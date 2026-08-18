# 🥡 Self-Service Counter & Takeaway QR System Specification
**Release Date:** August 18, 2026  
**Status:** Deployed & Verified  

---

## 🏛️ System Overview

The **Self-Service Counter & Takeaway QR System** is engineered to allow walk-in guests or customers scanned at table/counter locations to browse the full menu, place orders, complete UPI payments via dynamically generated QR codes, and track their preparation status on a real-time tracking interface.

```
[ Customer Smartphone ] ──(POST /api/counter/create-order)──► [ Next.js API Route ]
                                                                      │
                                                           (Service Role Auth)
                                                                      │
                                                                      ▼
                                                       [ Supabase PostgreSQL DB ]
                                                                      │
                                                             (Postgres Trigger)
                                                                      │
                                                                      ▼
                                                          [ public.bills Table ]
```

---

## 💻 Architecture & Component Breakdown

### 1. User Interface Pages & Components

* **Counter Main Page (`app/counter/page.tsx`):**
  - Acts as the root orchestrator of the takeaway checkout flow.
  - Manages the page state machine transitions: `'menu'` → `'checkout'` → `'payment'` → `'tracker'`.
  - Embeds the customer menu browser, checkout summaries, payment QR generators, and token status trackers.

* **Checkout Screen (`components/counter/CounterCheckout.tsx`):**
  - Displays selected items, item notes, subtotal, 5% GST calculation, packaging fee (from settings), and the final payable total.
  - Offers custom input options for specific kitchen instructions.

* **Payment Gateway (`components/counter/CounterPaymentQR.tsx`):**
  - Generates an interactive UPI deep-link URL: `upi://pay?pa={upi_id}&pn={site_name}&am={total}&cu=INR&tn=Counter%20Order`.
  - Renders a scan-to-pay QR code (using `QRCodeSVG`) and an interactive **"Tap to Open UPI App"** deep-link button for mobile users.
  - Houses the **"I Have Paid — Get My Token"** verification button, triggering order creation.

* **Real-Time Token Tracker (`components/counter/CounterTokenTracker.tsx`):**
  - Displays the customer's unique token (e.g., `# TA0005`) and order status stepper.
  - Listens to PostgreSQL real-time events on the specific order:
    ```typescript
    supabase.channel('counter-order-{id}')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'id=eq.{id}' })
    ```
  - Triggers a **haptic vibration pattern** (`navigator.vibrate`) and a **triumphant chime audio context** once status changes to `'ready'`.
  - Flashes a premium green backdrop indicating pickup readiness.

---

## 🔒 Security & Database Integration

### 1. Bypass of RLS via Service Role API
To enable seamless public ordering without requiring customer auth logins:
* Order submissions call the server-side Next.js route `/api/counter/create-order`.
* This API route instantiates the Supabase client using the secure administrative server-side key `SUPABASE_SERVICE_ROLE_KEY`.
* By running with service role context, the database inserts bypass RLS check policies, allowing walk-in customers to order securely without exposing database write access directly to the browser.

### 2. Auto-Token Generation
The endpoint calculates incremental takeaway tokens automatically inside a date-locked transaction:
```typescript
const today = new Date().toISOString().split('T')[0]
const { data } = await supabase
  .from('orders')
  .select('token_number')
  .eq('source', 'counter-qr')
  .gte('created_at', `${today}T00:00:00`)
```
Tokens are generated in format `TA0001`, `TA0002`... and reset every calendar day.

---

## 🛠️ Verification & Database Hotfix (RLS Resolution)

During initial checkout testing, orders failed due to a database RLS policy violation on the `bills` table (`new row violates row-level security policy for table "bills"`).

* **Root Cause:** The database has a trigger `auto_create_bill_trigger` which executes `auto_create_bill()` upon every new order. Because the trigger function was not declared with `SECURITY DEFINER`, it executed with the default caller context (which was restricted `anon`).
* **Resolution:** Re-deployed the trigger functions with `SECURITY DEFINER` constraints. The triggers now run with Postgres superuser rights, allowing anonymous order creation to safely write matching invoice data into the `bills` table.
