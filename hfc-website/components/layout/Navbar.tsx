'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, Menu as MenuIcon, X } from 'lucide-react'
import Image from 'next/image'
import { useCartStore } from '@/store/cartStore'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  const openCart = useCartStore(state => state.openCart)
  const count = useCartStore(state => state.getCount())

  if (pathname?.startsWith('/admin')) {
    return null
  }

  useEffect(() => {
    setMounted(true)
    const handleScroll = () => {
      setScrolled(window.scrollY > 80)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false)
    if (pathname === '/') {
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      window.location.href = `/#${id}`
    }
  }

  return (
    <header
      className={`sticky top-0 z-40 bg-white transition-shadow duration-300 ${
        scrolled ? 'shadow-[0_2px_16px_rgba(0,0,0,0.08)]' : 'border-b border-brand-border'
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-6 h-[72px] flex items-center justify-between">
        
        {/* Left — Brand Wordmark */}
        <a href="#" className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-brand-border flex-shrink-0">
            <Image
              src="/logo.jpeg"
              alt="HFC Consultancy Services Logo"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-brand font-black text-[26px] text-brand-red tracking-tight">HFC</span>
            <span className="font-brand font-semibold text-[9px] text-brand-black tracking-[3px] uppercase mt-0.5">
              Consultancy Services
            </span>
          </div>
        </a>

        {/* Center — Nav Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollToSection('menu-section')}
            className="font-body font-semibold text-[14px] text-brand-black hover:text-brand-red transition-colors relative py-1 group"
          >
            Menu
            <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-brand-red transition-all duration-200 group-hover:w-full" />
          </button>
          
          <a
            href="/about"
            className="font-body font-semibold text-[14px] text-brand-black hover:text-brand-red transition-colors relative py-1 group"
          >
            About
            <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-brand-red transition-all duration-200 group-hover:w-full" />
          </a>

          <a
            href="/pricing"
            className="font-body font-semibold text-[14px] text-brand-black hover:text-brand-red transition-colors relative py-1 group"
          >
            Pricing
            <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-brand-red transition-all duration-200 group-hover:w-full" />
          </a>

          <button
            onClick={() => scrollToSection('footer-section')}
            className="font-body font-semibold text-[14px] text-brand-black hover:text-brand-red transition-colors relative py-1 group"
          >
            Contact
            <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-brand-red transition-all duration-200 group-hover:w-full" />
          </button>
        </nav>

        {/* Right — Actions & Cart */}
        <div className="flex items-center gap-4">
          <button
            onClick={openCart}
            className="bg-brand-red hover:bg-brand-redHover text-white px-5 py-2.5 rounded-pill font-brand font-semibold text-[13px] flex items-center gap-2 transition-all duration-200 active:scale-95"
          >
            <ShoppingCart size={18} />
            <span>Cart</span>
            {mounted && count > 0 && (
              <motion.span
                key={count}
                initial={{ scale: 1.5 }}
                animate={{ scale: 1 }}
                className="bg-white text-brand-red rounded-full w-5 h-5 text-[10px] font-brand font-bold flex items-center justify-center ml-1"
              >
                {count}
              </motion.span>
            )}
          </button>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-brand-black p-2"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <MenuIcon size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Fullscreen Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[72px] bg-white z-50 flex flex-col items-center justify-center gap-8 p-8 border-t border-brand-border">
          <button
            onClick={() => scrollToSection('menu-section')}
            className="font-brand font-bold text-[24px] text-brand-black"
          >
            Menu
          </button>
          <a
            href="/about"
            onClick={() => setMobileMenuOpen(false)}
            className="font-brand font-bold text-[24px] text-brand-black"
          >
            About
          </a>
          <a
            href="/pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="font-brand font-bold text-[24px] text-brand-black"
          >
            Pricing
          </a>
          <button
            onClick={() => scrollToSection('footer-section')}
            className="font-brand font-bold text-[24px] text-brand-black"
          >
            Contact
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false)
              openCart()
            }}
            className="bg-brand-red text-white px-8 py-3 rounded-btn font-brand font-semibold text-[15px] uppercase tracking-wider mt-4"
          >
            View Cart ({mounted ? count : 0})
          </button>
        </div>
      )}
    </header>
  )
}
