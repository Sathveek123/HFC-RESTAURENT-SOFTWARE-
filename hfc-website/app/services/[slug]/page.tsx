'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { Star, Award, ArrowLeft, MessageCircle, CheckCircle, Zap, Shield, TrendingUp } from 'lucide-react'

interface ServiceDetail {
  title: string
  subtitle: string
  icon: any
  description: string
  problemTitle: string
  problemDescription: string
  process: string[]
  deliverables: string[]
  expectedOutcome: string
}

const SERVICES_DATA: Record<string, ServiceDetail> = {
  'menu-engineering': {
    title: 'Menu Engineering',
    subtitle: 'Structuring menus for maximum yield and portion cost controls.',
    icon: Star,
    description: 'We restructure your menu based on physical yield analysis, portion controls, and high-margin popularity mapping.',
    problemTitle: 'The Problem: Too many slow-moving items causing high food waste.',
    problemDescription: 'Many restaurants run a bloated menu of 80+ items. This drives up inventory storage costs, complicates kitchen workflows, and increases daily ingredient spoilage.',
    process: [
      'Analyze physical raw material yield for each menu item.',
      'Group menu items into Stars (high margin, high popularity) and Dogs (low margin, low popularity).',
      'Standardize portions down to exact gram weights (portion control).',
      'Optimize layout visibility to draw eyes toward high-gross-margin signature dishes.'
    ],
    deliverables: [
      'Standardized Recipe Weight Manual (portion matrices).',
      'Gross Profit Matrix (raw cost vs pricing analysis).',
      'Streamlined menu layout draft (reduced by 50% for speed).'
    ],
    expectedOutcome: 'Typically reduces food cost percentage by 4% to 8% within the first 30 days.'
  },
  'brand-identity': {
    title: 'Brand Identity Design',
    subtitle: 'Creating memorable food brands that connect and convert local areas.',
    icon: Award,
    description: 'Establish a powerful, unified visual narrative across physical signage, delivery packaging, Swiggy/Zomato, and direct menus.',
    problemTitle: 'The Problem: Generic styling that gets drowned out in competitive aggregators.',
    problemDescription: 'If your brand looks exactly like 10 other restaurants on Swiggy, you are forced to compete solely on discount percentages, killing your profit margins.',
    process: [
      'Define unique brand voice and local market positioning.',
      'Design modern typography systems and harmonious brand color systems.',
      'Create high-impact packaging assets and box dimensions.',
      'Optimize logo layouts for small mobile thumbnails on Swiggy and Zomato.'
    ],
    deliverables: [
      'Full Vector Logo Assets (dark, light, minimal formats).',
      'Packaging and Signage Mockups.',
      'Brand Style Guide Book (colors, typography, spacing rules).'
    ],
    expectedOutcome: 'Improves customer repeat order rates and strengthens local brand authority.'
  },
  'kitchen-setup': {
    title: 'Kitchen Setup & Layout',
    subtitle: 'Optimizing physical kitchen workflows for speed and line assembly.',
    icon: Shield,
    description: 'We design ergonomic kitchen floor plans that eliminate bottleneck paths and speed up ticket-to-delivery timings.',
    problemTitle: 'The Problem: Chaotic kitchen flow driving up ticket prep times to 25+ minutes.',
    problemDescription: 'Unplanned layouts cause chefs to cross paths constantly. This creates physical fatigue, dish inconsistency, and delayed dispatches during peak rush hours.',
    process: [
      'Map physical foot traffic paths (raw materials, prep, line assembly, dispatch).',
      'Position kitchen equipment (burners, prep tables, cold storage) for minimum step count.',
      'Integrate dedicated KDS display screens for easy prep visibility.',
      'Define clear dispatch layout points for riders and aggregator pickups.'
    ],
    deliverables: [
      '2D Kitchen Floor Plan Blueprint (with equipment placements).',
      'Workflow Path Analysis Document.',
      'Equipment Procurement Guide (optimized for local budgets).'
    ],
    expectedOutcome: 'Reduces peak-hour order preparation times down to under 10 minutes.'
  },
  'staff-training': {
    title: 'Staff Training Programs',
    subtitle: 'Training kitchen teams on portion controls and anti-theft closing logs.',
    icon: Zap,
    description: 'We run on-site training sessions to align kitchen staff with standardized portion controls and secure end-of-day closing checks.',
    problemTitle: 'The Problem: Recipe inconsistency and staff resistance to inventory tracking.',
    problemDescription: 'Without standard procedures, chefs portion dishes randomly, skewing food costs. Staff often struggle with complex stock logs, leading to fudged numbers.',
    process: [
      'Conduct hands-on portion standardization training with weighing scales.',
      'Train staff on our zero-feedback daily physical inventory closing count.',
      'Implement strict kitchen hygiene and FSSAI safety compliance checklists.',
      'Set up individual staff PIN entry accountability systems on KDS monitors.'
    ],
    deliverables: [
      'Standard Operating Procedure (SOP) manuals for kitchen staff.',
      'Hygiene & Safety Compliance checklists.',
      'End-of-day kitchen closing checklist guidelines.'
    ],
    expectedOutcome: 'Ensures menu flavor consistency and locks down inventory from daily stock leakage.'
  },
  'cost-optimization': {
    title: 'Cost & Margin Optimization',
    subtitle: 'Analyzing raw supplier costs, waste metrics, and gross profit gaps.',
    icon: TrendingUp,
    description: 'We analyze your complete supply chain, menu pricing, and waste metrics to identify hidden profit leaks.',
    problemTitle: 'The Problem: High sales but zero cash balance in the bank at month-end.',
    problemDescription: 'Invisible operational costs (oil usage, packaging boxes, aggregator commission cuts, raw wastage) quietly consume gross margins, leaving owners confused.',
    process: [
      'Audit raw supplier purchase prices against local market baselines.',
      'Calculate actual portion costs including packaging and cooking oil costs.',
      'Analyze weekly variance logs (theoretical vs physical stock levels).',
      'Optimize Swiggy & Zomato discount strategies to prevent selling below cost.'
    ],
    deliverables: [
      'Detailed Gross Profit Margin sheet per dish.',
      'Supplier Comparison & Negotiation matrix.',
      'Weekly Profitability Dashboard template.'
    ],
    expectedOutcome: 'Saves an average of ₹12,000 to ₹35,000 monthly by plugging raw material leakages.'
  },
  'full-consulting': {
    title: 'Full F&B Consulting',
    subtitle: 'End-to-end guidance from conceptual setup to automated growth.',
    icon: Star,
    description: 'Our signature consulting package combining kitchen layouts, menu engineering, cost margins, branding, and SaaS ordering platforms.',
    problemTitle: 'The Problem: Navigating the entire startup roadmap alone without F&B experience.',
    problemDescription: 'Opening a restaurant software involves multiple complex layers. A single wrong decision in location, menu structure, or pricing can lead to capital loss within 6 months.',
    process: [
      'Refine the core kitchen concept and conduct local target demographic audits.',
      'Design complete kitchen workflow layouts and source local supplier equipment.',
      'Engineer high-margin standardized menus and calculate exact portion pricing.',
      'Integrate HFC direct WhatsApp ordering and anti-theft inventory checkups.'
    ],
    deliverables: [
      'Complete Restaurant Software Pre-Launch Blueprint.',
      'Standardized Menu & Recipe portion manual.',
      'WhatsApp direct ordering CRM configuration setup.'
    ],
    expectedOutcome: 'Provides a complete, scalable, and audit-protected F&B business model from Day 1.'
  }
}

export default function ServiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  const slug = params.slug as string
  const service = SERVICES_DATA[slug]

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!service) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
        <h1 className="font-display font-bold text-[28px] text-brand-black">
          Service Not Found
        </h1>
        <button
          onClick={() => router.push('/')}
          className="mt-4 border-2 border-brand-black text-brand-black font-brand font-bold text-[13px] uppercase px-6 py-2.5 rounded-md"
        >
          Go Back Home
        </button>
      </div>
    )
  }

  const IconComp = service.icon

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
      <div className="max-w-[900px] mx-auto px-6 pt-[140px] pb-24">
        
        {/* Back Link */}
        <button
          onClick={() => router.push('/about')}
          className="flex items-center gap-2 font-brand font-semibold text-[12px] text-brand-muted hover:text-brand-red uppercase tracking-wider mb-8 transition-colors"
        >
          <ArrowLeft size={14} /> Back to About
        </button>

        {/* Hero Block */}
        <div className="flex items-start gap-4.5 mb-10 pb-8 border-b border-brand-border">
          <div className="w-14 h-14 rounded-full bg-brand-redLight flex items-center justify-center flex-shrink-0">
            <IconComp className="text-brand-red" size={26} />
          </div>
          <div>
            <h1 className="font-display font-bold text-[34px] sm:text-[40px] leading-tight text-brand-black">
              {service.title}
            </h1>
            <p className="font-tagline italic text-[16px] text-brand-body mt-2 leading-relaxed">
              {service.subtitle}
            </p>
          </div>
        </div>

        {/* Problem and Solution Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-red-50/20 border border-brand-red/10 rounded-[16px] p-6 space-y-3">
            <h3 className="font-brand font-bold text-[14px] text-brand-red uppercase tracking-wider">
              ⚠️ The Challenge
            </h3>
            <p className="font-body text-[13.5px] text-brand-body leading-[1.7]">
              {storyLabelForProblem(service.problemDescription)}
            </p>
          </div>
          <div className="bg-green-50/10 border border-green-600/10 rounded-[16px] p-6 space-y-3">
            <h3 className="font-brand font-bold text-[14px] text-green-700 uppercase tracking-wider">
              ✅ The Solution
            </h3>
            <p className="font-body text-[13.5px] text-brand-body leading-[1.7]">
              {service.description}
            </p>
          </div>
        </div>

        {/* Detailed Process Timeline */}
        <div className="space-y-8 mb-12">
          <h2 className="font-display font-bold text-[22px] text-brand-black">
            Our Step-by-Step Consulting Process
          </h2>

          <div className="space-y-4">
            {service.process.map((step, idx) => (
              <div key={idx} className="flex items-start gap-4 bg-white border border-brand-border p-5 rounded-[12px] shadow-xs">
                <div className="w-7 h-7 rounded-full bg-brand-red text-white font-brand font-bold text-[13px] flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </div>
                <p className="font-body text-[13.5px] text-brand-body leading-relaxed mt-0.5">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Key Deliverables & Outcomes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 pt-8 border-t border-brand-border">
          <div className="space-y-4">
            <h3 className="font-brand font-bold text-[14px] text-brand-black uppercase tracking-wider">
              📋 What You Get (Deliverables)
            </h3>
            <ul className="space-y-2.5">
              {service.deliverables.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle size={15} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="font-body text-[13px] text-brand-body leading-[1.5]">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4 bg-brand-surface border border-brand-border p-6 rounded-[16px]">
            <h3 className="font-brand font-bold text-[14px] text-brand-black uppercase tracking-wider">
              📈 Expected Business Outcome
            </h3>
            <p className="font-body text-[14px] text-brand-body leading-[1.7] font-semibold text-brand-red">
              {service.expectedOutcome}
            </p>
            <p className="font-body text-[12px] text-brand-muted leading-relaxed">
              *Expected outcomes represent verified historical client averages across Andhra Pradesh food startups.
            </p>
          </div>
        </div>

        {/* CTA Card */}
        <div className="bg-brand-redLight border border-brand-red/20 rounded-[20px] p-8 text-center space-y-5">
          <h3 className="font-display font-bold text-[24px] text-brand-black">
            Want to discuss this service for your kitchen?
          </h3>
          <p className="font-tagline italic text-[15px] text-brand-body max-w-[500px] mx-auto">
            Get in touch directly with Satish Chittelu on WhatsApp to schedule an audit session.
          </p>
          <div className="flex justify-center pt-2">
            <a
              href="https://wa.me/919912799855"
              target="_blank"
              rel="noreferrer"
              className="hfc-focusable bg-[#25D366] text-white font-brand font-bold text-[13px] uppercase tracking-[1.5px] px-8 py-3.5 rounded-full flex items-center justify-center gap-2 hover:bg-[#20ba59] transition-all duration-150 active:scale-[0.98] shadow-sm"
            >
              <MessageCircle size={18} />
              Discuss on WhatsApp
            </a>
          </div>
        </div>

      </div>
    </motion.div>
  )
}

function storyLabelForProblem(desc: string) {
  return desc
}
