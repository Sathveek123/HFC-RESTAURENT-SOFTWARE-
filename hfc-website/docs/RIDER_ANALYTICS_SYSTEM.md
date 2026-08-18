# 🛵 Rider Performance & Gig-Economy Analytics System Specification
**Release Date:** August 18, 2026  
**Status:** Deployed & Verified  

---

## 🏛️ System Overview

The **Rider Performance & Gig-Economy Analytics System** upgrades the basic delivery report page into a comprehensive performance, settlement, and quality monitoring dashboard. It enables delivery agents to track their earnings and ratings, and provides administrators with settlement calculators, commission parameters, and customer ratings metrics.

```
[ Customer Rating Submission ] ──(RPC: submit_delivery_rating)──► [ delivery_ratings Table ]
                                                                             │
                                                                       (Aggregation)
                                                                             │
                                                                             ▼
[ Agent Analytics Dashboard ] ◄──────(Zustand + Real-Time Sync)────── [ Admin settling tools ]
```

---

## 💻 Architecture & Component Breakdown

### 1. Database Schema Additions (`migration-rider-analytics.sql`)

* **New Order Analytics Columns:**
  - `rider_earning` (NUMERIC): The payout calculated for the agent for a specific delivery.
  - `estimated_delivery_minutes` (INTEGER): Estimated delivery duration benchmark.
  - `picked_up_at` (TIMESTAMPTZ): Timestamp when the rider changed status to `picked-up`.
  - `kitchen_source` (TEXT): Identifies the preparation kitchen branch.

* **Delivery Feedback System (`delivery_ratings` table):**
  - Columns: `id` (UUID PK), `order_id` (TEXT), `agent_name` (TEXT), `rating` (INTEGER 1-5), `review_text` (TEXT), `created_at`.
  - RPC function: `submit_delivery_rating(p_order_id, p_rating, p_review_text)` which inserts customer ratings securely.

---

### 2. User Interface Pages & Components

* **Agent Performance Dashboard (`app/agent/report/page.tsx`):**
  - **Analytics Cards:** Real-time metrics for Daily Deliveries, Total Earnings, On-Time Performance (calculated against estimated time), and average Customer Rating.
  - **Score Ring:** Displays a composite Rider Score based on ratings and on-time percentage.
  - **Volume Charts:** Grouped daily delivery count columns using SVG layouts.
  - **Date Range Filters:** Allows riders to select customized start/end dates to audit their logs.

* **Admin Rider Management Drilldown (`app/admin/agents/[agentId]/performance/page.tsx`):**
  - **Settlement Calculator:** Allows administrators to calculate payouts dynamically by setting a flat fee or commission percentage, factoring in cash-collected deductions and bonuses.
  - **Performance Benchmarks:** Audits the rider's average rating, total deliveries, and on-time performance charts.
  - **Real-Time Order List:** Chronological log of orders completed by the rider within the selected date range.

* **Customer Rating Card (`app/track/[orderId]/page.tsx`):**
  - Renders a 5-star interactive review card when the order status reaches `'delivered'`.
  - Customers can rate their delivery rider and submit comments, writing directly into the `delivery_ratings` table via RPC.

---

## 🔒 Settlement Formula & Logic

Rider earnings are computed atomically during the status transition in the order store (`store/orderStore.ts`):
1. Upon changing order status to `'delivered'`, the system checks settings for commission structures:
   - **Flat Commission:** Adds a fixed reward per order (e.g. ₹40).
   - **Percentage Commission:** Allocates a percentage of the total order value.
2. The calculated value is saved into `rider_earning`.
3. In the admin performance console, the net settlement is calculated as:
   $$\text{Net Payout} = \text{Total Rider Earnings} + \text{Bonuses} - \text{Cash In Hand Collected}$$

---

## 🔒 Privacy, PII & RLS Scoping Compliance

To ensure strict security and compliance with customer/rider privacy standards:
1. **No Live Location or GPS Telemetry:** The platform does NOT collect, stream, or log continuous GPS coordinates or location tracking of the riders. Performance on-time metrics are calculated strictly from transactional status changes (`picked_up_at` and order timestamp bounds).
2. **Teammate Data Isolation (Anti-Leakage):** The RLS policies strictly partition rider scores. Delivery agents cannot query teammate ratings, reviews, or earnings. Selecting from `public.delivery_ratings` restricts entries using the rider's Auth metadata claim ID:
   `agent_id = (auth.jwt() -> 'user_metadata' ->> 'agent_id')`
3. **Admin Exclusivity:** Only authenticated users with `role = 'admin'` claims can run global aggregations or perform rider payout settlements.
4. **Rating Fraud Prevention:** The `submit_delivery_rating` RPC validates that the corresponding order status is `'delivered'` before accepting inputs, blocking early submissions or false ratings.

---

## 🛠️ Verification & Build Status

* Verified compiler builds: both Restaurant and Cloud Kitchen codebases compile successfully with no TypeScript warnings.
* All settings inputs (eta parameters, targets) sync dynamically across the administrative controls.
