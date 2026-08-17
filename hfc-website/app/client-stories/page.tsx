'use client'

import React, { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Star, MessageCircle, ArrowRight, ShieldCheck, TrendingUp, Sparkles } from 'lucide-react'
import Image from 'next/image'

const SUCCESS_STORIES = [
  {
    brand: 'Pizza Lounge',
    location: 'Vijayawada, AP',
    badge: 'Bestseller Outlets',
    stats: [
      { label: 'Sales Growth', value: '+42% in 3 Months' },
      { label: 'Wastage Cut', value: 'Reduced by 68%' }
    ],
    quote: "HFC restructured our entire menu pricing. By breaking down our portion costs and implementing standardized ingredient weights, we turned a struggling food court kitchen into Vijayawada's top-rated quick pizza brand.",
    founderName: 'Satish Chittelu',
    founderTitle: 'Co-owner & Systems Engineer',
    tags: ['Menu Engineering', 'Digital POS Setup', 'Operations Playbook']
  },
  {
    brand: 'Raju\'s Cafe & Quick Service',
    location: 'Rajam, AP',
    badge: 'Fast Casual Outlet',
    stats: [
      { label: 'Direct Orders', value: '80% via WhatsApp' },
      { label: 'Theft Instances', value: 'Dropped to Zero' }
    ],
    quote: "Our biggest headache was staff accountability and stock leakage when we weren't physically at the counter. HFC's immutable daily closing checklist with blind expected counts saved us over ₹18,000 in monthly leakage.",
    founderName: 'Raju Varma',
    founderTitle: 'Managing Partner',
    tags: ['Anti-Theft ERP', 'WhatsApp Ordering', 'Daily Closing Audits']
  },
  {
    brand: 'Kasibugga Juice & Street Counter',
    location: 'Palasa, AP',
    badge: 'Local Street Cafe',
    stats: [
      { label: 'Customer Base', value: 'Double in 60 Days' },
      { label: 'Order Processing', value: '3x Faster' }
    ],
    quote: "We didn't think a small juice shop needed consulting. HFC simplified our menu from 80 items to 25 fast-moving specials. Order prep time dropped from 12 minutes to 3 minutes, and table turnover doubled.",
    founderName: 'Sathveek Nalla',
    founderTitle: 'Technical Advisor',
    tags: ['Wastage Optimization', 'QR Table Menu', 'Menu Engineering']
  }
]

export default function ClientStoriesPage() {
  const [mounted, setMounted] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
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
      {/* Hero Section */}
      <section className="pt-[140px] pb-16 text-center max-w-[900px] mx-auto px-6">
        <div className="inline-flex items-center gap-2 border border-brand-red bg-brand-redLight rounded-full px-4 py-1.5 mb-6">
          <Sparkles size={11} fill="#CC0000" color="#CC0000" />
          <span className="font-brand font-semibold text-[11px] text-brand-red tracking-[1px] uppercase">
            Client Success
          </span>
        </div>

        <h1 className="font-display font-bold text-[36px] sm:text-[50px] leading-[1.15] text-brand-black">
          Real Kitchens.<br />
          <span className="text-brand-red">Real Revenue Growth.</span>
        </h1>

        <p className="font-tagline italic text-[16px] sm:text-[18px] text-brand-body leading-[1.7] mt-5 max-w-[600px] mx-auto">
          See how local restaurant owners and cloud kitchen startups across India used HFC consulting and automation platforms to eliminate theft, cut wastage, and multiply direct orders.
        </p>
      </section>

      {/* Stories Grid */}
      <section className="max-w-[1100px] mx-auto px-6 pb-24 space-y-12">
        {SUCCESS_STORIES.map((story, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : idx * 0.1 }}
            className="bg-white border border-brand-border rounded-[20px] p-8 sm:p-10 shadow-xs hover:shadow-cardHover transition-shadow duration-300 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10 items-center"
          >
            
            {/* Story Text */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="px-3.5 py-1 bg-brand-redLight border border-brand-red/10 rounded-full font-brand font-bold text-[10px] text-brand-red uppercase tracking-wider">
                  {story.badge}
                </span>
                <span className="font-body text-[12px] text-brand-muted">
                  📍 {story.location}
                </span>
              </div>

              <div>
                <h2 className="font-display font-bold text-[26px] text-brand-black">
                  {story.brand}
                </h2>
                <div className="flex flex-wrap gap-2 mt-3">
                  {story.tags.map((tag, tIdx) => (
                    <span key={tIdx} className="px-2.5 py-1 bg-brand-surface border border-brand-border rounded-[6px] font-body text-[11px] text-brand-body">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <blockquote className="font-body text-[14.5px] text-brand-body leading-[1.8] italic border-l-4 border-brand-red pl-5">
                &quot;{story.quote}&quot;
              </blockquote>

              <div className="pt-2">
                <p className="font-brand font-bold text-[14px] text-brand-black">
                  {story.founderName}
                </p>
                <p className="font-brand font-semibold text-[11px] text-brand-red uppercase tracking-wider mt-0.5">
                  {story.founderTitle}
                </p>
              </div>
            </div>

            {/* Metrics Sidebar */}
            <div className="bg-brand-surface border border-brand-border rounded-[16px] p-6 lg:p-8 space-y-6">
              <p className="font-brand font-bold text-[11px] text-brand-muted uppercase tracking-wider text-center">
                📊 Verified Outcomes
              </p>

              <div className="space-y-6 divide-y divide-brand-border/60">
                {story.stats.map((stat, sIdx) => (
                  <div key={sIdx} className={`pt-6 first:pt-0 text-center`}>
                    <div className="font-brand font-black text-[24px] sm:text-[28px] text-brand-black">
                      {stat.value}
                    </div>
                    <p className="font-body text-[12px] text-brand-muted mt-1">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <div className="flex justify-center text-brand-gold gap-0.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={15} fill="#C9973A" color="#C9973A" />
                  ))}
                </div>
                <p className="font-body text-[10px] text-brand-muted text-center mt-1.5 uppercase font-bold tracking-wider">
                  5/5 Verified Review
                </p>
              </div>
            </div>

          </motion.div>
        ))}
      </section>

      {/* CTA section */}
      <section className="bg-brand-redLight border-y border-brand-red/20 py-20 text-center">
        <div className="max-w-[700px] mx-auto px-6 space-y-6">
          <h2 className="font-display font-bold text-[30px] sm:text-[36px] text-brand-black leading-tight">
            Ready to become our next success story?
          </h2>
          <p className="font-tagline italic text-[16px] sm:text-[18px] text-brand-body">
            Get a free F&B audit from Satish and Sathveek on WhatsApp. Let&apos;s talk about your menu structure.
          </p>

          <div className="flex justify-center pt-4">
            <a
              href="https://wa.me/919912799855"
              target="_blank"
              rel="noreferrer"
              className="hfc-focusable bg-[#25D366] text-white font-brand font-bold text-[13px] uppercase tracking-[1.5px] px-8 py-3.5 rounded-full flex items-center justify-center gap-2 hover:bg-[#20ba59] transition-all duration-150 active:scale-[0.98] shadow-sm"
            >
              <MessageCircle size={18} />
              Consult on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </motion.div>
  )
}
