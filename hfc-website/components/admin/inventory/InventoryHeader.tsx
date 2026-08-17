'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Plus, Settings, Layers, FileText } from 'lucide-react'

interface InventoryHeaderProps {
  title: string
  description: string
}

export default function InventoryHeader({ title, description }: InventoryHeaderProps) {
  const pathname = usePathname()

  const tabs = [
    { label: 'Dashboard', href: '/admin/inventory', icon: LayoutDashboard },
    { label: 'Opening Stock', href: '/admin/inventory/stock', icon: Plus },
    { label: 'Recipe Config', href: '/admin/inventory/recipes', icon: Settings },
    { label: 'Purchase Planning', href: '/admin/inventory/purchase', icon: Layers },
    { label: 'EOD Reports', href: '/admin/inventory/reports', icon: FileText },
  ]

  return (
    <div className="space-y-6">
      {/* Brand Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-5">
        <div>
          <h1 className="font-brand font-black text-[28px] text-brand-black leading-tight">
            {title}
          </h1>
          <p className="font-body text-[13px] text-brand-body mt-1">
            {description}
          </p>
        </div>
      </div>

      {/* Tabs row */}
      <div className="flex flex-wrap border-b border-brand-border gap-2">
        {tabs.map(tab => {
          const isActive = pathname === tab.href
          const Icon = tab.icon
          return (
            <Link key={tab.href} href={tab.href}>
              <div className={`flex items-center gap-2 pb-3 px-4 text-[13.5px] font-brand font-semibold cursor-pointer border-b-2 transition-all ${
                isActive
                  ? 'text-brand-red border-brand-red'
                  : 'text-brand-muted border-transparent hover:text-brand-black hover:border-brand-border'
              }`}>
                <Icon size={16} />
                <span>{tab.label}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
