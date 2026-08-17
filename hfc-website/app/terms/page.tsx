'use client'

import React, { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Scale, ShieldAlert, Award, FileText } from 'lucide-react'

export default function TermsOfServicePage() {
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
      <div className="max-w-[800px] mx-auto px-6 pt-[140px] pb-24">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-brand-redLight flex items-center justify-center">
            <Scale className="text-brand-red" size={24} />
          </div>
          <div>
            <h1 className="font-display font-bold text-[32px] text-brand-black">
              Terms of Service
            </h1>
            <p className="font-body text-[12px] text-brand-muted mt-0.5">
              Last Updated: August 16, 2026
            </p>
          </div>
        </div>

        <div className="bg-white border border-brand-border rounded-[16px] p-8 space-y-8 font-body text-[14px] text-brand-body leading-[1.75] shadow-xs">
          
          <section className="space-y-3">
            <h2 className="font-brand font-bold text-[16px] text-brand-black uppercase tracking-wider flex items-center gap-2">
              <FileText size={18} className="text-brand-red" /> 1. Agreement to Terms
            </h2>
            <p>
              By accessing HFC Consultancy Services software platform, ordering storefronts, kitchen closing portals, or delivery dashboards, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not access our digital systems.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-brand font-bold text-[16px] text-brand-black uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert size={18} className="text-brand-red" /> 2. SaaS Subscriptions & Billing
            </h2>
            <p>
              We provide software tiers (Basic, Pro, Premium) on a monthly or yearly recurring basis. Subscriptions are billed at the beginning of each billing cycle. You are responsible for ensuring your kitchen staff maintains security compliance by keeping individual staff PINs private and secure. HFC is not responsible for data discrepancy variances resulting from shared staff access credentials.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-brand font-bold text-[16px] text-brand-black uppercase tracking-wider flex items-center gap-2">
              <Award size={18} className="text-brand-red" /> 3. Fair Use & Digital Workspace
            </h2>
            <p>
              You may use our Direct Ordering Ecosystem (WhatsApp ordering, table QR menus, CRM tools) solely for legal food-consultancy and food-business operations. Reverse engineering our database architectures, scraping recipe structures, or attempting to bypass security definition rules will result in immediate suspension of all active storefront licenses.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-brand-border">
            <h2 className="font-brand font-bold text-[15px] text-brand-black uppercase">
              Governing Law
            </h2>
            <p>
              These Terms are governed and interpreted under the laws of Andhra Pradesh, India. Any operational disputes will be settled through mutual consulting resolution.
            </p>
          </section>

        </div>
      </div>
    </motion.div>
  )
}
