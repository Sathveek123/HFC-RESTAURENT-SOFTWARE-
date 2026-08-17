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

async function clearTransactions() {
  console.log('🔄 Wiping existing transactional inventory data to start validation from scratch...')
  
  // Wipe kitchen_closing
  const { error: err1 } = await supabase.from('kitchen_closing').delete().neq('id', '')
  if (err1) console.error('❌ Failed to clear kitchen_closing:', err1.message)
  else console.log('✓ kitchen_closing table cleared')

  // Wipe stock_entries
  const { error: err2 } = await supabase.from('stock_entries').delete().neq('id', '')
  if (err2) console.error('❌ Failed to clear stock_entries:', err2.message)
  else console.log('✓ stock_entries table cleared')

  // Wipe daily_stock_summary
  const { error: err3 } = await supabase.from('daily_stock_summary').delete().neq('id', '')
  if (err3) console.error('❌ Failed to clear daily_stock_summary:', err3.message)
  else console.log('✓ daily_stock_summary table cleared')

  console.log('🎉 Wiping completed! Inventory tables are completely clean and ready.')
}

clearTransactions()
