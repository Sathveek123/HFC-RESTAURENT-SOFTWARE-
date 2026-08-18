import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { syncSettingToSupabase, fetchSettingFromSupabase } from '@/lib/supabaseSync'

export interface DeliveryArea {
  id: string
  name: string
  isActive: boolean
}

export interface SubscriptionPlan {
  id: string
  name: string
  pricePerMonth: number
  isActive: boolean
}

export interface Settings {
  // License
  licenseKey: string
  isLicensed: boolean
  licensedDomain: string
  licenseValidUntil: string

  // Branding
  siteName: string
  logoBase64: string | null
  phone: string
  whatsappNumber: string
  kitchenAddress: string

  // GST
  gstMode: 'none' | 'inclusive' | 'exclusive'
  gstPercent: number

  // Delivery & Payment
  deliveryFee: number
  freeDeliveryAbove: number
  currencySymbol: string
  upiId: string
  acceptCash: boolean
  acceptOnline: boolean
  packagingCharge: number   // Counter QR takeaway packaging fee (₹)

  // WhatsApp Auto-send
  cloudApiToken: string
  cloudApiPhoneId: string

  // Delivery Areas
  deliveryAreas: DeliveryArea[]

  // Subscription Plans
  subscriptionPlans: SubscriptionPlan[]

  // Kitchen Closing Parameters (configurable operating windows)
  kitchenCloseHour: number
  kitchenOpenHour: number

  // Rider Performance settings
  riderEarningModel?: 'flat' | 'percent'
  riderFlatFee?: number
  riderEarningPercent?: number
  defaultEtaMinutes?: number
  riderTargetVolume?: number
}

const defaultSettings: Settings = {
  licenseKey: 'HFC-PRO-2026-ENTERPRISE-88X',
  isLicensed: true,
  licensedDomain: 'hfc-consultancy.com',
  licenseValidUntil: '31 Dec 2026',

  siteName: 'HFC Consultancy Services',
  logoBase64: null,
  phone: '9912799855',
  whatsappNumber: '919912799855',
  kitchenAddress: 'Labour Colony, Maruthi Nagar, near HFC Outlet, Rajam',

  gstMode: 'exclusive',
  gstPercent: 5,

  deliveryFee: 50,
  freeDeliveryAbove: 500,
  currencySymbol: '₹',
  upiId: '9912799855@okbizaxis',
  acceptCash: true,
  acceptOnline: true,
  packagingCharge: 10,

  cloudApiToken: '',
  cloudApiPhoneId: '',

  deliveryAreas: [
    { id: 'area-1', name: 'Labour Colony', isActive: true },
    { id: 'area-2', name: 'Vamsadhara Colony', isActive: true },
    { id: 'area-3', name: 'Palakonda Road', isActive: true }
  ],

  subscriptionPlans: [
    { id: 'plan-1', name: 'Growth Support Plan', pricePerMonth: 4500, isActive: true },
    { id: 'plan-2', name: 'Standard Setup Plan', pricePerMonth: 6500, isActive: true }
  ],

  kitchenCloseHour: 22, // 10:00 PM
  kitchenOpenHour: 4,  // 4:00 AM

  riderEarningModel: 'flat',
  riderFlatFee: 30,
  riderEarningPercent: 50,
  defaultEtaMinutes: 30,
  riderTargetVolume: 20
}

interface SettingsStore {
  settings: Settings

  // Core actions
  updateSettings: (newSettings: Partial<Settings>) => void
  setSettingsFromSupabase: (remote: Partial<Settings>) => void
  fetchAndSyncSettings: () => Promise<void>

  // Delivery Area actions
  addDeliveryArea: (name: string) => void
  toggleDeliveryArea: (id: string) => void
  deleteDeliveryArea: (id: string) => void

  // Subscription Plan actions
  addSubscriptionPlan: (name: string, price: number) => void
  toggleSubscriptionPlan: (id: string) => void
  deleteSubscriptionPlan: (id: string) => void
}

// Persist the full settings object to Supabase under key 'site_settings'
const pushToSupabase = async (settings: Settings) => {
  // Don't sync sensitive secrets like cloudApiToken in plain JSONB — only public settings
  const { cloudApiToken, cloudApiPhoneId, ...publicSettings } = settings
  await syncSettingToSupabase('site_settings', publicSettings as any)
  // Sync API creds separately under a private key (still goes to same table but separate row)
  if (cloudApiToken || cloudApiPhoneId) {
    await syncSettingToSupabase('site_settings_private', { cloudApiToken, cloudApiPhoneId } as any)
  }
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,

      updateSettings: (newSettings) => {
        const merged = { ...get().settings, ...newSettings }
        set({ settings: merged })
        pushToSupabase(merged)
      },

      // Called when Realtime broadcasts a remote update (or initial fetch)
      setSettingsFromSupabase: (remote) => {
        const merged = { ...get().settings, ...remote }
        set({ settings: merged })
      },

      // Fetch settings from Supabase on mount
      fetchAndSyncSettings: async () => {
        try {
          const [pub, priv] = await Promise.all([
            fetchSettingFromSupabase('site_settings'),
            fetchSettingFromSupabase('site_settings_private'),
          ])

          if (pub || priv) {
            const merged: Partial<Settings> = { ...(pub || {}), ...(priv || {}) }
            set({ settings: { ...get().settings, ...merged } })
          } else {
            // First run — seed defaults to Supabase
            console.log('No settings found in Supabase. Seeding defaults...')
            await pushToSupabase(get().settings)
          }
        } catch (err) {
          console.warn('Failed to fetch settings from Supabase:', err)
        }
      },

      addDeliveryArea: (name) => {
        const newArea: DeliveryArea = { id: `area-${Date.now()}`, name: name.trim(), isActive: true }
        const updated = { ...get().settings, deliveryAreas: [...get().settings.deliveryAreas, newArea] }
        set({ settings: updated })
        pushToSupabase(updated)
      },

      toggleDeliveryArea: (id) => {
        const updated = {
          ...get().settings,
          deliveryAreas: get().settings.deliveryAreas.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a)
        }
        set({ settings: updated })
        pushToSupabase(updated)
      },

      deleteDeliveryArea: (id) => {
        const updated = {
          ...get().settings,
          deliveryAreas: get().settings.deliveryAreas.filter(a => a.id !== id)
        }
        set({ settings: updated })
        pushToSupabase(updated)
      },

      addSubscriptionPlan: (name, price) => {
        const newPlan: SubscriptionPlan = {
          id: `plan-${Date.now()}`,
          name: name.trim(),
          pricePerMonth: price,
          isActive: true
        }
        const updated = { ...get().settings, subscriptionPlans: [...get().settings.subscriptionPlans, newPlan] }
        set({ settings: updated })
        pushToSupabase(updated)
      },

      toggleSubscriptionPlan: (id) => {
        const updated = {
          ...get().settings,
          subscriptionPlans: get().settings.subscriptionPlans.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p)
        }
        set({ settings: updated })
        pushToSupabase(updated)
      },

      deleteSubscriptionPlan: (id) => {
        const updated = {
          ...get().settings,
          subscriptionPlans: get().settings.subscriptionPlans.filter(p => p.id !== id)
        }
        set({ settings: updated })
        pushToSupabase(updated)
      }
    }),
    {
      name: 'hfc-settings',
    }
  )
)
