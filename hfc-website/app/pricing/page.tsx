'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Star, CheckCircle2, ChevronDown, Check, Info, MessageCircle } from 'lucide-react'

// Hardcoded pricing plans (not using settings.subscriptionPlans store)
const PRICING_TIERS = [
  {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: 299,
    yearlyPrice: 2999,
    monthlyCostPerMonthText: 'Just ₹250/month, billed annually',
    dotColor: 'bg-green-500',
    description: 'Perfect for small juice shops, street counters, and cafes that just need digital ordering.',
    ctaLabel: 'Start with Basic',
    featured: false,
    badgeColor: 'border-brand-border',
    buttonStyle: 'border-2 border-brand-black text-brand-black hover:bg-brand-black hover:text-white active:bg-black',
    features: [
      { section: 'Customer Storefront', items: [
        'Mobile-optimized dynamic menu',
        'Interactive cart with live subtotal',
        'Coupon code validation at checkout',
        'Cash on Delivery + UPI QR checkout',
        'Live order tracker (Placed → Delivered)'
      ]},
      { section: 'Admin Panel', items: [
        'Real-time order alerts with sound',
        'Accept / reject / prep timer controls',
        'Product manager (add, edit, pricing, images)',
        'Coupons & promotions console',
        'Store settings (name, address, contact)'
      ]},
      { section: 'Security', items: [
        'Row-level order data protection',
        'XSS input sanitization',
        'Duplicate-order prevention'
      ]}
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 599,
    yearlyPrice: 5999,
    monthlyCostPerMonthText: 'Just ₹500/month, billed annually',
    dotColor: 'bg-blue-500',
    description: 'For active restaurants running their own delivery fleet and needing GST-compliant billing.',
    ctaLabel: 'Upgrade to Pro',
    featured: true, // ribbon + red border + offset on desktop
    badgeColor: 'border-brand-red shadow-[0_12px_40px_rgba(204,0,0,0.12)]',
    buttonStyle: 'bg-brand-red text-white hover:bg-brand-redHover active:bg-[#8B0000] shadow-[0_4px_16px_rgba(204,0,0,0.25)]',
    features: [
      { section: 'Everything in Basic, plus:', items: [] },
      { section: 'Kitchen Display System', items: [
        'Dedicated KDS prep monitor screen',
        'Color-coded prep-time timers',
        'One-touch prep completion toggle'
      ]},
      { section: 'Delivery Fleet', items: [
        'Dedicated rider login portal',
        'Live dispatch dashboard + status controls',
        'Assign riders from order detail page',
        'Rider earnings & delivery reports'
      ]},
      { section: 'Billing & Compliance', items: [
        'GST engine (inclusive/exclusive toggle)',
        'Printable invoices with tax breakup'
      ]},
      { section: 'WhatsApp', items: [
        'One-click dispatch & confirmation messages'
      ]}
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    monthlyPrice: 899,
    yearlyPrice: 8000,
    monthlyCostPerMonthText: 'Just ₹667/month, billed annually',
    dotColor: null, // Emoji 🔥
    description: 'The complete Restaurant ERP — eliminate shrinkage, prevent theft, automate procurement.',
    ctaLabel: 'Go Premium',
    featured: false,
    badgeColor: 'border-brand-border',
    buttonStyle: 'border-2 border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-white active:bg-[#A67B2E]',
    features: [
      { section: 'Everything in Pro, plus:', items: [] },
      { section: 'Recipe Mapping', items: [
        'Bind menu items to exact raw ingredient weights',
        'Standardized units (KG, L, G, PCS)'
      ]},
      { section: 'Stock Control', items: [
        'Daily stock refill logger (supplier, rate, invoice)',
        'Sealed daily opening stock baseline',
        'Live ingredient depletion as orders come in'
      ]},
      { section: 'Anti-Theft Protection', items: [
        'Staff PIN verification with lockout protection',
        'Zero-feedback EOD counts (prevents fudging)',
        'Tamper-proof, immutable closing records'
      ]},
      { section: 'Audits & Alerts', items: [
        'Automatic variance & shrinkage cost calculation',
        'Instant WhatsApp alerts on critical discrepancies',
        'Next-day procurement lists, auto-sent to vendors'
      ]}
    ]
  }
]

const FAQ_ITEMS = [
  {
    question: 'Can I switch plans later?',
    answer: 'Yes — upgrade or downgrade anytime. Changes take effect on your next billing cycle, and we will prorate the difference.'
  },
  {
    question: 'Do I need my own delivery riders for the Pro plan?',
    answer: 'Yes, the Delivery Agent Portal works with your own riders or anyone you assign. It is not tied to a third-party fleet. You create rider accounts directly from your admin panel.'
  },
  {
    question: 'What happens to my data if I downgrade?',
    answer: 'Your data is never deleted. If you downgrade from Premium, your inventory records stay saved in the database — you just won’t see new theft-detection alerts or stock tracking until you upgrade again.'
  },
  {
    question: 'Is there a setup fee or long-term contract?',
    answer: 'No setup fees, no lock-in contracts. Monthly plans can be cancelled anytime; yearly plans are billed once upfront at the discounted rate.'
  },
  {
    question: 'How does the anti-theft system actually work?',
    answer: 'Every dish is mapped to its exact ingredient usage. As orders come in, we calculate exactly how much stock should be used. At day’s end, your kitchen staff enters what’s physically left — without seeing what the system expected — and we flag any unexplained gap directly to you via WhatsApp.'
  },
  {
    question: 'Can I try before I subscribe?',
    answer: 'Reach out via WhatsApp or the Contact button and we will set up a live walkthrough on your own menu before you commit to a plan.'
  }
]

const COMPARISON_FEATURES = [
  { group: 'CUSTOMER STOREFRONT', features: [
    { name: 'Mobile-optimized menu', basic: true, pro: true, premium: true },
    { name: 'Interactive cart & checkout', basic: true, pro: true, premium: true },
    { name: 'Coupon code validation', basic: true, pro: true, premium: true },
    { name: 'Cash on Delivery & UPI', basic: true, pro: true, premium: true },
    { name: 'Live order status tracker', basic: true, pro: true, premium: true }
  ]},
  { group: 'ADMIN PANEL', features: [
    { name: 'Real-time order alerts', basic: true, pro: true, premium: true },
    { name: 'Accept / Reject controls', basic: true, pro: true, premium: true },
    { name: 'Product catalog manager', basic: true, pro: true, premium: true },
    { name: 'Discount coupon creator', basic: true, pro: true, premium: true }
  ]},
  { group: 'SECURITY', features: [
    { name: 'Row-level order protection', basic: true, pro: true, premium: true },
    { name: 'XSS input sanitization', basic: true, pro: true, premium: true },
    { name: 'Duplicate-order guard', basic: true, pro: true, premium: true }
  ]},
  { group: 'KITCHEN DISPLAY SYSTEM', features: [
    { name: 'Dedicated KDS monitor screen', basic: false, pro: true, premium: true },
    { name: 'Prep-time tracking clocks', basic: false, pro: true, premium: true },
    { name: 'One-touch prep completion', basic: false, pro: true, premium: true }
  ]},
  { group: 'DELIVERY FLEET', features: [
    { name: 'Dedicated rider login portal', basic: false, pro: true, premium: true },
    { name: 'Rider dispatch dashboard', basic: false, pro: true, premium: true },
    { name: 'Assign riders to orders', basic: false, pro: true, premium: true },
    { name: 'Rider earnings report metrics', basic: false, pro: true, premium: true }
  ]},
  { group: 'BILLING & COMPLIANCE', features: [
    { name: 'GST tax engine & logic', basic: false, pro: true, premium: true },
    { name: 'Printable receipts & invoices', basic: false, pro: true, premium: true }
  ]},
  { group: 'WHATSAPP AUTOMATION', features: [
    { name: 'One-click order details sharing', basic: false, pro: true, premium: true }
  ]},
  { group: 'RECIPE MAPPING', features: [
    { name: 'Bind menu to raw weights', basic: false, pro: false, premium: true, jargon: 'Maps each dish to its exact raw ingredient usage (e.g. 1 Chicken Biryani = 200g Fresh Chicken).' },
    { name: 'Standardized units (KG, L, G, PCS)', basic: false, pro: false, premium: true }
  ]},
  { group: 'STOCK CONTROL', features: [
    { name: 'Daily stock inward logs', basic: false, pro: false, premium: true },
    { name: 'Sealed daily opening baseline', basic: false, pro: false, premium: true },
    { name: 'Live ingredient depletion math', basic: false, pro: false, premium: true, jargon: 'Deducts raw material levels in real-time as customer orders are placed.' }
  ]},
  { group: 'ANTI-THEFT PROTECTION', features: [
    { name: 'Staff PIN with lockout timer', basic: false, pro: false, premium: true },
    { name: 'Zero-feedback EOD counts', basic: false, pro: false, premium: true, jargon: 'Staff type in physical balances without seeing what the system expects, preventing fudging.' },
    { name: 'Immutable Postgres trigger logs', basic: false, pro: false, premium: true, jargon: 'Database triggers block editing or deleting closing records once submitted.' }
  ]},
  { group: 'AUDITS & ALERTS', features: [
    { name: 'Automatic variance cost logging', basic: false, pro: false, premium: true },
    { name: 'Critical discrepancy SMS alerts', basic: false, pro: false, premium: true },
    { name: 'Auto WhatsApp procurements list', basic: false, pro: false, premium: true }
  ]}
]

function FeatureRow({ text, highlight = false }: { text: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <CheckCircle2
        size={15}
        className={highlight ? "text-brand-red flex-shrink-0 mt-0.5" : "text-green-600 flex-shrink-0 mt-0.5"}
      />
      <span className="font-body text-[13px] text-brand-body leading-[1.5]">
        {text}
      </span>
    </div>
  )
}

interface FaqItemProps {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
}

function FaqItem({ question, answer, isOpen, onToggle }: FaqItemProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    }
  }, [isOpen, answer])

  return (
    <div className="border-b border-brand-border py-5">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-red focus-visible:outline-offset-4 rounded-[4px]"
      >
        <span className="font-brand font-semibold text-[15px] text-brand-black">
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
        >
          <ChevronDown size={18} className="text-brand-red flex-shrink-0" />
        </motion.div>
      </button>

      <motion.div
        animate={{ height: isOpen ? height : 0 }}
        initial={false}
        transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="overflow-hidden"
      >
        <div ref={contentRef} className="pt-4">
          <p className="font-body text-[14px] text-brand-body leading-[1.7]">
            {answer}
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
      {/* Structured SEO Schema Data for Google Search Engine */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "HFC Restaurant ERP Software",
            "description": "Simple transparent pricing tiers for F&B operators. Auto depletion inventory, rider dispatches, and KDS.",
            "offers": [
              { "@type": "Offer", "name": "Basic Plan", "price": "299", "priceCurrency": "INR", "priceSpecification": { "@type": "UnitPriceSpecification", "price": "299", "priceCurrency": "INR", "unitText": "Month" } },
              { "@type": "Offer", "name": "Pro Plan", "price": "599", "priceCurrency": "INR", "priceSpecification": { "@type": "UnitPriceSpecification", "price": "599", "priceCurrency": "INR", "unitText": "Month" } },
              { "@type": "Offer", "name": "Premium Plan", "price": "899", "priceCurrency": "INR", "priceSpecification": { "@type": "UnitPriceSpecification", "price": "899", "priceCurrency": "INR", "unitText": "Month" } }
            ]
          })
        }}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: mounted ? 1 : 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.4 }}
        className="min-h-screen bg-white"
        style={{
          backgroundImage: 'radial-gradient(rgba(204, 0, 0, 0.04) 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px'
        }}
      >
        {/* Layer 2 — Pricing Hero */}
        <section className="pt-[140px] pb-[60px] text-center max-w-[900px] mx-auto px-6">
          <div className="inline-flex items-center gap-2 border border-brand-red bg-brand-redLight rounded-full px-4 py-1.5 mb-6">
            <Star size={11} fill="#CC0000" color="#CC0000" />
            <span className="font-brand font-semibold text-[11px] text-brand-red tracking-[1px] uppercase">
              Simple, Transparent Pricing
            </span>
          </div>

          <h1 className="font-display font-bold text-[36px] sm:text-[52px] leading-[1.15] text-brand-black">
            Run Your Restaurant Software<br />
            <span className="text-brand-red">Without the Chaos.</span>
          </h1>

          <p className="font-tagline italic text-[16px] sm:text-[18px] text-brand-body leading-[1.7] mt-5 max-w-[600px] mx-auto">
            From your first order to full inventory automation — pick the plan that matches where your kitchen is today. Upgrade anytime as you grow.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 bg-[#FAFAFA] border border-brand-border rounded-full p-1.5 mt-10">
            <button
              onClick={() => setBilling('monthly')}
              className={`hfc-focusable px-6 py-2.5 rounded-full font-brand font-semibold text-[13px] transition-all duration-100 ${
                billing === 'monthly'
                  ? 'bg-brand-red text-white'
                  : 'text-brand-body hover:text-brand-black'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`hfc-focusable px-6 py-2.5 rounded-full font-brand font-semibold text-[13px] flex items-center gap-2 transition-all duration-100 ${
                billing === 'yearly'
                  ? 'bg-brand-red text-white'
                  : 'text-brand-body hover:text-brand-black'
              }`}
            >
              Yearly
              <span className="bg-brand-gold text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-[0.5px]">
                Save ~17%
              </span>
            </button>
          </div>
        </section>

        {/* Layer 3 — 3-Column Pricing Cards */}
        <section className="max-w-[1180px] mx-auto px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6 items-start">
            {PRICING_TIERS.map((tier, idx) => (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{
                  duration: shouldReduceMotion ? 0.01 : 0.5,
                  delay: shouldReduceMotion ? 0 : idx * 0.12,
                  ease: [0.22, 1, 0.36, 1]
                }}
                className={`bg-white border-2 rounded-[16px] p-6 md:p-5 lg:p-8 relative ${tier.badgeColor} ${
                  tier.featured ? 'lg:-mt-4 lg:mb-4 border-brand-red shadow-[0_12px_40px_rgba(204,0,0,0.12)]' : 'border-brand-border'
                }`}
              >
                {/* Visual promotion ribbon */}
                {tier.featured && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: -8 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.4,
                      delay: shouldReduceMotion ? 0 : 0.5,
                      type: 'spring',
                      stiffness: 300,
                      damping: 15
                    }}
                    className="absolute -top-[1px] left-1/2 -translate-x-1/2 bg-brand-red text-white font-brand font-bold text-[10px] uppercase tracking-[1.5px] px-5 py-1.5 rounded-b-[8px]"
                  >
                    ⭐ Most Popular
                  </motion.div>
                )}

                <div className="flex items-center gap-2.5 mb-1 mt-2">
                  {tier.dotColor ? (
                    <span className={`w-3 h-3 rounded-full ${tier.dotColor}`} />
                  ) : (
                    <span className="text-[14px]">🔥</span>
                  )}
                  <h3 className="font-brand font-bold text-[13px] text-brand-black uppercase tracking-[1px]">
                    {tier.name}
                  </h3>
                </div>

                <p className="font-body text-[13px] text-brand-muted mt-2 mb-6">
                  {tier.description}
                </p>

                {/* Price block */}
                <div className="flex items-baseline gap-1.5 mb-1">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={billing + (billing === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice)}
                      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: shouldReduceMotion ? 0 : 4 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                      className="font-brand font-black text-[38px] lg:text-[42px] text-brand-black leading-none"
                    >
                      ₹{(billing === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice).toLocaleString('en-IN')}
                    </motion.span>
                  </AnimatePresence>
                  <span className="font-body text-[14px] text-brand-muted">
                    / {billing === 'monthly' ? 'month' : 'year'}
                  </span>
                </div>

                <div className="h-6">
                  <AnimatePresence mode="wait">
                    {billing === 'yearly' && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="font-body text-[11px] text-green-700 font-semibold"
                      >
                        {tier.monthlyCostPerMonthText}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* CTA Button */}
                <button
                  className={`w-full h-[48px] font-brand font-bold text-[13px] uppercase tracking-[1px] rounded-md transition-all duration-150 active:scale-[0.98] mt-4 mb-8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-red focus-visible:outline-offset-2 ${tier.buttonStyle}`}
                >
                  {tier.ctaLabel}
                </button>

                {/* Features Checklist */}
                <div className="space-y-6">
                  {tier.features.map((section, sidx) => (
                    <div key={sidx} className="space-y-3">
                      <p className="font-brand font-bold text-[11px] text-brand-muted uppercase tracking-[1px]">
                        {section.section}
                      </p>
                      {section.items.map((item, fidx) => (
                        <FeatureRow key={fidx} text={item} highlight={tier.featured} />
                      ))}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Layer 4 — Detailed Feature Comparison Table */}
        <section className="bg-[#FAFAFA] py-20 mt-16 border-y border-brand-border">
          <div className="max-w-[1000px] mx-auto px-6">
            <h2 className="font-display font-bold text-[32px] text-brand-black text-center mb-3">
              Compare Every Feature
            </h2>
            <p className="font-body text-[14px] text-brand-muted text-center mb-12">
              See exactly what is included in each plan
            </p>

            <div className="bg-white border border-brand-border rounded-[12px] overflow-hidden shadow-sm">
              <div className="overflow-x-auto relative">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-brand-border bg-brand-surface">
                      <th className="sticky left-0 z-10 bg-brand-surface border-r border-brand-border w-[240px] min-w-[240px] text-left px-5 py-4 font-brand font-bold text-[11px] text-brand-black uppercase tracking-wider shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)]">
                        Feature
                      </th>
                      <th className="px-5 py-4 min-w-[120px] text-center font-brand font-semibold text-[11px] text-brand-black uppercase tracking-wider">
                        Basic
                      </th>
                      <th className="px-5 py-4 min-w-[120px] text-center font-brand font-bold text-[11px] text-brand-red bg-brand-redLight uppercase tracking-wider">
                        Pro
                      </th>
                      <th className="px-5 py-4 min-w-[120px] text-center font-brand font-semibold text-[11px] text-brand-black uppercase tracking-wider">
                        Premium
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_FEATURES.map((group, gidx) => (
                      <React.Fragment key={gidx}>
                        <tr className="bg-brand-surface border-b border-brand-border">
                          <td colSpan={4} className="sticky left-0 z-10 bg-brand-surface px-5 py-2.5 font-brand font-bold text-[10px] text-brand-muted tracking-wider">
                            {group.group}
                          </td>
                        </tr>
                        {group.features.map((feat, fidx) => (
                          <tr
                            key={fidx}
                            className={`border-b border-brand-border hover:bg-red-50/10 transition-colors ${
                              fidx % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'
                            }`}
                          >
                            <td className={`sticky left-0 z-10 border-r border-brand-border px-5 py-3.5 font-body text-[13px] text-brand-black flex items-center gap-1.5 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] ${
                              fidx % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'
                            }`}>
                              <span>{feat.name}</span>
                              {feat.jargon && (
                                <div className="group relative">
                                  <Info size={13} className="text-brand-muted hover:text-brand-red cursor-help" />
                                  <div className="pointer-events-none absolute bottom-full left-0 mb-2 w-64 p-3 bg-brand-black text-white text-[11px] rounded-btn shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 leading-relaxed font-body">
                                    {feat.jargon}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              {feat.basic ? (
                                <Check size={16} className="text-green-600 mx-auto" />
                              ) : (
                                <span className="text-brand-muted">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-center bg-brand-redLight/20">
                              {feat.pro ? (
                                <Check size={16} className="text-brand-red mx-auto font-bold" />
                              ) : (
                                <span className="text-brand-muted">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              {feat.premium ? (
                                <Check size={16} className="text-green-600 mx-auto" />
                              ) : (
                                <span className="text-brand-muted">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Layer 5 — FAQ Section */}
        <section className="bg-white py-20 max-w-[720px] mx-auto px-6">
          <h2 className="font-display font-bold text-[32px] text-brand-black text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-1">
            {FAQ_ITEMS.map((item, idx) => (
              <FaqItem
                key={idx}
                question={item.question}
                answer={item.answer}
                isOpen={openFaqIndex === idx}
                onToggle={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
              />
            ))}
          </div>
        </section>

        {/* Layer 6 — Final CTA Banner */}
        <section className="bg-brand-redLight border-y border-brand-red/20 py-20 text-center">
          <div className="max-w-[700px] mx-auto px-6 space-y-6">
            <h2 className="font-display font-bold text-[30px] sm:text-[36px] text-brand-black leading-tight">
              Still deciding which plan fits your kitchen?
            </h2>
            <p className="font-tagline italic text-[16px] sm:text-[18px] text-brand-body">
              Talk to us — we’ll recommend the right tier based on your order volume and team size.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <a
                href="https://wa.me/919912799855"
                target="_blank"
                rel="noreferrer"
                className="hfc-focusable bg-[#25D366] text-white font-brand font-bold text-[13px] uppercase tracking-[1.5px] px-8 py-3.5 rounded-full flex items-center justify-center gap-2 hover:bg-[#20ba59] transition-all duration-150 active:scale-[0.98] shadow-sm"
              >
                <MessageCircle size={18} />
                Chat on WhatsApp
              </a>
              <a
                href="/#menu-section"
                className="hfc-focusable border-2 border-brand-black text-brand-black font-brand font-bold text-[13px] uppercase tracking-[1.5px] px-8 py-3.5 rounded-full flex items-center justify-center hover:bg-brand-black hover:text-white transition-all duration-150 active:scale-[0.98]"
              >
                Explore the Menu Demo
              </a>
            </div>
          </div>
        </section>
      </motion.div>
    </>
  )
}
