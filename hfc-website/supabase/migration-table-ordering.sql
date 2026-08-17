-- ══════════════════════════════════════════════════════════════════════════════
-- HFC RESTAURANT SOFTWARE — TABLE ORDERING SYSTEM MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Table master list
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id TEXT PRIMARY KEY,
  table_number TEXT NOT NULL UNIQUE,
  table_name TEXT,
  capacity INTEGER NOT NULL DEFAULT 4,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  qr_code_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to allow clean re-run
DROP POLICY IF EXISTS "Allow public read-only access to tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Allow admins write access to tables" ON public.restaurant_tables;

-- Create policies
CREATE POLICY "Allow public read-only access to tables" ON public.restaurant_tables
  FOR SELECT USING (true);

CREATE POLICY "Allow admins write access to tables" ON public.restaurant_tables
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 2. Active table sessions (The Lock Mechanism)
CREATE TABLE IF NOT EXISTS public.table_sessions (
  id TEXT PRIMARY KEY,
  table_id TEXT REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  table_number TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE, -- UUID given to first device
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'payment_pending', 'completed', 'released')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  total_amount NUMERIC(10,2) DEFAULT 0,
  payment_method TEXT CHECK (payment_method IN ('Cash', 'UPI', 'Online', 'Card')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-only access to active sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "Allow public insert to active sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "Allow anyone update to active sessions" ON public.table_sessions;

-- Create policies
CREATE POLICY "Allow public read-only access to active sessions" ON public.table_sessions
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert to active sessions" ON public.table_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anyone update to active sessions" ON public.table_sessions
  FOR UPDATE USING (true) WITH CHECK (true);


-- 3. Table orders (Multi-round KOTs)
CREATE TABLE IF NOT EXISTS public.table_orders (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  round_number INTEGER NOT NULL DEFAULT 1,
  items JSONB NOT NULL, -- Array of items: [{ id, name, price, quantity }]
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'accepted', 'ready', 'served', 'rejected')),
  placed_at TIMESTAMPTZ DEFAULT NOW(),
  served_at TIMESTAMPTZ,
  kot_number TEXT NOT NULL UNIQUE,
  special_instructions TEXT
);

-- Enable RLS
ALTER TABLE public.table_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-only access to table orders" ON public.table_orders;
DROP POLICY IF EXISTS "Allow public insert to table orders" ON public.table_orders;
DROP POLICY IF EXISTS "Allow updates to table orders" ON public.table_orders;

-- Create policies
CREATE POLICY "Allow public read-only access to table orders" ON public.table_orders
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert to table orders" ON public.table_orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow updates to table orders" ON public.table_orders
  FOR UPDATE USING (true) WITH CHECK (true);


-- 4. Add to Realtime replication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'table_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'table_orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.table_orders;
    END IF;
END $$;


-- 5. Seed default physical tables (Tables 01 to 10)
INSERT INTO public.restaurant_tables (id, table_number, table_name, capacity, is_active)
VALUES 
  ('tbl-01', '01', 'Table 1 (2 Seats)', 2, TRUE),
  ('tbl-02', '02', 'Table 2 (2 Seats)', 2, TRUE),
  ('tbl-03', '03', 'Table 3 (4 Seats)', 4, TRUE),
  ('tbl-04', '04', 'Table 4 (4 Seats)', 4, TRUE),
  ('tbl-05', '05', 'Table 5 (4 Seats)', 4, TRUE),
  ('tbl-06', '06', 'Table 6 (6 Seats)', 6, TRUE),
  ('tbl-07', '07', 'Table 7 (6 Seats)', 6, TRUE),
  ('tbl-08', '08', 'Table 8 (8 Seats)', 8, TRUE),
  ('tbl-09', '09', 'Window Booth A (4 Seats)', 4, TRUE),
  ('tbl-10', '10', 'Window Booth B (4 Seats)', 4, TRUE)
ON CONFLICT (table_number) DO UPDATE 
SET table_name = EXCLUDED.table_name, capacity = EXCLUDED.capacity;
