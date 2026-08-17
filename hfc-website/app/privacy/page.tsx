'use client'

import React, { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Shield, Lock, Eye, FileText } from 'lucide-react'

export default function PrivacyPolicyPage() {
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
            <Shield className="text-brand-red" size={24} />
          </div>
          <div>
            <h1 className="font-display font-bold text-[32px] text-brand-black">
              Privacy Policy
            </h1>
            <p className="font-body text-[12px] text-brand-muted mt-0.5">
              Last Updated: August 16, 2026
            </p>
          </div>
        </div>

        <div className="bg-white border border-brand-border rounded-[16px] p-8 space-y-8 font-body text-[14px] text-brand-body leading-[1.75] shadow-xs">
          
          <section className="space-y-3">
            <h2 className="font-brand font-bold text-[16px] text-brand-black uppercase tracking-wider flex items-center gap-2">
              <Eye size={18} className="text-brand-red" /> 1. Information We Collect
            </h2>
            <p>
              HFC Consultancy Services (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects information necessary to deliver our consulting programs, WhatsApp direct-ordering templates, and custom kitchen automation dashboards.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Direct Contacts:</strong> Name, phone number, physical kitchen address, and email addresses provided during billing or WhatsApp strategy calls.</li>
              <li><strong>Kitchen Data:</strong> Recipe mappings, ingredient listings, supplier rates, and physical closing stock counts submitted through our optional Premium anti-theft database.</li>
              <li><strong>Rider Portals:</strong> Location coordinates and delivery statuses collected exclusively during active delivery cycles.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-brand font-bold text-[16px] text-brand-black uppercase tracking-wider flex items-center gap-2">
              <Lock size={18} className="text-brand-red" /> 2. How We Secure Data
            </h2>
            <p>
              All kitchen inventory closing records, staff PIN codes, and transactional histories are safeguarded using row-level security (RLS) policies within our secure Supabase database layer. Inward stock logs and daily closing records cannot be deleted or mutated by kitchen staff once committed, preventing inventory tampering and ensuring accountability.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-brand font-bold text-[16px] text-brand-black uppercase tracking-wider flex items-center gap-2">
              <FileText size={18} className="text-brand-red" /> 3. Data Retention & Sharing
            </h2>
            <p>
              We do not sell, rent, or lease your brand catalog or transaction statistics to third-party marketing companies. Data is kept in secure encrypted storage for as long as your account remains active or to fulfill tax and GST auditing requirements. You may request a complete database wipe by contacting our systems architect at NetQuora directly.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-brand-border">
            <h2 className="font-brand font-bold text-[15px] text-brand-black uppercase">
              Questions & Contact
            </h2>
            <p>
              For privacy requests, database export queries, or RLS policy definitions, please email us at <strong>info@hfcconsultancy.com</strong>.
            </p>
          </section>

        </div>
      </div>
    </motion.div>
  )
}
