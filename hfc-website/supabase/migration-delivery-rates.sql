-- ══════════════════════════════════════════════════════════════════════════════
-- HFC RESTAURANT SOFTWARE — DELIVERY AGENT COMMISSIONS MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Add delivery_rate column to agents table (Defaults to ₹40.00 per order)
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS delivery_rate NUMERIC(10,2) NOT NULL DEFAULT 40.00;

-- 2. Re-create sync_agent RPC to support mapping of delivery_rate from payload
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
    id, name, whatsapp, username, is_active, vehicle_type, coverage_area, total_deliveries, created_at, delivery_rate
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
    COALESCE((agent_row->>'created_at')::TIMESTAMPTZ, NOW()),
    COALESCE((agent_row->>'delivery_rate')::NUMERIC, 40.00)
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    whatsapp = EXCLUDED.whatsapp,
    username = EXCLUDED.username,
    is_active = EXCLUDED.is_active,
    vehicle_type = EXCLUDED.vehicle_type,
    coverage_area = EXCLUDED.coverage_area,
    total_deliveries = EXCLUDED.total_deliveries,
    delivery_rate = EXCLUDED.delivery_rate;
END;
$$;

-- Re-assign permissions
REVOKE EXECUTE ON FUNCTION public.sync_agent(JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_agent(JSONB) TO authenticated;
