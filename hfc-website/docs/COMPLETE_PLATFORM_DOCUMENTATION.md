# 🍳 HFC Restaurant Platform — Complete Technical & Operational Documentation
**Document Version:** v1.0.0  
**Last Updated:** August 18, 2026  
**Status:** Live & Production Ready  

---

## 1. Core Architecture & Philosophy

The HFC Restaurant Platform is a real-time, multi-device, secure restaurant management system spanning across four major portals — the Customer Website, Admin Control Panel, Kitchen Display System, and Delivery Agent Portal.

```
┌──────────────────────────────────────────────────────────────────┐
│                   Supabase Cloud PostgreSQL DB                   │
│                    (Single Source of Truth)                      │
└──────┬─────────────────────────────────────────────────────┬─────┘
       │           (Realtime WebSockets Sync)                │
       ▼                                                     ▼
┌─────────────────────┐             ┌──────────────────────────────┐
│  Customer Website   │             │   Admin Control Panel        │
│  Table QR Ordering  │             │   Orders / Bills / Products  │
│  Counter Takeaway   │             │   Agents / Coupons / Settings│
│  Live Tracker       │             │   Inventory / Kitchen KDS    │
└─────────────────────┘             └──────────────────────────────┘
                              ▼
              ┌───────────────────────────────┐
              │    Delivery Agent Portal       │
              │    Orders / Rider Analytics    │
              └───────────────────────────────┘
```

---

## 2. What Makes This Software Unique (vs. Cloud Kitchen)

The Restaurant Platform includes all Cloud Kitchen features PLUS additional modules exclusive to dine-in operations:

### 2.1 QR-Based Table Ordering System
Unlike Cloud Kitchen, this software includes a full QR-based table ordering system:
* **Session-Based Table Management:** Tables are assigned locked ordering sessions with cryptographic session tokens. Customers scan a QR code and can add items, track their tab, and request bill payment without any staff help.
* **Multi-Round Ordering:** Customers can keep adding to the same session throughout their dine-in (drinks, desserts, extra portions).
* **Admin Table Dashboard:** Admins can view all active table sessions with their total amounts, session start times, and active statuses.

---

## 3. Comprehensive Database Schema & Security RLS

### 3.1 Exclusive Restaurant Tables

* **`table_sessions` (Table QR Ordering):**
  - `id` (UUID PK): Session UUID.
  - `table_number` (TEXT): Physical table reference (e.g., `1`, `3B`, `A-5`).
  - `session_token` (TEXT UNIQUE): Cryptographic token assigned to the ordering device.
  - `status` (TEXT): `active` | `payment_pending` | `completed`.
  - `total_amount` (NUMERIC): Running bill total for the session.
  - `items` (JSONB): Ordered items array.
  - `created_at`, `completed_at` (TIMESTAMPTZ): Session timestamps.

* **`orders` (Customer Transactions — with Table System columns):**
  - Includes all columns from Cloud Kitchen PLUS:
  - `source` (TEXT): `'counter-qr'` | `'table-qr'` | `'website'`.
  - `token_number` (TEXT): Auto-assigned takeaway token (format: `TA0001`).

### 3.2 Core Shared Tables
All standard tables (`bills`, `settings`, `agents`, `products`, `coupons`, `ingredients`, `recipes`, `kitchen_closing`) are identical to Cloud Kitchen — see Cloud Kitchen documentation for full column specs.

---

## 4. Core Modules Implementation

### 4.1 QR Table Ordering System (`app/table/`, `app/api/table/`)
* **Create Session (`/api/table/create-session`):** On first scan, generates a new table session with a `session_token`. Subsequent scans from different devices using the same URL are rejected unless they hold the original session token cookie.
* **Add Items (`/api/table/add-items`):** Appends newly ordered items to the session's JSONB array and updates the running total.
* **Check Lock (`/api/table/check-lock`):** Verifies if the session is still active and controlled by the requesting device.
* **Complete Order (`/api/table/complete-order`):** Marks the session as `payment_pending` and locks further additions.
* **Release Table (`/api/table/release-table`):** Admin API to reset a table session after checkout is complete.

### 4.2 Self-Service Counter & Takeaway QR Ordering (`app/counter/`)
* Identical to Cloud Kitchen — see `docs/TAKEAWAY_QR_SYSTEM.md` for full spec.

### 4.3 Admin Tables Dashboard (`app/admin/tables/`)
* Displays all tables and their current session status.
* Enables admin override to release locked tables and reset sessions manually.
* Live session total amounts visible per table for cashier convenience.

### 4.4 Rider Settlement & Gig-Economy Analytics (`app/agent/report/`)
* Identical to Cloud Kitchen — see `docs/RIDER_ANALYTICS_SYSTEM.md` for full spec.

### 4.5 Inventory, Recipes & EOD Closing Counts (`app/admin/inventory/`)
* Full ingredient tracking, recipe mapping, daily discrepancy reports, and WhatsApp procurement export.

### 4.6 Wall-Mount Kitchen Display System (KDS) (`app/admin/kitchen/`)
* Live order stream — includes `'placed'` and `'accepted'` statuses.
* Audio chime alerts on new orders. Color-coded elapsed time warnings.
* PIN screen lock overlay. Wall-mount big-text mode.

---

## 5. All Live URLs (Production — hfc-restaurent-software.vercel.app)

* **Customer Website & Menu:** https://hfc-restaurent-software.vercel.app
* **QR Table Ordering — Table 1:** https://hfc-restaurent-software.vercel.app/table/1
* **QR Table Ordering — Table 2:** https://hfc-restaurent-software.vercel.app/table/2
* **Counter Takeaway Page:** https://hfc-restaurent-software.vercel.app/counter
* **Live Order Tracker:** https://hfc-restaurent-software.vercel.app/track/[orderId]
* **Admin Login:** https://hfc-restaurent-software.vercel.app/admin/login
* **Admin Dashboard:** https://hfc-restaurent-software.vercel.app/admin/dashboard
* **Admin Orders:** https://hfc-restaurent-software.vercel.app/admin/orders
* **Admin Bills:** https://hfc-restaurent-software.vercel.app/admin/bills
* **Admin Products:** https://hfc-restaurent-software.vercel.app/admin/products
* **Admin Agents:** https://hfc-restaurent-software.vercel.app/admin/agents
* **Admin Tables:** https://hfc-restaurent-software.vercel.app/admin/tables
* **Admin Settings:** https://hfc-restaurent-software.vercel.app/admin/settings
* **Admin Coupons:** https://hfc-restaurent-software.vercel.app/admin/coupons
* **Admin Inventory:** https://hfc-restaurent-software.vercel.app/admin/inventory
* **Admin Inventory Purchase:** https://hfc-restaurent-software.vercel.app/admin/inventory/purchase
* **Admin Inventory Recipes:** https://hfc-restaurent-software.vercel.app/admin/inventory/recipes
* **Admin Inventory Reports:** https://hfc-restaurent-software.vercel.app/admin/inventory/reports
* **Admin Inventory Stock:** https://hfc-restaurent-software.vercel.app/admin/inventory/stock
* **Kitchen Display (KDS):** https://hfc-restaurent-software.vercel.app/admin/kitchen
* **Kitchen EOD Closing:** https://hfc-restaurent-software.vercel.app/admin/kitchen/closing
* **Rider Login:** https://hfc-restaurent-software.vercel.app/agent/login
* **Rider Orders:** https://hfc-restaurent-software.vercel.app/agent/orders
* **Rider Analytics:** https://hfc-restaurent-software.vercel.app/agent/report
* **Privacy Policy:** https://hfc-restaurent-software.vercel.app/privacy
* **Terms of Service:** https://hfc-restaurent-software.vercel.app/terms
* **Refund Policy:** https://hfc-restaurent-software.vercel.app/refund-policy

---

## 6. Key Security Audits & Vulnerability Patches

* **Session Token Integrity:** Table ordering sessions use cryptographic tokens — if a different device scans the same QR, they see the menu but cannot add items or corrupt the bill.
* **Server-Side Order Validation:** All customer orders pass through `/api/orders/create` which recomputes coupons, GST, delivery charges, and totals server-side. Client-side price manipulation via DevTools has zero effect.
* **IP Rate Limiting:** Checkout API is rate-limited to 20 submissions per IP per minute to prevent order flooding.
* **Plaintext Password Elimination:** Rider passwords are managed via Supabase Auth, not plain database columns.
* **Bills RLS SECURITY DEFINER Hotfix (Aug 18, 2026):** Resolved the `new row violates row-level security policy for table "bills"` error by upgrading trigger functions with `SECURITY DEFINER` and using Service Role client in API routes.

---

## 7. Deployment & Configuration Checklist

### 7.1 Environment Variables
Set the following in Vercel environment variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://cmwsffhenpckwkwgnmsy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_hZmCQNTdDAuysF3iU4IaYA_daEHVI8D
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 7.2 Admin Credentials
Provisioned via Supabase Auth Dashboard.

### 7.3 Kitchen Staff PINs
* Sathveek → `1234`
* Raju → `5678`
* Kitchen Chef → `2026`
