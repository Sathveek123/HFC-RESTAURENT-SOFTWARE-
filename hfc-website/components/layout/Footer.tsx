'use client'

import React from 'react'
import Link from 'next/link'
import {
  Star, Phone, Mail, MapPin, Clock, MessageCircle,
  Share2, Globe, Send
} from 'lucide-react'

import { useSettingsStore } from '@/store/settingsStore'

export default function Footer() {
  const settings = useSettingsStore(state => state.settings)
  const phone = settings?.phone || '9912799855'
  const whatsappNumber = settings?.whatsappNumber || '919912799855'
  const address = settings?.kitchenAddress || 'Kasibugga, Srikakulam District, Andhra Pradesh, India'
  const formattedPhone = settings?.phone
    ? `+91 ${settings.phone.slice(0, 5)} ${settings.phone.slice(5)}`
    : '+91 99127 99855'

  const quickLinks = ['Home', 'Our Menu', 'About Us', 'Our Services', 'Client Stories', 'Contact']
  const servicesList = [
    'Menu Engineering',
    'Brand Identity Design',
    'Kitchen Setup & Layout',
    'Staff Training Programs',
    'Cost & Margin Optimization',
    'Full F&B Consulting'
  ]
  const legalLinks = ['Privacy Policy', 'Terms of Service', 'Refund Policy']

  return (
    <footer className="bg-[#FAFAFA] border-t border-brand-border pt-16 pb-8 text-brand-black">
      <div className="max-w-[1280px] mx-auto px-6">
        
        {/* Row 1 — Multi-column Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr] gap-10 pb-12 border-b border-brand-border">
          
          {/* Column 1 — Brand Block */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-full border-2 border-brand-red flex items-center justify-center bg-white shadow-xs">
                <span className="font-brand font-black text-[13px] text-brand-red">
                  HFC
                </span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-brand font-black text-[20px] text-brand-red">HFC</span>
                <span className="font-brand font-semibold text-[8px] text-brand-black tracking-[2px] uppercase mt-0.5">
                  Consultancy Services
                </span>
              </div>
            </div>

            <p className="font-body text-[13px] text-brand-body leading-[1.7] max-w-[280px]">
              We help ambitious F&amp;B founders turn great food ideas into growing, sustainable businesses — from first concept to full-scale operations.
            </p>

            {/* Star rating strip */}
            <div className="flex items-center gap-1.5 mt-4">
              <div className="flex text-brand-gold">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} size={13} fill="#C9973A" color="#C9973A" />
                ))}
              </div>
              <span className="font-body text-[12px] text-brand-muted ml-1">
                4.9 out of 5 (184 reviews)
              </span>
            </div>

            {/* Social Icons Row */}
            <div className="flex items-center gap-3 mt-5">
              {[
                { icon: Globe, href: '#', label: 'Website' },
                { icon: Share2, href: '#', label: 'Share' },
                { icon: Send, href: '#', label: 'Telegram' },
                { icon: MessageCircle, href: `https://wa.me/${whatsappNumber}`, label: 'WhatsApp' }
              ].map((item, idx) => {
                const Icon = item.icon
                return (
                  <a
                    key={idx}
                    href={item.href}
                    target={item.href.startsWith('http') ? '_blank' : '_self'}
                    rel="noreferrer"
                    aria-label={item.label}
                    className="w-9 h-9 rounded-full border border-brand-border bg-white flex items-center justify-center hover:border-brand-red hover:bg-brand-redLight transition-all duration-200"
                  >
                    <Icon size={15} className="text-brand-black" />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Column 2 — Quick Links */}
          <div>
            <h4 className="font-brand font-bold text-[13px] text-brand-black uppercase tracking-[1px] mb-4">
              Quick Links
            </h4>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: 'Home', href: '/' },
                { label: 'Our Menu', href: '/#menu-section' },
                { label: 'About Us', href: '/about' },
                { label: 'Our Services', href: '/#services-section' },
                { label: 'Client Stories', href: '/client-stories' },
                { label: 'Contact', href: '/#footer-section' }
              ].map(link => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-body text-[13px] text-brand-body hover:text-brand-red transition-colors duration-150"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Our Services */}
          <div>
            <h4 className="font-brand font-bold text-[13px] text-brand-black uppercase tracking-[1px] mb-4">
              Our Services
            </h4>
            <ul className="flex flex-col gap-2.5">
              {[
                { name: 'Menu Engineering', slug: 'menu-engineering' },
                { name: 'Brand Identity Design', slug: 'brand-identity' },
                { name: 'Kitchen Setup & Layout', slug: 'kitchen-setup' },
                { name: 'Staff Training Programs', slug: 'staff-training' },
                { name: 'Cost & Margin Optimization', slug: 'cost-optimization' },
                { name: 'Full F&B Consulting', slug: 'full-consulting' }
              ].map(s => (
                <li key={s.slug}>
                  <Link
                    href={`/services/${s.slug}`}
                    className="font-body text-[13px] text-brand-body hover:text-brand-red transition-colors duration-150"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 — Get in Touch */}
          <div>
            <h4 className="font-brand font-bold text-[13px] text-brand-black uppercase tracking-[1px] mb-4">
              Get in Touch
            </h4>

            <div className="flex flex-col gap-3.5">
              <a href={`tel:+91${phone}`} className="flex items-start gap-2.5 group">
                <Phone size={14} className="text-brand-red mt-0.5 flex-shrink-0" />
                <span className="font-body text-[13px] text-brand-body group-hover:text-brand-red transition-colors">
                  {formattedPhone}
                </span>
              </a>

              <a href="mailto:info@hfcconsultancy.com" className="flex items-start gap-2.5 group">
                <Mail size={14} className="text-brand-red mt-0.5 flex-shrink-0" />
                <span className="font-body text-[13px] text-brand-body group-hover:text-brand-red transition-colors">
                  info@hfcconsultancy.com
                </span>
              </a>

              <div className="flex items-start gap-2.5">
                <MapPin size={14} className="text-brand-red mt-0.5 flex-shrink-0" />
                <span className="font-body text-[13px] text-brand-body">
                  {address}
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock size={14} className="text-brand-red mt-0.5 flex-shrink-0" />
                <span className="font-body text-[13px] text-brand-body">
                  Mon – Sat, 10 AM – 8 PM
                </span>
              </div>
            </div>

            {/* Direct WhatsApp CTA */}
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-brand font-semibold text-[12px] px-4 py-2.5 rounded-[6px] mt-5 hover:bg-[#1da851] transition-colors shadow-xs"
            >
              <MessageCircle size={14} />
              Chat on WhatsApp
            </a>
          </div>

        </div>

        {/* Row 2 — Center Tagline Strip */}
        <div className="text-center py-6">
          <p className="font-tagline italic text-[15px] text-brand-body">
            &quot;Your Growth, Our Responsibility. All Within Your Budget.&quot;
          </p>
        </div>

        {/* Row 3 — Bottom Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-brand-border">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-center sm:text-left">
            <p className="font-body text-[12px] text-[#888888]">
              © {new Date().getFullYear()} HFC Consultancy Services. All rights reserved.
            </p>
            <span className="hidden sm:inline text-gray-300">|</span>
            <p className="font-body text-[12px] text-[#888888]">
              Powered by{' '}
              <a
                href="https://net-quora-x-agency.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-red hover:underline transition-all"
              >
                Netquora X IT Solutions
              </a>
            </p>
          </div>

          <div className="flex items-center gap-5">
            {[
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Terms of Service', href: '/terms' },
              { label: 'Refund Policy', href: '/refund-policy' }
            ].map(link => (
              <Link
                key={link.label}
                href={link.href}
                className="font-body text-[11px] text-[#888888] hover:text-brand-red transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </footer>
  )
}
