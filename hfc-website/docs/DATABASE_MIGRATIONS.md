# 🗄️ Database Migrations Reference
**Applies To:** HFC Restaurant Software  
**Last Updated:** August 18, 2026  
**Shared Supabase Instance:** `[YOUR_SUPABASE_PROJECT_REF].supabase.co`  

> [!IMPORTANT]
> Always run migrations in the **Supabase SQL Editor** → Dashboard → SQL Editor → New Query.
> All migration scripts are idempotent (safe to run multiple times) unless noted.

---

## Migration 1: Core Schema (`supabase/schema.sql`)

**When to Run:** Fresh database provisioning only.  
**Contains:**
* All 10 base tables: `orders`, `products`, `agents`, `bills`, `coupons`, `settings`, `ingredients`, `stock_entries`, `recipes`, `kitchen_closing`, `daily_stock_summary`, `table_sessions`.
* All RLS policies.
* All SECURITY DEFINER trigger functions (`auto_create_bill`, `sync_bill_payment_status`, `get_order_by_id`, `sync_setting`, `get_all_bills`).
* Realtime publication registrations.
* Default settings seeds.

---

## Migration 2: Delivery Rate Zones (`supabase/migration-delivery-rates.sql`)

**When to Run:** After base schema, before first delivery order.  
**Contains:**
* Delivery zone to rate mapping configurations.
* Supports distance-based dynamic pricing for multi-zone delivery areas.

---

## Migration 3: Rider Analytics (`supabase/migration-rider-analytics.sql`)

**When to Run:** Before enabling the Rider Performance Dashboard.  
**Contains:**
* Adds `rider_earning` (NUMERIC) to `orders`.
* Adds `estimated_delivery_minutes` (INTEGER) to `orders`.
* Adds `picked_up_at` (TIMESTAMPTZ) to `orders`.
* Adds `kitchen_source` (TEXT) to `orders`.
* Creates the `delivery_ratings` table.
* Creates the `submit_delivery_rating(p_order_id, p_rating, p_review_text)` RPC.

---

## Migration 4: Table QR Ordering (`supabase/migration-table-ordering.sql`)

**When to Run:** Before enabling the QR Table Ordering system.  
**Contains:**
* Creates `table_sessions` table with all columns.
* Adds `source` (TEXT) column to `orders` for tracking origin (`table-qr`, `counter-qr`, `website`).
* Adds `token_number` (TEXT) column to `orders` for takeaway tokens.
* Configures RLS policies on `table_sessions`.
* Registers `table_sessions` in the `supabase_realtime` publication.

---

## Hotfix: Bills RLS & Missing Columns (`supabase/hotfix-bills-rls.sql`)

**When to Run:** On any database where counter orders are failing.  
**Contains:**
* `ALTER TABLE bills ADD COLUMN IF NOT EXISTS items JSONB ...`
* `ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_method TEXT ...`
* `ALTER TABLE bills ADD COLUMN IF NOT EXISTS order_type TEXT ...`
* `ALTER TABLE bills ADD COLUMN IF NOT EXISTS coupon_code TEXT`
* Recreates `auto_create_bill()` WITH SECURITY DEFINER.
* Recreates `sync_bill_payment_status()` WITH SECURITY DEFINER.
* Adds permissive `INSERT` policy on `bills`.

---

## Verification Queries

After running migrations, verify with:

```sql
-- Verify all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;

-- Verify realtime publications
SELECT tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Verify trigger functions have SECURITY DEFINER
SELECT proname, prosecdef FROM pg_proc 
WHERE proname IN ('auto_create_bill', 'sync_bill_payment_status');
-- prosecdef should be TRUE for both rows

-- Verify bills table has all required columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'bills' ORDER BY ordinal_position;
```
