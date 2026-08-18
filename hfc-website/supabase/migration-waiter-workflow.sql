-- ══════════════════════════════════════════════════════════════════════════════
-- HFC WAITER WORKFLOW & ORDER ACCEPTANCE MODULE — DATABASE MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Create waiters staff table
CREATE TABLE IF NOT EXISTS public.waiters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_tables TEXT[],           -- e.g. ['01','02','03'] (null = all tables)
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create waiter credentials split table (zero-SELECT security pattern)
CREATE TABLE IF NOT EXISTS public.waiter_credentials (
  staff_id TEXT PRIMARY KEY REFERENCES public.waiters(id) ON DELETE CASCADE,
  pin TEXT NOT NULL
);

-- 3. Extend table_orders with waiter workflow tracking fields
ALTER TABLE public.table_orders ADD COLUMN IF NOT EXISTS
  waiter_id TEXT REFERENCES public.waiters(id);
ALTER TABLE public.table_orders ADD COLUMN IF NOT EXISTS
  waiter_name TEXT;
ALTER TABLE public.table_orders ADD COLUMN IF NOT EXISTS
  accepted_at TIMESTAMPTZ;
ALTER TABLE public.table_orders ADD COLUMN IF NOT EXISTS
  rejected_at TIMESTAMPTZ;
ALTER TABLE public.table_orders ADD COLUMN IF NOT EXISTS
  rejection_reason TEXT;
ALTER TABLE public.table_orders ADD COLUMN IF NOT EXISTS
  served_by_waiter_at TIMESTAMPTZ;

-- 4. Create print_queue table for physical/digital thermal printing companion bridge
CREATE TABLE IF NOT EXISTS public.print_queue (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES public.table_orders(id) ON DELETE CASCADE,
  kot_number TEXT NOT NULL,
  table_number TEXT NOT NULL,
  items JSONB NOT NULL,
  printed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.waiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiter_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_queue ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
DROP POLICY IF EXISTS "Staff read waiters" ON public.waiters;
CREATE POLICY "Staff read waiters" ON public.waiters 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin write waiters" ON public.waiters;
CREATE POLICY "Admin write waiters" ON public.waiters 
  FOR ALL USING (COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin');

-- waiter_credentials policies
DROP POLICY IF EXISTS "Admin write waiter credentials" ON public.waiter_credentials;
CREATE POLICY "Admin write waiter credentials" ON public.waiter_credentials 
  FOR ALL USING (COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin');

-- print_queue policies
DROP POLICY IF EXISTS "Authenticated read print queue" ON public.print_queue;
CREATE POLICY "Authenticated read print queue" ON public.print_queue 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone write print queue" ON public.print_queue;
CREATE POLICY "Anyone write print queue" ON public.print_queue 
  FOR ALL USING (true) WITH CHECK (true);

-- 7. Waiter PIN verification RPC function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.verify_waiter_pin(p_staff_id TEXT, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_db_pin TEXT;
  v_locked_until TIMESTAMPTZ;
  v_failed_attempts INTEGER;
  v_success BOOLEAN := FALSE;
BEGIN
  SELECT locked_until, failed_attempts INTO v_locked_until, v_failed_attempts
  FROM public.waiters WHERE id = p_staff_id;

  IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
    RAISE EXCEPTION 'Waiter account temporarily locked. Try again in 15 minutes.';
  END IF;

  SELECT pin INTO v_db_pin FROM public.waiter_credentials WHERE staff_id = p_staff_id;

  IF v_db_pin = p_pin THEN
    UPDATE public.waiters SET failed_attempts = 0, locked_until = NULL WHERE id = p_staff_id;
    v_success := TRUE;
  ELSE
    IF v_failed_attempts + 1 >= 5 THEN
      UPDATE public.waiters SET failed_attempts = v_failed_attempts + 1, 
        locked_until = NOW() + INTERVAL '15 minutes' WHERE id = p_staff_id;
    ELSE
      UPDATE public.waiters SET failed_attempts = v_failed_attempts + 1 WHERE id = p_staff_id;
    END IF;
  END IF;

  RETURN v_success;
END;
$$;

-- Grant execution permissions
REVOKE EXECUTE ON FUNCTION public.verify_waiter_pin(TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_waiter_pin(TEXT, TEXT) TO authenticated, anon;

-- 8. Add print_queue, table_sessions, table_orders to Realtime replication channel
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'print_queue'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.print_queue;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'waiters'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.waiters;
    END IF;
END $$;
