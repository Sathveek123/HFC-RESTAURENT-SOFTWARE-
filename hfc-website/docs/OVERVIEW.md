# 🏗️ HFC Cloud Kitchen — Project Overview

> **Production URL:** https://hfc-cloud-kitchen-services-white-la.vercel.app  
> **Supabase Project:** cmwsffhenpckwkwgnmsy  
> **Stack:** Next.js 16.3 · TypeScript · Tailwind CSS v4 · Supabase · Zustand · Vercel

---

## About the Project

**HFC Consultancy Services** is a premium Food & Beverage consultancy brand based in Kasibugga, Srikakulam District, Andhra Pradesh, India. This application serves as their:

1. **Customer-facing website** — Cloud kitchen ordering platform with live menu, cart, and coupon support
2. **Admin panel** — Full business management dashboard (orders, products, bills, coupons, agents, settings)
3. **Delivery agent portal** — Lightweight rider-facing app for order dispatch and status updates

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | **Next.js 16.3** (App Router, React Server Components) |
| Language | **TypeScript** |
| Styling | **Tailwind CSS v4** with custom HFC design tokens |
| Animations | **Framer Motion** |
| State Management | **Zustand** with `persist` middleware (localStorage) |
| Database | **Supabase PostgreSQL** (cloud, primary source of truth) |
| Realtime | **Supabase Realtime** WebSockets (sub-second cross-device sync) |
| Auth | **Supabase Auth** (admin + agent credentials via `auth.users`) |
| Error Monitoring | **Sentry** (`@sentry/nextjs` — active exception capture) |
| Uptime Monitoring | **UptimeRobot** (12hr Supabase ping + 5min Vercel ping) |
| Deployment | **Vercel** (auto-deploy from Git) |
| QR Codes | `qrcode.react` |
| Icons | **Lucide React** |
| Date Utilities | `date-fns` |
| Toast Notifications | `react-hot-toast` |
| Package Manager | `npm` |

---

## 📁 Directory Structure

```
hfc-website/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Customer homepage (/) + realtime sync bootstrap
│   ├── layout.tsx              # Root layout (Navbar + Footer + Providers)
│   ├── globals.css             # Global CSS + Tailwind imports
│   ├── admin/                  # Admin Panel routes
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── orders/
│   │   │   ├── page.tsx        # Orders list (realtime)
│   │   │   └── [orderId]/page.tsx  # Order detail
│   │   ├── products/page.tsx   # Products management (realtime)
│   │   ├── kitchen/page.tsx    # Kitchen Display Monitor (KDS)
│   │   ├── bills/page.tsx      # Bills & invoices (Supabase)
│   │   ├── coupons/page.tsx    # Coupons, Offers & Reward Tiers (realtime)
│   │   ├── agents/page.tsx     # Delivery agent management
│   │   └── settings/page.tsx   # Business settings (realtime)
│   ├── agent/                  # Delivery Agent Portal routes
│   │   ├── layout.tsx          # Agent auth guard + topbar
│   │   ├── login/page.tsx
│   │   ├── orders/page.tsx     # My Orders (realtime)
│   │   └── report/page.tsx     # My Report (personal analytics)
│   ├── track/
│   │   └── [orderId]/page.tsx  # Live order tracker (customer-facing, realtime)
│   └── api/
│       └── admin/
│           └── agents/provision/route.ts  # Secure agent provisioning endpoint
│
├── components/                 # Reusable React components
│   ├── admin/                  # Admin panel components
│   │   ├── shared/             # AdminBadge, AdminTable, EmptyState
│   │   ├── orders/             # AgentDropdown, OrdersTable, etc.
│   │   ├── products/           # ProductForm, ProductRow, etc.
│   │   ├── bills/              # Bills table components
│   │   ├── coupons/            # CouponForm, RewardTierForm, etc.
│   │   ├── agents/             # AddAgentForm, AgentsTable, etc.
│   │   └── settings/           # Card-based settings components
│   ├── hero/                   # Hero section (HeroSection, HeroBrandCircle, etc.)
│   ├── cart/                   # Cart drawer + checkout (CartDrawer, CartItem, CartButton)
│   ├── layout/                 # Navbar, Footer
│   ├── menu/                   # MenuSection, MenuGrid, MenuCard, CategoryTabs
│   └── splash/                 # SplashScreen
│
├── store/                      # Zustand state stores (all Supabase-synced)
│   ├── orderStore.ts           # Orders — Supabase + Realtime
│   ├── agentsStore.ts          # Delivery agents — Supabase
│   ├── agentAuthStore.ts       # Agent auth (localStorage persistence)
│   ├── adminAuthStore.ts       # Admin auth
│   ├── cartStore.ts            # Shopping cart (localStorage)
│   ├── productsStore.ts        # Menu products — Supabase + Realtime + self-healer
│   ├── promotionsStore.ts      # Coupons, Offers, Reward Tiers — Supabase + Realtime
│   ├── settingsStore.ts        # Business settings — Supabase + Realtime
│   ├── recipeStore.ts          # Recipe configuration mappings
│   ├── inventoryStore.ts       # Raw material stock entries & closing logs
│   └── billsStore.ts           # Bills — Supabase
│
├── lib/                        # Utility functions
│   ├── supabase.ts             # Supabase client singleton
│   ├── supabaseSync.ts         # All sync functions, RPCs, and realtime subscriptions
│   ├── inventoryHelpers.ts     # Consumption math & variance calculations
│   └── whatsapp.ts             # WhatsApp message builder + link opener
│
├── hooks/                      # Custom React hooks
│   └── useSplash.ts            # Splash screen show/skip logic
│
├── data/                       # Static seed data
│   └── menuData.ts             # Default menu items (used as self-healer seed)
│
└── docs/                       # This documentation (16 files — v2.5.5)
```

---

## 🔄 Data Architecture

```
┌────────────────────────────────────────┐
│     Supabase PostgreSQL (Cloud DB)     │  ← SINGLE SOURCE OF TRUTH
│  orders · products · agents · bills   │
│  settings (promotions · site config)  │
│  ingredients · stock_entries · recipes │
│  kitchen_closing · daily_stock_summary │
└─────────────────┬──────────────────────┘
                  │  Realtime WebSockets
          ┌───────┴──────────┐
          ▼                  ▼
   Zustand Stores      All UI Surfaces
   (localStorage       (Admin / Agent /
     cache)             Customer website)
```

### Key localStorage Keys

| Key | Store | Supabase Key |
|-----|-------|-------------|
| `hfc-orders` | orderStore | `public.orders` table |
| `hfc-agents` | agentsStore | `public.agents` table |
| `hfc-agent-session` | agentAuthStore | `auth.users` |
| `hfc-products` | productsStore | `public.products` table |
| `hfc-promotions` | promotionsStore | `settings.key = 'promotions'` |
| `hfc-bills` | billsStore | `public.bills` table |
| `hfc-settings` | settingsStore | `settings.key = 'site_settings'` |

---

## 🌐 Route Map

```
/                           → Customer homepage (menu + cart + realtime)
/track/[orderId]            → Live order tracker (realtime WebSocket)
/admin/login                → Admin authentication
/admin/dashboard            → Analytics & KPIs
/admin/orders               → Orders list (all statuses, realtime)
/admin/orders/[orderId]     → Order detail & management
/admin/products             → Menu product management (realtime)
/admin/inventory            → Live depletion levels & variance dashboard (realtime)
/admin/inventory/stock      → Opening stock & inward vendor invoices
/admin/inventory/recipes    → Map menu items to raw material recipe quantities
/admin/inventory/purchase   → Procurement assistant with WhatsApp sharing exports
/admin/inventory/reports    → Historical daily audits & shrinkage logs
/admin/bills                → Bills & invoices
/admin/coupons              → Coupons, Offers & Reward Tiers (realtime)
/admin/agents               → Delivery agent accounts
/admin/settings             → Business configuration (realtime)
/admin/kitchen              → Kitchen Display Monitor (KDS)
/admin/kitchen/closing      → Staff EOD physical remaining count submission
/agent/login                → Agent authentication
/agent/orders               → My Orders (agent-filtered, realtime)
/agent/report               → My Report (personal analytics)
/api/admin/agents/provision → Secure server-side agent creation endpoint
/api/admin/clean-orders     → Admin maintenance endpoint
/privacy                    → Privacy policy
/terms                      → Terms & conditions
```

---

## 📱 WhatsApp Integration

All order notifications use WhatsApp — no third-party API, zero cost:

- **Customer places order** → WhatsApp opens with full order details sent to `+91 99127 99855`
- **Admin assigns agent** → "Notify agent" button sends WhatsApp to agent's number
- **Order tracker link** is included in every WhatsApp message: `/track/[orderId]`

---

## 🔒 Security Model

| Layer | Protection |
|-------|-----------|
| Admin credentials | Supabase Auth JWT — `role: 'admin'` claim enforced at DB + client level |
| Agent credentials | Stored only in Supabase Auth (`auth.users`) — no plaintext anywhere in codebase |
| Order bulk dump | Blocked by RLS — customers can only fetch own order via `get_order_by_id()` RPC |
| Settings writes | Protected by `sync_setting()` SECURITY DEFINER RPC |
| Agent provisioning | Server-side API route (`/api/admin/agents/provision`) with JWT verification |
| XSS defense | All user inputs sanitized via `sanitizeInput()` before storage |
| Duplicate orders | Idempotency guard in `addOrder()` checks existing ID before insert |
| Credential exposure | Full repo scan confirmed 0 hardcoded passwords in source files (v2.2.0) |
| Uptime | UptimeRobot pings every 12hr (Supabase) + 5min (Vercel) — free tier never pauses |

---

*Last updated: v2.5.1 — KDS Navigation Alignment — August 15, 2026*
