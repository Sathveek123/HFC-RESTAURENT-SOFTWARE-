'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Star, Award, TrendingUp, Wallet, Handshake, ShieldCheck, ChevronRight, MessageCircle, Terminal, Cpu, Network, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'

const TIMELINE_ENTRIES = [
  {
    year: '2011',
    title: 'Where It Started',
    description: 'HFC began as a single home-kitchen consulting one struggling street-food vendor through a menu redesign. Word spread fast across Kasibugga.'
  },
  {
    year: '2015',
    title: 'Building the Playbook',
    description: 'After consulting 50+ kitchens, we developed operational systems that move food businesses from struggling survival to consistent profitability.'
  },
  {
    year: '2019',
    title: 'Going Digital',
    description: 'We started building custom ordering, kitchen display, and delivery logistics software because every client requested the exact same digital tools.'
  },
  {
    year: '2023',
    title: '200+ Brands Strong',
    description: 'From local street outlets to multi-location restaurants, HFC has guided over 200 F&B businesses across Andhra Pradesh and beyond.'
  },
  {
    year: '2026',
    title: 'Today — The Complete Restaurant ERP',
    description: 'We combine hands-on culinary consulting with an anti-theft restaurant software software platform — built from 15 years of active market experience.'
  }
]

const VALUES_PILLARS = [
  {
    icon: TrendingUp,
    title: 'Growth First',
    description: "We don't just consult — we stay invested until your daily order volume and profit numbers actually move."
  },
  {
    icon: Wallet,
    title: 'Real Budgets',
    description: 'Every recommendation fits what your kitchen can actually afford. Zero unrealistic corporate bloat.'
  },
  {
    icon: Handshake,
    title: 'Zero Hidden Fees',
    description: 'Transparent SaaS subscription pricing, zero recurring order commissions, and software you 100% own.'
  },
  {
    icon: ShieldCheck,
    title: 'Security & Reliability',
    description: 'Database-level anti-theft triggers, staff PIN lockouts, and 99.9% uptime for total peace of mind.'
  }
]

export default function AboutPage() {
  const [mounted, setMounted] = useState(false)
  const [activeLeader, setActiveLeader] = useState<'satish' | 'sathveek'>('satish')
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    setMounted(true)
  }, [])

  const scrollToTeam = () => {
    const el = document.getElementById('leadership-section')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      {/* SEO Structured Metadata for About Page */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "HFC Consultancy Services",
            "url": "https://hfc-website-two.vercel.app/about",
            "logo": "https://hfc-website-two.vercel.app/logo.jpeg",
            "foundingDate": "2011",
            "description": "Premium Food & F&B Consultancy Services based in Andhra Pradesh helping restaurants and restaurants scale profitability.",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Labour Colony, Rajam",
              "addressLocality": "Rajam",
              "addressRegion": "Andhra Pradesh",
              "postalCode": "532127",
              "addressCountry": "IN"
            }
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
        {/* Layer 2 — About Hero */}
        <section className="pt-[140px] pb-[80px] max-w-[1280px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-16 items-center">
            
            {/* Left Column */}
            <div>
              <div className="inline-flex items-center gap-2 border border-brand-red bg-brand-redLight rounded-full px-4 py-1.5 mb-6">
                <Star size={11} fill="#CC0000" color="#CC0000" />
                <span className="font-brand font-semibold text-[11px] text-brand-red tracking-[1px] uppercase">
                  Our Story
                </span>
              </div>

              <h1 className="font-display font-bold text-[38px] sm:text-[50px] leading-[1.15] text-brand-black">
                We&apos;ve Spent 15 Years Learning<br />
                What Makes Food Businesses <span className="text-brand-red">Grow.</span>
              </h1>

              <p className="font-tagline italic text-[16px] sm:text-[18px] text-brand-body leading-[1.7] mt-6 max-w-[540px]">
                HFC Consultancy Services started with one simple belief: great food deserves a business behind it that actually works. Today, we&apos;ve helped 200+ F&B brands across India turn recipes into revenue.
              </p>

              <div className="flex flex-wrap gap-4 mt-8">
                <button
                  onClick={scrollToTeam}
                  className="bg-brand-red text-white font-brand font-bold text-[13px] uppercase tracking-[1px] px-7 py-4 rounded-md hover:bg-brand-redHover active:scale-[0.98] transition-all duration-150 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-red"
                >
                  Meet the Leaders
                </button>
                <a
                  href="/pricing"
                  className="border-2 border-brand-black text-brand-black font-brand font-bold text-[13px] uppercase tracking-[1px] px-7 py-4 rounded-md hover:bg-brand-black hover:text-white active:scale-[0.98] transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-red"
                >
                  Explore Pricing Plans
                </a>
              </div>
            </div>

            {/* Right Column — Visual Anchor */}
            <div className="relative w-full aspect-square max-w-[420px] mx-auto">
              <div className="absolute inset-0 border border-dashed border-brand-red/20 rounded-full animate-spin-slow pointer-events-none" />
              <div className="absolute inset-4 border border-brand-border bg-white rounded-full pointer-events-none shadow-xs" />
              
              <div className="absolute inset-8 rounded-full overflow-hidden border-4 border-white shadow-float">
                <Image
                  src="/logo.jpeg"
                  alt="HFC Brand History"
                  fill
                  className="object-cover"
                />
              </div>

              {/* Floating Badge */}
              <div className="absolute bottom-4 -left-4 sm:-left-8 bg-white border border-brand-border rounded-[10px] shadow-float px-4 py-3 w-[180px] z-20">
                <div className="flex items-center gap-1.5 font-brand font-semibold text-[12px] text-brand-black">
                  <Award size={14} className="text-brand-red" />
                  <span>Founded 2011</span>
                </div>
                <p className="font-body text-[11px] text-brand-muted mt-0.5">
                  Kasibugga, Andhra Pradesh
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* Layer 3 — Narrative Timeline */}
        <section className="bg-[#FAFAFA] py-20 border-y border-brand-border">
          <div className="max-w-[900px] mx-auto px-6">
            <p className="font-brand font-semibold text-[11px] text-brand-red tracking-[3px] uppercase text-center">
              The Journey
            </p>
            <h2 className="font-display font-bold text-[36px] text-brand-black text-center mt-2 mb-16">
              From One Kitchen to 200+
            </h2>

            <div className="relative">
              {/* Desktop center line */}
              <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] bg-brand-border" />

              {TIMELINE_ENTRIES.map((entry, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: shouldReduceMotion ? 0 : (idx % 2 === 0 ? -20 : 20) }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
                  className={`relative mb-14 md:w-1/2 ${
                    idx % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12 md:ml-auto'
                  }`}
                >
                  {/* Dot marker on the center line */}
                  <div
                    className={`hidden md:block absolute top-1.5 w-3.5 h-3.5 rounded-full bg-brand-red border-2 border-white shadow-[0_0_0_3px_rgba(204,0,0,0.15)] ${
                      idx % 2 === 0 ? '-right-[7px]' : '-left-[7px]'
                    }`}
                  />

                  <span className="font-brand font-black text-[13px] text-brand-red uppercase tracking-[1px]">
                    {entry.year}
                  </span>
                  <h3 className="font-display font-bold text-[20px] text-brand-black mt-1">
                    {entry.title}
                  </h3>
                  <p className="font-body text-[13px] text-brand-body leading-[1.7] mt-2">
                    {entry.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Layer 4 — Mission & Values */}
        <section className="bg-white py-20 max-w-[1100px] mx-auto px-6">
          <div className="text-center mb-16">
            <p className="font-brand font-semibold text-[11px] text-brand-red tracking-[3px] uppercase">
              What We Believe
            </p>
            <h2 className="font-display font-bold text-[36px] text-brand-black mt-2">
              Built On Four Principles
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES_PILLARS.map((item, idx) => {
              const IconComp = item.icon
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: shouldReduceMotion ? 0 : idx * 0.1, duration: 0.4 }}
                  className="bg-white border border-brand-border rounded-[14px] p-7 text-center hover:shadow-cardHover transition-shadow duration-300"
                >
                  <div className="w-14 h-14 rounded-full bg-brand-redLight flex items-center justify-center mx-auto mb-5">
                    <IconComp size={24} className="text-brand-red" />
                  </div>
                  <h3 className="font-brand font-bold text-[16px] text-brand-black mb-2">
                    {item.title}
                  </h3>
                  <p className="font-body text-[13px] text-brand-body leading-[1.6]">
                    {item.description}
                  </p>
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* Layer 5 — By The Numbers Stat Strip */}
        <section className="bg-brand-surface py-16 border-y border-brand-border">
          <div className="max-w-[1100px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="font-brand font-black text-[38px] sm:text-[44px] text-brand-red leading-none">
                200+
              </div>
              <p className="font-body text-[13px] text-brand-muted mt-2">
                F&B Brands Consulted
              </p>
            </div>
            <div>
              <div className="font-brand font-black text-[38px] sm:text-[44px] text-brand-black leading-none">
                15+
              </div>
              <p className="font-body text-[13px] text-brand-muted mt-2">
                Years Experience
              </p>
            </div>
            <div>
              <div className="font-brand font-black text-[38px] sm:text-[44px] text-brand-red leading-none">
                4.9 ★
              </div>
              <p className="font-body text-[13px] text-brand-muted mt-2">
                Client Rating (184 Reviews)
              </p>
            </div>
            <div>
              <div className="font-brand font-black text-[38px] sm:text-[44px] text-brand-black leading-none">
                +34%
              </div>
              <p className="font-body text-[13px] text-brand-muted mt-2">
                Avg 6-Month Growth
              </p>
            </div>
          </div>
        </section>

        {/* Layer 6 — Meet The Team (Founder Story Selector Console) */}
        <section id="leadership-section" className="bg-white py-20 max-w-[1100px] mx-auto px-6">
          <div className="text-center mb-10">
            <p className="font-brand font-semibold text-[11px] text-brand-red tracking-[3px] uppercase">
              Leadership
            </p>
            <h2 className="font-display font-bold text-[36px] text-brand-black mt-2">
              The People Behind HFC
            </h2>
            <p className="font-body text-[13px] text-brand-muted mt-2">
              Select a founder to read their story, technology background, and digital vision.
            </p>
          </div>

          {/* Interactive Toggle Segment Buttons */}
          <div className="flex justify-center mb-16">
            <div className="inline-flex bg-brand-surface border border-brand-border p-1 rounded-full shadow-xs">
              <button
                onClick={() => setActiveLeader('satish')}
                className={`hfc-focusable px-6 sm:px-8 py-3 rounded-full font-brand font-bold text-[12px] sm:text-[13px] uppercase tracking-wider transition-all duration-150 active:scale-95 ${
                  activeLeader === 'satish'
                    ? 'bg-brand-red text-white'
                    : 'text-brand-body hover:text-brand-black'
                }`}
              >
                Satish Chittelu
              </button>
              <button
                onClick={() => setActiveLeader('sathveek')}
                className={`hfc-focusable px-6 sm:px-8 py-3 rounded-full font-brand font-bold text-[12px] sm:text-[13px] uppercase tracking-wider transition-all duration-150 active:scale-95 ${
                  activeLeader === 'sathveek'
                    ? 'bg-brand-red text-white'
                    : 'text-brand-body hover:text-brand-black'
                }`}
              >
                Sathveek Nalla
              </button>
            </div>
          </div>

          {/* Tab Display Screens */}
          <div className="min-h-[500px]">
            <AnimatePresence mode="wait">
              {activeLeader === 'satish' ? (
                <motion.div
                  key="satish"
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -12 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-12 items-start"
                >
                  {/* Left portrait & blockquote */}
                  <div className="space-y-6">
                    <div className="relative aspect-square w-full rounded-[24px] overflow-hidden border border-brand-border shadow-md">
                      <Image
                        src="/logo.jpeg"
                        alt="Satish Chittelu Portrait"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="bg-brand-redLight/40 border-l-4 border-brand-red p-5 rounded-r-[12px] space-y-2">
                      <p className="font-tagline italic text-[15px] text-brand-black leading-relaxed">
                        &quot;My journey didn&apos;t start with a business idea... It started with engineering.&quot;
                      </p>
                      <p className="font-brand font-bold text-[11px] uppercase tracking-wider text-brand-red">
                        — Satish Chittelu, Founder of HFC
                      </p>
                    </div>
                  </div>

                  {/* Right story content */}
                  <div className="space-y-8">
                    <div>
                      <h3 className="font-display font-bold text-[28px] text-brand-black">
                        Satish Chittelu
                      </h3>
                      <p className="font-brand font-semibold text-[12px] text-brand-red uppercase tracking-wider mt-1">
                        Founder & Managing Director — HFC Consultancy Services
                      </p>
                    </div>

                    <div className="space-y-6 font-body text-[13.5px] text-brand-body leading-[1.75] border-l border-brand-border pl-6">
                      
                      <div className="space-y-2 relative">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-red absolute -left-[31px] top-1.5 border border-white" />
                        <h4 className="font-brand font-bold text-[14px] text-brand-black uppercase">
                          ⚡ Electrical Engineer to Entrepreneur
                        </h4>
                        <p>
                          After completing my B.Tech in Electrical & Electronics Engineering, I spent several years working in the core electrical sector, including major projects involving international and Indian companies. But somewhere in that journey, I always had another dream — to build something of my own.
                        </p>
                      </div>

                      <div className="space-y-2 relative">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-red absolute -left-[31px] top-1.5 border border-white" />
                        <h4 className="font-brand font-bold text-[14px] text-brand-black uppercase">
                          🍴 The Food Journey (Pizza Lounge)
                        </h4>
                        <p>
                          During my engineering days, I was a bachelor living in a room, and my passion for food slowly became a business idea. I researched products, recipes, branding, marketing, and customer behaviour, travelling across South and East India. This eventually led to my first food brand — <strong>Pizza Lounge in Vijayawada</strong>. I learned one critical lesson: <em>A great product alone is not enough. You need a strong brand, consistent quality, and powerful marketing.</em>
                        </p>
                      </div>

                      <div className="space-y-2 relative">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-red absolute -left-[31px] top-1.5 border border-white" />
                        <h4 className="font-brand font-bold text-[14px] text-brand-black uppercase">
                          ⚠️ Hyderabad Setbacks & HFC Foundation
                        </h4>
                        <p>
                          Later, I expanded to Hyderabad and experimented with food-courts and restaurant concepts. I experienced expansion, setbacks, lockdowns, financial challenges, and rebuilding. Every failure taught me something new. I realized that many food entrepreneurs were facing the same problems: wrong menus, poor costing, lack of branding, no proper marketing, operational issues, and a lack of business systems. That became the foundation of <strong>HFC Consultancy Services</strong>.
                        </p>
                      </div>

                      <div className="space-y-2 relative">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-red absolute -left-[31px] top-1.5 border border-white" />
                        <h4 className="font-brand font-bold text-[14px] text-brand-black uppercase">
                          💻 Connecting Business & Technology
                        </h4>
                        <p>
                          Business is changing. Technology, marketing, AI, and customer behavior are evolving. That&apos;s why I started <strong>Digital Creators Hub</strong> to connect students, creators, and entrepreneurs through digital skills, AI, automation, and collaboration. Our vision is to convert knowledge into practical opportunities.
                        </p>
                      </div>

                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="sathveek"
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -12 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-12 items-start"
                >
                  {/* Left portrait & blockquote */}
                  <div className="space-y-6">
                    <div className="relative aspect-square w-full rounded-[24px] overflow-hidden border border-brand-border shadow-md">
                      <Image
                        src="/logo.jpeg"
                        alt="Sathveek Nalla Portrait"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="bg-brand-redLight/40 border-l-4 border-brand-red p-5 rounded-r-[12px] space-y-2">
                      <p className="font-tagline italic text-[15px] text-brand-black leading-relaxed">
                        &quot;I design and build intelligent systems that solve real-world complexity — AI rule engines, performance-focused databases, and full-stack dashboards.&quot;
                      </p>
                      <p className="font-brand font-bold text-[11px] uppercase tracking-wider text-brand-red">
                        — Sathveek Nalla, Founder of NetQuora
                      </p>
                    </div>
                  </div>

                  {/* Right story content */}
                  <div className="space-y-8">
                    <div>
                      <h3 className="font-display font-bold text-[28px] text-brand-black">
                        Sathveek Nalla
                      </h3>
                      <p className="font-brand font-semibold text-[12px] text-brand-red uppercase tracking-wider mt-1">
                        Technical Lead of HFC & Founder of NetQuora
                      </p>
                    </div>

                    <div className="space-y-6 font-body text-[13.5px] text-brand-body leading-[1.75] border-l border-brand-border pl-6">
                      
                      <div className="space-y-2 relative">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-red absolute -left-[31px] top-1.5 border border-white" />
                        <h4 className="font-brand font-bold text-[14px] text-brand-black uppercase">
                          🖥️ Technical Architect & Automation Lead
                        </h4>
                        <p>
                          Starting my journey as a student engineer, I quickly bridged high-speed web automation with real-world local business growth. As the Technical Lead of HFC, I architected the core database synchronization systems, WebSocket updates, and server-side verification routines you see across the platform.
                        </p>
                      </div>

                      <div className="space-y-2 relative">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-red absolute -left-[31px] top-1.5 border border-white" />
                        <h4 className="font-brand font-bold text-[14px] text-brand-black uppercase">
                          🚀 Founder of NetQuora Agency
                        </h4>
                        <p>
                          As the founder of <strong>NetQuora</strong> digital agency, I have managed and delivered over **30+ client projects** for local and big Indian brands, always ensuring top-tier performance, security auditing, and delivery before deadlines.
                        </p>
                      </div>

                      <div className="space-y-2 relative">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-red absolute -left-[31px] top-1.5 border border-white" />
                        <h4 className="font-brand font-bold text-[14px] text-brand-black uppercase">
                          🤝 HFC x NetQuora Collaboration
                        </h4>
                        <p>
                          Our joint startup collaboration brings together <strong>HFC x NetQuora</strong> to dominate the food-technology landscape. Our mission is to scale restaurant operations, empower local vendors, and make custom digital workspaces accessible, ensuring local operators have the technology they need to stay ahead of the curve.
                        </p>
                      </div>

                      {/* Technical Badges */}
                      <div className="pt-2">
                        <p className="font-brand font-bold text-[11px] text-brand-muted uppercase tracking-wider mb-2">
                          Specialized Systems Stack
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1 bg-brand-surface border border-brand-border rounded-full font-mono text-[11px] text-brand-black flex items-center gap-1.5">
                            <Terminal size={12} className="text-brand-red" /> AI Rule Engines
                          </span>
                          <span className="px-3 py-1 bg-brand-surface border border-brand-border rounded-full font-mono text-[11px] text-brand-black flex items-center gap-1.5">
                            <Cpu size={12} className="text-brand-red" /> RAG AI Agents
                          </span>
                          <span className="px-3 py-1 bg-brand-surface border border-brand-border rounded-full font-mono text-[11px] text-brand-black flex items-center gap-1.5">
                            <Network size={12} className="text-brand-red" /> Realtime Sync
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Layer 7 — Final CTA Banner */}
        <section className="bg-brand-redLight border-t border-brand-red/20 py-20 text-center">
          <div className="max-w-[700px] mx-auto px-6 space-y-6">
            <h2 className="font-display font-bold text-[30px] sm:text-[36px] text-brand-black leading-tight">
              Ready to scale your kitchen business?
            </h2>
            <p className="font-tagline italic text-[16px] sm:text-[18px] text-brand-body">
              Get in touch with our consulting team directly on WhatsApp for a custom walkthrough.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <a
                href="https://wa.me/919912799855"
                target="_blank"
                rel="noreferrer"
                className="hfc-focusable bg-[#25D366] text-white font-brand font-bold text-[13px] uppercase tracking-[1.5px] px-8 py-3.5 rounded-full flex items-center justify-center gap-2 hover:bg-[#20ba59] transition-all duration-150 active:scale-[0.98] shadow-sm"
              >
                <MessageCircle size={18} />
                Talk to Us on WhatsApp
              </a>
              <a
                href="/pricing"
                className="hfc-focusable border-2 border-brand-black text-brand-black font-brand font-bold text-[13px] uppercase tracking-[1.5px] px-8 py-3.5 rounded-full flex items-center justify-center hover:bg-brand-black hover:text-white transition-all duration-150 active:scale-[0.98]"
              >
                View Software Pricing
              </a>
            </div>
          </div>
        </section>
      </motion.div>
    </>
  )
}
