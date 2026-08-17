# 📚 HFC Cloud Kitchen — Documentation Index

> **HFC Consultancy Services** — Premium Food & F&B Consultancy  
> Full-stack Next.js application: Customer Website + Admin Panel + Delivery Agent Portal  
> **Production URL:** https://hfc-cloud-kitchen-services-white-la.vercel.app

---

## 📁 Documentation Files

| File | Description |
|------|-------------|
| [OVERVIEW.md](./OVERVIEW.md) | Project overview, tech stack, architecture |
| [BRAND_SYSTEM.md](./BRAND_SYSTEM.md) | Design tokens, color palette, typography |
| [WEBSITE.md](./WEBSITE.md) | Customer-facing website — all sections & features |
| [ORDER_FLOW.md](./ORDER_FLOW.md) | Complete end-to-end order lifecycle |
| [ADMIN_PANEL.md](./ADMIN_PANEL.md) | Admin panel — all pages & functionality |
| [DELIVERY_PORTAL.md](./DELIVERY_PORTAL.md) | Delivery agent portal — login, orders, report |
| [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) | Zustand stores — data models & actions |
| [COMPONENTS.md](./COMPONENTS.md) | Component architecture & directory structure |
| [COUPONS_OFFERS.md](./COUPONS_OFFERS.md) | Promotions system — coupons, offers, reward tiers |
| [SETTINGS.md](./SETTINGS.md) | Settings panel — all configuration options |
| [SUPABASE_INTEGRATION.md](./SUPABASE_INTEGRATION.md) | Supabase Cloud DB, schema, WebSockets, rate-limiting queue |
| [REALTIME_SYNC_ARCHITECTURE.md](./REALTIME_SYNC_ARCHITECTURE.md) | Detailed sync flows, RLS, triggers, and solved bugs |
| [AUDIT_AND_HARDENING.md](./AUDIT_AND_HARDENING.md) | Production technical audit, security hardening, E2E results |
| [CHANGELOG.md](./CHANGELOG.md) | Build history & feature changelog |

---

## 🚀 Quick Start

```bash
cd hfc-website
npm install
npm run dev        # http://localhost:3000
```

**Key URLs (Production):**

| Surface | URL |
|---------|-----|
| Customer Website | `https://hfc-cloud-kitchen-services-white-la.vercel.app/` |
| Admin Login | `https://hfc-cloud-kitchen-services-white-la.vercel.app/admin/login` |
| Admin Dashboard | `https://hfc-cloud-kitchen-services-white-la.vercel.app/admin/dashboard` |
| Agent Login | `https://hfc-cloud-kitchen-services-white-la.vercel.app/agent/login` |
| Order Tracker | `https://hfc-cloud-kitchen-services-white-la.vercel.app/track/[orderId]` |

## 🔐 Access Credentials

All user credentials (admins and delivery agents) are stored securely inside **Supabase Auth** (`auth.users`) to prevent data leakage:
- **Admin**: Log in using the username `admin` or email `admin@hfcconsultancy.com`. The default setup password is configured upon first launch and should be managed via the Supabase Admin console.
- **Riders**: Log in using usernames and passwords provisioned dynamically in the Admin panel.

---

*Last updated: v2.5.1 (KDS Navigation Alignment) — August 15, 2026*

