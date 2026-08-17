const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 1. Attempt to load env vars from .env.local
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
        // Remove quotes if present
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1)
        }
        if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') serviceKey = val
      }
    }
  }
} catch (e) {
  console.warn('Could not read .env.local file:', e.message)
}

// Check arguments as fallback
if (process.argv[2]) supabaseUrl = process.argv[2]
if (process.argv[3]) serviceKey = process.argv[3]

if (!supabaseUrl || !serviceKey) {
  console.error('\n❌ Error: Missing configuration parameters.')
  console.log('\nUsage:')
  console.log('  node supabase/clear-agents.js [SUPABASE_URL] [SERVICE_ROLE_KEY]')
  console.log('\nOr add the following key inside your local .env.local file:')
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here\n')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
})

async function run() {
  console.log('🔄 Connecting to Supabase at:', supabaseUrl)
  
  // 1. Fetch all Auth Users to clear them
  console.log('🔄 Fetching auth user accounts list...')
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  
  if (listError) {
    console.error('❌ Failed to retrieve users from Auth container:', listError.message)
    process.exit(1)
  }

  const agentUsers = users.filter(u => 
    u.email?.endsWith('@hfc-agents.com') || 
    u.user_metadata?.role === 'agent'
  )

  console.log(`✓ Found ${agentUsers.length} agent account(s) inside Supabase Auth.`)

  // 2. Delete Auth Users in loop
  for (const user of agentUsers) {
    console.log(`🔄 Deleting auth user: ${user.email} (UUID: ${user.id})...`)
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) {
      console.error(`❌ Failed to delete auth user ${user.email}:`, error.message)
    } else {
      console.log(`✓ Deleted auth user ${user.email}`)
    }
  }

  // 3. Clear public.agents table
  console.log('🔄 Clearing the public.agents database table...')
  const { error: dbError } = await supabase
    .from('agents')
    .delete()
    .neq('id', 'dummy-non-matching-id') // deletes all rows

  if (dbError) {
    console.error('❌ Database agents table truncation failed:', dbError.message)
  } else {
    console.log('✓ Successfully emptied the public.agents database table!')
  }

  console.log('\n🎉 Clean-up complete! You have a fresh slate to create new agents.')
}

run()
