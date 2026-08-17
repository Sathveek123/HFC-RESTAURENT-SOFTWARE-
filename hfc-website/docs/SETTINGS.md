# ⚙️ HFC Settings Panel — Complete Documentation

> **URL:** `/admin/settings`  
> **File:** `app/admin/settings/page.tsx`  
> **Store:** `store/settingsStore.ts` (key: `hfc-settings`)  
> **Supabase Path:** `public.settings` rows where `key IN ('site_settings', 'site_settings_private')` (JSONB)

---

## Overview

The Settings page is the **business configuration hub** that drives live site behavior across the entire HFC application. Settings are split into:
1. **Cards 1–5**: Core settings saved via the "Save settings" form submission.
2. **Card 6**: Delivery Areas (managed dynamically with instant auto-save).
3. **Card 7**: Subscription Plans (managed dynamically with instant auto-save).

Any change here automatically upserts to Supabase via `sync_setting('site_settings', {...})` RPC and broadcasts to all connected clients in **real-time** (< 1s).

---

## 💾 Save & Sync Behavior

### Initial Load (Page Mount)
On page mount, `fetchAndSyncSettings()` runs:
```ts
// Fetches both rows, merges them into the local zustand store
fetchSettingFromSupabase('site_settings')          → public settings (gst, delivery, areas, plans, branding, UPI)
fetchSettingFromSupabase('site_settings_private')  → credentials (Cloud API token/phone ID)
```

### Realtime Sync (Live Push)
Both rows are subscribed via `subscribeToSettingRealtime(key, onChanged)` which listens to `postgres_changes` events. If settings are updated on **another device** (or another admin tab), they sync live without page reload.

⚠️ **CRITICAL BUG FIXED (session Aug-14-2026):** Previously realtime only listened to `event: 'UPDATE'`. The very first save ever to an empty database table issues an `INSERT` (not an UPDATE), so that first save was never broadcast. Now listener uses `event: '*'` = INSERT + UPDATE, so first save propagates to ALL tabs and ALL customer browsers in < 1s.

### Sensitive Data Isolation
To prevent exposing Meta Cloud API access tokens to anonymous clients, API keys are synced separately to `site_settings_private`:
- `site_settings` (public readable via RLS `USING (true)`) → branding, gst, delivery, areas, plans, UPI, WhatsApp #
- `site_settings_private` (admin-only) → cloudApiToken, cloudApiPhoneId

### Save Mechanism (Upsert RPC)
Every mutation triggers:
```
syncSettingToSupabase('site_settings', { /* full Settings object */ })
   ↳ calls postgres RPC sync_setting(p_key, p_value) — SECURITY DEFINER (bypasses RLS)
        ↳ INSERT ... ON CONFLICT (key) DO UPDATE value / updated_at
```

---

## 🃏 Card 1 — License

Shows the active product licensing details. Gated client-side to prevent unauthorized domain usage.

| Field | Type | Notes |
|-------|------|-------|
| License Key | textarea | HFC product license key |
| Status Badge | text | Active (green check) or Not licensed (amber alert) |

---

## 🎨 Card 2 — Branding

Controls brand information displayed across pages and messages.

| Field | Type | Notes |
|-------|------|-------|
| Kitchen / Site Name | text | e.g. "HFC Consultancy Services" |
| Logo | file upload | Uploads image and converts to Base64 format |
| Phone | text | Used in Navbar, Footer, and tracker "Call HFC" link |
| WhatsApp Number | text | Numeric only with country code, e.g. `919912799855` |
| Kitchen Address | textarea | Displayed in invoice bills and footer |

**Live impact (real-time, no page refresh):**
- ✅ WhatsApp order recipient target updates instantly on cart + orders pages
- ✅ Footer / navbar contact links update live on customer website
- ✅ Invoice headers & tracker page branding update instantly

---

## 🧾 Card 3 — GST

Controls split tax calculations displayed during checkout and on printed bills.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| GST Mode | select | `exclusive` | `none` / `inclusive` / `exclusive` |
| GST % | number | `5` | Used as the total GST rate — bills split to CGST + SGST |

### GST Mode Semantics (CRITICAL — affects pricing)

| Mode | Behavior | Customer Checkout Line | Bill Calculation |
|------|----------|------------------------|------------------|
| `exclusive` (default) | GST is **added ON TOP** of subtotal at checkout (restaurant standard) | `GST (5%) ₹XX.XX` | subtotal × gst% added as separate line(s) |
| `inclusive` | Menu prices **already include** GST — no extra charge at checkout | `GST (5%) Already in menu prices` (italic grey) | Menu price is final; no additional line item added |
| `none` | No GST is charged whatsoever | (GST line completely hidden) | 0.00 across board |

### Backward Compat ⚠️
**Bug Fixed (session Aug-14-2026):** Old CartDrawer.tsx + CartSummary.tsx **hardcoded 5% GST regardless of gstMode**. This meant customers ordering with "GST Inclusive" were taxed **twice** (once in menu, once at checkout). Fixed so checkout branches correctly. The `/api/orders/create` server endpoint also recomputes using identical logic — so cart UI, order record, and final bill **always agree exactly**.

---

## 🛵 Card 4 — Delivery & Payment

Configures checkout rates, payment modes, and payment targets.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| Delivery Fee | number | `50` | Flat fee charged on delivery orders (unless waived) |
| Free Delivery Above | number | `500` | Free delivery threshold (0 = never free) |
| Currency Symbol | text | `₹` | Used for all currency labels |
| UPI ID | text | - | Target for checkout QR code generation (leave blank to hide QR) |
| Accept Cash | checkbox | `true` | Allows Cash on Delivery option at checkout |
| Accept Online (UPI/QR) | checkbox | `true` | Allows UPI payment option at checkout |

### Delivery Fee Waive Rules (Live)
The delivery fee is waived to `₹0` when EITHER is true:
1. Subtotal (pre-discount) ≥ `settings.freeDeliveryAbove`, **OR**
2. Customer applied a valid coupon with `discountType === 'free-delivery'` (e.g. `FREEBY` — see COUPONS_OFFERS.md)

---

## 📱 Card 5 — WhatsApp Auto-Send

Configures webhook triggers to Meta Cloud APIs for automatic status message dispatching.

| Field | Type | Description |
|-------|------|-------------|
| Cloud API access token | password | Permanent or temporary Meta token (saved to `site_settings_private`) |
| Phone number ID | text | Meta API phone node reference (saved to `site_settings_private`) |

---

## 📍 Card 6 — Delivery Areas

Manage the delivery zones where HFC delivers. Saved to `settings.deliveryAreas[]` within the same `site_settings` row.

### Delivery Area Fields

| Field | Type | Notes |
|-------|------|-------|
| Area Name | text | e.g. "Labour Colony", "Maruthi Nagar", "Sarojinidevi Flat Area" |
| Is Active | badge | Active zones appear in customer checkout "Delivery Area" dropdown |

### Actions
- **Add area**: Type name and hit Enter or click Add area.
- **Active / Paused toggle**: Toggle availability instantly.
- **Delete**: Remove area with inline confirm trigger.

### Seeded Defaults (from `supabase/schema.sql`)
First-launch seeds:
1. `Maruthi Nagar` (active)
2. `Labour Colony` (active)
3. `Sarojinidevi Flat Area` (active)

---

## 📦 Card 7 — Subscription Plans

Informational meal plans displayed to regular clients registerable on sign-up sheets.

### Subscription Plan Fields

| Field | Type | Notes |
|-------|------|-------|
| Plan Name | text | e.g. "Basic Tier", "Premium Cloud Plan" |
| Price / month | number | Cost of tiffin plan in ₹ |
| Is Active | badge | Active plans appear in registration options |

### Seeded Defaults (from `supabase/schema.sql`)
1. `Basic Tier` @ ₹3,000 / month
2. `Premium Cloud Plan` @ ₹5,000 / month

---

## 🔄 Settings Store Schema (TypeScript)

```typescript
interface Settings {
  // License
  licenseKey: string
  isLicensed: boolean
  licensedDomain: string
  licenseValidUntil: string

  // Branding
  siteName: string
  logoBase64: string | null
  phone: string
  whatsappNumber: string
  kitchenAddress: string

  // GST
  gstMode: 'none' | 'inclusive' | 'exclusive'
  gstPercent: number

  // Delivery & Payment
  deliveryFee: number
  freeDeliveryAbove: number
  currencySymbol: string
  upiId: string
  acceptCash: boolean
  acceptOnline: boolean

  // WhatsApp Auto-send
  cloudApiToken: string
  cloudApiPhoneId: string

  // Delivery Areas
  deliveryAreas: DeliveryArea[]
  // Subscription Plans
  subscriptionPlans: SubscriptionPlan[]
}

interface DeliveryArea { id: string; name: string; isActive: boolean }
interface SubscriptionPlan { id: string; name: string; pricePerMonth: number; isActive: boolean }
```

---

## 🔗 Settings → Live Site Impact Map (Real-time — no refresh)

| Setting Changed | Live Impact |
|----------------|-------------|
| `siteName` | Tab titles, checkout header, WhatsApp order templates |
| `logoBase64` | Navbar logo and order confirmation displays |
| `phone` / `whatsappNumber` | Target recipients for ordering, customer assistance links |
| `deliveryFee` / `freeDeliveryAbove` | Checkout subtotal/total calculations (INSTANT update on CartDrawer) |
| `upiId` | Generated UPI deep link / QR code on order tracker |
| `gstMode` / `gstPercent` | GST line calc on CartDrawer, CartSummary, bills API, orders/create API |
| `deliveryAreas` | Address zone selector list during delivery-type checkout |
| `acceptCash` / `acceptOnline` | Payment option visibility on checkout |

⚠️ **Bug Fixed (session Aug-14-2026):** CartSummary.tsx (WhatsApp direct cart) used hardcoded WhatsApp number `919876543210` regardless of what was saved in Settings. Now correctly reads live from `settings.whatsappNumber`. |

---

## 🧪 Database Validation

Run this in the Supabase SQL editor to verify your saved settings landed correctly:
```sql
SELECT
  key,
  (value ->> 'gstMode')           AS gst_mode,
  (value ->> 'gstPercent')        AS gst_pct,
  (value ->> 'deliveryFee')       AS delivery_fee,
  (value ->> 'freeDeliveryAbove') AS free_delivery_above,
  (value ->> 'whatsappNumber')    AS whatsapp_no,
  jsonb_array_length(value -> 'deliveryAreas')      AS num_areas,
  jsonb_array_length(value -> 'subscriptionPlans') AS num_plans,
  updated_at
FROM public.settings
WHERE key = 'site_settings';
```
