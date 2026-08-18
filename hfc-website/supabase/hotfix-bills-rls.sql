-- ══════════════════════════════════════════════════════════════════════════════
-- HOTFIX: bills RLS + SECURITY DEFINER trigger functions
-- Run this in the Supabase SQL Editor for the Restaurant project
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── STEP 1: Add missing columns to bills table (safe, idempotent) ─────────────
-- If these columns already exist nothing happens. Ensures full schema parity.

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'Cash';

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'dine-in';

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS coupon_code TEXT;


-- ─── STEP 2: Fix auto_create_bill trigger function ─────────────────────────────
-- PROBLEM: Function was not SECURITY DEFINER → ran as 'anon' → blocked by RLS.
-- FIX: Add SECURITY DEFINER so it always runs as postgres superuser.

CREATE OR REPLACE FUNCTION public.auto_create_bill()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_str   TEXT;
  seq_num     INTEGER;
  new_bill_no TEXT;
BEGIN
  today_str := to_char(NEW.created_at, 'YYYYMMDD');

  SELECT COALESCE(COUNT(*), 0) + 1 INTO seq_num
  FROM public.bills
  WHERE date::date = NEW.created_at::date;

  new_bill_no := 'BILL-' || today_str || '-' || lpad(seq_num::text, 3, '0');

  INSERT INTO public.bills (
    bill_no, order_id, customer_name, date,
    subtotal, gst, delivery_charge, discount_amount, total,
    payment_status, items, payment_method, order_type, coupon_code,
    created_at
  )
  VALUES (
    new_bill_no,
    NEW.id,
    NEW.customer_name,
    NEW.created_at,
    COALESCE(NEW.subtotal, 0),
    COALESCE(NEW.gst, 0),
    COALESCE(NEW.delivery_charge, 0),
    COALESCE(NEW.discount_amount, 0),
    COALESCE(NEW.total, 0),
    COALESCE(NEW.payment_status, 'unpaid'),
    COALESCE(NEW.items, '[]'::jsonb),
    COALESCE(NEW.payment_method, 'Cash'),
    COALESCE(NEW.order_type, 'dine-in'),
    NEW.coupon_code,
    NEW.created_at
  )
  ON CONFLICT (bill_no) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_create_bill_trigger ON public.orders;
CREATE TRIGGER auto_create_bill_trigger
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_bill();


-- ─── STEP 3: Fix sync_bill_payment_status trigger function ─────────────────────
CREATE OR REPLACE FUNCTION public.sync_bill_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bills
  SET payment_status = NEW.payment_status
  WHERE order_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_bill_payment_status_trigger ON public.orders;
CREATE TRIGGER sync_bill_payment_status_trigger
  AFTER UPDATE OF payment_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_bill_payment_status();


-- ─── STEP 4: Allow trigger-context inserts (belt-and-suspenders) ───────────────
DROP POLICY IF EXISTS "Trigger insert bills" ON public.bills;
CREATE POLICY "Trigger insert bills" ON public.bills
  FOR INSERT WITH CHECK (true);

-- ─── STEP 5: Register Inventory & Table QR tables in Realtime Publication ────────
DO $$
DECLARE tables TEXT[] := ARRAY[
  'ingredients', 'stock_entries', 'kitchen_closing',
  'daily_stock_summary', 'table_sessions', 'table_orders', 'restaurant_tables'
];
t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.' || t;
    END IF;
  END LOOP;
END $$;

-- ─── STEP 6: Verify ────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'bills' ORDER BY ordinal_position;
--
-- SELECT proname, prosecdef FROM pg_proc
-- WHERE proname IN ('auto_create_bill', 'sync_bill_payment_status');
-- prosecdef must be TRUE for both rows.
