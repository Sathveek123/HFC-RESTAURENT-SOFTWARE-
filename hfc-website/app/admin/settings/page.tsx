'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSettingsStore, Settings } from '@/store/settingsStore'
import { subscribeToSettingRealtime } from '@/lib/supabaseSync'
import { QRCodeSVG } from 'qrcode.react'


function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block font-brand font-semibold text-[11px] text-[#6A6A6A] uppercase tracking-[0.5px] mb-1.5">
      {children}
    </label>
  )
}

const inputCls = 'w-full h-[44px] border border-brand-border rounded-[8px] px-4 font-body text-[14px] text-brand-black focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/10 transition-all bg-white'
const selectCls = `${inputCls} appearance-none cursor-pointer`

function ActiveToggleBadge({ isActive, onToggle }: { isActive: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-1 rounded-full font-brand font-bold text-[10px] uppercase tracking-[0.5px] transition-colors cursor-pointer ${
        isActive
          ? 'bg-[#166534] text-white hover:bg-green-800'
          : 'bg-[#F0F0F0] text-brand-muted hover:bg-gray-200'
      }`}
    >
      {isActive ? 'Active' : 'Paused'}
    </button>
  )
}

function DeleteInlineButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return confirming ? (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="font-body text-[11px] text-red-700 whitespace-nowrap">{label}</span>
      <button
        type="button"
        onClick={() => { onConfirm(); setConfirming(false) }}
        className="h-7 px-3 bg-red-600 hover:bg-red-700 text-white font-brand font-bold text-[10px] uppercase rounded-[5px] transition-colors cursor-pointer"
      >
        Delete
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="h-7 px-3 border border-red-300 text-red-600 font-brand font-medium text-[10px] uppercase rounded-[5px] hover:bg-red-50 cursor-pointer"
      >
        Cancel
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="h-[30px] px-4 bg-white border border-red-300 text-red-600 font-brand font-bold text-[11px] uppercase rounded-[6px] hover:bg-red-50 transition-colors cursor-pointer"
    >
      Delete
    </button>
  )
}

export default function AdminSettingsPage() {
  const storeSettings = useSettingsStore(state => state.settings)
  const updateSettings = useSettingsStore(state => state.updateSettings)

  const addDeliveryArea = useSettingsStore(state => state.addDeliveryArea)
  const toggleDeliveryArea = useSettingsStore(state => state.toggleDeliveryArea)
  const deleteDeliveryArea = useSettingsStore(state => state.deleteDeliveryArea)

  const addSubscriptionPlan = useSettingsStore(state => state.addSubscriptionPlan)
  const toggleSubscriptionPlan = useSettingsStore(state => state.toggleSubscriptionPlan)
  const deleteSubscriptionPlan = useSettingsStore(state => state.deleteSubscriptionPlan)

  // Local Form Draft State
  const [draft, setDraft] = useState<Settings>(storeSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [paymentWarning, setPaymentWarning] = useState('')

  // Delivery Areas Local Input State
  const [newAreaName, setNewAreaName] = useState('')

  // Subscription Plans Local Input State
  const [newPlanName, setNewPlanName] = useState('')
  const [newPlanPrice, setNewPlanPrice] = useState('')

  // Sync from Supabase on mount and subscribe to realtime
  useEffect(() => {
    const store = useSettingsStore.getState()
    store.fetchAndSyncSettings()

    const unsubPublic = subscribeToSettingRealtime('site_settings', (val) => {
      if (val) useSettingsStore.getState().setSettingsFromSupabase(val)
    })
    const unsubPrivate = subscribeToSettingRealtime('site_settings_private', (val) => {
      if (val) useSettingsStore.getState().setSettingsFromSupabase(val)
    })

    return () => { unsubPublic(); unsubPrivate() }
  }, [])

  useEffect(() => {
    setDraft(storeSettings)
  }, [storeSettings])


  const handleFieldChange = (key: keyof Settings, value: any) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  // Payment Checkbox toggle with validation
  const handlePaymentToggle = (type: 'cash' | 'online', checked: boolean) => {
    if (type === 'cash') {
      if (!checked && !draft.acceptOnline) {
        setPaymentWarning('At least one payment method must be enabled')
        return
      }
      setPaymentWarning('')
      handleFieldChange('acceptCash', checked)
    } else {
      if (!checked && !draft.acceptCash) {
        setPaymentWarning('At least one payment method must be enabled')
        return
      }
      setPaymentWarning('')
      handleFieldChange('acceptOnline', checked)
    }
  }

  // Logo file upload handler
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      handleFieldChange('logoBase64', reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // License Activate
  const handleActivateLicense = () => {
    if (draft.licenseKey.trim().length > 5) {
      handleFieldChange('isLicensed', true)
      toast.success('License activated ✓')
    } else {
      handleFieldChange('isLicensed', false)
      toast.error('Invalid or expired license key')
    }
  }

  // Save Cards 1-5 settings
  const handleSaveSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsSaving(true)
    updateSettings(draft)

    setTimeout(() => {
      setIsSaving(false)
      setSaveSuccess(true)
      toast.success('Settings saved successfully ✓')
      if (draft.upiId) {
        toast.success('UPI ID updated — new QR codes are now live ✓')
      }
      setTimeout(() => setSaveSuccess(false), 2000)
    }, 400)
  }

  // Delivery area add
  const handleAddArea = () => {
    if (!newAreaName.trim()) return
    addDeliveryArea(newAreaName.trim())
    setNewAreaName('')
    toast.success('Delivery area added ✓')
  }

  // Subscription plan add
  const handleAddPlan = () => {
    const price = parseFloat(newPlanPrice)
    if (!newPlanName.trim() || isNaN(price)) return
    addSubscriptionPlan(newPlanName.trim(), price)
    setNewPlanName('')
    setNewPlanPrice('')
    toast.success('Subscription plan added ✓')
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 bg-[#FAFAFA] min-h-full max-w-[900px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-[28px] text-brand-black">Settings</h1>
        <p className="font-body text-[12px] text-[#6A6A6A] mt-1">Admin / Settings</p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">

        {/* CARD 1 — LICENSE */}
        <div className="bg-white border border-brand-border rounded-[12px] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            {draft.isLicensed ? (
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-700 flex-shrink-0">
                <CheckCircle2 size={16} />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                <XCircle size={16} />
              </div>
            )}
            <h2 className="font-display font-bold text-[18px] text-brand-black">License</h2>
          </div>

          <p className="font-body text-[13px] text-[#4A4A4A] mt-1">
            {draft.isLicensed ? (
              <>
                Licensed for <span className="font-semibold text-brand-black">{draft.licensedDomain}</span>, valid until <span className="font-semibold text-brand-black">{draft.licenseValidUntil}</span>.
              </>
            ) : (
              <span className="text-amber-700 font-semibold">Not licensed — some features may be limited.</span>
            )}
          </p>

          <div className="mt-4">
            <FormLabel>License key</FormLabel>
            <textarea
              rows={2}
              value={draft.licenseKey}
              onChange={e => handleFieldChange('licenseKey', e.target.value)}
              className="w-full border border-brand-border rounded-[8px] px-4 py-3 font-mono text-[12px] text-brand-black resize-y focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/10 bg-white"
            />
          </div>

          <button
            type="button"
            onClick={handleActivateLicense}
            className="bg-brand-red text-white font-brand font-bold text-[13px] uppercase tracking-[1px] h-[42px] px-6 rounded-[8px] hover:bg-brand-redHover transition-colors mt-4 cursor-pointer"
          >
            Activate
          </button>
        </div>

        {/* CARD 2 — BRANDING */}
        <div className="bg-white border border-brand-border rounded-[12px] p-6 shadow-sm">
          <h2 className="font-display font-bold text-[19px] text-brand-black mb-5">Branding</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {/* Field 1 — Site Name */}
            <div>
              <FormLabel>Kitchen / site name</FormLabel>
              <input
                type="text"
                value={draft.siteName}
                onChange={e => handleFieldChange('siteName', e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Field 2 — Logo */}
            <div>
              <FormLabel>Logo</FormLabel>
              <div className="flex items-center gap-3">
                <div className="w-[56px] h-[56px] rounded-[8px] border border-brand-border overflow-hidden bg-brand-surface flex items-center justify-center flex-shrink-0">
                  {draft.logoBase64 ? (
                    <img src={draft.logoBase64} alt="Logo preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-brand font-bold text-[18px] text-brand-red">HFC</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                    <span className="inline-flex items-center gap-2 bg-white border border-brand-border rounded-[6px] px-3 py-2 font-body text-[13px] hover:bg-[#F5F5F5] transition-colors">
                      Choose File
                    </span>
                  </label>
                  <span className="font-body text-[12px] text-[#6A6A6A]">
                    {draft.logoBase64 ? 'Image selected' : 'No file chosen'}
                  </span>
                </div>
              </div>
            </div>

            {/* Field 3 — Phone */}
            <div>
              <FormLabel>Phone</FormLabel>
              <input
                type="tel"
                value={draft.phone}
                onChange={e => handleFieldChange('phone', e.target.value)}
                placeholder="9912499855"
                className={inputCls}
              />
            </div>

            {/* Field 4 — WhatsApp */}
            <div>
              <FormLabel>WhatsApp number (with country code, digits only)</FormLabel>
              <input
                type="tel"
                value={draft.whatsappNumber}
                onChange={e => handleFieldChange('whatsappNumber', e.target.value.replace(/\D/g, ''))}
                placeholder="919912499855"
                className={inputCls}
              />
            </div>

            {/* Field 5 — Address */}
            <div className="md:col-span-2">
              <FormLabel>Kitchen address</FormLabel>
              <textarea
                rows={2}
                value={draft.kitchenAddress}
                onChange={e => handleFieldChange('kitchenAddress', e.target.value)}
                className="w-full border border-brand-border rounded-[8px] px-4 py-3 font-body text-[13px] resize-y focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/10 bg-white"
              />
            </div>
          </div>
        </div>

        {/* CARD 3 — GST */}
        <div className="bg-white border border-brand-border rounded-[12px] p-6 shadow-sm">
          <h2 className="font-display font-bold text-[19px] text-brand-black mb-5">GST</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {/* GST Mode */}
            <div>
              <FormLabel>GST mode</FormLabel>
              <select
                value={draft.gstMode}
                onChange={e => handleFieldChange('gstMode', e.target.value as any)}
                className={selectCls}
              >
                <option value="none">No GST</option>
                <option value="inclusive">GST Inclusive (already in menu price)</option>
                <option value="exclusive">GST Exclusive (added at checkout)</option>
              </select>
            </div>

            {/* GST % */}
            <div>
              <FormLabel>GST % (split evenly as CGST + SGST on the bill)</FormLabel>
              <input
                type="number"
                step="0.01"
                disabled={draft.gstMode === 'none'}
                value={draft.gstPercent}
                onChange={e => handleFieldChange('gstPercent', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className={`${inputCls} ${draft.gstMode === 'none' ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <p className="font-body text-[11px] text-[#6A6A6A] mt-1">
                e.g. 5% total shows as CGST 2.5% + SGST 2.5% on customer bills
              </p>
            </div>
          </div>
        </div>

        {/* CARD 4 — DELIVERY & PAYMENT */}
        <div className="bg-white border border-brand-border rounded-[12px] p-6 shadow-sm">
          <h2 className="font-display font-bold text-[19px] text-brand-black mb-5">Delivery &amp; Payment</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {/* Delivery fee */}
            <div>
              <FormLabel>Delivery fee</FormLabel>
              <input
                type="number"
                step="0.01"
                value={draft.deliveryFee}
                onChange={e => handleFieldChange('deliveryFee', parseFloat(e.target.value) || 0)}
                className={inputCls}
              />
            </div>

            {/* Free delivery threshold */}
            <div>
              <FormLabel>Free delivery above (0 = never free)</FormLabel>
              <input
                type="number"
                step="0.01"
                value={draft.freeDeliveryAbove}
                onChange={e => handleFieldChange('freeDeliveryAbove', parseFloat(e.target.value) || 0)}
                className={inputCls}
              />
            </div>

            {/* Currency symbol */}
            <div>
              <FormLabel>Currency symbol</FormLabel>
              <input
                type="text"
                maxLength={3}
                value={draft.currencySymbol}
                onChange={e => handleFieldChange('currencySymbol', e.target.value)}
                className={`${inputCls} w-[100px]`}
              />
            </div>

            {/* UPI ID */}
            <div>
              <FormLabel>UPI ID (leave blank to hide QR)</FormLabel>
              <input
                type="text"
                value={draft.upiId}
                onChange={e => handleFieldChange('upiId', e.target.value)}
                placeholder="streetfood@upi"
                className={inputCls}
              />
            </div>

            {/* Packaging Charge */}
            <div>
              <FormLabel>Packaging Charge (₹) (takeaway orders only)</FormLabel>
              <input
                type="number"
                step="0.01"
                value={draft.packagingCharge}
                onChange={e => handleFieldChange('packagingCharge', parseFloat(e.target.value) || 0)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Payment Checkboxes */}
          <div className="mt-5 space-y-2 pt-2 border-t border-brand-border">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.acceptCash}
                onChange={e => handlePaymentToggle('cash', e.target.checked)}
                className="w-4 h-4 accent-brand-red cursor-pointer"
              />
              <span className="font-body text-[13px] text-brand-black">Accept cash</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.acceptOnline}
                onChange={e => handlePaymentToggle('online', e.target.checked)}
                className="w-4 h-4 accent-brand-red cursor-pointer"
              />
              <span className="font-body text-[13px] text-brand-black">Accept online (UPI/QR)</span>
            </label>

            {paymentWarning && (
              <div className="flex items-center gap-1.5 text-brand-red text-[11px] font-semibold mt-1">
                <AlertTriangle size={14} />
                {paymentWarning}
              </div>
            )}
          </div>
        </div>

        {/* CARD 4b — COUNTER TAKEAWAY QR CODE */}
        <div className="bg-white border border-brand-border rounded-[12px] p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="font-display font-bold text-[19px] text-brand-black">Counter QR Code</h2>
            <p className="font-body text-[13.5px] text-[#4A4A4A] leading-relaxed max-w-[450px]">
              Display this QR code at your checkout counter. Walk-in customers can scan this to open the self-service menu, place takeaway orders, and track their tokens live.
            </p>
            <div className="font-mono text-[11px] bg-brand-surface border border-brand-border rounded-[6px] px-3 py-1.5 inline-block text-brand-black select-all">
              https://hfc-restaurent-software.vercel.app/counter
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-3 bg-brand-surface p-4 border border-brand-border rounded-[12px] flex-shrink-0">
            <QRCodeSVG
              value="https://hfc-restaurent-software.vercel.app/counter"
              size={120}
              level="H"
              includeMargin={true}
              id="counter-qr-code-svg"
            />
            <button
              type="button"
              onClick={() => {
                const win = window.open('', '_blank')
                if (win) {
                  const svgHtml = document.getElementById('counter-qr-code-svg')?.outerHTML || '';
                  win.document.write(`
                    <html>
                      <head>
                        <title>Print Counter QR Code</title>
                        <style>
                          body {
                            font-family: sans-serif;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            height: 90vh;
                            text-align: center;
                            margin: 0;
                            background: #FAFAFA;
                          }
                          .card {
                            border: 3px solid #E11D48;
                            border-radius: 24px;
                            padding: 40px;
                            max-width: 400px;
                            background: white;
                            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);
                          }
                          h1 { color: #E11D48; margin-bottom: 5px; font-size: 28px; font-weight: 900; letter-spacing: -0.5px; }
                          p { color: #4B5563; font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
                          .qr-wrapper { margin: 30px 0; display: flex; justify-content: center; }
                          svg { width: 220px; height: 220px; }
                        </style>
                      </head>
                      <body>
                        <div class="card">
                          <h1>HFC Counter Ordering</h1>
                          <p>Scan this QR to browse menu, order takeaway, and get your sequence token directly on your phone!</p>
                          <div class="qr-wrapper">
                            ${svgHtml}
                          </div>
                          <p style="font-weight: bold; font-size: 12px; margin-top: 15px; text-transform: uppercase; color: #E11D48; letter-spacing: 1px;">Self-Service Takeaway Stand</p>
                        </div>
                        <script>
                          setTimeout(function() { window.print(); }, 250);
                        </script>
                      </body>
                    </html>
                  `)
                  win.document.close()
                }
              }}
              className="bg-brand-black hover:bg-brand-red text-white font-brand font-bold text-[11px] uppercase tracking-[1px] h-[34px] px-4 rounded-[6px] transition-colors cursor-pointer"
            >
              Print QR Card
            </button>
          </div>
        </div>

        {/* CARD 5 — WHATSAPP AUTO-SEND */}
        <div className="bg-white border border-brand-border rounded-[12px] p-6 shadow-sm">
          <h2 className="font-display font-bold text-[19px] text-brand-black mb-1">WhatsApp auto-send (optional)</h2>
          <p className="font-body text-[12.5px] text-[#6A6A6A] leading-relaxed mb-4">
            Leave blank to use free click-to-send WhatsApp links (default, no setup needed). Fill these in only if you have a Meta WhatsApp Cloud API account and want status updates sent automatically without a click.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            <div>
              <FormLabel>Cloud API access token</FormLabel>
              <input
                type="password"
                value={draft.cloudApiToken}
                onChange={e => handleFieldChange('cloudApiToken', e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>

            <div>
              <FormLabel>Phone number ID</FormLabel>
              <input
                type="text"
                value={draft.cloudApiPhoneId}
                onChange={e => handleFieldChange('cloudApiPhoneId', e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>
        </div>

        {/* CARD 5b — RIDER PERFORMANCE SETTINGS */}
        <div className="bg-white border border-brand-border rounded-[12px] p-6 shadow-sm">
          <h2 className="font-display font-bold text-[19px] text-brand-black mb-1">Rider Performance</h2>
          <p className="font-body text-[12.5px] text-[#6A6A6A] leading-relaxed mb-5">
            Configure how rider commissions are calculated, the on-time benchmark, and target delivery volume used in the Rider Score calculation.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {/* Earning Model */}
            <div>
              <FormLabel>Commission Model</FormLabel>
              <select
                value={draft.riderEarningModel ?? 'flat'}
                onChange={e => handleFieldChange('riderEarningModel', e.target.value as 'flat' | 'percent')}
                className={selectCls}
              >
                <option value="flat">Flat fee per delivery</option>
                <option value="percent">% of delivery charge</option>
              </select>
            </div>

            {/* Flat Fee */}
            {(draft.riderEarningModel ?? 'flat') === 'flat' && (
              <div>
                <FormLabel>Flat fee per delivery (₹)</FormLabel>
                <input
                  type="number"
                  step="0.5"
                  value={draft.riderFlatFee ?? 30}
                  onChange={e => handleFieldChange('riderFlatFee', parseFloat(e.target.value) || 0)}
                  className={inputCls}
                />
                <p className="font-body text-[11px] text-[#6A6A6A] mt-1">Added to rider earnings per delivered order</p>
              </div>
            )}

            {/* Percent of delivery charge */}
            {(draft.riderEarningModel ?? 'flat') === 'percent' && (
              <div>
                <FormLabel>Rider % of delivery charge</FormLabel>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={draft.riderEarningPercent ?? 50}
                  onChange={e => handleFieldChange('riderEarningPercent', parseFloat(e.target.value) || 0)}
                  className={inputCls}
                />
                <p className="font-body text-[11px] text-[#6A6A6A] mt-1">e.g. 50% of ₹60 delivery charge → ₹30 rider earning</p>
              </div>
            )}

            {/* Default ETA */}
            <div>
              <FormLabel>Default ETA (minutes)</FormLabel>
              <input
                type="number"
                min="5"
                step="5"
                value={draft.defaultEtaMinutes ?? 30}
                onChange={e => handleFieldChange('defaultEtaMinutes', parseInt(e.target.value) || 30)}
                className={inputCls}
              />
              <p className="font-body text-[11px] text-[#6A6A6A] mt-1">Benchmark used for On-Time Performance calculation</p>
            </div>

            {/* Target Volume */}
            <div>
              <FormLabel>Monthly target deliveries per rider</FormLabel>
              <input
                type="number"
                min="1"
                step="1"
                value={draft.riderTargetVolume ?? 20}
                onChange={e => handleFieldChange('riderTargetVolume', parseInt(e.target.value) || 20)}
                className={inputCls}
              />
              <p className="font-body text-[11px] text-[#6A6A6A] mt-1">Used in the 20% volume component of the Rider Score</p>
            </div>
          </div>
        </div>

        {/* Sticky Save Settings Button for Cards 1-5 */}
        <div className="flex justify-start">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-brand-red text-white font-brand font-bold text-[13px] uppercase tracking-[1px] h-[46px] px-8 rounded-[8px] hover:bg-brand-redHover transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <span>Saving...</span>
            ) : saveSuccess ? (
              <span>✓ Saved</span>
            ) : (
              <span>Save settings</span>
            )}
          </button>
        </div>
      </form>

      {/* CARD 6 — DELIVERY AREAS */}
      <div className="bg-white border border-brand-border rounded-[12px] p-6 shadow-sm mt-2">
        <h2 className="font-display font-bold text-[19px] text-brand-black mb-1">Delivery Areas</h2>
        <p className="font-body text-[12.5px] text-[#6A6A6A] leading-relaxed mb-4">
          Add the localities you deliver to. If you add at least one, customers must pick one when checking out for delivery — leave this empty to allow any address with no restriction.
        </p>

        {/* Add Area Row */}
        <div className="flex gap-3 items-end mb-6">
          <div className="flex-1">
            <FormLabel>Area name</FormLabel>
            <input
              type="text"
              value={newAreaName}
              onChange={e => setNewAreaName(e.target.value)}
              placeholder="e.g. Sector 5, Solan"
              className={inputCls}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddArea())}
            />
          </div>
          <button
            type="button"
            onClick={handleAddArea}
            className="bg-brand-red text-white font-brand font-bold text-[13px] uppercase tracking-[1px] h-[42px] px-6 rounded-[8px] hover:bg-brand-redHover transition-colors cursor-pointer"
          >
            Add area
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden border border-brand-border rounded-[8px]">
          <table className="w-full">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-brand-border">
                <th className="font-brand font-semibold text-[10px] text-[#6A6A6A] uppercase tracking-[1.2px] px-5 py-3 text-left">Area</th>
                <th className="font-brand font-semibold text-[10px] text-[#6A6A6A] uppercase tracking-[1.2px] px-5 py-3 text-left">Active</th>
                <th className="font-brand font-semibold text-[10px] text-[#6A6A6A] uppercase tracking-[1.2px] px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {draft.deliveryAreas.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-5 font-body text-[13px] text-[#5B7FA6] italic">
                    No areas added — delivery address is unrestricted.
                  </td>
                </tr>
              ) : (
                draft.deliveryAreas.map(area => (
                  <tr key={area.id} className="border-b border-brand-border last:border-0 hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-5 py-3.5 font-body text-[13px] text-brand-black">{area.name}</td>
                    <td className="px-5 py-3.5">
                      <ActiveToggleBadge
                        isActive={area.isActive}
                        onToggle={() => toggleDeliveryArea(area.id)}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <DeleteInlineButton
                        label={`Delete ${area.name}?`}
                        onConfirm={() => deleteDeliveryArea(area.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CARD 7 — SUBSCRIPTION PLANS */}
      <div className="bg-white border border-brand-border rounded-[12px] p-6 shadow-sm">
        <h2 className="font-display font-bold text-[19px] text-brand-black mb-1">Subscription Plans</h2>
        <p className="font-body text-[12.5px] text-[#6A6A6A] leading-relaxed mb-4">
          Shown to customers registering for a fixed account on the login page (e.g. 'Basic — ₹3000/month'). This is informational — you still add the actual charges yourself from the customer's ledger.
        </p>

        {/* Add Plan Row */}
        <div className="flex gap-3 items-end mb-6">
          <div className="flex-1">
            <FormLabel>Plan name</FormLabel>
            <input
              type="text"
              value={newPlanName}
              onChange={e => setNewPlanName(e.target.value)}
              placeholder="e.g. Basic"
              className={inputCls}
            />
          </div>
          <div className="w-[140px]">
            <FormLabel>Price / month</FormLabel>
            <input
              type="number"
              value={newPlanPrice}
              onChange={e => setNewPlanPrice(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>
          <button
            type="button"
            onClick={handleAddPlan}
            className="bg-brand-red text-white font-brand font-bold text-[13px] uppercase tracking-[1px] h-[42px] px-6 rounded-[8px] hover:bg-brand-redHover transition-colors cursor-pointer"
          >
            Add plan
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden border border-brand-border rounded-[8px]">
          <table className="w-full">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-brand-border">
                <th className="font-brand font-semibold text-[10px] text-[#6A6A6A] uppercase tracking-[1.2px] px-5 py-3 text-left">Plan</th>
                <th className="font-brand font-semibold text-[10px] text-[#6A6A6A] uppercase tracking-[1.2px] px-5 py-3 text-left">Price</th>
                <th className="font-brand font-semibold text-[10px] text-[#6A6A6A] uppercase tracking-[1.2px] px-5 py-3 text-left">Active</th>
                <th className="font-brand font-semibold text-[10px] text-[#6A6A6A] uppercase tracking-[1.2px] px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {draft.subscriptionPlans.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-5 font-body text-[13px] text-[#6A6A6A] italic">
                    No plans added yet.
                  </td>
                </tr>
              ) : (
                draft.subscriptionPlans.map(plan => (
                  <tr key={plan.id} className="border-b border-brand-border last:border-0 hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-5 py-3.5 font-brand font-semibold text-[13px] text-brand-black">{plan.name}</td>
                    <td className="px-5 py-3.5 font-body text-[13px] text-brand-black">₹{plan.pricePerMonth}/month</td>
                    <td className="px-5 py-3.5">
                      <ActiveToggleBadge
                        isActive={plan.isActive}
                        onToggle={() => toggleSubscriptionPlan(plan.id)}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <DeleteInlineButton
                        label={`Delete ${plan.name}?`}
                        onConfirm={() => deleteSubscriptionPlan(plan.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
