'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  FileDown,
  Eye,
  MessageCircle,
  SlidersHorizontal,
  CheckCircle,
  AlertCircle,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
} from 'lucide-react'
import { useBillsStore } from '@/store/billsStore'
import { useAgentsStore } from '@/store/agentsStore'
import { useSettingsStore } from '@/store/settingsStore'
import { exportBillsToCSV } from '@/lib/billExport'
import OrderStatusBadge from '@/components/admin/orders/OrderStatusBadge'
import BillPreviewModal from '@/components/admin/bills/BillPreviewModal'
import { Bill } from '@/types'

export default function AdminBillsPage() {
  const bills = useBillsStore(state => state.bills)
  const updatePaymentStatus = useBillsStore(state => state.updatePaymentStatus)
  const fetchBills = useBillsStore(state => state.fetchBills)
  const agents = useAgentsStore(state => state.agents)

  // 1. FILTER FIELDS STATE
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedAgent, setSelectedAgent] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [orderType, setOrderType] = useState('')

  // Selected bill for Modal
  const [previewBill, setPreviewBill] = useState<Bill | null>(null)

  // Popover State for payment status changes
  const [popoverBillNo, setPopoverBillNo] = useState<string | null>(null)
  const [popoverTargetStatus, setPopoverTargetStatus] = useState<'paid' | 'unpaid' | 'partial' | null>(null)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Set default dates and fetch bills on mount
  useEffect(() => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    setFromDate(format(firstDay, 'yyyy-MM-dd'))
    setToDate(format(now, 'yyyy-MM-dd'))
    fetchBills()
  }, [fetchBills])

  const handleResetFilters = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    setFromDate(format(firstDay, 'yyyy-MM-dd'))
    setToDate(format(now, 'yyyy-MM-dd'))
    setCustomerName('')
    setPhone('')
    setSelectedAgent('')
    setPaymentFilter('')
    setOrderType('')
    setCurrentPage(1)
  }

  // 2. FILTER CONDITION LOGIC
  const getFilteredBills = () => {
    let result = [...bills]

    // From Date
    if (fromDate) {
      const fDate = new Date(fromDate)
      fDate.setHours(0, 0, 0, 0)
      result = result.filter(b => b.timestamp >= fDate.getTime())
    }

    // To Date
    if (toDate) {
      const tDate = new Date(toDate)
      tDate.setHours(23, 59, 59, 999)
      result = result.filter(b => b.timestamp <= tDate.getTime())
    }

    // Customer Name (Case-insensitive partial match)
    if (customerName.trim()) {
      const q = customerName.toLowerCase().trim()
      result = result.filter(b => b.customerName.toLowerCase().includes(q))
    }

    // Phone (Strips +91 prefix)
    if (phone.trim()) {
      const cleanPhoneQuery = phone.replace('+91', '').replace(/\D/g, '').trim()
      result = result.filter(b => {
        const cleanPhoneStr = b.customerPhone.replace(/\D/g, '')
        return cleanPhoneStr.includes(cleanPhoneQuery)
      })
    }

    // Agent
    if (selectedAgent) {
      if (selectedAgent === 'unassigned') {
        result = result.filter(b => !b.assignedAgent)
      } else {
        result = result.filter(b => b.assignedAgent === selectedAgent)
      }
    }

    // Payment Filter (method x status combinations)
    if (paymentFilter) {
      const [method, status] = paymentFilter.split('-')
      result = result.filter(
        b => b.paymentMethod.toLowerCase() === method && b.paymentStatus === status
      )
    }

    // Order Type
    if (orderType) {
      result = result.filter(b => b.orderType === orderType)
    }

    // Sort by timestamp DESC (newest first)
    return result.sort((a, b) => b.timestamp - a.timestamp)
  }

  const filteredBills = getFilteredBills()

  // 3. STATS CARD CALCULATIONS (computed from currently filtered bills)
  const filteredCount = filteredBills.length
  
  const paidCount = filteredBills.filter(b => b.paymentStatus === 'paid').length
  const unpaidCount = filteredBills.filter(b => b.paymentStatus === 'unpaid').length
  const partialCount = filteredBills.filter(b => b.paymentStatus === 'partial').length

  const totalValue = filteredBills.reduce((sum, b) => sum + b.total, 0)
  const paidValue = filteredBills.filter(b => b.paymentStatus === 'paid').reduce((sum, b) => sum + b.total, 0)
  const unpaidValue = filteredBills.filter(b => b.paymentStatus === 'unpaid').reduce((sum, b) => sum + b.total, 0)
  const partialValue = filteredBills.filter(b => b.paymentStatus === 'partial').reduce((sum, b) => sum + b.total, 0)

  // 4. PAGINATION CALCULATIONS
  const totalPages = Math.ceil(filteredCount / pageSize)
  const paginatedBills = filteredBills.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  
  const paginationFrom = filteredCount > 0 ? (currentPage - 1) * pageSize + 1 : 0
  const paginationTo = Math.min(currentPage * pageSize, filteredCount)

  // Print all filtered bills in a formatted print page layout
  const handlePrintAll = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    let printHTML = `
      <html>
        <head>
          <title>HFC Filtered Bills</title>
          <style>
            body { font-family: sans-serif; padding: 25px; color: #1A1A1A; }
            h2 { border-bottom: 2px solid #CC0000; padding-bottom: 10px; margin-bottom: 20px; font-size: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
            th, td { padding: 8px; border-bottom: 1px solid #E5E7EB; text-align: left; }
            th { background: #FAFAFA; font-weight: bold; }
            .text-right { text-align: right; }
            .footer { text-align: center; margin-top: 50px; font-size: 11px; color: #6A6A6A; }
            .page-break { page-break-after: always; }
          </style>
        </head>
        <body>
          <h2>HFC Consultancy Services - Invoices Logs Summary</h2>
          <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
          <p>Total Value: ₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${filteredCount} bills found)</p>
          <table>
            <thead>
              <tr>
                <th>Bill No</th>
                <th>Order ID</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Agent</th>
                <th>Payment</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${filteredBills
                .map(
                  b => `
                <tr>
                  <td><strong>${b.billNo}</strong></td>
                  <td>${b.orderId}</td>
                  <td>${format(new Date(b.timestamp), 'dd MMM yyyy')}</td>
                  <td>${b.customerName}</td>
                  <td style="text-transform: capitalize;">${b.orderType}</td>
                  <td>${b.assignedAgent || '—'}</td>
                  <td>${b.paymentMethod} - ${b.paymentStatus.toUpperCase()}</td>
                  <td class="text-right">₹${b.total.toFixed(2)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          <div class="footer">This is a computer-generated summary export of bills.</div>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `
    printWindow.document.write(printHTML)
    printWindow.document.close()
  }

  // Print a single bill directly in print style
  const handlePrintSingle = (bill: Bill) => {
    const settings = useSettingsStore.getState().settings
    const upiId = settings?.upiId || '9912799855@okbizaxis'
    const timeFormatted = format(new Date(bill.timestamp), 'dd MMM yyyy, h:mm aa')
    const upiLink = `upi://pay?pa=${upiId}&pn=HFC&am=${bill.total}&cu=INR`
    
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    let printHTML = `
      <html>
        <head>
          <title>${bill.billNo}</title>
          <style>
            body { font-family: monospace; padding: 25px; max-width: 400px; margin: 0 auto; color: #1A1A1A; }
            .center { text-align: center; }
            .right { text-align: right; }
            .divider { border-top: 1px dashed #000; margin: 15px 0; }
            .meta, .totals { font-size: 12px; line-height: 1.5; }
            .items { font-size: 13px; line-height: 1.6; }
            .footer { text-align: center; font-size: 11px; margin-top: 30px; border-top: 1px dashed #000; padding-top: 15px; }
            h2 { margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2>HFC Restaurant Software</h2>
            <p style="font-size: 11px; margin: 5px 0;">Premium F&B Consulting & Kitchen</p>
          </div>
          <div class="divider"></div>
          <div class="meta">
            Bill No: ${bill.billNo}<br/>
            Date: ${timeFormatted}<br/>
            Order ID: ${bill.orderId}<br/>
            Customer: ${bill.customerName}<br/>
            Phone: ${bill.customerPhone}<br/>
            Order Type: ${bill.orderType.toUpperCase()}
          </div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="right">Qty</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${bill.items
                .map(
                  i => `
                <tr>
                  <td>${i.name}</td>
                  <td class="right">${i.quantity}</td>
                  <td class="right">₹${(i.price * i.quantity).toFixed(2)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="totals">
            <div style="display:flex; justify-content:space-between"><span>Subtotal</span><span>₹${bill.subtotal.toFixed(2)}</span></div>
            ${bill.discountAmount > 0 ? `<div style="display:flex; justify-content:space-between; color: green;"><span>Discount (${bill.couponCode})</span><span>-₹${bill.discountAmount.toFixed(2)}</span></div>` : ''}
            <div style="display:flex; justify-content:space-between"><span>GST (5%)</span><span>₹${bill.gst.toFixed(2)}</span></div>
            <div style="display:flex; justify-content:space-between; font-weight:bold;"><span>Grand Total</span><span>₹${bill.total.toFixed(2)}</span></div>
          </div>
          <div class="divider"></div>
          <div class="center meta">
            Payment Status: ${bill.paymentStatus.toUpperCase()}<br/>
            Payment Method: ${bill.paymentMethod.toUpperCase()}<br/>
            Scan VPA Vouchers to Pay: 9912799855@okbizaxis
          </div>
          <div class="footer">Thank you for ordering with HFC!</div>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `
    printWindow.document.write(printHTML)
    printWindow.document.close()
  }

  const handleWhatsAppShareSingle = (bill: Bill) => {
    const formattedDate = format(new Date(bill.timestamp), 'dd MMM yyyy')
    const itemsSummary = bill.items
      .map(i => `• ${i.quantity} × ${i.name} — ₹${(i.price * i.quantity).toFixed(2)}`)
      .join('\n')

    let text = `━━━━━━━━━━━━━━━━━━━━━━\n`
    text += ` 🧾 *BILL — HFC CONSULTANCY SERVICES*\n`
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`
    text += `📋 *Bill No:* ${bill.billNo}\n`
    text += `🆔 *Order:* ${bill.orderId}\n`
    text += `📅 *Date:* ${formattedDate}\n`
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`
    text += `*ITEMS:*\n`
    text += `${itemsSummary}\n`
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`
    text += `Subtotal: ₹${bill.subtotal.toFixed(2)}\n`
    if (bill.discountAmount > 0) {
      text += `Discount (${bill.couponCode}): -₹${bill.discountAmount.toFixed(2)}\n`
    }
    text += `GST (5%): ₹${bill.gst.toFixed(2)}\n`
    text += `*TOTAL: ₹${bill.total.toFixed(2)}*\n`
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`
    text += `Payment: ${bill.paymentMethod} — ${bill.paymentStatus.toUpperCase()}\n`
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`
    text += `_Thank you for ordering from HFC!_`

    const cleanPhone = bill.customerPhone.replace(/\D/g, '')
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  // Handle inline payment status toggling
  const handleInlinePaymentToggleClick = (e: React.MouseEvent, bill: Bill) => {
    e.stopPropagation()
    const targetStatus = bill.paymentStatus === 'paid' ? 'unpaid' : 'paid'
    setPopoverBillNo(bill.billNo)
    setPopoverTargetStatus(targetStatus)
  }

  const confirmPopoverStatusChange = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (popoverBillNo && popoverTargetStatus) {
      updatePaymentStatus(popoverBillNo, popoverTargetStatus)
      toast.success(`Bill marked as ${popoverTargetStatus.toUpperCase()} ✓`)
    }
    closePopover()
  }

  const closePopover = () => {
    setPopoverBillNo(null)
    setPopoverTargetStatus(null)
  }

  const getInitials = (nameStr: string | null) => {
    if (!nameStr) return '—'
    return nameStr
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Generate date validity checks
  const isDateInvalid = fromDate && toDate && new Date(toDate) < new Date(fromDate)

  // Dynamic pagination numbers array generator
  const getPageNumbers = () => {
    const pageLimit = 5
    let start = Math.max(1, currentPage - 2)
    let end = Math.min(totalPages, start + pageLimit - 1)
    if (end - start + 1 < pageLimit) {
      start = Math.max(1, end - pageLimit + 1)
    }
    const pages = []
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 bg-[#FAFAFA] min-h-full font-body text-[13.5px]">
      
      {/* LAYER 1 — PAGE HEADER ROW */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
        <div>
          <h1 className="font-display font-bold text-[28px] text-brand-black">All Bills</h1>
          <div className="text-[12px] text-brand-muted mt-1 leading-none font-semibold">
            Admin / Bills
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintAll}
            disabled={filteredBills.length === 0}
            className="h-11 px-5 bg-brand-red hover:bg-brand-redHover text-white font-brand font-semibold text-[12px] uppercase tracking-[1px] rounded-btn inline-flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown size={15} /> Download PDF
          </button>
          <button
            onClick={() => exportBillsToCSV(filteredBills)}
            disabled={filteredBills.length === 0}
            className="h-11 px-5 bg-brand-black hover:bg-brand-red text-white font-brand font-semibold text-[12px] uppercase tracking-[1px] rounded-btn inline-flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown size={15} /> Export CSV
          </button>
          <button
            onClick={handleResetFilters}
            className="h-11 px-5 border border-brand-border text-brand-body hover:bg-[#F5F5F5] font-brand font-semibold text-[12px] uppercase tracking-[1px] rounded-btn transition-colors bg-white"
          >
            Reset
          </button>
        </div>
      </div>

      {/* LAYER 2 — FILTER BAR CARD */}
      <div className="bg-white border border-brand-border rounded-[12px] p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          
          {/* From Date */}
          <div className="flex flex-col gap-1 w-[150px]">
            <span className="font-brand font-semibold text-[10px] text-brand-muted uppercase tracking-[1.5px] mb-1.5">
              From date
            </span>
            <input
              type="date"
              value={fromDate}
              onChange={e => {
                setFromDate(e.target.value)
                setCurrentPage(1)
              }}
              className="h-[40px] px-3 border border-brand-border rounded-[6px] text-brand-black bg-white focus:border-brand-red focus:ring-3 focus:ring-brand-red/10 outline-none w-full"
            />
          </div>

          {/* To Date */}
          <div className="flex flex-col gap-1 w-[150px]">
            <span className="font-brand font-semibold text-[10px] text-brand-muted uppercase tracking-[1.5px] mb-1.5">
              To date
            </span>
            <input
              type="date"
              value={toDate}
              onChange={e => {
                setToDate(e.target.value)
                setCurrentPage(1)
              }}
              className={`h-[40px] px-3 border rounded-[6px] text-brand-black bg-white focus:border-brand-red focus:ring-3 focus:ring-brand-red/10 outline-none w-full ${
                isDateInvalid ? 'border-brand-red ring-2 ring-red-100' : 'border-brand-border'
              }`}
            />
            {isDateInvalid && (
              <span className="text-[10px] text-brand-red mt-1 font-semibold block">
                To date must be after From date
              </span>
            )}
          </div>

          {/* Customer Name */}
          <div className="flex flex-col gap-1 w-[200px]">
            <span className="font-brand font-semibold text-[10px] text-brand-muted uppercase tracking-[1.5px] mb-1.5">
              Customer name
            </span>
            <input
              type="text"
              placeholder="Search customer..."
              value={customerName}
              onChange={e => {
                setCustomerName(e.target.value)
                setCurrentPage(1)
              }}
              className="h-[40px] px-3 border border-brand-border rounded-[6px] text-brand-black placeholder:text-brand-muted bg-white focus:border-brand-red outline-none w-full font-body"
            />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1 w-[160px]">
            <span className="font-brand font-semibold text-[10px] text-brand-muted uppercase tracking-[1.5px] mb-1.5">
              Phone
            </span>
            <input
              type="text"
              placeholder="Search phone..."
              value={phone}
              onChange={e => {
                setPhone(e.target.value)
                setCurrentPage(1)
              }}
              className="h-[40px] px-3 border border-brand-border rounded-[6px] text-brand-black placeholder:text-brand-muted bg-white focus:border-brand-red outline-none w-full font-mono"
            />
          </div>

          {/* Agent */}
          <div className="flex flex-col gap-1 w-[140px]">
            <span className="font-brand font-semibold text-[10px] text-brand-muted uppercase tracking-[1.5px] mb-1.5">
              Agent
            </span>
            <select
              value={selectedAgent}
              onChange={e => {
                setSelectedAgent(e.target.value)
                setCurrentPage(1)
              }}
              className="h-[40px] px-3 pr-8 border border-brand-border rounded-[6px] text-brand-black bg-white cursor-pointer outline-none focus:border-brand-red w-full appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236A6A6A%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-right-3"
            >
              <option value="">All</option>
              {agents.map(a => (
                <option key={a.id} value={a.name}>
                  {a.name}
                </option>
              ))}
              <option value="unassigned">— Unassigned —</option>
            </select>
          </div>

          {/* Payment */}
          <div className="flex flex-col gap-1 w-[180px]">
            <span className="font-brand font-semibold text-[10px] text-brand-muted uppercase tracking-[1.5px] mb-1.5">
              Payment
            </span>
            <select
              value={paymentFilter}
              onChange={e => {
                setPaymentFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="h-[40px] px-3 pr-8 border border-brand-border rounded-[6px] text-brand-black bg-white cursor-pointer outline-none focus:border-brand-red w-full appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236A6A6A%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-right-3"
            >
              <option value="">All</option>
              <option value="cash-paid">Cash — Paid</option>
              <option value="cash-unpaid">Cash — Unpaid</option>
              <option value="online-paid">Online — Paid</option>
              <option value="online-unpaid">Online — Unpaid</option>
              <option value="upi-paid">UPI — Paid</option>
              <option value="upi-unpaid">UPI — Unpaid</option>
            </select>
          </div>

          {/* Order Type */}
          <div className="flex flex-col gap-1 w-[140px]">
            <span className="font-brand font-semibold text-[10px] text-brand-muted uppercase tracking-[1.5px] mb-1.5">
              Order type
            </span>
            <select
              value={orderType}
              onChange={e => {
                setOrderType(e.target.value)
                setCurrentPage(1)
              }}
              className="h-[40px] px-3 pr-8 border border-brand-border rounded-[6px] text-brand-black bg-white cursor-pointer outline-none focus:border-brand-red w-full appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236A6A6A%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-right-3"
            >
              <option value="">All</option>
              <option value="dine-in">Dine-In</option>
              <option value="takeaway">Takeaway</option>
              <option value="delivery">Delivery</option>
            </select>
          </div>

          {/* Explicit Filter Button */}
          <button
            type="button"
            className="h-[40px] bg-brand-red hover:bg-brand-redHover text-white font-brand font-bold text-[13px] uppercase tracking-[1px] px-6 rounded-[6px] flex items-center gap-2 transition-colors cursor-pointer w-fit"
          >
            <SlidersHorizontal size={14} />
            Filter
          </button>
        </div>

        {/* Clear/Reset link triggers */}
        <div className="flex justify-end pr-2 pt-1">
          <button
            onClick={handleResetFilters}
            className="font-brand font-bold text-[12px] text-brand-red hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* LAYER 3 — SUMMARY STATS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-2">
        {/* Stat Card 1: Bills Found */}
        <div className="bg-white border border-brand-border rounded-[12px] p-5 shadow-sm flex items-start gap-4">
          <div className="w-11 h-11 bg-brand-redLight text-brand-red rounded-full flex items-center justify-center flex-shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <div className="font-brand font-black text-[42px] text-brand-black leading-none">
              {filteredCount}
            </div>
            <div className="font-body text-[13px] text-brand-muted mt-1 font-semibold uppercase tracking-[0.5px]">
              Bills found
            </div>
            <div className="font-body text-[11px] mt-1.5">
              <span className="text-green-700 font-bold">{paidCount} paid</span>
              <span className="text-brand-muted"> · </span>
              <span className="text-amber-600 font-bold">{unpaidCount} unpaid</span>
            </div>
          </div>
        </div>

        {/* Stat Card 2: Total Value */}
        <div className="bg-white border border-brand-border rounded-[12px] p-5 shadow-sm flex items-start gap-4">
          <div className="w-11 h-11 bg-green-50 text-green-700 rounded-full flex items-center justify-center flex-shrink-0">
            <IndianRupee size={20} />
          </div>
          <div>
            <div className="font-brand font-black text-[34px] text-brand-black leading-none">
              ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="font-body text-[13px] text-brand-muted mt-1 font-semibold uppercase tracking-[0.5px]">
              Total value
            </div>
            <div className="font-body text-[11px] mt-1.5 whitespace-nowrap">
              <span className="text-green-700 font-bold">₹{paidValue.toLocaleString('en-IN')} collected</span>
              <span className="text-brand-muted"> · </span>
              <span className="text-amber-600 font-bold">₹{unpaidValue.toLocaleString('en-IN')} outstanding</span>
            </div>
          </div>
        </div>

        {/* Stat Card 3: Awaiting Payment */}
        <div className="bg-white border border-brand-border rounded-[12px] p-5 shadow-sm flex items-start gap-4">
          <div className="w-11 h-11 bg-amber-50 text-[#C9973A] rounded-full flex items-center justify-center flex-shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <div className="font-brand font-black text-[38px] text-brand-black leading-none">
              {unpaidCount + partialCount}
            </div>
            <div className="font-body text-[13px] text-brand-muted mt-1 font-semibold uppercase tracking-[0.5px]">
              Awaiting Payment
            </div>
            <div className="font-body text-[11px] text-[#C9973A] font-bold mt-1.5">
              ₹{(unpaidValue + partialValue).toLocaleString('en-IN')} not yet collected
            </div>
          </div>
        </div>
      </div>

      {/* LAYER 4 — BILLS TABLE */}
      <div className="bg-white border border-brand-border rounded-[12px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-brand-border font-brand font-semibold text-[10px] text-brand-muted uppercase tracking-[1.2px]">
                <th className="px-5 py-3.5 text-left">Order</th>
                <th className="px-5 py-3.5 text-left">Date</th>
                <th className="px-5 py-3.5 text-left">Customer</th>
                <th className="px-5 py-3.5 text-center">Type</th>
                <th className="px-5 py-3.5 text-left">Agent</th>
                <th className="px-5 py-3.5 text-right w-[110px]">Total</th>
                <th className="px-5 py-3.5 text-left w-[180px]">Payment</th>
                <th className="px-5 py-3.5 text-left">Status</th>
                <th className="px-5 py-3.5 text-right w-[240px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {paginatedBills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-brand-muted italic">
                    No bill invoices recorded inside active filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedBills.map(bill => {
                  const billDate = format(new Date(bill.timestamp), 'dd MMM yyyy')
                  const billTime = format(new Date(bill.timestamp), 'h:mm aa')
                  const isPopoverActive = popoverBillNo === bill.billNo

                  return (
                    <tr
                      key={bill.billNo}
                      onClick={() => setPreviewBill(bill)}
                      className="hover:bg-[#FAFAFA] transition-colors duration-150 cursor-pointer font-body text-[13px] relative"
                    >
                      {/* Column 1: Order ID */}
                      <td className="px-5 py-4 align-middle">
                        <Link
                          href={`/admin/orders/${bill.orderId}`}
                          onClick={e => e.stopPropagation()}
                          className="font-mono font-bold text-[13.5px] text-brand-black hover:text-brand-red transition-colors hover:underline tracking-tight"
                          title="View order details"
                        >
                          {bill.orderId}
                        </Link>
                      </td>

                      {/* Column 2: Date */}
                      <td className="px-5 py-4 align-middle whitespace-nowrap">
                        <div className="font-medium text-brand-black">{billDate}</div>
                        <div className="text-[11px] text-brand-muted mt-0.5">{billTime}</div>
                      </td>

                      {/* Column 3: Customer */}
                      <td className="px-5 py-4 align-middle">
                        <div className="font-brand font-semibold text-brand-black">{bill.customerName}</div>
                        <div className="text-[11px] text-brand-muted mt-0.5">
                          <a
                            href={`tel:${bill.customerPhone}`}
                            className="hover:text-brand-red transition-colors"
                            onClick={e => e.stopPropagation()}
                          >
                            {bill.customerPhone}
                          </a>
                        </div>
                      </td>

                      {/* Column 4: Order Type Icon */}
                      <td className="px-5 py-4 align-middle text-center">
                        {bill.orderType === 'dine-in' && (
                          <div className="flex justify-center">
                            <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center" title="Dine-In">
                              <UtensilsCrossed size={13} className="text-blue-600" />
                            </div>
                          </div>
                        )}
                        {bill.orderType === 'takeaway' && (
                          <div className="flex justify-center">
                            <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center" title="Takeaway">
                              <ShoppingBag size={13} className="text-amber-600" />
                            </div>
                          </div>
                        )}
                        {bill.orderType === 'delivery' && (
                          <div className="flex justify-center">
                            <div className="w-7 h-7 rounded-full bg-purple-50 flex items-center justify-center" title="Delivery">
                              <Bike size={13} className="text-purple-600" />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Column 5: Agent initials avatar */}
                      <td className="px-5 py-4 align-middle whitespace-nowrap">
                        {bill.assignedAgent ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-brand-redLight flex items-center justify-center flex-shrink-0">
                              <span className="font-brand font-bold text-[10px] text-brand-red">
                                {getInitials(bill.assignedAgent)}
                              </span>
                            </div>
                            <span className="font-medium text-brand-black">{bill.assignedAgent}</span>
                          </div>
                        ) : (
                          <span className="font-body italic text-[12px] text-brand-muted">—</span>
                        )}
                      </td>

                      {/* Column 6: Total */}
                      <td className="px-5 py-4 align-middle text-right font-brand font-bold text-[15px] text-brand-black">
                        ₹{bill.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Column 7: Payment status with toggle popover */}
                      <td className="px-5 py-4 align-middle relative">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{bill.paymentMethod}</span>
                          <span className="text-[#B0B0B0]">—</span>
                          <button
                            type="button"
                            onClick={e => handleInlinePaymentToggleClick(e, bill)}
                            className={`font-brand font-bold text-[13px] transition-colors focus:underline outline-none hover:opacity-85 ${
                              bill.paymentStatus === 'paid'
                                ? 'text-[#2E7D32]'
                                : bill.paymentStatus === 'partial'
                                ? 'text-[#1565C0]'
                                : 'text-[#C9973A]'
                            }`}
                          >
                            {bill.paymentStatus === 'paid' ? 'Paid' : bill.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
                          </button>
                        </div>

                        {/* Inline confirmation Popover */}
                        {isPopoverActive && (
                          <div
                            onClick={e => e.stopPropagation()}
                            className="absolute bg-white border border-brand-border rounded-[8px] p-3 shadow-md z-30 left-5 top-12 text-center space-y-2.5 w-44 animate-in fade-in slide-in-from-top-2 duration-150"
                          >
                            <div className="text-[11px] text-brand-black font-semibold">
                              Mark as {popoverTargetStatus?.toUpperCase()}?
                            </div>
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={confirmPopoverStatusChange}
                                className="bg-brand-red hover:bg-brand-redHover text-white text-[10px] font-brand font-bold px-3 py-1.5 rounded uppercase cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={closePopover}
                                className="border border-brand-border text-brand-body text-[10px] font-brand font-semibold px-2 py-1.5 rounded uppercase hover:bg-gray-50 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Column 8: StatusBadge read-only */}
                      <td className="px-5 py-4 align-middle">
                        <OrderStatusBadge status={bill.orderStatus as any} />
                      </td>

                      {/* Column 9: Action Buttons */}
                      <td className="px-5 py-4 align-middle text-right">
                        <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                          {/* Print/View */}
                          <button
                            type="button"
                            onClick={() => setPreviewBill(bill)}
                            className="h-8 border border-brand-border hover:border-brand-black hover:bg-[#F5F5F5] text-brand-black font-brand font-semibold text-[11px] px-3.5 rounded-[5px] inline-flex items-center gap-1.5 transition-colors"
                            title="View / Print Invoice"
                          >
                            <Eye size={13} />
                            <span className="hidden xl:inline">View / Print</span>
                          </button>

                          {/* Print Single PDF bypass */}
                          <button
                            type="button"
                            onClick={() => handlePrintSingle(bill)}
                            className="h-8 border border-[#1565C0] hover:bg-[#1565C0] hover:text-white text-[#1565C0] font-brand font-semibold text-[11px] px-3.5 rounded-[5px] inline-flex items-center gap-1.5 transition-colors"
                            title="Direct PDF Print"
                          >
                            <FileDown size={13} />
                            <span className="hidden xl:inline">PDF</span>
                          </button>

                          {/* WhatsApp share */}
                          <button
                            type="button"
                            onClick={() => handleWhatsAppShareSingle(bill)}
                            className="h-8 bg-[#25D366] hover:bg-[#1da851] text-white font-brand font-semibold text-[11px] px-3.5 rounded-[5px] inline-flex items-center gap-1.5 transition-colors border-0"
                            title="Share Invoice on WhatsApp"
                          >
                            <MessageCircle size={13} />
                            <span className="hidden xl:inline">Share</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LAYER 5 — PAGINATION BAR */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-4 border border-brand-border bg-white rounded-[12px] shadow-sm flex-wrap gap-4 mt-2">
          {/* Results count text */}
          <span className="font-body text-[13px] text-brand-muted">
            Showing {paginationFrom}–{paginationTo} of {filteredCount} bills
          </span>

          {/* Controls and size */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Number pills */}
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="w-8 h-8 rounded-[6px] border border-brand-border flex items-center justify-center hover:bg-[#F5F5F5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white text-brand-black"
              >
                <ChevronLeft size={16} />
              </button>

              {getPageNumbers().map(num => (
                <button
                  key={num}
                  onClick={() => setCurrentPage(num)}
                  className={`w-8 h-8 rounded-[6px] flex items-center justify-center font-brand text-[12px] transition-colors border ${
                    currentPage === num
                      ? 'bg-brand-red text-white border-brand-red font-bold'
                      : 'border-brand-border hover:bg-[#F5F5F5] font-medium text-brand-black bg-white'
                  }`}
                >
                  {num}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="w-8 h-8 rounded-[6px] border border-brand-border flex items-center justify-center hover:bg-[#F5F5F5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white text-brand-black"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Page size dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-brand-muted">Show</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="h-8 px-2 border border-brand-border rounded-[6px] bg-white font-body text-[12px] cursor-pointer outline-none focus:border-brand-red appearance-none w-[70px] text-center"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-[12px] text-brand-muted">per page</span>
            </div>
          </div>
        </div>
      )}

      {/* Bill Preview Modal Overlay */}
      {previewBill && (
        <BillPreviewModal
          isOpen={!!previewBill}
          onClose={() => setPreviewBill(null)}
          bill={previewBill}
        />
      )}
    </div>
  )
}
