const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load env vars
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

try {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const lines = envContent.split('\n')
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
      if (match) {
        const key = match[1]
        let val = match[2].trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1)
        }
        if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') serviceKey = val
      }
    }
  }
} catch (e) {}

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Error: Missing configuration parameters in env.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
})

async function run() {
  console.log('🔄 Attempting to insert a test order to diagnose trigger issues...')
  
  const testOrderId = `TEST-${Date.now()}`
  const dbRow = {
    id: testOrderId,
    customer_name: 'TEST DIAGNOSTIC',
    phone_number: '9999999999',
    order_type: 'dine-in',
    address: null,
    landmark: null,
    delivery_area: null,
    coords: null,
    items: [],
    subtotal: 100,
    gst: 5,
    delivery_charge: 0,
    discount_amount: 0,
    coupon_code: null,
    total: 105,
    payment_method: 'Cash',
    payment_status: 'unpaid',
    status: 'placed',
    assigned_agent: null,
    seen_by_admin: false,
    is_regular_customer: false,
    notes: 'Diagnostic test order',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    timestamp: Date.now()
  }

  const { data, error } = await supabase
    .from('orders')
    .insert(dbRow)
    .select()

  if (error) {
    console.error('\n❌ Order Insertion Failed!')
    console.error('Code:', error.code)
    console.error('Message:', error.message)
    console.error('Details:', error.details)
    console.error('Hint:', error.hint)
  } else {
    console.log('\n✅ Success! The test order was inserted successfully.')
    console.log('Deleting test order...')
    await supabase.from('orders').delete().eq('id', testOrderId)
  }
}

run()
