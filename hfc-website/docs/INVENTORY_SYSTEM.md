# 🏭 HFC Restaurant Software Inventory & Recipe Management System

## Overview
The HFC Inventory and Recipe Management System is a premium, real-time variance detection platform built directly on Supabase PostgreSQL and Next.js. It automatically tracks raw material consumption based on dynamic order menu items, calculates end-of-day kitchen wastage, flags unexplained shrinkage, and provides automated WhatsApp procurement plans.

To guarantee absolute security and accountability, the system enforces database-level immutability triggers, rate-limited PIN checks, and strict operational countdown windows.

---

## 🗺️ System Architecture

The inventory system operates through a structured loop of actions split between Admin operations, storefront sales, and KDS (Kitchen Display System) closing audits:

```
┌──────────────────────────────────────────────────────────────────┐
│                      1. Owner / Admin Panel                      │
│               - Configures ingredients cost & categories         │
│               - Maps menu items to raw recipe quantities         │
│               - logs opening stock + inward vendor invoices      │
└───────────────────────────────┬──────────────────────────────────┘
                                │ Clicks "Lock Stock"
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                      2. Storefront / Cart                        │
│               - Customers order Butter Chicken, Paneer, etc.     │
│               - System dynamically calculates recipe depletion  │
└───────────────────────────────┬──────────────────────────────────┘
                                │ Operations run (countdown active)
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     3. End of Day: Kitchen                       │
│               - Locked during day; opens 10 PM - 4 AM            │
│               - Verified via secure server-side RPC PIN check    │
│               - Staff enter physical weights (expected is hidden)│
└───────────────────────────────┬──────────────────────────────────┘
                                │ Clicks "Submit Closing"
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│               4. Reconciliation & Procurements                   │
│               - Discrepancy logged: cost, wastage, shrinkage     │
│               - Critical variance triggers WhatsApp owner alert  │
│               - Next-day purchase lists calculated (+20% safety) │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema & Rules (`supabase/schema.sql`)

### 1. Table Definitions

```sql
-- 1. Ingredients Master List
CREATE TABLE IF NOT EXISTS public.ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,          -- 'KG', 'L', 'G', 'PCS'
  category TEXT,               -- 'Protein', 'Oil', 'Dry', 'Veg', 'Spices'
  cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Daily Opening Stock Entries
CREATE TABLE IF NOT EXISTS public.stock_entries (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  ingredient_id TEXT REFERENCES public.ingredients(id) ON DELETE CASCADE,
  opening_qty NUMERIC(10,3) NOT NULL DEFAULT 0,
  inward_qty NUMERIC(10,3) NOT NULL DEFAULT 0,
  total_available NUMERIC(10,3) NOT NULL DEFAULT 0,
  supplier TEXT,
  purchase_rate NUMERIC(10,2),
  invoice_no TEXT,
  entered_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_date_ingredient_stock UNIQUE (date, ingredient_id)
);

-- 3. Recipes Map (menu items -> ingredient weights)
CREATE TABLE IF NOT EXISTS public.recipes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  ingredient_id TEXT REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity_per_unit NUMERIC(10,4) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_product_ingredient_recipe UNIQUE (product_id, ingredient_id)
);

-- 4. Kitchen EOD Closing Submissions
CREATE TABLE IF NOT EXISTS public.kitchen_closing (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  ingredient_id TEXT REFERENCES public.ingredients(id) ON DELETE CASCADE,
  theoretical_consumed NUMERIC(10,3) NOT NULL DEFAULT 0,
  actual_remaining NUMERIC(10,3) NOT NULL DEFAULT 0,
  actual_consumed NUMERIC(10,3) NOT NULL DEFAULT 0,
  wastage_reported NUMERIC(10,3) DEFAULT 0,
  wastage_reason TEXT,
  discrepancy NUMERIC(10,3) NOT NULL DEFAULT 0,
  discrepancy_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by_admin BOOLEAN DEFAULT FALSE,
  CONSTRAINT unique_date_ingredient_closing UNIQUE (date, ingredient_id)
);

-- 5. Daily Stock Audits Summary
CREATE TABLE IF NOT EXISTS public.daily_stock_summary (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  ingredient_id TEXT REFERENCES public.ingredients(id) ON DELETE CASCADE,
  opening_qty NUMERIC(10,3) NOT NULL DEFAULT 0,
  inward_qty NUMERIC(10,3) NOT NULL DEFAULT 0,
  theoretical_consumed NUMERIC(10,3) NOT NULL DEFAULT 0,
  actual_consumed NUMERIC(10,3) NOT NULL DEFAULT 0,
  wastage NUMERIC(10,3) NOT NULL DEFAULT 0,
  closing_qty NUMERIC(10,3) NOT NULL DEFAULT 0,
  discrepancy NUMERIC(10,3) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_date_ingredient_summary UNIQUE (date, ingredient_id)
);

-- 6. Kitchen Staff Directory
CREATE TABLE IF NOT EXISTS public.kitchen_staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Staff Credentials (Zero-SELECT policies on client to prevent credentials leakage)
CREATE TABLE IF NOT EXISTS public.kitchen_staff_credentials (
  staff_id TEXT PRIMARY KEY REFERENCES public.kitchen_staff(id) ON DELETE CASCADE,
  pin TEXT NOT NULL
);
```

### 2. 🔐 Row-Level Security (RLS) & Access Controls
*   **Ingredients & Recipes**: SELECT read access is granted to all authenticated staff (riders, kitchen, admins). Write paths (INSERT/UPDATE/DELETE) are restricted strictly to `role = 'admin'`.
*   **Kitchen Credentials**: RLS is fully enabled with **zero policies**. No client role can execute SELECT or query the PIN column in any form.

### 3. 🚨 Rate-Limited PIN Verification RPC
Verification is performed server-side via a Postgres Security Definer function to mitigate client-side script inspection. If five consecutive incorrect PIN entry attempts occur, the staff account is locked out for 15 minutes:

```sql
CREATE OR REPLACE FUNCTION public.verify_staff_pin(p_staff_id TEXT, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_db_pin TEXT;
  v_locked_until TIMESTAMPTZ;
  v_failed_attempts INTEGER;
  v_success BOOLEAN := FALSE;
BEGIN
  -- 1. Check account lockout status
  SELECT locked_until, failed_attempts INTO v_locked_until, v_failed_attempts
  FROM public.kitchen_staff
  WHERE id = p_staff_id;

  IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
    RAISE EXCEPTION 'Staff account is locked out due to too many failed attempts. Try again in 15 minutes.';
  END IF;

  -- 2. Fetch PIN
  SELECT pin INTO v_db_pin
  FROM public.kitchen_staff_credentials
  WHERE staff_id = p_staff_id;

  -- 3. Verify
  IF v_db_pin = p_pin THEN
    UPDATE public.kitchen_staff
    SET failed_attempts = 0, locked_until = NULL
    WHERE id = p_staff_id;
    v_success := TRUE;
  ELSE
    IF v_failed_attempts + 1 >= 5 THEN
      UPDATE public.kitchen_staff
      SET failed_attempts = v_failed_attempts + 1, locked_until = NOW() + INTERVAL '15 minutes'
      WHERE id = p_staff_id;
    ELSE
      UPDATE public.kitchen_staff
      SET failed_attempts = v_failed_attempts + 1
      WHERE id = p_staff_id;
    END IF;
  END IF;

  RETURN v_success;
END;
$$;
```

### 4. 🔏 Immutability Trigger Locks (Append-Only Logs)
To guarantee data integrity and prevent tampering, EOD records cannot be modified or deleted once logged:

```sql
-- Block UPDATE
CREATE OR REPLACE FUNCTION public.prevent_kitchen_closing_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Immutability Violation: Submitted kitchen closing counts cannot be modified or updated.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_kitchen_closing_update
BEFORE UPDATE ON public.kitchen_closing
FOR EACH ROW EXECUTE FUNCTION public.prevent_kitchen_closing_update();

-- Block DELETE
CREATE OR REPLACE FUNCTION public.prevent_kitchen_closing_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Immutability Violation: Submitted kitchen closing counts cannot be deleted or wiped.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_kitchen_closing_delete
BEFORE DELETE ON public.kitchen_closing
FOR EACH ROW EXECUTE FUNCTION public.prevent_kitchen_closing_delete();
```

---

## 🧪 Business Logic & Calculations

### 1. Dynamic Depletion Engine (`lib/inventoryHelpers.ts`)
Calculations are executed on-the-fly dynamically to eliminate database query latency.
*   **Idempotency & Reversals**: The engine only reads orders where `status != 'rejected'` and `status != 'cancelled'`. If an order is canceled or rejected, it is immediately ignored by the filter, restoring ingredients back to the available inventory pool automatically.

```typescript
// Map ingredient quantities consumed based on order details
export function calculateTheoreticalConsumption(orders: Order[], recipes: Recipe[]): Map<string, number> {
  const map = new Map<string, number>()
  
  orders.forEach(order => {
    order.items.forEach(item => {
      // Find all recipe mappings for item
      const ingredientMappings = recipes.filter(r => r.productId === item.id)
      ingredientMappings.forEach(m => {
        const totalConsumed = m.quantityPerUnit * item.quantity
        const prev = map.get(m.ingredientId) || 0
        map.set(m.ingredientId, prev + totalConsumed)
      })
    })
  })
  
  return map;
}
```

### 2. Discrepancy & Shrinkage Cost Logic
Variance levels determine operational loss metrics:
$$\text{Expected Consumed} = \text{Theoretical Consumed} + \text{Reported Wastage}$$
$$\text{Actual Consumed} = \text{Opening Balance} + \text{Inward Qty} - \text{Physical Count}$$
$$\text{Discrepancy} = \text{Actual Consumed} - \text{Expected Consumed}$$
$$\text{Shrinkage Cost Value} = \text{Discrepancy} \times \text{Ingredient Cost Per Unit}$$

---

## ⏳ Kitchen Closing Operating Hours & Lockout
The EOD Closing sheet contains a real-time countdown clock and locks submissions during standard business hours:
*   **Operating Window**: Opens strictly at **10:00 PM (22:00)** and locks at **4:00 AM (04:00)** daily.
*   **Countdown Clock**: Ticks down dynamically to 10:00 PM.
*   **Admin Override Bypass**: Owners logged in with `role === 'admin'` can bypass the window constraint to verify the page layout or perform audits.

---

## 📣 Real-time Owner WhatsApp Warning Alerts
On closing submission, the system evaluates the discrepancy variables. If any variance is critical:
*   **Discrepancy Percentage** $> 8\%$ of total available stock.
*   **Shrinkage Loss Value** $> ₹500$ INR.

The system automatically triggers a WhatsApp API redirect window to notify the owner:
```
⚠️ *HFC Inventory Discrepancy Alert!*

Critical variances detected in EOD counts submitted by Sathveek today:
- Fresh Chicken: Variance of 2.50 KG (Value: -₹625)

Please check reports dashboard: https://hfc-website-two.vercel.app/admin/inventory/reports
```

---

## 🚀 Deployed URL Directory
*   **Customer Storefront**: `https://hfc-website-two.vercel.app/`
*   **Admin Portal**: `https://hfc-website-two.vercel.app/admin/login`
*   **KDS closing sheet**: `https://hfc-website-two.vercel.app/admin/kitchen/closing`
*   **Inventory Dashboard**: `https://hfc-website-two.vercel.app/admin/inventory`
*   **Purchase Assistant**: `https://hfc-website-two.vercel.app/admin/inventory/purchase`
