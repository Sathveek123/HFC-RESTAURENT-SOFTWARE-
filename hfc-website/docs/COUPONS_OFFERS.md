# 🎟️ HFC Promotions System — Coupons, Offers & Reward Tiers

> **URL:** `/admin/coupons`  
> **File:** `app/admin/coupons/page.tsx`  
> **Store:** `store/promotionsStore.ts` (Unified Promotions & Coupons Store)  
> **Supabase Path:** `public.settings` row where `key = 'promotions'` (JSONB)

---

## Overview

The Promotions page has **3 sections** stacked vertically on the same page. Each has its own "Add" form at the top and a results table below. Any change here automatically saves to Supabase via the `sync_setting('promotions', {...})` SECURITY DEFINER RPC and propagates to all connected clients in **real-time** (< 1s).

```
┌─────────────────────────────────────────────────────────┐
│  SECTION 1: Auto-Reward Tiers                           │
│  [Add Tier Form]                                        │
│  [Reward Tiers Table]                                   │
├─────────────────────────────────────────────────────────┤
│  SECTION 2: Coupons                                     │
│  [Add Coupon Form]                                      │
│  [Coupons Table]                                        │
├─────────────────────────────────────────────────────────┤
│  SECTION 3: Offers                                      │
│  [Add Offer Form]                                       │
│  [Offers Table]                                         │
└─────────────────────────────────────────────────────────┘
```

### Storage Model
All three sections are stored together as a single JSONB object under `settings.key = 'promotions'`:

```ts
interface PromotionsValue {
  rewardTiers: RewardTier[]    // Section 1
  coupons: Coupon[]            // Section 2  ← validated at checkout
  offers: Offer[]              // Section 3
}
```

⚠️ **Old Stale Structure Removed (Bug session Aug-14-2026):** Previous seed + fallback used `{ coupons:[], bannerText, popupImage }` (legacy pre-unification). This broke coupon validation when the DB didn't have the correct row. The `DEFAULT_PROMOTIONS` fallback in `/api/orders/create` and the schema.sql seed now both use the exact structure above (`rewardTiers`, `coupons`, `offers`).

---

## 🏆 Section 1 — Auto-Reward Tiers

**Component:** `components/admin/coupons/RewardTierForm.tsx` + `RewardTierTable.tsx`  
**Store Path:** `promotionsStore.ts` → `settings.rewardTiers[]`

### What Are Reward Tiers?
Automatic loyalty rewards that trigger **based on order value** — no code needed. When a customer's order total meets the minimum, the tier reward applies automatically.

**Example:**
> "Orders above ₹500 get a free Masala Chai"

### Add Tier Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Min Order Value (₹) | number | ✅ | Minimum subtotal to trigger reward |
| Reward Type | select | ✅ | `flat` / `percent` / `free-delivery` |
| Reward Value | number | - | Discount value (e.g. 50 for ₹50 flat, 10 for 10%) |
| Valid Days | number | ✅ | Validity duration in days |
| Active | toggle | - | Whether tier is live |

### `RewardTier` Type

```typescript
interface RewardTier {
  id: string
  minOrderAmount: number
  rewardType: 'flat' | 'percent' | 'free-delivery'
  rewardValue: number | null
  validDays: number
  isActive: boolean
  createdAt: string
}
```

---

## 🎫 Section 2 — Coupons

**Component:** `components/admin/coupons/CouponForm.tsx` + `CouponTable.tsx`  
**Store Path:** `promotionsStore.ts` → `settings.coupons[]`

### What Are Coupons?
**Manually created discount codes** that customers type in at checkout. Validated in real-time against rules: minimum value, expiry, and usage limits.

### Seeded Default Coupons (Schema Seed / First Launch)
The database seed creates these 2 production starter coupons on every first-run:

| Code | Discount Type | Value / Cap | Min Order | Uses | Valid Until |
|------|---------------|-------------|-----------|------|-------------|
| `HFC50` | `percent` | **50% off up to ₹150 cap** | ₹300 | 100 uses | 31 Dec 2026 |
| `FREEBY` | `free-delivery` | Waive entire delivery charge | ₹250 | 500 uses | 31 Dec 2026 |

### Add Coupon Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Coupon Code | text | ✅ | e.g. `WELCOME20`, `HFC50` (auto-uppercase on save) |
| Discount Type | select | ✅ | `percent` / `flat` / `free-delivery` |
| Discount Value | number | - | e.g. 20 (for 20%) or 50 (for ₹50 flat) — not used for `free-delivery` |
| Max Discount Cap | number | - | Max cap for percentage discounts (e.g. max ₹100 off) |
| Min Order Value (₹) | number | ✅ | Minimum subtotal required to apply |
| Usage Limit | number | - | Leave blank for unlimited |
| Applicable Phone | text | - | Lock coupon to a specific customer's phone number |
| Valid From | date | - | Start date of coupon validity |
| Valid Until | date | - | Expiry date |
| Active | toggle | - | Enable/disable coupon |

### `Coupon` Type

```typescript
interface Coupon {
  id: string
  code: string
  discountType: 'percent' | 'flat' | 'free-delivery'
  discountValue: number | null          // null for free-delivery
  maxDiscountCap: number | null         // null for flat / free-delivery / no cap percent
  minOrderAmount: number
  usageLimit: number | null             // null = unlimited
  usedCount: number                     // incremented on successful apply
  validFrom: string | null
  validUntil: string | null
  isActive: boolean
  applicableCustomerPhone: string | null
  createdAt: string
}
```

### Coupon Validation Logic (Client + Server Identical)

**`promotionsStore.getValidCoupon(code, orderTotal)`**  
Also duplicated identically in `/api/orders/create` to prevent tampering with browser state.

Validation steps (ALL must pass):
1. Find coupon by code (**case-insensitive** match)
2. Check `isActive === true`
3. Check `usedCount < usageLimit` — OR `usageLimit === null` (unlimited)
4. Check `new Date() >= new Date(validFrom)` — if validFrom is set
5. Check `new Date() <= new Date(validUntil)` — if validUntil is set
6. Check `orderTotal >= minOrderAmount`
7. If `applicableCustomerPhone` is set → check customer phone matches

Returns: `{ valid: boolean, coupon?: Coupon, error?: string }`

### Discount Application (at Checkout)

| `coupon.discountType` | Discount Amount Calculation | Effect on CartDrawer |
|---|---|---|
| `flat` | `discountAmount = coupon.discountValue` | Subtotal reduced by flat ₹ |
| `percent` | `discountAmount = min (subtotal × coupon.discountValue / 100, coupon.maxDiscountCap \|\| Infinity)` | % off capped at max cap |
| `free-delivery` | `discountAmount = 0` → **deliveryCharge waived to ₹0** | Delivery charge line shows "(FREEBY coupon applied) → FREE" |

⚠️ **CRITICAL BUG FIXED (session Aug-14-2026):** `free-delivery` coupons worked correctly server-side (waiving delivery charge in the DB) but the **CartDrawer UI was still displaying the old delivery charge** in the Total. Customers saw `₹100 extra` in the checkout total vs. what was actually charged. Now UI uses the exact same waive logic — CartDrawer line reads "FREE" in green and total matches the server order record exactly.

---

## 🎁 Section 3 — Offers

**Component:** `components/admin/coupons/OfferForm.tsx` + `OfferTable.tsx`  
**Store Path:** `promotionsStore.ts` → `settings.offers[]`

### What Are Offers?
**Visual promotional banners** shown to customers on the website (e.g., "Buy 2 Get 1 Free", "Family Bundle Deal"). These are informational promotions highlightable on the customer home page.

### `Offer` Type

```typescript
interface Offer {
  id: string
  offerType: 'free-item' | 'bundle-discount' | 'happy-hour' | 'first-order'
  title: string
  freeItemId: string | null
  minOrderAmount: number
  validFrom: string | null
  validUntil: string | null
  isActive: boolean
  createdAt: string
}
```

---

## 📡 Real-Time WebSockets Synchronization

Promotions are fully real-time enabled. Any update in the Admin Coupons page updates the database and broadcasts to **all connected customer browsers** + any other open admin tabs — **in < 1 second, no refresh needed**:

### 1. Admin Page Hook (`app/admin/coupons/page.tsx`)
```typescript
useEffect(() => {
  usePromotionsStore.getState().fetchAndSyncPromotions()
  const unsub = subscribeToSettingRealtime('promotions', (val) => {
    if (val) usePromotionsStore.getState().setPromotionsFromSupabase(val)
  })
  return () => unsub()
}, [])
```

### 2. Customer Homepage Hook (`app/page.tsx`)
Updates available offers, active rewards, and valid coupons **live** on the home page and Cart Drawer:
```typescript
useEffect(() => {
  usePromotionsStore.getState().fetchAndSyncPromotions()
  const unsub = subscribeToSettingRealtime('promotions', (val) => {
    if (val) usePromotionsStore.getState().setPromotionsFromSupabase(val)
  })
  return () => unsub()
}, [])
```

### Realtime Event Fix
⚠️ **CRITICAL BUG FIXED (session Aug-14-2026):** `subscribeToSettingRealtime()` previously only listened to `event: 'UPDATE'`. The **very first coupon ever added** issues an `INSERT` (not an UPDATE, because the `promotions` row didn't exist yet). That first-save event NEVER propagated to customers or other admin tabs — until you refreshed the browser page. Now listener uses `event: '*'` = INSERT + UPDATE so both first-save AND subsequent edits broadcast.

---

## 🛒 Customer-Side Checkout Integration

### Coupon Validation in Cart Drawer (`CartDrawer.tsx`)
When a customer inputs a coupon code and clicks Apply:
1. `promotionsStore.getValidCoupon(code, subtotal)` is called.
2. If valid, the cart calculates the discount amount per the table above.
3. Upon order placement, `promotionsStore.incrementCouponUsage(code)` is called → writes `usedCount++` into the same `promotions` JSONB row in Supabase → broadcasts to all tabs.

### Server-Side Re-Validation (`app/api/orders/create/route.ts`)
The orders REST API:
1. Fetches the same `promotions` row from Supabase
2. Runs the **identical** `getValidCoupon` validation logic
3. Calculates discount + delivery waiver identically to CartDrawer
4. Persists the authoritative order record to `public.orders`

This 2-sided validation prevents:
- Coupon bypass via browser console (tinkering with `usedCount` in localStorage)
- Client-only drift in delivery charge / discount math

---

## 🧪 Database Validation

Run this in the Supabase SQL editor to verify coupons landed:
```sql
SELECT
  jsonb_array_elements(value -> 'coupons') ->> 'code'           AS code,
  jsonb_array_elements(value -> 'coupons') ->> 'discountType'   AS discount_type,
  jsonb_array_elements(value -> 'coupons') ->> 'usedCount'      AS used,
  jsonb_array_elements(value -> 'coupons') ->> 'isActive'       AS active
FROM public.settings
WHERE key = 'promotions';
```
