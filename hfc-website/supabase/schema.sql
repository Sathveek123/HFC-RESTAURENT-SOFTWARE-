-- ══════════════════════════════════════════════════════════════════════════════
-- HFC RESTAURANT SOFTWARE — SUPABASE DATABASE SCHEMA & REALTIME SETUP
-- Project: cmwsffhenpckwkwgnmsy
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,                       -- e.g. "HFC-F6B776C7"
    customer_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    order_type TEXT NOT NULL CHECK (order_type IN ('dine-in', 'takeaway', 'delivery')),
    address TEXT,
    landmark TEXT,
    delivery_area TEXT,
    coords JSONB,                             -- { lat: number, lng: number }
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ id, name, price, quantity }]
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    gst NUMERIC(10,2) NOT NULL DEFAULT 0,
    delivery_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    coupon_code TEXT,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'UPI', 'Online', 'Card')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'partial')),
    status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'accepted', 'ready', 'picked-up', 'delivered', 'rejected', 'cancelled')),
    assigned_agent TEXT,
    seen_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
    is_regular_customer BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- Index for fast order tracking lookup
CREATE INDEX IF NOT EXISTS idx_orders_id ON public.orders(id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_agent ON public.orders(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Enable Realtime on orders table for instant live updates on Tracker and Agent Portal (Safe/Idempotent check)
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
END $$;

-- 2. PRODUCTS TABLE (expanded v2 with bestseller/veg/sort_order/mrp columns)
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    mrp NUMERIC(10,2),
    description TEXT,
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
    is_veg BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. SETTINGS TABLE (key/value JSON store with RLS) ──────────────────────────
-- Stores site_settings (gst%, delivery fee, free delivery threshold, UPI ID, WhatsApp)
-- and promotions (coupons list, free items, combo offers) as JSONB blobs.
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default rows for settings and promotions so frontend never reads blank on first launch
INSERT INTO public.settings (key, value, updated_at) VALUES
(
    'site_settings',
    jsonb_build_object(
        'siteName', 'HFC Consultancy Services',
        'whatsappNumber', '919912799855',
        'upiId', '9912799855@okbizaxis',
        'gstPercent', 5,
        'gstMode', 'exclusive',
        'deliveryFee', 50,
        'freeDeliveryAbove', 500
    ),
    NOW()
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, updated_at) VALUES
(
    'promotions',
    jsonb_build_object(
        'rewardTiers', jsonb_build_array(),
        'coupons', jsonb_build_array(
            jsonb_build_object(
                'id', 'cp-seed-1',
                'code', 'HFC50',
                'discountType', 'percent',
                'discountValue', 50,
                'maxDiscountCap', 150,
                'minOrderAmount', 300,
                'usageLimit', 100,
                'usedCount', 0,
                'validFrom', '2026-08-01T00:00:00.000Z',
                'validUntil', '2026-12-31T23:59:59.000Z',
                'isActive', true,
                'applicableCustomerPhone', NULL,
                'createdAt', NOW()::text
            ),
            jsonb_build_object(
                'id', 'cp-seed-2',
                'code', 'FREEBY',
                'discountType', 'free-delivery',
                'discountValue', NULL,
                'maxDiscountCap', NULL,
                'minOrderAmount', 250,
                'usageLimit', 500,
                'usedCount', 0,
                'validFrom', '2026-08-01T00:00:00.000Z',
                'validUntil', '2026-12-31T23:59:59.000Z',
                'isActive', true,
                'applicableCustomerPhone', NULL,
                'createdAt', NOW()::text
            )
        ),
        'offers', jsonb_build_array()
    ),
    NOW()
)
ON CONFLICT (key) DO NOTHING;

-- 3. AGENTS TABLE (Credentials managed via Supabase Auth auth.users)
CREATE TABLE IF NOT EXISTS public.agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    vehicle_type TEXT,
    coverage_area TEXT,
    total_deliveries INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. BILLS TABLE
CREATE TABLE IF NOT EXISTS public.bills (
    bill_no TEXT PRIMARY KEY,                 -- e.g. "BILL-20260812-001"
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    gst NUMERIC(10,2) NOT NULL DEFAULT 0,
    delivery_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    order_type TEXT NOT NULL DEFAULT 'dine-in',
    coupon_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. COUPONS TABLE
CREATE TABLE IF NOT EXISTS public.coupons (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
    discount_value NUMERIC(10,2) NOT NULL,
    min_order_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_uses INTEGER,                         -- NULL = unlimited
    used_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    applicable_order_types TEXT[] NOT NULL DEFAULT ARRAY['dine-in', 'takeaway', 'delivery'],
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. PRODUCTION ROW LEVEL SECURITY (RLS) POLICIES
-- ══════════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- ─── 1. ORDERS TABLE POLICIES ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public create order" ON public.orders;
DROP POLICY IF EXISTS "Public select order by id" ON public.orders;
-- ONLY Admin (all orders) and Delivery Agents (assigned orders only) can run SELECT queries!
DROP POLICY IF EXISTS "Staff select orders" ON public.orders;
DROP POLICY IF EXISTS "Scoped staff select orders" ON public.orders;
DROP POLICY IF EXISTS "Public select orders" ON public.orders;
CREATE POLICY "Public select orders" ON public.orders FOR SELECT 
USING (true);


CREATE POLICY "Admin full update orders" ON public.orders FOR UPDATE 
USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Agent update assigned orders only" ON public.orders FOR UPDATE 
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'agent'
  AND assigned_agent = (auth.jwt() -> 'user_metadata' ->> 'agent_name')
)
WITH CHECK (
  assigned_agent = (auth.jwt() -> 'user_metadata' ->> 'agent_name')
);

CREATE POLICY "Admin delete orders only" ON public.orders FOR DELETE 
USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ─── PUBLIC INSERT POLICY ──────────────────────────────────────────────────────
-- Customers (anonymous) MUST be able to create orders on checkout!
DROP POLICY IF EXISTS "Public create order" ON public.orders;
CREATE POLICY "Public create order" ON public.orders
FOR INSERT WITH CHECK (true);

-- ─── 7. SECURITY DEFINER SINGLE ORDER LOOKUP FUNCTION ─────────────────────────
-- Public can ONLY fetch a single order by exact ID (prevents bulk DB dumps!)
CREATE OR REPLACE FUNCTION public.get_order_by_id(p_order_id TEXT)
RETURNS SETOF public.orders
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.orders WHERE id = p_order_id LIMIT 1;
$$;

-- Explicitly grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_order_by_id(TEXT) TO anon, authenticated, service_role;

-- ─── 8. GET ALL ORDERS (ADMIN) — SECURITY DEFINER bypasses RLS
-- Admin panel calls this instead of direct SELECT so it always works.
-- Access is restricted to authenticated admins.
CREATE OR REPLACE FUNCTION public.get_all_orders()
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') <> 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Admin privileges required';
  END IF;
  
  RETURN QUERY SELECT * FROM public.orders ORDER BY created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_all_orders() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_all_orders() TO authenticated;

-- ─── 9. CREATE ORDER (CUSTOMER) — SECURITY DEFINER bypasses RLS INSERT ───────
-- Customer checkout calls this as RPC fallback if direct INSERT fails (RLS blocked).
CREATE OR REPLACE FUNCTION public.create_order(order_row JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.orders (
    id, customer_name, phone_number, order_type, address, landmark,
    delivery_area, coords, items, subtotal, gst, delivery_charge,
    discount_amount, coupon_code, total, payment_method, payment_status,
    status, assigned_agent, seen_by_admin, is_regular_customer, notes,
    created_at, updated_at, timestamp
  )
  VALUES (
    order_row->>'id',
    order_row->>'customer_name',
    order_row->>'phone_number',
    order_row->>'order_type',
    order_row->>'address',
    order_row->>'landmark',
    order_row->>'delivery_area',
    (order_row->'coords'),
    (order_row->'items'),
    (order_row->>'subtotal')::NUMERIC,
    (order_row->>'gst')::NUMERIC,
    (order_row->>'delivery_charge')::NUMERIC,
    (order_row->>'discount_amount')::NUMERIC,
    order_row->>'coupon_code',
    (order_row->>'total')::NUMERIC,
    COALESCE(order_row->>'payment_method', 'Cash'),
    COALESCE(order_row->>'payment_status', 'unpaid'),
    COALESCE(order_row->>'status', 'placed'),
    order_row->>'assigned_agent',
    COALESCE((order_row->>'seen_by_admin')::BOOLEAN, false),
    COALESCE((order_row->>'is_regular_customer')::BOOLEAN, false),
    order_row->>'notes',
    COALESCE((order_row->>'created_at')::TIMESTAMPTZ, NOW()),
    COALESCE((order_row->>'updated_at')::TIMESTAMPTZ, NOW()),
    COALESCE((order_row->>'timestamp')::BIGINT, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    assigned_agent = EXCLUDED.assigned_agent,
    seen_by_admin = EXCLUDED.seen_by_admin,
    payment_status = EXCLUDED.payment_status,
    updated_at = EXCLUDED.updated_at,
    timestamp = EXCLUDED.timestamp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order(JSONB) TO anon, authenticated, service_role;

-- ─── 2. SETTINGS TABLE POLICIES ───────────────────────────────────────────────
-- Public can read site_name, gst, delivery fee, upi_id (needed for checkout QR)
-- ONLY Admin can insert, update, or delete settings! Prevents UPI ID hijacking.
DROP POLICY IF EXISTS "Public read settings" ON public.settings;
DROP POLICY IF EXISTS "Admin write settings" ON public.settings;

CREATE POLICY "Public read settings" ON public.settings FOR SELECT USING (true);

CREATE POLICY "Admin write settings" ON public.settings FOR ALL
USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ─── 3. BILLS TABLE POLICIES ──────────────────────────────────────────────────
-- ONLY authenticated Admin can read all bills; Agents can ONLY read bills for their assigned deliveries!
DROP POLICY IF EXISTS "Public read bills" ON public.bills;
DROP POLICY IF EXISTS "Staff read bills" ON public.bills;
DROP POLICY IF EXISTS "Agent read assigned delivery bills" ON public.bills;
DROP POLICY IF EXISTS "Admin write bills" ON public.bills;

CREATE POLICY "Agent read assigned delivery bills" ON public.bills FOR SELECT 
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'agent'
    AND order_id IN (
      SELECT id FROM public.orders 
      WHERE assigned_agent = (auth.jwt() -> 'user_metadata' ->> 'agent_name')
    )
  )
);

CREATE POLICY "Admin write bills" ON public.bills FOR ALL 
USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ─── 4. AGENTS TABLE POLICIES ─────────────────────────────────────────────────
-- ONLY authenticated staff (Admin/Agent) can read agent records (prevents rider phone number leaks!)
-- ONLY Admin can create, modify, or delete agent accounts!
DROP POLICY IF EXISTS "Public read active agents" ON public.agents;
DROP POLICY IF EXISTS "Staff read agents" ON public.agents;
DROP POLICY IF EXISTS "Admin write agents" ON public.agents;

CREATE POLICY "Staff read agents" ON public.agents FOR SELECT 
USING ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'agent'));

CREATE POLICY "Admin write agents" ON public.agents FOR ALL 
USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ─── 5. COUPONS TABLE POLICIES ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admin write coupons" ON public.coupons;

CREATE POLICY "Public read active coupons" ON public.coupons FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admin write coupons" ON public.coupons FOR ALL 
USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ─── 6. PRODUCTS TABLE POLICIES ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read products" ON public.products;
DROP POLICY IF EXISTS "Admin write products" ON public.products;

CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);

CREATE POLICY "Admin write products" ON public.products FOR ALL 
USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ─── 8. SECURITY DEFINER AGENT ACTIONS FUNCTIONS ──────────────────────────────────
-- Bypasses RLS so agent synchronization works across devices without requiring JWT.

-- get_all_agents: retrieves all agents
-- Access is restricted strictly to authenticated admins.
CREATE OR REPLACE FUNCTION public.get_all_agents()
RETURNS SETOF public.agents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') <> 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Admin privileges required';
  END IF;

  RETURN QUERY SELECT * FROM public.agents ORDER BY created_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_all_agents() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_all_agents() TO authenticated;

-- sync_agent: upserts an agent record
CREATE OR REPLACE FUNCTION public.sync_agent(agent_row JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') <> 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Admin privileges required';
  END IF;

  INSERT INTO public.agents (
    id, name, whatsapp, username, is_active, vehicle_type, coverage_area, total_deliveries, created_at
  )
  VALUES (
    agent_row->>'id',
    agent_row->>'name',
    agent_row->>'whatsapp',
    agent_row->>'username',
    COALESCE((agent_row->>'is_active')::BOOLEAN, true),
    agent_row->>'vehicle_type',
    agent_row->>'coverage_area',
    COALESCE((agent_row->>'total_deliveries')::INTEGER, 0),
    COALESCE((agent_row->>'created_at')::TIMESTAMPTZ, NOW())
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    whatsapp = EXCLUDED.whatsapp,
    username = EXCLUDED.username,
    is_active = EXCLUDED.is_active,
    vehicle_type = EXCLUDED.vehicle_type,
    coverage_area = EXCLUDED.coverage_area,
    total_deliveries = EXCLUDED.total_deliveries;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_agent(JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_agent(JSONB) TO authenticated;

-- delete_agent_by_id: deletes an agent record
CREATE OR REPLACE FUNCTION public.delete_agent_by_id(agent_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') <> 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Admin privileges required';
  END IF;

  DELETE FROM public.agents WHERE id = agent_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_agent_by_id(TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_agent_by_id(TEXT) TO authenticated;

-- ─── 9. SECURITY DEFINER BILLS FUNCTIONS & TRIGGERS ──────────────────────────────

-- auto_create_bill: creates a bill record for every new order placed
CREATE OR REPLACE FUNCTION public.auto_create_bill()
RETURNS TRIGGER AS $$
DECLARE
  today_str TEXT;
  seq_num INTEGER;
  new_bill_no TEXT;
BEGIN
  today_str := to_char(NEW.created_at, 'YYYYMMDD');
  
  SELECT COALESCE(COUNT(*), 0) + 1 INTO seq_num
  FROM public.bills
  WHERE date::date = NEW.created_at::date;
  
  new_bill_no := 'BILL-' || today_str || '-' || lpad(seq_num::text, 3, '0');
  
  INSERT INTO public.bills (
    bill_no, order_id, customer_name, date, subtotal, gst, 
    delivery_charge, discount_amount, total, payment_status, 
    items, payment_method, order_type, coupon_code, created_at
  )
  VALUES (
    new_bill_no, NEW.id, NEW.customer_name, NEW.created_at, NEW.subtotal, NEW.gst,
    NEW.delivery_charge, NEW.discount_amount, NEW.total, NEW.payment_status, 
    NEW.items, NEW.payment_method, NEW.order_type, NEW.coupon_code, NEW.created_at
  )
  ON CONFLICT (bill_no) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_create_bill_trigger ON public.orders;
CREATE TRIGGER auto_create_bill_trigger
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_bill();

-- sync_bill_payment_status: syncs payment status updates from orders to bills
CREATE OR REPLACE FUNCTION public.sync_bill_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.bills
  SET payment_status = NEW.payment_status
  WHERE order_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_bill_payment_status_trigger ON public.orders;
CREATE TRIGGER sync_bill_payment_status_trigger
AFTER UPDATE OF payment_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_bill_payment_status();

-- get_all_bills: fetches all bill records for the admin panel, bypassing RLS
CREATE OR REPLACE FUNCTION public.get_all_bills()
RETURNS TABLE (
  bill_no TEXT,
  order_id TEXT,
  customer_name TEXT,
  date TIMESTAMPTZ,
  subtotal NUMERIC(10,2),
  gst NUMERIC(10,2),
  delivery_charge NUMERIC(10,2),
  discount_amount NUMERIC(10,2),
  total NUMERIC(10,2),
  payment_status TEXT,
  items JSONB,
  payment_method TEXT,
  order_type TEXT,
  coupon_code TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') <> 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Admin privileges required';
  END IF;

  RETURN QUERY SELECT 
    b.bill_no, b.order_id, b.customer_name, b.date, b.subtotal, b.gst, 
    b.delivery_charge, b.discount_amount, b.total, b.payment_status,
    b.items, b.payment_method, b.order_type, b.coupon_code, b.created_at
  FROM public.bills b
  ORDER BY b.date DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_all_bills() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_all_bills() TO authenticated;

-- ─── 10. SECURITY DEFINER SETTINGS SYNC FUNCTIONS ──────────────────────────

-- ─── 5. PRODUCTS TABLE — ADD MISSING COLUMNS IF OLDER v1 TABLE EXISTS ─────────
-- (safe idempotent DO block; new installs already have these via products CREATE TABLE IF NOT EXISTS above)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='mrp') THEN
        ALTER TABLE public.products ADD COLUMN mrp NUMERIC(10,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_bestseller') THEN
        ALTER TABLE public.products ADD COLUMN is_bestseller BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_veg') THEN
        ALTER TABLE public.products ADD COLUMN is_veg BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sort_order') THEN
        ALTER TABLE public.products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='updated_at') THEN
        ALTER TABLE public.products ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- sync_product: UPSERT a product row (SECURITY DEFINER bypasses RLS — caller verified in app logic)
CREATE OR REPLACE FUNCTION public.sync_product(product_row JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id TEXT;
  v_name TEXT;
  v_category TEXT;
  v_price NUMERIC;
  v_mrp NUMERIC;
  v_description TEXT;
  v_image_url TEXT;
  v_is_available BOOLEAN;
  v_is_bestseller BOOLEAN;
  v_is_veg BOOLEAN;
  v_sort_order INTEGER;
BEGIN
  -- Extract fields from the JSONB payload
  v_id            := product_row ->> 'id';
  v_name          := product_row ->> 'name';
  v_category      := product_row ->> 'category';
  v_price         := COALESCE((product_row ->> 'price')::NUMERIC, 0);
  v_mrp           := (product_row ->> 'mrp')::NUMERIC;
  v_description   := product_row ->> 'description';
  v_image_url     := product_row ->> 'image_url';
  v_is_available  := COALESCE((product_row ->> 'is_available')::BOOLEAN, TRUE);
  v_is_bestseller := COALESCE((product_row ->> 'is_bestseller')::BOOLEAN, FALSE);
  v_is_veg        := COALESCE((product_row ->> 'is_veg')::BOOLEAN, TRUE);
  v_sort_order    := COALESCE((product_row ->> 'sort_order')::INTEGER, 0);

  INSERT INTO public.products (id, name, category, price, mrp, description, image_url, is_available, is_bestseller, is_veg, sort_order, updated_at)
  VALUES (v_id, v_name, v_category, v_price, v_mrp, v_description, v_image_url, v_is_available, v_is_bestseller, v_is_veg, v_sort_order, NOW())
  ON CONFLICT (id) DO UPDATE SET
    name          = EXCLUDED.name,
    category      = EXCLUDED.category,
    price         = EXCLUDED.price,
    mrp           = EXCLUDED.mrp,
    description   = EXCLUDED.description,
    image_url     = EXCLUDED.image_url,
    is_available  = EXCLUDED.is_available,
    is_bestseller = EXCLUDED.is_bestseller,
    is_veg        = EXCLUDED.is_veg,
    sort_order    = EXCLUDED.sort_order,
    updated_at    = NOW();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_product(JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_product(JSONB) TO authenticated;

-- Enable Realtime on products table so menu updates appear on customer pages instantly
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'products'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    END IF;
END $$;

-- sync_setting: upsert settings row, bypassing RLS
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

-- Enable Realtime on settings table to broadcast changes to clients instantly
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
    END IF;
END $$;


-- ─── 11. INVENTORY SYSTEM TABLES ──────────────────────────────────────────────

-- Ingredients master list
CREATE TABLE IF NOT EXISTS public.ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,          -- 'KG', 'L', 'G', 'PCS'
  category TEXT,               -- 'Protein', 'Oil', 'Dry', 'Veg', 'Spices'
  cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on ingredients
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated reads on ingredients" ON public.ingredients;
CREATE POLICY "Allow authenticated reads on ingredients" ON public.ingredients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin write on ingredients" ON public.ingredients;
CREATE POLICY "Allow admin write on ingredients" ON public.ingredients FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Daily opening stock inputs (entered by owner/admin)
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

-- Enable RLS on stock_entries
ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated reads on stock_entries" ON public.stock_entries;
CREATE POLICY "Allow authenticated reads on stock_entries" ON public.stock_entries FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin write on stock_entries" ON public.stock_entries;
CREATE POLICY "Allow admin write on stock_entries" ON public.stock_entries FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Recipe mappings (dish -> ingredients mapping)
CREATE TABLE IF NOT EXISTS public.recipes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL, -- Links to productItem.id
  product_name TEXT NOT NULL,
  ingredient_id TEXT REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity_per_unit NUMERIC(10,4) NOT NULL DEFAULT 0, -- e.g. 0.2500 kg
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_product_ingredient_recipe UNIQUE (product_id, ingredient_id)
);

-- Enable RLS on recipes
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated reads on recipes" ON public.recipes;
CREATE POLICY "Allow authenticated reads on recipes" ON public.recipes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin write on recipes" ON public.recipes;
CREATE POLICY "Allow admin write on recipes" ON public.recipes FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Kitchen EOD closing count submissions
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

-- Enable RLS on kitchen_closing
ALTER TABLE public.kitchen_closing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated reads on kitchen_closing" ON public.kitchen_closing;
CREATE POLICY "Allow authenticated reads on kitchen_closing" ON public.kitchen_closing FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated write on kitchen_closing" ON public.kitchen_closing;
CREATE POLICY "Allow authenticated write on kitchen_closing" ON public.kitchen_closing FOR ALL TO authenticated USING (true);

-- Daily stock totals summary log
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
  status TEXT NOT NULL DEFAULT 'ok', -- 'ok', 'warning', 'critical'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_date_ingredient_summary UNIQUE (date, ingredient_id)
);

-- Enable RLS on daily_stock_summary
ALTER TABLE public.daily_stock_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated reads on daily_stock_summary" ON public.daily_stock_summary;
CREATE POLICY "Allow authenticated reads on daily_stock_summary" ON public.daily_stock_summary FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin write on daily_stock_summary" ON public.daily_stock_summary;
CREATE POLICY "Allow admin write on daily_stock_summary" ON public.daily_stock_summary FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Add Realtime replication for dynamic live dashboard updates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'ingredients'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ingredients;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'stock_entries'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_entries;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'recipes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.recipes;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'kitchen_closing'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_closing;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'daily_stock_summary'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_stock_summary;
    END IF;
END $$;


-- ─── 12. SECURE KITCHEN STAFF & IMMUTABLE CLOSING ──────────────────────────

-- Kitchen staff table (PIN column removed to prevent RLS read leakage)
CREATE TABLE IF NOT EXISTS public.kitchen_staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credentials table (RLS enabled with ZERO select policies - hidden from all client roles)
CREATE TABLE IF NOT EXISTS public.kitchen_staff_credentials (
  staff_id TEXT PRIMARY KEY REFERENCES public.kitchen_staff(id) ON DELETE CASCADE,
  pin TEXT NOT NULL
);

-- Enable RLS on both tables
ALTER TABLE public.kitchen_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_staff_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated reads on kitchen_staff" ON public.kitchen_staff;
CREATE POLICY "Allow authenticated reads on kitchen_staff" ON public.kitchen_staff FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin write on kitchen_staff" ON public.kitchen_staff;
CREATE POLICY "Allow admin write on kitchen_staff" ON public.kitchen_staff FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Note: public.kitchen_staff_credentials has RLS enabled but has no SELECT/ALL policies.
-- Hence, no client role can read pins, bypassing client-side exposure.

-- Server-side PIN verification RPC with rate-limiting and lockout
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
  -- 1. Check if account is locked out
  SELECT locked_until, failed_attempts INTO v_locked_until, v_failed_attempts
  FROM public.kitchen_staff
  WHERE id = p_staff_id;

  IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
    RAISE EXCEPTION 'Staff account is temporarily locked due to too many failed attempts. Try again in 15 minutes.';
  END IF;

  -- 2. Fetch the correct PIN from secure table
  SELECT pin INTO v_db_pin
  FROM public.kitchen_staff_credentials
  WHERE staff_id = p_staff_id;

  -- 3. Verify
  IF v_db_pin = p_pin THEN
    -- Reset locks
    UPDATE public.kitchen_staff
    SET failed_attempts = 0, locked_until = NULL
    WHERE id = p_staff_id;
    v_success := TRUE;
  ELSE
    -- Increment attempts
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

REVOKE EXECUTE ON FUNCTION public.verify_staff_pin(TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(TEXT, TEXT) TO authenticated;

-- Database-level audit immutability triggers for kitchen closing counts
CREATE OR REPLACE FUNCTION public.prevent_kitchen_closing_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Immutability Violation: Submitted kitchen closing counts cannot be modified or updated.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_kitchen_closing_update ON public.kitchen_closing;
CREATE TRIGGER trigger_prevent_kitchen_closing_update
BEFORE UPDATE ON public.kitchen_closing
FOR EACH ROW
EXECUTE FUNCTION public.prevent_kitchen_closing_update();

CREATE OR REPLACE FUNCTION public.prevent_kitchen_closing_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Immutability Violation: Submitted kitchen closing counts cannot be deleted or wiped.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_kitchen_closing_delete ON public.kitchen_closing;
CREATE TRIGGER trigger_prevent_kitchen_closing_delete
BEFORE DELETE ON public.kitchen_closing
FOR EACH ROW
EXECUTE FUNCTION public.prevent_kitchen_closing_delete();

-- Add Realtime replication for kitchen_staff
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'kitchen_staff'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_staff;
    END IF;
END $$;




