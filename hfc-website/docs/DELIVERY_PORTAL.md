# 🛵 HFC Delivery Agent Portal — Complete Documentation

> **URL:** https://hfc-restaurant-software.vercel.app/agent  
> **Login:** `/agent/login`  
> **Auth:** Supabase Auth JWT based authentication (delivery agent claims check)  
> **Persistence:** `localStorage` key `hfc-agent-session` (agent ID)

---

## Overview

The Delivery Agent Portal is a **lightweight, mobile-first** interface for HFC delivery riders. It is completely separate from the admin panel. 

It retrieves and updates data directly in **Supabase PostgreSQL** via authenticated queries. Any change propagates in under 1 second to the customer's live tracker and the admin orders dashboard via WebSockets.

**Strict RLS Scoping:** Riders can ONLY read or update orders assigned specifically to their agent name. All other order queries return `403 Forbidden` at the database level.

---

## 🔐 Authentication

- **Database Separation**: Agent passwords are NOT stored in the public database table. The `password_hash` column has been dropped from `public.agents`. Credentials live securely within **Supabase Auth** (`auth.users`).
- **Provisioning**: When an Admin creates a new agent via `/admin/agents`, the browser invokes `/api/admin/agents/provision` server-side, which triggers the Admin Auth API to create the credential and set `role: 'agent'` and `agent_name: 'Name'` in user metadata.
- **Login Flow**:
  1. Agent enters username + password at `/agent/login`.
  2. `agentAuthStore.login()` calls `authenticateAgentSupabase(username, password)`.
  3. Supabase Auth signs in and returns a JWT containing the role metadata.
  4. The unique agent ID is stored in `localStorage` under `hfc-agent-session`.
- **Session Persistence**: Sessions are saved in `localStorage` (not sessionStorage) so delivery riders stay logged in across browser restarts, device reboots, and tab closes.

---

## 📐 Portal Layout

**File:** `app/agent/layout.tsx`

```
┌───────────────────────────────────────────┐
│ HFC  🛵 Delivery Portal    [Agent Name ▾] │
├───────────────────────────────────────────┤
│                                           │
│  [My Orders]    [My Report]               │
│  ──────────────────────────               │
│                                           │
│           Page Content Area              │
│                                           │
└───────────────────────────────────────────┘
```

- **Top Bar**: Branding, agent name dropdown, and Logout button.
- **Tab Navigation**: My Orders (filtered dashboard) and My Report (analytics).
- **Route Guard**: Layout intercepts requests and redirects unauthenticated users back to `/agent/login`.

---

## 📋 My Orders Page

**URL:** `/agent/orders`  
**File:** `app/agent/orders/page.tsx`

### Real-Time Orders Hook
Subscribes to all order changes using `subscribeToAllOrdersRealtime()`. The list updates instantly when an admin assigns an order or changes its preparation status.

### Status Filter Tabs
- **New Assignments**: Orders marked `accepted` or `ready` assigned to the rider.
- **Out for Delivery**: Orders marked `picked-up`.
- **Delivered**: Completed deliveries.
- **All**: History list.

### Action buttons (Rider Actions)
- **Start Delivery**: Changes status from `accepted` / `ready` to `picked-up` in Supabase.
- **Mark Delivered**: Triggers cash confirmation modal (if order is Cash). Commits `status = 'delivered'` and `paymentStatus = 'paid'` atomically to Supabase.
- **View Bill**: Opens the order's tracker receipt.
- **Open Map (Maps Navigation)**: When coordinates (`coords.lat/lng`) are captured for a delivery address, an "Open map" (📍) button is shown next to the address in the agent orders list. Clicking it launches a Google Maps navigation deep link to the exact latitude and longitude pin, minimizing delivery friction.

---

## 📈 My Report Page

**URL:** `/agent/report`  
**File:** `app/agent/report/page.tsx`

- **Date Range Filter**: Focuses analytics on daily, weekly, or monthly delivery performances.
- **Summary statistics**: Shows Assigned Orders count, Delivered count, and total Delivered Value (revenue collected).
- **Report Table**: Displays a chronological list of deliveries made in the selected range.

---

## 🔒 Hardened Security Matrix

| Concern | Approach | Enforcement |
|---------|----------|-------------|
| **Credential Storage** | Supabase Auth (SHA256 salted hashes) | Identity Provider |
| **Bulk Data Access** | Scoped `SELECT` policy on `public.orders` where `assigned_agent = auth.jwt()` | PostgreSQL RLS |
| **Cross-Rider Updates** | Scoped `UPDATE` policy on `public.orders` | PostgreSQL RLS |
| **Billing Privacy** | Bills select scoped to orders where `assigned_agent = auth.jwt()` | PostgreSQL RLS |
| **Session Longevity** | Persistent `localStorage` credentials | zustand store |
| **API Endpoints** | Fail-closed token inspection | `/api/admin/agents/provision` |
| **Teammate Directory Exposure** | Restricted `get_all_agents()` RPC strictly to admin and removed teammate fetch hook from agent orders page | PL/pgSQL role check & mount hook cleanup |
