# 🍽️ QR Table Ordering System — Technical Specification
**Applies To:** HFC Restaurant Software  
**Last Updated:** August 18, 2026  
**Status:** Deployed & Production Ready  

---

## 1. System Overview

The QR Table Ordering System enables dine-in guests to:
1. Scan a QR code printed on their physical table.
2. Browse the full restaurant menu on their smartphone.
3. Add items, place orders, and add more items in multiple rounds.
4. Request the bill and pay via UPI QR code directly from their table.
5. Track their bill total in real-time throughout the meal.

The system requires **zero app downloads** and **zero staff interaction** for ordering. It operates as a pure browser-based, session-tracked ordering interface.

---

## 2. Session Architecture & Security

### 2.1 Session Token Model
Each table session is identified by:
* **Session ID** (UUID): Persisted in `table_sessions.id`.
* **Session Token** (Cryptographic string): Generated using `crypto.randomUUID()`. Stored in the customer's browser via `sessionStorage`.

When a customer opens the table URL:
1. The browser calls `/api/table/check-lock` with the current `sessionId` and `sessionToken`.
2. If no session exists → `/api/table/create-session` creates a new one.
3. If the session already exists and the token matches → customer sees their existing cart.
4. If the session token does NOT match → the table is locked, and a "Table in Use" message is shown.

This prevents one customer's phone from corrupting another customer's session if they scan the same QR code while a session is active.

### 2.2 Table URL Structure
QR codes should point to:
```
https://hfc-restaurent-software.vercel.app/table/{tableNumber}
```
Table numbers can be integers (`1`, `2`, `3`) or alphanumeric (`A-1`, `B-5`, `VIP-1`).

---

## 3. Page Flow & State Machine

```
Customer Scans QR → /table/[tableNumber]
                              │
                     Check existing session
                     (check-lock API)
                              │
              ┌───────────────┴──────────────┐
              │                              │
         No session                    Session exists
              │                              │
         Create session               Token matches?
         (create-session API)              /   \
              │                          Yes    No
              ▼                           │      │
         Show Menu                   Show Cart  Show "Table In Use"
              │                       resume     error page
         Add Items
              │
         Cart Checkout
         (complete-order API)
              │
         Payment QR Screen
              │
         /table/[tableNumber]/track
         (Real-time bill tracker)
```

---

## 4. API Routes Reference

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/table/create-session` | POST | Creates a new table ordering session |
| `/api/table/check-lock` | POST | Verifies if a session exists and token is valid |
| `/api/table/add-items` | POST | Adds new items to an existing session |
| `/api/table/complete-order` | POST | Marks session as `payment_pending` |
| `/api/table/release-table` | POST | Admin-only: resets/releases the table session |

---

## 5. Admin Table Management Dashboard

The admin panel at `/admin/tables` provides:
* A full grid view of all tables by number.
* Each table card shows: Status (Active, Payment Pending, Available), Current Total, Session Start Time.
* Drill-down at `/admin/tables/[tableNumber]` shows the full order history and items for that specific table.
* One-click **Release Table** button to reset sessions after payment.
