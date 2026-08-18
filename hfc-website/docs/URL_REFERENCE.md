# 🌐 All Pages & URL Reference
**Applies To:** HFC Restaurant Software  
**Last Updated:** August 18, 2026  
**Base Domain:** https://hfc-restaurent-software.vercel.app  

---

## 1. Customer-Facing Pages

### 1.1 Main Website
| Page | URL | Description |
|------|-----|-------------|
| Home / Menu | `/` | Full customer website — hero, menu, cart, checkout |
| Privacy Policy | `/privacy` | DPDP Act 2023 compliance page |
| Terms of Service | `/terms` | Order terms, 5% GST policy, refund eligibility |
| Refund Policy | `/refund-policy` | Customer refund process |
| About | `/about` | About HFC restaurant |

### 1.2 Order Tracking
| Page | URL | Description |
|------|-----|-------------|
| Live Tracker | `/track/[orderId]` | Real-time order status stepper + UPI QR code payment |

### 1.3 Table QR Ordering (Dine-In)
| Page | URL | Description |
|------|-----|-------------|
| Table 1 Menu | `/table/1` | Browse menu, add items, checkout — Table 1 |
| Table 2 Menu | `/table/2` | Table 2 QR ordering session |
| Table 3 Menu | `/table/3` | Table 3 QR ordering session |
| *(any table number)* | `/table/{N}` | Supports integer or alphanumeric table IDs |
| Table Bill Tracker | `/table/{N}/track` | Live bill tracker for table session |

### 1.4 Counter Takeaway (Walk-In)
| Page | URL | Description |
|------|-----|-------------|
| Counter / Takeaway | `/counter` | Self-service QR ordering, token tracking |

---

## 2. Admin Panel Pages

| Page | URL | Access |
|------|-----|--------|
| Admin Redirect | `/admin` | Redirects to `/admin/login` if unauthenticated |
| Admin Login | `/admin/login` | Admin credential entry |
| Dashboard | `/admin/dashboard` | Revenue KPIs, order stats, agent performance |
| All Orders | `/admin/orders` | Order list with filters, search, pagination |
| Order Detail | `/admin/orders/[orderId]` | Status controls, agent assignment, payment |
| Products / Menu | `/admin/products` | Add, edit, delete, toggle menu items |
| Bills & Invoices | `/admin/bills` | Invoice history, mark-paid, print |
| Coupon Management | `/admin/coupons` | Coupons, offers, reward tiers |
| Delivery Agents | `/admin/agents` | Rider CRUD, credential resets |
| Agent Performance | `/admin/agents/[agentId]/performance` | Rider KPIs, settlement calculator |
| Table Management | `/admin/tables` | All dine-in table sessions |
| Table Session Detail | `/admin/tables/[tableNumber]` | Per-table session history |
| Settings | `/admin/settings` | Business config, UPI, GST, delivery areas |
| Kitchen Display (KDS) | `/admin/kitchen` | Live order monitor for kitchen staff |
| Kitchen EOD Closing | `/admin/kitchen/closing` | Staff stock count submission |
| Inventory Overview | `/admin/inventory` | Live depletion + KPI summary |
| Stock Entry | `/admin/inventory/stock` | Opening stock inputs |
| Recipe Mapper | `/admin/inventory/recipes` | Ingredient-to-product recipe builder |
| Purchase Planner | `/admin/inventory/purchase` | Tomorrow's procurement, WhatsApp export |
| Reports | `/admin/inventory/reports` | Daily historical discrepancy logs |

---

## 3. Delivery Agent Portal Pages

| Page | URL | Description |
|------|-----|-------------|
| Agent Login | `/agent/login` | Rider credential authentication |
| My Orders | `/agent/orders` | Orders assigned to current rider |
| My Report | `/agent/report` | Rider performance, earnings, ratings |

---

## 4. Server-Side API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/orders/create` | POST | Validates and creates customer web orders |
| `/api/counter/create-order` | POST | Creates counter takeaway orders (service role) |
| `/api/counter/token-status` | GET | Checks token number display status |
| `/api/table/create-session` | POST | Initializes a dine-in table session |
| `/api/table/check-lock` | POST | Verifies session token ownership |
| `/api/table/add-items` | POST | Adds items to existing table session |
| `/api/table/complete-order` | POST | Marks table session as payment pending |
| `/api/table/release-table` | POST | Admin: resets/clears a table session |
| `/api/admin/agents/provision` | POST | Securely provisions/updates rider credentials |

---

## 5. SEO & Crawlers
| File | URL | Purpose |
|------|-----|---------|
| Sitemap | `/sitemap.xml` | Auto-generated Next.js sitemap |
| Robots | `/robots.txt` | Crawler access rules |
