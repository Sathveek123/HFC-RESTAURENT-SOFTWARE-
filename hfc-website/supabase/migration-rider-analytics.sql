-- ══════════════════════════════════════════════════════════════════════════════
-- HFC RIDER PERFORMANCE & ANALYTICS MODULE — DATABASE MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Add earnings tracking to orders (rider commission per delivery)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS 
  rider_earning NUMERIC(10,2) DEFAULT 0;

-- 2. Add estimated delivery time benchmark (for On-Time calculation)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS 
  estimated_delivery_minutes INTEGER DEFAULT 30;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS 
  picked_up_at TIMESTAMPTZ;

-- 3. Add restaurant/kitchen source (forward-compatible for multi-kitchen deployments)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS 
  kitchen_source TEXT DEFAULT 'HFC Main Kitchen';

-- 4. NEW TABLE — Customer ratings for deliveries
CREATE TABLE IF NOT EXISTS public.delivery_ratings (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL,        -- denormalized snapshot at time of rating
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback_text TEXT,              -- optional comment
  rated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_order_rating UNIQUE (order_id)
);

-- 5. Enable Row Level Security (RLS) on delivery_ratings
ALTER TABLE public.delivery_ratings ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
DROP POLICY IF EXISTS "Admin read all ratings" ON public.delivery_ratings;
CREATE POLICY "Admin read all ratings" ON public.delivery_ratings 
  FOR SELECT USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
  );

DROP POLICY IF EXISTS "Agent read own ratings" ON public.delivery_ratings;
CREATE POLICY "Agent read own ratings" ON public.delivery_ratings 
  FOR SELECT USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'agent'
    AND agent_id = (auth.jwt() -> 'user_metadata' ->> 'agent_id')
  );

-- 7. Submit Delivery Rating Function (SECURITY DEFINER RPC)
CREATE OR REPLACE FUNCTION public.submit_delivery_rating(
  p_order_id TEXT, p_rating INTEGER, p_feedback TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agent_id TEXT;
  v_agent_name TEXT;
  v_order_status TEXT;
BEGIN
  SELECT assigned_agent, status INTO v_agent_name, v_order_status
  FROM public.orders WHERE id = p_order_id;

  -- Only allow rating a delivered order, prevents fake/early ratings
  IF v_order_status <> 'delivered' THEN
    RAISE EXCEPTION 'Order must be delivered before rating';
  END IF;

  SELECT id INTO v_agent_id FROM public.agents WHERE name = v_agent_name;

  INSERT INTO public.delivery_ratings (id, order_id, agent_id, agent_name, rating, feedback_text)
  VALUES ('RATING-' || p_order_id, p_order_id, v_agent_id, COALESCE(v_agent_name, 'No Rider'), p_rating, p_feedback)
  ON CONFLICT (order_id) DO NOTHING;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.submit_delivery_rating(TEXT, INTEGER, TEXT) TO anon, authenticated, service_role;

-- Enable Realtime for the delivery_ratings table so agents/admins see incoming ratings live
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'delivery_ratings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_ratings;
    END IF;
END $$;
