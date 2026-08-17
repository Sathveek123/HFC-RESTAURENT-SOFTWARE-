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
  console.log('🔄 Checking latest orders in Supabase...')
  const { data, error } = await supabase
    .from('orders')
    .select('id, customer_name, phone_number, status, created_at, total')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('❌ Error fetching orders:', error.message)
    process.exit(1)
  }

  console.log(`\nFound ${data.length} latest orders in Supabase:`)
  for (const o of data) {
    console.log(`- Order ID: ${o.id}`)
    console.log(`  Customer: ${o.customer_name} (${o.phone_number})`)
    console.log(`  Total: ₹${o.total}`)
    console.log(`  Status: ${o.status}`)
    console.log(`  Created At: ${o.created_at}`)
    console.log('---')
  }
}

run()
