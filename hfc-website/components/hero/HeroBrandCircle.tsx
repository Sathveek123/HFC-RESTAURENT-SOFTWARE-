'use client'

import { motion } from 'framer-motion'
import { Utensils, Star, TrendingUp } from 'lucide-react'
import Image from 'next/image'

export default function HeroBrandCircle() {
  return (
    <div className="relative flex items-center justify-center w-full aspect-square max-w-[480px] mx-auto">
      {/* Layer 1 — Concentric Circles with Layered Opacity & Depth */}
      {/* Outermost circle: 480px, dashed rgba(204,0,0,0.10) */}
      <div className="absolute w-[480px] h-[480px] border border-dashed border-[rgba(204,0,0,0.10)] rounded-full pointer-events-none" />

      {/* Middle circle: 380px, dashed rgba(204,0,0,0.16) with slow continuous rotation */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 60, ease: 'linear', repeat: Infinity }}
        className="absolute w-[380px] h-[380px] border border-dashed border-[rgba(204,0,0,0.16)] rounded-full pointer-events-none"
      />

      {/* Inner circle: 280px solid #F0F0F0, bg-white */}
      <div className="absolute w-[280px] h-[280px] border border-[#F0F0F0] bg-white rounded-full pointer-events-none shadow-xs" />

      {/* Layer 2 — Animated Center HFC Badge with Synchronized Floating Shadow */}
      <motion.div
        animate={{
          y: [0, -8, 0],
          boxShadow: [
            '0 10px 30px rgba(0,0,0,0.08)',
            '0 20px 40px rgba(0,0,0,0.14)',
            '0 10px 30px rgba(0,0,0,0.08)'
          ]
        }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        className="relative z-10 w-[260px] h-[260px] rounded-full border-4 border-brand-red bg-white flex flex-col items-center justify-center p-4 text-center cursor-pointer"
      >
        <div className="relative w-[210px] h-[210px] rounded-full overflow-hidden">
          <Image
            src="/logo.jpeg"
            alt="HFC Brand Mark"
            fill
            className="object-contain"
          />
        </div>
      </motion.div>

      {/* Layer 3 — Floating Social Proof Card 1 (Top-Right) */}
      <motion.div
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute top-8 right-0 translate-x-6 z-20 bg-white border border-brand-border rounded-[10px] p-3 shadow-float w-[160px]"
      >
        <div className="flex items-center gap-2 font-brand font-semibold text-[13px] text-brand-black">
          <Utensils size={14} className="text-brand-red" />
          <span>Now Live</span>
        </div>
        <div className="w-full h-[1px] bg-brand-border my-1.5" />
        <div className="font-body text-[12px] text-brand-body">Order via WhatsApp</div>
      </motion.div>

      {/* Layer 4 — NEW Floating Card 3 (Mid-Left for Visual Balance) */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="absolute top-1/2 left-0 -translate-x-10 -translate-y-1/2 z-20 bg-white border border-brand-border rounded-[10px] shadow-float px-4 py-3 w-[150px]"
      >
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingUp size={13} className="text-green-700" />
          <span className="font-brand font-semibold text-[12px] text-brand-black">Avg. Growth</span>
        </div>
        <div className="font-brand font-black text-[18px] text-brand-red leading-tight">+34%</div>
        <div className="font-body text-[10px] text-brand-muted mt-0.5">revenue in 6 months</div>
      </motion.div>

      {/* Layer 5 — Floating Social Proof Card 2 (Bottom-Right/Bottom-Left) */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.5 }}
        className="absolute bottom-8 right-2 translate-x-4 z-20 bg-white border border-brand-border rounded-[10px] p-3 shadow-float w-[180px]"
      >
        <div className="flex items-center gap-1.5 font-brand font-semibold text-[12px] text-brand-black">
          <div className="flex text-brand-gold text-[11px]">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} size={11} fill="#C9973A" color="#C9973A" />
            ))}
          </div>
          <span className="ml-1">4.9 (184)</span>
        </div>
        <div className="font-tagline italic text-[12px] text-brand-body mt-1">
          &quot;Best F&amp;B consultant&quot;
        </div>
      </motion.div>
    </div>
  )
}
