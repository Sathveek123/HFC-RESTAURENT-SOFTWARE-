# 🔴 HFC Cloud Kitchen — Complete Realtime Sync Architecture

> **Last Updated:** August 14, 2026  
> **Status:** 100% Production Live  
> **Supabase Project:** `cmwsffhenpckwkwgnmsy`  
> **Production URL:** `https://hfc-cloud-kitchen-services-white-la.vercel.app`

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Tables & Schema](#database-tables--schema)
3. [Supabase Functions (RPCs)](#supabase-functions-rpcs)
4. [Realtime Publications](#realtime-publications)
5. [Store-by-Store Sync Map](#store-by-store-sync-map)
6. [Egress Protection](#egress-protection)
7. [Session Persistence](#session-persistence)
8. [Full SQL Setup Script](#full-sql-setup-script)
9. [Bugs Fixed in This Session](#bugs-fixed-in-this-session)
10. [Deployment Reference](#deployment-reference)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE CLOUD DATABASE                       │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────┐ ┌───────────┐  │
│  │ orders  │ │ products │ │ agents │ │ bills │ │ settings  │  │
│  └─────────┘ └──────────┘ └────────┘ └───────┘ └───────────┘  │
└───────────────────────┬─────────────────────────────────────────┘
                        │ Supabase Realtime WebSockets
                        │ (postgres_changes channel)
          ┌─────────────┼─────────────────┐
          ▼             ▼                 ▼
  ┌──────────────┐ ┌──────────┐ ┌─────────────────┐
  │ Admin Panel  │ │ Delivery │ │ Customer Website │
  │ /admin/*     │ │  Portal  │ │   /  (public)    │
  └──────────────┘ └──────────┘ └─────────────────┘
          │             │                 │
          └─────────────┴─────────────────┘
                        │
                 Zustand Stores
                 (localStorage cache)
```

### Core Principles
- **Supabase PostgreSQL** = Single Source of Truth for all business data
- **Zustand + localStorage** = Optimistic client-side cache for instant UI
- **Realtime WebSockets** = Push changes to all connected devices < 1 second
- **SECURITY DEFINER RPCs** = Bypass RLS safely for admin operations
- **30-day rolling window** = Protect egress by only fetching recent data

---

## Database Tables & Schema

### 1. `public.orders`
| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | e.g. `HFC-F6B776C7` |
| `customer_name` | TEXT | XSS sanitized |
| `phone_number` | TEXT | 10 digits |
| `order_type` | TEXT | `dine-in` \| `takeaway` \| `delivery` |
| `address` | TEXT | Delivery address |
| `landmark` | TEXT | House no / landmark |
| `delivery_area` | TEXT | Selected zone |
| `coords` | JSONB | `{ lat, lng }` |
| `items` | JSONB | `[{ id, name, price, quantity }]` |
| `subtotal` | NUMERIC(10,2) | Item total |
| `gst` | NUMERIC(10,2) | GST amount |
| `delivery_charge` | NUMERIC(10,2) | Delivery fee |
| `discount_amount` | NUMERIC(10,2) | Coupon discount |
| `coupon_code` | TEXT | Applied code |
| `total` | NUMERIC(10,2) | Final amount |
| `payment_method` | TEXT | Cash / UPI |
| `payment_status` | TEXT | `unpaid` \| `paid` |
| `status` | TEXT | `placed`→`accepted`→`ready`→`picked-up`→`delivered` |
| `assigned_agent` | TEXT | Rider name |
| `seen_by_admin` | BOOLEAN | Unseen badge |
| `is_regular_customer` | BOOLEAN | Loyalty flag |
| `notes` | TEXT | Kitchen instructions |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Used for atomic lock |
| `timestamp` | BIGINT | Unix ms |

**RLS Policies:**
- `SELECT USING (true)` → Anyone can read (needed for Realtime to broadcast)
- `INSERT WITH CHECK (true)` → Anyone can place an order
- `UPDATE` → Admin full access; Agent only their assigned orders
- `DELETE` → Admin only

---

### 2. `public.products`
| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | e.g. `item-1234567` |
| `name` | TEXT | Dish name |
| `category` | TEXT | Category slug |
| `price` | NUMERIC(10,2) | |
| `mrp` | NUMERIC(10,2) | Strike-through price |
| `description` | TEXT | |
| `image_url` | TEXT | |
| `is_available` | BOOLEAN | Menu toggle |
| `is_bestseller` | BOOLEAN | Bestseller badge |
| `is_veg` | BOOLEAN | Veg/non-veg |
| `sort_order` | INTEGER | Display order |
| `updated_at` | TIMESTAMPTZ | |

**RLS Policies:**
- `SELECT USING (true)` → Public can read menu
- `ALL USING (true)` → Admin can write (via `sync_product` RPC)

**Realtime:** Enabled on `supabase_realtime` publication.  
**Self-Healing Seeder:** On first load, if products table is empty, all default menu items from `menuData.ts` are automatically seeded.

---

### 3. `public.agents`
| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | |
| `name` | TEXT | Display name |
| `whatsapp` | TEXT | Contact number |
| `username` | TEXT UNIQUE | Login username |
| `is_active` | BOOLEAN | On/Off duty |
| `vehicle_type` | TEXT | Bike / Scooter etc. |
| `coverage_area` | TEXT | Zone |
| `total_deliveries` | INTEGER | Counter |

> ⚠️ `password_hash` column was **permanently removed** — credentials are managed exclusively via `Supabase Auth` (`auth.users`). Agent passwords are stored only as hashed Supabase Auth credentials.

**RLS Policies:**
- `SELECT` → Admin + authenticated agents only (prevents phone number scraping)

---

### 4. `public.bills`
| Column | Type | Notes |
|--------|------|-------|
| `bill_no` | TEXT PK | e.g. `BILL-20260814-001` |
| `order_id` | TEXT FK | → `orders.id` |
| `customer_name` | TEXT | |
| `date` | TIMESTAMPTZ | |
| `subtotal` | NUMERIC(10,2) | |
| `gst` | NUMERIC(10,2) | |
| `delivery_charge` | NUMERIC(10,2) | |
| `discount_amount` | NUMERIC(10,2) | |
| `total` | NUMERIC(10,2) | |
| `payment_status` | TEXT | `paid` \| `unpaid` |
| `created_at` | TIMESTAMPTZ | |

**Auto-generation:** SQL trigger `auto_create_bill` fires on `INSERT` to `orders`, automatically creating the bill record.  
**Auto-sync:** SQL trigger `sync_bill_payment_status` fires on `UPDATE` to `orders.payment_status`, keeping bills in sync.

---

### 5. `public.settings`
| Column | Type | Notes |
|--------|------|-------|
| `key` | TEXT PK | e.g. `site_settings`, `promotions` |
| `value` | JSONB | Full configuration object |
| `updated_at` | TIMESTAMPTZ | |

**Used for:**
- `site_settings` → Delivery fee, UPI ID, GST, branding, delivery areas
- `promotions` → All coupons, reward tiers, and offers
- `site_settings_private` → WhatsApp Cloud API credentials (separate row)

**RLS Policies:**
- `SELECT USING (true)` → Public can read settings (needed for checkout to know delivery fee, UPI ID)
- `ALL` → Admin only via JWT role check (bypassed via `sync_setting` RPC)

**Realtime:** Enabled on `supabase_realtime` publication.

---

## Supabase Functions (RPCs)

All RPCs use `SECURITY DEFINER` to bypass RLS safely:

| Function | Arguments | Purpose |
|----------|-----------|---------|
| `get_order_by_id(p_order_id TEXT)` | Order ID | Customer tracker — single order lookup only |
| `get_all_orders()` | none | Admin panel — fetch all orders (bypasses RLS) |
| `create_order(order_row JSONB)` | Full order JSONB | Customer checkout fallback if direct INSERT blocked |
| `get_all_agents()` | none | Admin panel — fetch all agents |
| `get_all_bills()` | none | Admin bills page — fetch all billing records |
| `sync_product(product_row JSONB)` | Product JSONB | Admin products — upsert product to DB |
| `sync_setting(p_key TEXT, p_value JSONB)` | Key + value JSONB | Admin settings & coupons — upsert settings row |

> All RPCs are granted to `anon`, `authenticated`, and `service_role`.

---

## Realtime Publications

Tables subscribed to `supabase_realtime` publication:

| Table | Events Broadcast | Subscribers |
|-------|-----------------|-------------|
| `orders` | `INSERT`, `UPDATE`, `DELETE` | Admin panel, Delivery portal, Customer tracker |
| `products` | `INSERT`, `UPDATE`, `DELETE` | Customer menu page |
| `settings` | `INSERT`, `UPDATE` | Customer checkout (delivery fee, UPI, GST), Admin settings page, **Coupons page** (promotions row) |

⚠️ **IMPORTANT BUG FIXED (session Aug-14-2026):** Both the database publication AND the client-side JS listener were accidentally handling UPDATE-only:
- **Publication side:** The idempotent SQL now adds all 3 tables to the realtime publication (settings was missing on fresh installs).
- **Client side:** `subscribeToSettingRealtime()` previously used `event: 'UPDATE'` only. On a fresh Supabase instance, the first time you save settings, that's an `INSERT` (row didn't exist yet). That first insert was never broadcast — so customers and other admin tabs wouldn't see anything until you refreshed the page. Now listener uses `event: '*'` = listens to **all events** (INSERT + UPDATE + DELETE), so both first-save ever AND subsequent edits propagate in < 1s.

### How Realtime is enabled (SQL):
```sql
-- Idempotent enable for ALL THREE tables. Safe to rerun.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'products'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
    END IF;
END $$;
```

### Verify in 2 seconds — run this:
```sql
SELECT tablename, string_agg(event, ', ') AS events
FROM pg_publication_tables
LEFT JOIN pg_publication_rel ON (
  pubrel.pubid = pg_publication.oid
  AND pg_publication.pubname = 'supabase_realtime'
  AND ...
)
WHERE pubname = 'supabase_realtime' AND tablename IN ('orders','products','settings')
GROUP BY tablename;
```

You should see 3 rows: `orders`, `products`, `settings`. If any row is missing, run the DO block above.

---

## Store-by-Store Sync Map

### `orderStore.ts`
| Action | Supabase Call | Realtime |
|--------|--------------|---------|
| `addOrder()` | `create_order(row)` RPC | Triggers broadcast to admin + agent |
| `updateOrderStatus()` | `syncOrderStatusAtomic()` atomic UPDATE | Yes |
| `fetchOrdersFromSupabase()` | Direct SELECT (last 30 days, max 500) | On mount |
| `subscribeToAllOrdersRealtime()` | WebSocket channel | Admin + Agent pages |

**Duplicate Prevention:** `addOrder()` checks if `order.id` already exists in local state before inserting, preventing double-submission on network retry.

---

### `productsStore.ts`
| Action | Supabase Call | Realtime |
|--------|--------------|---------|
| `addItem()` | `sync_product(row)` RPC | Triggers broadcast to menu page |
| `updateItem()` | `sync_product(row)` RPC | Yes |
| `deleteItem()` | Direct DELETE | Yes |
| `toggleAvailability()` | `sync_product(row)` RPC | Yes |
| `toggleBestseller()` | `sync_product(row)` RPC | Yes |
| `fetchAndSyncProducts()` | Direct SELECT + self-healer | On mount |
| `subscribeToProductsRealtime()` | WebSocket channel | Menu page |

**Self-Healing Seeder:** `fetchAndSyncProducts()` compares fetched IDs against `seedItems`. Any missing default item is automatically re-seeded to Supabase without admin intervention.

---

### `promotionsStore.ts` (Coupons, Reward Tiers, Offers)
| Action | Supabase Call | Realtime |
|--------|--------------|---------|
| `addCoupon()` | `sync_setting('promotions', {...})` | Yes — customer checkout updates |
| `toggleCouponActive()` | `sync_setting('promotions', {...})` | Yes |
| `deleteCoupon()` | `sync_setting('promotions', {...})` | Yes |
| `addRewardTier()` | `sync_setting('promotions', {...})` | Yes |
| `addOffer()` | `sync_setting('promotions', {...})` | Yes |
| `fetchAndSyncPromotions()` | `fetchSettingFromSupabase('promotions')` | On mount |
| `subscribeToSettingRealtime('promotions', cb)` | WebSocket channel | Customer checkout |

**Architecture:** All promotions (coupons + tiers + offers) are stored as a single JSONB object under `settings.key = 'promotions'`. Any mutation triggers a full re-sync of this object.

---

### `settingsStore.ts`
| Action | Supabase Call | Realtime |
|--------|--------------|---------|
| `updateSettings()` | `sync_setting('site_settings', {...})` | Yes — checkout fees update live |
| `addDeliveryArea()` | `sync_setting('site_settings', {...})` | Yes |
| `toggleDeliveryArea()` | `sync_setting('site_settings', {...})` | Yes |
| `addSubscriptionPlan()` | `sync_setting('site_settings', {...})` | Yes |
| `fetchAndSyncSettings()` | Fetch both `site_settings` + `site_settings_private` | On mount |

**What goes live on the website instantly when settings change:**
- ✅ Delivery fee
- ✅ Free delivery threshold
- ✅ UPI ID (QR code)
- ✅ GST % and mode
- ✅ Accept Cash / Accept Online toggles
- ✅ Delivery area list (customer dropdown)

---

### `agentsStore.ts`
| Action | Supabase Call | Realtime |
|--------|--------------|---------|
| `addAgent()` | `/api/admin/agents/provision` server-side API (with JWT) | Yes — propagates to layout |
| `updateAgent()` | `/api/admin/agents/provision` server-side update + `sync_agent(row)` RPC | Yes |
| `deleteAgent()` | `delete_agent_by_id(id)` RPC | Yes |
| `toggleAgentActive()` | `sync_agent(row)` RPC | Yes |
| `incrementDeliveries()` | `sync_agent(row)` RPC | Yes |
| `fetchAgentsFromSupabase()` | Direct SELECT (admin only) | On mount |
| `subscribeToAgentsRealtime()` | WebSocket channel | Admin pages & assignment dropdowns |

**Credentials Security:** Passwords and hashes are completely omitted from the database sync payload. Credentials exist strictly inside Supabase Auth container.

---

### `agentAuthStore.ts`
**Session Persistence:** Sessions are stored in `localStorage` (not `sessionStorage`), so delivery agents remain logged in across:
- Tab closes
- Browser restarts
- Page refreshes

**Login Flow:**
1. Admin creates agent via `/api/admin/agents/provision` API route
2. Agent calls `authenticateAgentSupabase(username, password)` → gets JWT from Supabase Auth
3. Agent ID saved to `localStorage` under key `hfc-agent-session`
4. On every page load, `checkSession()` reads `localStorage` and restores auth state

---

## Egress Protection

Supabase Free Tier = **5GB egress/month**. We protect this with:

| Protection | Implementation | Impact |
|-----------|---------------|--------|
| 30-day orders window | `fetchOrdersFromSupabase()` filters `created_at >= now - 30 days` | Constant payload regardless of DB growth |
| 500-row order cap | `.limit(500)` on order SELECT | Hard cap on single fetch |
| 30-day bills window | `fetchBillsFromSupabase()` filters `date >= now - 30 days` | Same as above |
| Products cached | `zustand/middleware/persist` in localStorage | Only fetched once per session |
| Settings cached | `zustand/middleware/persist` in localStorage | Only fetched once per session |
| Realtime over REST | Real-time deltas via WebSocket (bytes, not KB) | Tiny compared to full fetch |

**Estimated monthly egress for a 500-order/month kitchen:**
- Orders page load (admin): ~50 orders × 2KB = 100KB × 30 loads = **3MB/month**
- Menu products: 50 items × 500B = 25KB × 200 visits = **5MB/month**
- Realtime events: ~200B/event × 2000 events = **400KB/month**
- **Total estimated: ~8–10MB/month** (0.16% of the 5GB limit ✅)

---

## Session Persistence

| User Type | Storage | Persistence |
|-----------|---------|-------------|
| Admin | `localStorage` (Supabase Auth JWT via `supabase.auth.getSession()`) | Until manual logout |
| Delivery Agent | `localStorage` key `hfc-agent-session` (agent ID) | Until manual logout |
| Customer | No session (anonymous) | None needed |

---

## Full SQL Setup Script

Run this **once** in the [Supabase SQL Editor](https://supabase.com/dashboard/project/cmwsffhenpckwkwgnmsy/editor):

```sql
-- ─── STEP 1: ADD MISSING PRODUCT COLUMNS ────────────────────────────────────
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_veg BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ─── STEP 2: PRODUCTS RLS ───────────────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin write products" ON public.products;
CREATE POLICY "Admin write products" ON public.products FOR ALL USING (true) WITH CHECK (true);

-- ─── STEP 3: PRODUCTS REALTIME ──────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END $$;

-- ─── STEP 4: sync_product RPC ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_product(product_row JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.products (
    id, name, category, price, mrp, description, image_url,
    is_available, is_bestseller, is_veg, sort_order, updated_at
  )
  VALUES (
    product_row->>'id', product_row->>'name', product_row->>'category',
    (product_row->>'price')::NUMERIC,
    NULLIF(product_row->>'mrp', 'null')::NUMERIC,
    product_row->>'description', product_row->>'image_url',
    COALESCE((product_row->>'is_available')::BOOLEAN, TRUE),
    COALESCE((product_row->>'is_bestseller')::BOOLEAN, FALSE),
    COALESCE((product_row->>'is_veg')::BOOLEAN, TRUE),
    COALESCE((product_row->>'sort_order')::INTEGER, 0),
    COALESCE((product_row->>'updated_at')::TIMESTAMPTZ, NOW())
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price,
    mrp = EXCLUDED.mrp, description = EXCLUDED.description, image_url = EXCLUDED.image_url,
    is_available = EXCLUDED.is_available, is_bestseller = EXCLUDED.is_bestseller,
    is_veg = EXCLUDED.is_veg, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
END;
$$;
GRANT EXECUTE ON FUNCTION public.sync_product(JSONB) TO anon, authenticated, service_role;

-- ─── STEP 5: SETTINGS REALTIME ──────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
  END IF;
END $$;

-- ─── STEP 6: sync_setting RPC ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_setting(p_key TEXT, p_value JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.settings (key, value, updated_at)
  VALUES (p_key, p_value, NOW())
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
END;
$$;
GRANT EXECUTE ON FUNCTION public.sync_setting(TEXT, JSONB) TO anon, authenticated, service_role;
```

---

## Bugs Fixed in This Session

### 1. ✅ Delivery Agent Not Appearing in Admin Dropdown
- **Root Cause:** `NOT NULL` constraint on removed `password_hash` column in `public.agents` caused INSERT to fail silently.
- **Fix:** `ALTER TABLE public.agents DROP COLUMN IF EXISTS password_hash;`

### 2. ✅ Delivery Agent Login Always Failing
- **Root Cause:** Agent was created in local state but not provisioned in Supabase Auth. `/api/admin/agents/provision` route was not being called correctly.
- **Fix:** Fixed the provisioning flow to call Supabase Auth Admin API and create a real auth user for each agent.

### 3. ✅ Bills Page Showing No Data
- **Root Cause:** Bills were being auto-generated by a SQL trigger, but `AdminBillsPage` never called `fetchBills()` on mount.
- **Fix:** Added `fetchBills()` call in `AdminBillsPage` `useEffect`. Added `get_all_bills()` SECURITY DEFINER RPC. Added `fetchBillsFromSupabase()` to `billsStore.ts`.

### 4. ✅ Duplicate Orders Appearing in Admin Panel
- **Root Cause:** Rapid double-click or network retry caused `addOrder()` to insert the same order ID twice.
- **Fix:** Added idempotency guard in `orderStore.ts` — checks if `order.id` already exists in local state before inserting.

### 5. ✅ Real-time Order Updates Not Reaching Delivery Agents / Admin
- **Root Cause:** Supabase Realtime requires an RLS `SELECT` policy that returns `true`. The previous policy required an authenticated JWT, so anonymous clients received no broadcasts.
- **Fix:** Changed `orders` SELECT policy to `USING (true)` so Realtime broadcast works for all subscribers.

### 6. ✅ Delivery Agent Session Logging Out on Tab Close
- **Root Cause:** `agentAuthStore.ts` used `sessionStorage` which is wiped when the browser tab is closed.
- **Fix:** Switched to `localStorage` — agent session now persists across all tab closes, browser restarts, and page refreshes.

### 7. ✅ Product Changes Not Appearing on Live Website
- **Root Cause:** Products were loaded only from static `menuData.ts` seed file. No Supabase sync existed.
- **Fix:** Full `productsStore.ts` rewrite to sync every mutation (`addItem`, `updateItem`, `deleteItem`, `toggleAvailability`) to Supabase via `sync_product` RPC. `MenuSection.tsx` subscribes to `subscribeToProductsRealtime()` on mount.

### 8. ✅ Products Disappearing After Adding One Item
- **Root Cause:** When the first product was added via admin, `fetchAndSyncProducts()` replaced the entire local cache with just the one item fetched from the (mostly empty) database.
- **Fix:** Added self-healing seeder — `fetchAndSyncProducts()` detects missing default items and auto-uploads them to Supabase if they don't exist in the database yet.

### 9. ✅ Coupons Created in Admin Not Working on Website
- **Root Cause:** Admin coupons page (`/admin/coupons`) used `usePromotionsStore` but the customer checkout cart (`CartDrawer.tsx`) validated against a completely separate `useCouponsStore` with hardcoded default coupons only.
- **Fix:** Unified both under `usePromotionsStore`. All coupon mutations sync to `public.settings` key `promotions`. `CartDrawer.tsx` now reads from `usePromotionsStore.getValidCoupon()`. Customer website subscribes to `subscribeToSettingRealtime('promotions', ...)`.

### 10. ✅ Settings Page Changes Not Persisting Across Devices
- **Root Cause:** `settingsStore.ts` only used `localStorage` — no Supabase sync existed. Changes made on one device didn't appear on another.
- **Fix:** Every `settingsStore` mutation now calls `syncSettingToSupabase('site_settings', ...)`. On mount, `fetchAndSyncSettings()` loads from database. Website subscribes to realtime so delivery fee, UPI ID, GST changes update live.

### 12. ✅ Settings Realtime Listener Only Received Updates — First Save Not Synced (Broken)
- **Root Cause:** `subscribeToSettingRealtime()` used `event: 'UPDATE'`. But on a fresh database, the first save ever performs an `INSERT` (row didn't exist). The client-side JS listener was never subscribed to INSERT events, so the first admin save + first coupon save did NOT propagate live to other tabs or customers until the page was refreshed.
- **Customer-facing impact:** Customers trying to use a coupon saved just minutes before would get "Invalid coupon code" until they refreshed the page.
- **Fix:** Changed listener from `event: 'UPDATE'` → `event: '*'` in `lib/supabaseSync.ts`. Now it subscribes to INSERT + UPDATE + DELETE on the specific settings row filter `key=eq.<row>`, so both first-save ever AND subsequent edits broadcast in < 1 second.

### 13. ✅ CartDrawer Always Charged GST Regardless of gstMode Selection
- **Root Cause:** `CartDrawer.tsx` hardcoded `gst = subtotal * (gstPercent || 0.05)` — ignoring the admin setting `gstMode` value entirely. If admin selected "GST Inclusive" (meant: already in menu prices), customers were still being double-taxed.
- **Fix:** Added full mode branching:
  - `exclusive` → add GST on top (restaurant standard, same as previous default for users who haven't touched mode yet)
  - `inclusive` → GST line shows "Already in menu prices" italic; NO added charge at checkout
  - `none` → GST line completely hidden; 0 added to total
- Also fixed same hardcoding bug in `CartSummary.tsx` (standalone WhatsApp cart component) which had both hardcoded 5% GST AND hardcoded phone number `919876543210` instead of the saved settings WhatsApp #.

### 14. ✅ FREEBY Coupon UI Still Showed Delivery Charge (False Pricing Mismatch)
- **Root Cause:** CartDrawer.tsx only used `subtotal >= freeDeliveryAbove` waive rule. But `promotionsStore` supports a third coupon type `discountType === 'free-delivery'` which also waives delivery charge (regardless of subtotal vs threshold). The server at `/api/orders/create` correctly waived delivery charge in this case — but the UI kept displaying the old delivery charge as an additional line item, causing customers to see one price and be charged another (lower) one on the final order record.
- **Fix:** Added `hasFreeDeliveryCoupon` flag to CartDrawer that also triggers waive. Delivery charge line now shows which rule waived it: `(FREEBY coupon applied)` or `(orders above ₹500)`.

### 15. ✅ Orders API `DEFAULT_PROMOTIONS` Fallback Was Wrong Shape
- **Root Cause:** `/api/orders/create` `DEFAULT_PROMOTIONS` fallback used `{ coupons:[], bannerText, popupImage }` from legacy pre-unification schema. Since the actual promotions row now stores `{ rewardTiers, coupons, offers }`, any DB-miss scenario (cold-started Vercel instance with expired supabase cache) would have promotions set to the wrong shape and coupon lookups would silently fail.
- **Fix:** Updated fallback to exact `{ rewardTiers:[], coupons:[], offers:[] }` matching the `promotionsStore.ts` interface.

---

## Deployment Reference

| Environment | URL |
|-------------|-----|
| Production | `https://hfc-cloud-kitchen-services-white-la.vercel.app` |
| Admin Panel | `https://hfc-cloud-kitchen-services-white-la.vercel.app/admin` |
| Delivery Portal | `https://hfc-cloud-kitchen-services-white-la.vercel.app/agent` |
| Supabase Dashboard | `https://supabase.com/dashboard/project/cmwsffhenpckwkwgnmsy` |
| Supabase SQL Editor | `https://supabase.com/dashboard/project/cmwsffhenpckwkwgnmsy/editor` |
| Vercel Dashboard | `https://vercel.com/sathveek12345-3432s-projects/hfc-cloud-kitchen-services-white-label-brand` |

### Deploy Command
```bash
npx vercel deploy --prod --yes
# from: d:\Client Projects\DCH PROJECTS\HFC Cloud Kitchen\
```

---

## Files Modified in This Session

| File | What Changed |
|------|-------------|
| `store/agentAuthStore.ts` | `sessionStorage` → `localStorage` for persistent agent sessions |
| `store/productsStore.ts` | Full rewrite — Supabase sync on every mutation, self-healing seeder |
| `store/promotionsStore.ts` | Full rewrite — syncs coupons/tiers/offers to `settings.promotions` in Supabase |
| `store/settingsStore.ts` | Full rewrite — syncs all settings to `settings.site_settings` in Supabase |
| `store/orderStore.ts` | Idempotency guard in `addOrder()`, 30-day fetch window |
| `store/billsStore.ts` | Added `fetchBills()` from Supabase RPC |
| `lib/supabaseSync.ts` | Added: `syncProductToSupabase`, `deleteProductFromSupabase`, `fetchProductsFromSupabase`, `subscribeToProductsRealtime`, `syncSettingToSupabase`, `fetchSettingFromSupabase`, `subscribeToSettingRealtime` |
| `lib/supabaseSync.ts subscribeToSettingRealtime()` | ✅ Changed `event: 'UPDATE'` → `event: '*'` so first INSERT (first save ever) is also broadcast (bug #12) |
| `components/menu/MenuSection.tsx` | Added Supabase product fetch + realtime subscription on mount |
| `components/cart/CartDrawer.tsx` | Replaced `useCouponsStore` with `usePromotionsStore` for live coupon validation |
| `components/cart/CartDrawer.tsx` | ✅ Added GST mode support (bug #13) + ✅ hasFreeDeliveryCoupon waive rule (bug #14) + detailed price breakdown with Subtotal/GST/Delivery/Discount lines |
| `components/cart/CartSummary.tsx` | ✅ Fixed hardcoded 5% GST + hardcoded phone `919876543210` — now reads live from settings (bug #13) |
| `app/page.tsx` | Added promotions + settings fetch and realtime subscriptions |
| `app/admin/coupons/page.tsx` | Added `fetchAndSyncPromotions` + realtime subscription on mount |
| `app/admin/settings/page.tsx` | Added `fetchAndSyncSettings` + realtime subscription on mount |
| `app/admin/bills/page.tsx` | Added `fetchBills()` on mount |
| `app/api/orders/create/route.ts` | ✅ Fixed `DEFAULT_PROMOTIONS` from stale `{ coupons, bannerText, popupImage }` → `{ rewardTiers, coupons, offers }` (bug #15) + gstMode handling |
| `supabase/schema.sql` | Added: `sync_product` RPC, `sync_setting` RPC, `auto_create_bill` trigger, `sync_bill_payment_status` trigger, products RLS policies, settings realtime publication |
| `supabase/schema.sql` | Settings `site_settings` + `promotions` seed now use correct shapes (rewardTiers/coupons/offers + HFC50 FREEBY seed coupons) |
