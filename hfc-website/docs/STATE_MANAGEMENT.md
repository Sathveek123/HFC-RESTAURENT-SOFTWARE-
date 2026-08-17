# 🗄️ HFC State Management — Zustand & Supabase Architecture

> All stores use `zustand/middleware/persist` (localStorage) as an **optimistic cache**.  
> **Supabase PostgreSQL** is the Single Source of Truth. Every mutation syncs to Supabase.  
> Every surface subscribes to **Supabase Realtime WebSockets** for sub-second cross-device updates.

---

## Architecture Summary

```
Admin Action (e.g. "Add Coupon")
  ↓
Zustand store mutation (instant local UI update)
  ↓
syncSettingToSupabase() / syncProductToSupabase() etc.
  ↓
Supabase PostgreSQL (upsert via SECURITY DEFINER RPC)
  ↓
Supabase Realtime broadcast (postgres_changes event)
  ↓
All connected clients (customers, agents, admins) updated < 1 second
```

---

## 📦 `orderStore.ts`

**localStorage Key:** `hfc-orders`  
**Supabase Table:** `public.orders`  
**Realtime:** `subscribeToAllOrdersRealtime()` on admin + agent pages  

### `OrderRecord` Type

```typescript
interface OrderRecord {
  id: string                  // e.g. "HFC-F6B776C7" (crypto.randomUUID based)
  customerName: string        // XSS sanitized
  phoneNumber: string         // 10-digit
  orderType: 'dine-in' | 'takeaway' | 'delivery'
  address?: string
  landmark?: string
  deliveryArea?: string | null
  coords?: { lat: number; lng: number }
  items: { id: string; name: string; price: number; quantity: number }[]
  subtotal: number
  gst: number
  deliveryCharge: number
  discountAmount: number
  couponCode?: string | null
  total: number
  paymentMethod: 'Cash' | 'UPI' | 'Online' | 'Card'
  paymentStatus: 'unpaid' | 'paid' | 'partial'
  status: 'placed' | 'accepted' | 'ready' | 'picked-up' | 'delivered' | 'rejected' | 'cancelled'
  assignedAgent: string | null
  seenByAdmin: boolean
  isRegularCustomer: boolean
  notes?: string | null
  createdAt: string           // ISO string
  updatedAt: string           // ISO string (updated on every write)
  timestamp: number           // Unix milliseconds
}
```

### Actions

| Action | Supabase Sync | Notes |
|--------|--------------|-------|
| `addOrder(order)` | `create_order(row)` RPC | Idempotency guard: skips if ID already exists |
| `updateOrderStatus(id, status)` | `syncOrderStatusAtomic()` | COD auto-pay for delivery orders |
| `updatePaymentStatus(id, status)` | `syncOrderStatusAtomic()` | Syncs to bills table too |
| `updatePaymentMethod(id, method)` | `syncOrderStatusAtomic()` | |
| `assignAgent(id, agentName)` | `syncOrderStatusAtomic()` | |
| `cancelOrder(id)` | `syncOrderStatusAtomic()` | |
| `fetchOrdersFromSupabase()` | SELECT (last 30 days, max 500) | On admin/agent mount |
| `subscribeToAllOrdersRealtime()` | WebSocket channel | Real-time cross-device |

### COD Auto-Pay Guard

```typescript
// When status becomes 'delivered' for all orders with Cash payment (Universal auto-flip in v2.2.2):
if (status === 'delivered' && paymentMethod === 'Cash' && paymentStatus !== 'paid') {
  paymentStatus = 'paid'  // auto-flip
  // also syncs to billsStore
}
// Note: As of v2.2.2, the orderType === 'delivery' guard has been removed so that dine-in/takeaway cash orders also flip to paid automatically upon completion.
```

### Duplicate Prevention

```typescript
// In addOrder() — idempotency guard:
const existing = get().orders.find(o => o.id === order.id)
if (existing) return  // skip insert if already exists
```

### Egress Protection (30-day window)

```typescript
// fetchOrdersFromSupabase() only fetches last 30 days:
const since = new Date()
since.setDate(since.getDate() - 30)
.gte('created_at', sinceISO)
.limit(500)
```

---

## 👤 `agentsStore.ts`

**localStorage Key:** `hfc-agents`  
**Supabase Table:** `public.agents`  

### `Agent` Type

```typescript
interface Agent {
  id: string
  name: string              // Display name (used in order.assignedAgent)
  whatsapp: string          // Full number with country code "919876543210"
  username: string          // Unique login username
  isActive: boolean         // Off-duty = hidden from assignment dropdowns
  vehicleType: 'bike' | 'bicycle' | 'scooter' | 'on-foot' | null
  coverageArea: string | null
  createdAt: string
  totalDeliveries: number
}
```

> ⚠️ **No `password` or `password_hash` field** — credentials are stored exclusively in Supabase Auth (`auth.users`). Agent passwords are managed via `/api/admin/agents/provision`.

### Actions

| Action | Notes |
|--------|-------|
| `addAgent(agent)` | Also calls `/api/admin/agents/provision` to create Supabase Auth user |
| `updateAgent(id, updates)` | Patch fields (triggers API call to `/api/admin/agents/provision` if password/metadata is updated) |
| `deleteAgent(id)` | Remove permanently |
| `toggleAgentActive(id)` | Flip `isActive` boolean |
| `incrementDeliveries(id)` | +1 to `totalDeliveries` |
| `isUsernameAvailable(username, excludeId?)` | Uniqueness check |
| `getActiveAgents()` | Returns only `isActive: true` agents (shown in assignment dropdown) |
| `getAgentByUsername(username)` | Used in auth flow |

---

## 🔑 `agentAuthStore.ts`

**Persistence:** `localStorage` key `hfc-agent-session` (agent ID string)  
> ✅ **localStorage** — session persists across tab close, browser restart, and page refresh.

### State

```typescript
{
  isAuthenticated: boolean
  loggedInAgentId: string | null
}
```

### Actions

| Action | Notes |
|--------|-------|
| `login(username, password)` | Calls Supabase Auth → saves agent ID to localStorage |
| `logout()` | Clears `localStorage.hfc-agent-session` + resets state |
| `checkSession()` | On mount: reads `localStorage`, re-validates agent is still active |
| `getLoggedInAgent()` | Returns full Agent object from agentsStore |

### Login Flow

```
agent.login(username, password)
  → authenticateAgentSupabase(username, password)  ← Supabase Auth signInWithPassword()
  → localStorage.setItem('hfc-agent-session', agent.id)
  → set({ isAuthenticated: true })
```

---

## 🔑 `adminAuthStore.ts`

**Persistence:** Supabase Auth session (JWT stored by Supabase SDK — persists across refreshes)

### Authentication
Admin authentication is managed entirely by **Supabase Auth**:
- Login calls `authenticateAdminSupabase(username, password)` which signs in via `supabase.auth.signInWithPassword()`.
- Session validity is verified by checking `user_metadata.role === 'admin'` on the returned JWT.
- Credentials are configured in the **Supabase Auth dashboard** — no passwords are stored in source code.

---


## 🛒 `cartStore.ts`

**localStorage Key:** `hfc-cart`  
**No Supabase sync** — cart is customer session-only.

### State

```typescript
{
  items: CartItem[]    // { id, name, price, quantity }
  isOpen: boolean      // Cart drawer visibility
}
```

### Actions

| Action | Notes |
|--------|-------|
| `addItem(product)` | Adds or increments quantity |
| `removeItem(id)` | Removes entirely |
| `updateQuantity(id, qty)` | Set specific quantity (0 = remove) |
| `clearCart()` | Empty cart after order placed |
| `openCart()` / `closeCart()` | Drawer toggle |
| `getSubtotal()` | Sum of `item.price × item.quantity` |

---

## 📋 `productsStore.ts`

**localStorage Key:** `hfc-products`  
**Supabase Table:** `public.products`  
**Realtime:** `subscribeToProductsRealtime()` on `MenuSection.tsx`  

### `ProductItem` Type

```typescript
interface ProductItem {
  id: string
  categoryId: string        // Category slug e.g. "starters"
  name: string
  description: string
  price: number
  mrp: number | null        // Strike-through MRP price
  imageUrl: string | null
  isVeg: boolean
  isAvailable: boolean      // Toggle hide/show from customer menu
  isBestseller: boolean     // Shows bestseller badge
  sortOrder: number         // Display order
  updatedAt: string         // ISO string
}
```

### Actions

| Action | Supabase Sync | Notes |
|--------|--------------|-------|
| `addItem(categoryId, item)` | `sync_product(row)` RPC | Triggers realtime broadcast |
| `updateItem(itemId, updates)` | `sync_product(row)` RPC | Live on customer menu |
| `deleteItem(itemId)` | Direct DELETE | |
| `toggleAvailability(itemId)` | `sync_product(row)` RPC | Instant hide/show on menu |
| `toggleBestseller(itemId)` | `sync_product(row)` RPC | |
| `fetchAndSyncProducts()` | Direct SELECT + self-healer | On mount |
| `upsertProductFromSupabase(item)` | — | Called by realtime listener |
| `removeProductFromSupabase(id)` | — | Called by realtime listener |

### Self-Healing Seeder

```typescript
fetchAndSyncProducts: async () => {
  const fetched = await fetchProductsFromSupabase()
  const fetchedIds = new Set(fetched.map(i => i.id))
  const missingSeeds = seedItems.filter(item => !fetchedIds.has(item.id))
  
  if (missingSeeds.length > 0) {
    // Auto-upload any missing default menu items to Supabase
    for (const item of missingSeeds) {
      await syncProductToSupabase(item)
    }
  }
}
```

---

## 🎟️ `promotionsStore.ts` (Coupons, Offers & Reward Tiers)

**localStorage Key:** `hfc-promotions`  
**Supabase Storage:** `public.settings` row where `key = 'promotions'` (JSONB)  
**Realtime:** `subscribeToSettingRealtime('promotions', cb)` on homepage + admin coupons page  

### Types

```typescript
interface Coupon {
  id: string
  code: string                              // Uppercase e.g. "HFC50"
  discountType: 'percent' | 'flat' | 'free-delivery'
  discountValue: number | null              // null for free-delivery
  maxDiscountCap: number | null             // Max cap for percent discounts
  minOrderAmount: number                    // Minimum cart total
  usageLimit: number | null                 // null = unlimited
  usedCount: number
  validFrom: string | null                  // ISO date
  validUntil: string | null                 // ISO date
  isActive: boolean
  applicableCustomerPhone: string | null    // Lock to specific phone number
  createdAt: string
}

interface RewardTier {
  id: string
  minOrderAmount: number
  rewardType: 'flat' | 'percent' | 'free-delivery'
  rewardValue: number | null
  validDays: number
  isActive: boolean
  createdAt: string
}

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

### Actions

| Action | Supabase Sync | Notes |
|--------|--------------|-------|
| `addCoupon(coupon)` | `sync_setting('promotions', {...})` | Live on customer checkout |
| `toggleCouponActive(id)` | `sync_setting('promotions', {...})` | |
| `deleteCoupon(id)` | `sync_setting('promotions', {...})` | |
| `incrementCouponUsage(code)` | `sync_setting('promotions', {...})` | Called on order placement |
| `addRewardTier(tier)` | `sync_setting('promotions', {...})` | |
| `addOffer(offer)` | `sync_setting('promotions', {...})` | |
| `fetchAndSyncPromotions()` | `fetchSettingFromSupabase('promotions')` | On mount |
| `setPromotionsFromSupabase(data)` | — | Called by realtime listener |
| `getValidCoupon(code, total)` | — | Used by CartDrawer |
| `getActiveOffers()` | — | Returns currently active offers |

### Coupon Validation (`getValidCoupon`)

```typescript
getValidCoupon(code, orderTotal) => {
  // Checks: code exists, isActive, not expired, usageLimit not reached, minOrderAmount met
  // Returns: { valid: boolean, coupon?: Coupon, error?: string }
}
// CartDrawer then calculates discount amount based on coupon.discountType
```

---

## 🧾 `billsStore.ts`

**localStorage Key:** `hfc-bills`  
**Supabase Table:** `public.bills`  

### Auto-Creation
Bills are created automatically via a Supabase SQL trigger (`auto_create_bill`) that fires on every `INSERT` to `public.orders`.

### Sync
- Supabase trigger `sync_bill_payment_status` fires on `UPDATE` to `orders.payment_status`, keeping the corresponding bill row in sync.
- `fetchBillsFromSupabase()` is called on mount in `AdminBillsPage` (last 30 days only).
- The `get_all_bills()` SECURITY DEFINER RPC bypasses RLS for admin reads.

---

## ⚙️ `settingsStore.ts`

**localStorage Key:** `hfc-settings`  
**Supabase Storage:** `public.settings` row where `key = 'site_settings'` (JSONB)  
**Realtime:** `subscribeToSettingRealtime('site_settings', cb)` on homepage + admin settings page  

### Settings Schema

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
  whatsappNumber: string      // With country code "919912799855"
  kitchenAddress: string

  // GST
  gstMode: 'none' | 'inclusive' | 'exclusive'
  gstPercent: number

  // Delivery & Payment
  deliveryFee: number
  freeDeliveryAbove: number   // 0 = never free
  currencySymbol: string      // "₹"
  upiId: string               // For QR code generation
  acceptCash: boolean
  acceptOnline: boolean

  // WhatsApp Auto-send (optional, Meta Cloud API)
  cloudApiToken: string
  cloudApiPhoneId: string

  // Delivery Areas
  deliveryAreas: DeliveryArea[]

  // Subscription Plans
  subscriptionPlans: SubscriptionPlan[]
}
```

### Actions

| Action | Supabase Sync | Live Effect on Website |
|--------|--------------|----------------------|
| `updateSettings(patch)` | `sync_setting('site_settings', {...})` | Delivery fee, UPI ID, GST update live |
| `addDeliveryArea(name)` | `sync_setting('site_settings', {...})` | Customer dropdown updates live |
| `toggleDeliveryArea(id)` | `sync_setting('site_settings', {...})` | |
| `deleteDeliveryArea(id)` | `sync_setting('site_settings', {...})` | |
| `addSubscriptionPlan(name, price)` | `sync_setting('site_settings', {...})` | |
| `fetchAndSyncSettings()` | Fetch `site_settings` + `site_settings_private` | On mount |
| `setSettingsFromSupabase(data)` | — | Called by realtime listener |

### Sensitive Data Separation

```typescript
// Public settings (readable by anyone):
syncSettingToSupabase('site_settings', publicSettings)

// Private settings (API tokens — separate row):
syncSettingToSupabase('site_settings_private', { cloudApiToken, cloudApiPhoneId })

---

## 🍛 `recipeStore.ts`

**localStorage Key:** `hfc-recipes`  
**Supabase Table:** `public.recipes`  

### State Schema
```typescript
interface Recipe {
  id: string
  productId: string
  productName: string
  ingredientId: string
  quantityPerUnit: number
  unit: string
}
```

### Actions
*   `fetchRecipes()`: Fetches all recipe mapping parameters.
*   `saveRecipeIngredients(productId, productName, rows)`: Re-seeds mapping details atomically by invoking the `save_recipe_ingredients` helper client-side.

---

## 🍗 `inventoryStore.ts`

**localStorage Key:** `hfc-inventory`  
**Supabase Tables:** `public.ingredients`, `public.stock_entries`, `public.kitchen_closing`, `public.daily_stock_summary`, `public.kitchen_staff`  

### Actions
*   `fetchIngredients()`: Restores master items list.
*   `addIngredient(name, unit, category, costPerUnit, minStock)`: Appends a new item master catalog.
*   `fetchStockEntriesForDate(date)`: Retrieves baseline opening inventories.
*   `confirmOpeningStock(date, rows)`: Locks opening balances baseline for the day.
*   `fetchKitchenClosingForDate(date)`: Restores logged EOD physical count reports.
*   `submitKitchenClosing(date, rows, staffName)`: Logs actual physical count submissions, and checks discrepancies.
*   `fetchStockSummaries()`: Loads daily audit reconciliations reports history.
```
