'use client'

import React, { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { RefreshCw, CheckCircle, HelpCircle } from 'lucide-react'

export default function RefundPolicyPage() {
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
            <RefreshCw className="text-brand-red" size={24} />
          </div>
          <div>
            <h1 className="font-display font-bold text-[32px] text-brand-black">
              Refund Policy
            </h1>
            <p className="font-body text-[12px] text-brand-muted mt-0.5">
              Last Updated: August 16, 2026
            </p>
          </div>
        </div>

        <div className="bg-white border border-brand-border rounded-[16px] p-8 space-y-8 font-body text-[14px] text-brand-body leading-[1.75] shadow-xs">
          
          <section className="space-y-3">
            <h2 className="font-brand font-bold text-[16px] text-brand-black uppercase tracking-wider flex items-center gap-2">
              <CheckCircle size={18} className="text-brand-red" /> 1. SaaS Cancellations
            </h2>
            <p>
              Subscription cancellations take effect at the end of the current billing period. You will continue to have access to your admin panels, KDS preparers, and inventory tracking tools until the end of your billing cycle. We do not provide prorated refunds for mid-month cancellations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-brand font-bold text-[16px] text-brand-black uppercase tracking-wider flex items-center gap-2">
              <CheckCircle size={18} className="text-brand-red" /> 2. F&B Consulting Refund Scope
            </h2>
            <p>
              Consulting service fees, kitchen design layouts, and menu engineering projects involve intensive direct advisor workload. These payments are non-refundable once work has commenced. If you choose to cancel a consulting program before deliverables are drafted, we will credit the balance to your SaaS software subscription dashboard.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-brand-border">
            <h2 className="font-brand font-bold text-[15px] text-brand-black uppercase flex items-center gap-1.5">
              <HelpCircle size={18} className="text-brand-red" /> Contact Support
            </h2>
            <p>
              If you have disputes, billing questions, or wish to cancel your plan, please contact our support team at <strong>info@hfcconsultancy.com</strong> or message us on WhatsApp.
            </p>
          </section>

        </div>
      </div>
    </motion.div>
  )
}
