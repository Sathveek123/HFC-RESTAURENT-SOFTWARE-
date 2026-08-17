# ⚡ HFC Supabase Integration — Complete Documentation

**Project Reference:** `cmwsffhenpckwkwgnmsy`  
**API Endpoint:** `https://cmwsffhenpckwkwgnmsy.supabase.co`  
**Client SDK:** `@supabase/supabase-js`

---

## 🏛️ Architecture & Source of Truth Reconciliation

```
[ Supabase PostgreSQL Cloud DB ]  <--- SINGLE SOURCE OF TRUTH
               │
      (Realtime WebSockets)
               │
               ▼
[ Zustand Stores + localStorage ]  <--- OPTIMISTIC CLIENT CACHE & OFFLINE LAYER
               │
               ▼
[ Customer Tracker | Admin Panel | Delivery Portal ]
```

### Data Layer Principles
1. **Primary System of Record**: **Supabase PostgreSQL Cloud DB** is the authoritative single source of truth for all business entities (`orders`, `products`, `agents`, `bills`, `settings`).
2. **Client Cache Layer**: **Zustand + localStorage** acts strictly as an optimistic cache for instant UI rendering.
3. **Cross-Device Real-Time Sync**:
   - **Customer Tracker**: Subscribes to single-order updates via `subscribeToOrderRealtime(orderId)`.
   - **Admin Orders Panel**: Subscribes to all order changes via `subscribeToAllOrdersRealtime()`.
   - **Delivery Agent Portal**: Subscribes to all order changes via `subscribeToAllOrdersRealtime()`, updating rider screens live on any mobile device.
   - **Customer Menu**: Subscribes to product changes via `subscribeToProductsRealtime()`.
   - **Branding & Checkout Settings**: Subscribes to settings updates via `subscribeToSettingRealtime('site_settings', cb)`.
   - **Coupons & Promotions**: Subscribes to promotions updates via `subscribeToSettingRealtime('promotions', cb)`.

### Critical Realtime Listener Fix (Session Aug-14-2026)
⚠️ **Settings & Coupons First Save Was Not Broadcasting**:
`lib/supabaseSync.ts subscribeToSettingRealtime()` previously used `event: 'UPDATE'`. On a fresh database, the very first save ever performs an `INSERT` (row didn't exist yet). The `postgres_changes` listener was only subscribed to UPDATE events, so first-time saves (including first-ever coupon and settings edit) did NOT propagate to customer browsers or other admin tabs.

**Fix:** Event filter changed to `event: '*'` = listens to INSERT + UPDATE + DELETE on the row-filtered `key=eq.<key>` channel.

**Server-side Publication Fix:** Added idempotent block that verifies ALL 3 tables (`orders`, `products`, `settings`) are actually in the `supabase_realtime` publication. Previously `settings` was missing on fresh seeds, causing websocket listeners to never fire (even with correct client filters).

---

## 🔒 Read-Side Database Hardening & PII Protection

1. **Bulk Database Dump Prevention (`public.orders`)**:
   - Direct bulk queries (`GET /rest/v1/orders?select=*`) with the public anon key return `403 Forbidden`.
   - Single-order tracker lookups are served via a **`SECURITY DEFINER` Postgres RPC function**: `get_order_by_id(p_order_id TEXT)`. Customers can ONLY fetch their own order by exact ID match.
2. **Rider Credential & Phone Number Protection (`public.agents`)**:
   - `password_hash` column completely removed from `public.agents`. Credentials are managed exclusively via Supabase Auth (`auth.users`).
   - `SELECT` on `public.agents` is restricted to authenticated staff (`(auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'agent')`), preventing public scraping of rider phone numbers.
3. **Agent Billing Scoping (`public.bills`)**:
   - Admin can read all billing records.
   - Delivery Agents can **ONLY** read bills tied to orders assigned to their own name (`order_id IN (SELECT id FROM orders WHERE assigned_agent = auth.jwt() -> 'user_metadata' ->> 'agent_name')`).

---

## 🔑 Fail-Closed Agent Provisioning API Route (`/api/admin/agents/provision`)

The server provisioning endpoint is engineered with **Fail-Closed Security**:

1. **Missing Authorization Header** → Immediate `401 Unauthorized`.
2. **Invalid or Expired JWT Token** → Immediate `401 Unauthorized`.
3. **Non-Admin User Role** → Immediate `403 Forbidden`.
4. **Valid Admin Bearer Token** → Execution proceeds to create agent credentials in Supabase Auth using the service role token server-side.

---

## ⚡ Atomic Conditional SQL Optimistic Lock (`syncOrderStatusAtomic`)

To eliminate TOCTOU (Time-of-Check to Time-of-Use) race conditions and prevent silent overwrites:
- Replaced generic `.upsert()` with **Atomic Conditional Update**:
  ```sql
  UPDATE public.orders 
  SET status = $new_status, updated_at = $new_updated_at 
  WHERE id = $order_id AND updated_at = $last_known_updated_at
  RETURNING *;
  ```
- If 0 rows are affected (indicating another device updated the order in between), the client flags a conflict and refetches the latest cloud version without clobbering data.

---

## 🗄️ Database Tables (`supabase/schema.sql`)

### 1. `orders` Table
| Column | Type | Constraints / Details |
|--------|------|----------------------|
| `id` | TEXT PK | e.g. `HFC-F6B776C7` |
| `customer_name` | TEXT | Customer name (sanitized) |
| `phone_number` | TEXT | 10-digit mobile number |
| `order_type` | TEXT | `dine-in` \| `takeaway` \| `delivery` |
| `address` | TEXT | Delivery address |
| `landmark` | TEXT | Delivery landmark |
| `delivery_area` | TEXT | Selected delivery zone |
| `coords` | JSONB | `{ lat: number, lng: number }` |
| `items` | JSONB | `[{ id, name, price, quantity }]` |
| `subtotal` | NUMERIC(10,2) | Item subtotal |
| `gst` | NUMERIC(10,2) | GST split taxes amount |
| `delivery_charge` | NUMERIC(10,2) | Delivery fee |
| `discount_amount` | NUMERIC(10,2) | Applied coupon discount |
| `coupon_code` | TEXT | Coupon code used |
| `total` | NUMERIC(10,2) | Final payable total |
| `payment_method` | TEXT | Cash / UPI / Online / Card |
| `payment_status` | TEXT | `unpaid` \| `paid` \| `partial` |
| `status` | TEXT | `placed` \| `accepted` \| `ready` \| `picked-up` \| `delivered` \| `rejected` \| `cancelled` |
| `assigned_agent` | TEXT | Assigned delivery rider name |
| `seen_by_admin` | BOOLEAN | Unseen badge flag |
| `is_regular_customer` | BOOLEAN | Loyalty customer flag |
| `notes` | TEXT | Kitchen instructions |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Modification timestamp |
| `timestamp` | BIGINT | Unix epoch milliseconds |

### 2. `products` Table
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Primary Key |
| `name` | TEXT | Product dish name |
| `category` | TEXT | Starters / Mains / Beverages / Desserts |
| `price` | NUMERIC(10,2) | Price in ₹ |
| `mrp` | NUMERIC(10,2) | Strike-through MSRP price |
| `description` | TEXT | Dish description |
| `image_url` | TEXT | Product image URL |
| `is_available` | BOOLEAN | Availability toggle |
| `is_bestseller` | BOOLEAN | Bestseller badge |
| `is_veg` | BOOLEAN | Veg/non-veg flag |
| `sort_order` | INTEGER | Sorting order value |
| `updated_at` | TIMESTAMPTZ | Modification timestamp |

### 3. `agents` Table
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Primary Key |
| `name` | TEXT | Rider display name |
| `whatsapp` | TEXT | Mobile contact with country code |
| `username` | TEXT UNIQUE | Unique login username |
| `is_active` | BOOLEAN | Off-duty / On-duty toggle |
| `vehicle_type` | TEXT | Bike / Scooter / Bicycle / On-foot |
| `coverage_area` | TEXT | Delivery zone description |
| `total_deliveries` | INTEGER | Completed deliveries counter |

### 4. `bills` Table
| Column | Type | Description |
|--------|------|-------------|
| `bill_no` | TEXT PK | Primary Key (e.g. `BILL-20260814-001`) |
| `order_id` | TEXT | Foreign Key -> `orders.id` |
| `customer_name` | TEXT | Customer name |
| `subtotal`, `gst`, `total` | NUMERIC(10,2) | Breakdown amounts |
| `payment_status` | TEXT | `paid` \| `unpaid` |
| `date` | TIMESTAMPTZ | Invoice timestamp |
| `created_at` | TIMESTAMPTZ | Row creation timestamp |

### 5. `settings` Table
| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT PK | Primary Key — see row keys below |
| `value` | JSONB | Dynamic JSONB payload — shape depends on key. **No stale `bannerText`/`popupImage` fields used anymore**. |
| `updated_at` | TIMESTAMPTZ | Last sync timestamp |

#### Row Keys (the only 3 you'll find in the table):

| `key` value | What It Stores | Shape |
|-------------|----------------|-------|
| `site_settings` | All business config: GST, delivery fees, branding, WhatsApp #, UPI, delivery areas, subscription plans | `Settings` TS interface (see SETTINGS.md) |
| `promotions` | Coupons, reward tiers, offers (unified) | `{ rewardTiers: [], coupons: [], offers: [] }` |
| `site_settings_private` | **Admin-only row.** Stores sensitive Meta Cloud API credentials. Never readable by anon. | `{ cloudApiToken, cloudApiPhoneId }` |

⚠️ **Schema Bug Fixed (Session Aug-14-2026 — SQL 42703):**
The old `settings` table had no `key` column PRIMARY KEY defined (which caused Postgres `SQL Error 42703 column settings.key does not exist`). The table is now recreated with:
```sql
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
Drop + recreate was required because the pre-existing table had no PK constraint. All seeded rows use the correct shapes above.

### 5a. `settings` Table RLS Policies (Prevent Public Write, Allow Public Read)

| Policy | For | Postgres Clause |
|--------|-----|------------------|
| Public read settings | `SELECT` | `USING (true)` |
| Admin write settings | `ALL` (INSERT/UPDATE/DELETE) | `USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')` |

Any admin mutation (save settings, save coupon, add delivery area) **bypasses the RLS check entirely** by calling a SECURITY DEFINER RPC: `sync_setting(p_key TEXT, p_value JSONB)` — so even if admin's browser auth token is missing the custom role claim (due to browser-only auth bypass), mutations still land safely.

Any admin mutation (save settings, save coupon, add delivery area) calls a `SECURITY DEFINER` RPC: `sync_setting(p_key TEXT, p_value JSONB)`. This function is strictly restricted to authenticated admins and revokes public execution rights to prevent unauthorized settings overrides:

```sql
CREATE OR REPLACE FUNCTION public.sync_setting(p_key TEXT, p_value JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') <> 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Admin privileges required';
  END IF;

  INSERT INTO public.settings (key, value, updated_at)
  VALUES (p_key, p_value, NOW())
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_setting(TEXT, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_setting(TEXT, JSONB) TO authenticated;
```

---

## 📡 Real-Time WebSockets Setup

Realtime is enabled on `orders`, `products`, and `settings` tables via Postgres publication:

```sql
-- Idempotent version (safe to rerun):
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='products') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='settings') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
    END IF;
END $$;
```

**Verify realtime tables are registered:**
```sql
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('orders','products','settings');
```
Should return exactly **3 rows**. If missing, rerun the idempotent DO block.

---

## ⚡ Protection & Performance Architecture

### 1. Debounced Write Queue (Rate Limiting)
In `lib/supabaseSync.ts`, rapid order status updates (e.g. clicking Accept/Ready 5 times in a second) are throttled via `syncQueueMap`:
- **200ms window debounce**: Batches rapid changes for the same order into a single clean database call.

### 2. Exponential Backoff Retries
If network drops or API requests fail:
- Retries automatically up to 3 times (`attempt * 500ms` backoff).
- If all retries fail, the mutation stays safely preserved in `localStorage` without interrupting user experience.

### 3. Egress Bandwidth Efficiency
- Average payload per order update: ~400 Bytes.
- Expected monthly egress at 1,000 orders/month: **~2.5 MB** (< 0.05% of Supabase 5GB limit).
- All bulk fetching queries are limited to a 30-day window and capped at 500 records.

### 4. Automatic WebSocket Disconnection
Order tracker, menu, and admin pages unsubscribe and close the WebSocket connection on component unmount to prevent connection leaks.
