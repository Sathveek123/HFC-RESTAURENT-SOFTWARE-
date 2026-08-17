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

// Check arguments as fallback
if (process.argv[2]) supabaseUrl = process.argv[2]
if (process.argv[3]) serviceKey = process.argv[3]

if (!supabaseUrl || !serviceKey) {
  console.error('\n❌ Error: Missing configuration parameters.')
  console.log('\nUsage:')
  console.log('  node supabase/create-admin.js [SUPABASE_URL] [SERVICE_ROLE_KEY]')
  console.log('\nOr add the following key inside your local .env.local file:')
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here\n')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
})

async function run() {
  const email = 'admin@hfcconsultancy.com'
  const username = 'admin'
  const password = '2026' // default passcode

  console.log('🔄 Connecting to Supabase at:', supabaseUrl)
  console.log(`🔄 Checking if user ${email} already exists...`)
  
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('❌ Failed to retrieve users list:', listError.message)
    process.exit(1)
  }

  const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

  if (existingUser) {
    console.log(`🔄 User already exists (UUID: ${existingUser.id}). Updating credentials...`)
    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: password,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        username: username
      }
    })

    if (updateError) {
      console.error('❌ Failed to update admin credentials:', updateError.message)
      process.exit(1)
    }
    console.log(`\n🎉 Success! Admin user ${email} has been updated and auto-confirmed.`)
    console.log(`   Username: ${username}`)
    console.log(`   Password: ${password}\n`)
  } else {
    console.log(`🔄 Admin user does not exist. Creating new account...`)
    const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        username: username
      }
    })

    if (createError) {
      console.error('❌ Failed to create admin user:', createError.message)
      process.exit(1)
    }
    console.log(`\n🎉 Success! Admin user ${email} has been created and auto-confirmed.`)
    console.log(`   Username: ${username}`)
    console.log(`   Password: ${password}\n`)
  }
}

run()
