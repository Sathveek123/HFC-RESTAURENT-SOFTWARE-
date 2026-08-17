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
  console.log('🔄 Checking admin user accounts in Supabase...')
  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  if (error) {
    console.error('❌ Error listing users:', error.message)
    process.exit(1)
  }

  const admins = users.filter(u => 
    u.email?.includes('admin') || 
    u.user_metadata?.role === 'admin'
  )

  console.log(`\nFound ${admins.length} admin accounts in Supabase Auth:`)
  for (const admin of admins) {
    console.log(`- Email: ${admin.email}`)
    console.log(`  UUID: ${admin.id}`)
    console.log(`  Role Claim: ${admin.user_metadata?.role}`)
    console.log(`  Email Confirmed: ${!!admin.email_confirmed_at}`)
    console.log(`  Last Sign In: ${admin.last_sign_in_at || 'Never'}`)
    console.log('---')
  }
}

run()
