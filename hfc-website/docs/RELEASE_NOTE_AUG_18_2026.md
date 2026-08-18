# 🚀 HFC Restaurant Platform Release Notes (August 18, 2026)
**Version:** v1.21.0  
**Release Date:** August 18, 2026  
**Status:** Deployed & Verified  

---

## 📋 Release Summary

This release introduces the **Takeaway QR / Self-Service Counter Ordering** system, deploys the **Rider Performance & Gig-Economy Analytics Dashboard** for delivery agents and admins, resolves a critical database trigger RLS blocking issue on the counter checkout, fixes a KDS order filtering bug, and corrects domain metadata configurations to fix link previews.

---

## 🛠️ Detailed Features Deployed

### 1. Self-Service Counter Takeaway & QR Ordering
* Deployed customer ordering interface at `/counter` featuring menu browsing, cart checkout, dynamic UPI payment QR code generation, and real-time token tracking.
* Implemented automatic daily-resetting token numbers (e.g. `TA0001`, `TA0002`...).
* Designed a real-time order preparation status monitor featuring audio notifications (chimes) and haptic vibrations once the order state transitions to `'ready'`.

### 2. Rider Settlement & Analytics System
* Created Postgres database schemas (`migration-rider-analytics.sql` and `migration-delivery-rates.sql`) mapping rider performance parameters.
* Deployed a premium analytics panel for delivery agents at `/agent/report`, detailing daily volumes, score indicators, ratings, and logs.
* Added an interactive settlement panel for administrators under `/admin/agents/[agentId]/performance` with payout calculators, bonuses, and cash deductions.
* Integrated a 5-star review card inside the order tracker page (`/track/[orderId]`) for customer feedback.

---

## 🐞 Critical Hotfixes & Stability Updates

### 1. Counter Order Placement & Bills RLS Resolution
* **The Problem:** Placing a counter order failed with `new row violates row-level security policy for table "bills"`. An order insert fires `auto_create_bill_trigger` to create a bill, which was blocked under the default anonymous caller context.
* **The Solution:** 
  - Updated the `/api/counter/create-order` API route to use the Supabase **Service Role** client, allowing order insertions to execute with administrative bypass privileges.
  - Wrote a hotfix script [hotfix-bills-rls.sql](file:///d:/Client%20Projects%20-%20White%20Label%20brand/hfc-website/supabase/hotfix-bills-rls.sql) to add missing database columns (`items`, `payment_method`, `order_type`, `coupon_code`) and recreate the database triggers with `SECURITY DEFINER` access controls.

### 2. Kitchen Display (KDS) Real-Time Order Stream
* **The Problem:** Takeaway orders placed via QR codes initialized in `'placed'` status, but the KDS panel was configured to filter and display orders only when status was `'accepted'`, keeping new orders hidden.
* **The Solution:** Updated KDS order memo filters to display both `'placed'` and `'accepted'` states. Added real-time order sync subscriptions to the KDS mount lifecycle so incoming takeaway and delivery orders appear live without needing page reloads.

### 3. OpenGraph Preview Domain & App Favicon Fixes
* **The Problem:** The app layout metadata was using the old placeholder domain `hfc-website-two.vercel.app` for link previews, causing crawlers to display the old template logo.
* **The Solution:** Updated all layout metadata, OG tags, Twitter cards, and structured JSON-LD schemas in [layout.tsx](file:///d:/Client%20Projects/DCH%20PROJECTS/HFC%20Restaurent%20Kitchen%20-%20White%20Label%20brand/hfc-website/app/layout.tsx) to use the correct domain `https://hfc-restaurent-software.vercel.app`. Copied `logo.jpeg` as `favicon.ico` in both `/public` and `/app` to ensure the tab icon works correctly across all browsers.

---

## 📊 Verification & Builds Check
* Deployed code compiles successfully with no TypeScript errors:
  - `npm run build` -> **PASS** ✓
* Live WebSockets successfully sync order status events.
