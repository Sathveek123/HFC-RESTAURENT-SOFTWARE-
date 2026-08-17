# 🛠️ HFC Admin Panel — Complete Documentation

> **URL:** https://hfc-cloud-kitchen-services-white-la.vercel.app/admin  
> **Login:** `/admin/login` → redirects to `/admin/dashboard`  
> **Auth:** Supabase Auth JWT based authentication (admin claims check)

---

## 🔐 Authentication

- Uses **Supabase Auth** (`signInWithPassword`) under the hood to log in.
- Authenticated state issues a valid Bearer JWT. All subsequent SELECT/INSERT/UPDATE queries carry this token.
- PostgreSQL RLS filters ensure only accounts with `'admin'` role metadata can execute updates, deletes, and sync settings/products.
- Admin credentials verified in backend routes. Unauthenticated requests redirect immediately to `/admin/login`.

---

## 📐 Admin Panel Layout

**File:** `app/admin/layout.tsx`

```
┌─────────────────────────────────────────────────────────┐
│  [HFC Logo]  ADMIN PANEL              [🔔] [👤] [Logout]│
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  Dashboard   │                                          │
│  Orders  🔴N │           Page Content Area              │
│  Kitchen     │                                          │
│  Bills       │                                          │
│  Products    │                                          │
│  Agents      │                                          │
│  Coupons     │                                          │
│  Settings    │                                          │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

- Fixed left sidebar navigation with hover highlights.
- The `Orders` tab displays a **pulsing red dot badge** showing the count of unseen orders.
- The `Kitchen View` tab displays a **red notification badge** showing the count of orders in preparation.
- Responsive: the sidebar transitions to a bottom navigation layout on mobile viewports.

---

## 📊 Dashboard Page

**URL:** `/admin/dashboard`  
**File:** `app/admin/dashboard/page.tsx`

- **Date Range Filter**: Limits analytical aggregation (default: start of current month to today).
- **KPI Metrics Row**:
  - Total Orders, Completed, Delivered, Pending counts.
  - Total Revenue, Avg Order Value, and New Today.
- **Rider Performance Table**: Aggregates rider dispatch metrics (orders assigned, completed deliveries, revenue collected).
- **Recent Orders Table**: Lists the 10 most recent orders with instant link to detail page.

---

## 📦 Orders List Page

**URL:** `/admin/orders`  
**File:** `app/admin/orders/page.tsx`

- **Sub-Second Updates**: Subscribes to the `orders` table WebSocket. Customer checkouts and rider status changes populate on the dashboard **instantly** without reloading.
- **Status Filter Tabs**: Split into Active (placed/accepted/ready/picked-up), New (placed), Accepted, Ready, Out for Delivery (picked-up), Delivered, Cancelled, and All.
- **Search & Filters**: Searchable by Order ID, Customer Name, and Phone. Filterable by date ranges, order types, and payment flags.
- **Safety Window**: Limits default fetch query to the last 30 days to optimize network egress.

---

## 📋 Order Detail Page

**URL:** `/admin/orders/[orderId]`  
**File:** `app/admin/orders/[orderId]/page.tsx`

### 2-Column layout:
- **Left Column**: Itemized order summary, XSS-sanitized delivery/customer address, coordinates, CGST/SGST split calculations, coupon discount, and payment summary.
- **Right Column**:
  - **Status Updates**: Accept Order, Mark Prepared, Out For Delivery, Mark Delivered, Reject, Cancel.
  - **Rider Assignment**: Assign to active riders (notifying them via WhatsApp links).
  - **Quick Actions**: View customer tracker link, Duplicate Order (assigns a fresh UUID), and Toggle Regular Customer loyalty status.

---

## 🍳 Kitchen View Monitor (KDS)

**URL:** `/admin/kitchen`  
**File:** `app/admin/kitchen/page.tsx`

- **Active Cooking Feed**: Real-time list showing accepted orders (`status = 'accepted'`) sorted by oldest first.
- **Chef Bell Alerts**: Generates a high-fidelity soft kitchen bell tone (Web Audio API) when new orders are accepted to catch cook attention.
- **Time Elapsed color-coding**: Timers calculate elapsed cooking duration and flash red warning pulses if delay > 20 minutes.
- **Wall-Mount mode**: A text-scaling accessibility toggle that increases dish name sizes by 40% for kitchen-mounted screens.
- **"Mark Ready" Transition**: Cook clicks "Food Ready & Packed" to atomically transition the order to `ready` status.
- **KDS Screen Lock Security**: Allows locking the tablet screen with a temporary 4-digit passcode for unattended wall-mount operation.
  - **Bypass / Recovery Path**: Since the session passcode is stored in RAM (component state), if a cook forgets the PIN, simply refresh the browser (F5). The page will reload, the lock will reset to unlocked, and the latest active orders will be hydrated from the Supabase database instantly (<1s) with zero loss of order history.

---

## 🍽️ Products Page

**URL:** `/admin/products`  
**File:** `app/admin/products/page.tsx`

- Manage menu catalog items (Add, Edit, Delete, Toggle Availability, Toggle Bestseller).
- All changes are synchronized to the `public.products` database table via a secure `sync_product` RPC.
- Toggling availability propagates to customer menu interfaces in under 1 second.

---

## 🧾 Bills Page

**URL:** `/admin/bills`  
**File:** `app/admin/bills/page.tsx`

- Bills are automatically generated on checkout via the `auto_create_bill` PostgreSQL database trigger.
- Fetches billing invoices from Supabase in a rolling 30-day window.
- Quick action to mark bills "Paid" or preview a printable layout.
- Aggregates overall totals (Total Revenue, Paid, Unpaid).

---

## 🛵 Delivery Agents Page

**URL:** `/admin/agents`  
**File:** `app/admin/agents/page.tsx`

- **Secure Provisioning**: Adding an agent submits a request to the server-side API `/api/admin/agents/provision` with the admin JWT token. The server provisions the user credentials securely in Supabase Auth using the service role key.
- **Agents Table**: Toggle active status (inactive riders are hidden from dropdowns), WhatsApp links, coverage areas, and total deliveries count.
- **Unassign Guard**: Deleting a rider automatically resets assignment fields on active orders assigned to them.
