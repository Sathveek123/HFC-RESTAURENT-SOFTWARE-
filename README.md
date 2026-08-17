# 🍗 HFC Consultancy Services — White-Label Restaurant Software Platform (v1.20.0)

> A modern, ultra-secure, white-label restaurant software ordering platform, admin management dashboard, and delivery agent portal engineered with Next.js 16, TypeScript, Tailwind CSS, Supabase PostgreSQL, and Sentry Error Monitoring.

[![Deployment](https://img.shields.io/badge/Deployment-Vercel%20Production-000000?style=for-the-badge&logo=vercel)](https://hfc-restaurent-software.vercel.app/)
[![Build Status](https://img.shields.io/badge/Build-Passing-2E7D32?style=for-the-badge&logo=nextdotjs)](https://hfc-restaurent-software.vercel.app/)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://hfc-restaurent-software.vercel.app/)
[![Compliance](https://img.shields.io/badge/Compliance-DPDP%20Act%202023-CC0000?style=for-the-badge)](https://hfc-restaurent-software.vercel.app/privacy)

---

## 🚀 Live Production Vercel URLs & Access Credentials

| Portal / Screen | Production URL | Credentials / Notes |
|-----------------|----------------|---------------------|
| 🌐 **Customer Website & Menu** | [https://hfc-restaurent-software.vercel.app](https://hfc-restaurent-software.vercel.app) | Public menu, interactive cart, coupon redemption, 2-step checkout |
| 🔑 **Admin Control Panel** | [https://hfc-restaurent-software.vercel.app/admin/login](https://hfc-restaurent-software.vercel.app/admin/login) | **Email:** `admin@hfcconsultancy.com` (or username `admin`) <br>**Password:** Configured via Supabase Auth |
| 🛵 **Delivery Portal** | [https://hfc-restaurent-software.vercel.app/agent/login](https://hfc-restaurent-software.vercel.app/agent/login) | Credentials provisioned via Admin Panel / Supabase Auth |
| 📍 **Customer Tracker** | `https://hfc-restaurent-software.vercel.app/track/[orderId]` | Real-time status stepper, QR payment scanner, single-order RPC lookup |
| ⚖️ **Privacy Policy (DPDP)** | [https://hfc-restaurent-software.vercel.app/privacy](https://hfc-restaurent-software.vercel.app/privacy) | Data subject rights, DPO contact, erasure requests |
| 📜 **Terms of Service** | [https://hfc-restaurent-software.vercel.app/terms](https://hfc-restaurent-software.vercel.app/terms) | Order fulfillment terms, 5% GST computation, refund rules |
| 🐙 **GitHub Repository** | [GitHub Repo](https://github.com/Sathveek123/HFC-RESTAURENT-SOFTWARE-) | Branch: `main` |


---

## 📱 Mobile Responsiveness & Screen Compatibility

The entire platform is engineered to render **flawlessly across 100% of mobile device viewports** (from 320px ultra-compact phones to 430px+ flagship smartphones, tablets, and desktop displays):

- **Responsive Grid System:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` automatically scales menu cards and dish blocks based on viewport width.
- **Mobile Touch Optimization:** All buttons and interactive controls feature min 44px touch targets with `-webkit-tap-highlight-color: transparent`.
- **Slide-Over Mobile Cart Drawer:** Full-screen responsive slide-over drawer with touch gesture support and sticky checkout summary.
- **Mobile Admin & Rider Panels:** Tables wrap horizontally with responsive scroll containers (`overflow-x-auto`) and collapsible topbar navigation menus.

---

## 🔒 6-Table Role-Based Database Security (RLS)

All database operations are governed by **Strict Row Level Security (RLS)** in PostgreSQL (`supabase/schema.sql`):

1. **`orders` Table:**
   - Public can `INSERT` (checkout flow).
   - Unauthenticated bulk queries (`GET /rest/v1/orders?select=*`) return **HTTP 403 Forbidden / Empty Array `[]`**.
   - Admin can `SELECT` all orders; Delivery Agents can ONLY `SELECT` orders assigned to their own name (`assigned_agent = auth.jwt() -> 'user_metadata' ->> 'agent_name'`).
   - Single-order customer tracking is served via a **`SECURITY DEFINER` function**: `get_order_by_id(p_order_id TEXT)`.
2. **`settings` Table:** Public can read site name and UPI ID; ONLY Admin can insert/update/delete.
3. **`bills` Table:** Scoped to staff. Delivery agents can ONLY read billing records for their assigned orders.
4. **`agents` Table:** `password_hash` column deleted. Rider accounts managed in Supabase Auth. Public reads blocked; staff-only `SELECT`.
5. **`coupons` & `products` Tables:** Public can read active items; ONLY Admin can create/update/delete.

---

## 🛠️ Environment Variables for Vercel Deployment

Ensure the following environment variables are set in your Vercel Project Settings (`Settings -> Environment Variables`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://cmwsffhenpckwkwgnmsy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_hZmCQNTdDAuysF3iU4IaYA_daEHVI8D
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

---

## 📊 Error Monitoring & Alerting

Integrated with `@sentry/nextjs`:
- Client runtime error tracking: `sentry.client.config.ts`
- Server route error tracking: `sentry.server.config.ts`
- Error capture helper: `lib/logger.ts` (`captureError()`, `reportSyncFailure()`)

---

© 2026 HFC Consultancy Services. All Rights Reserved.
