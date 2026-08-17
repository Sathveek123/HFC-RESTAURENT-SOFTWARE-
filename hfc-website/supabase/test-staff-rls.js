const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load env vars
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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
        if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') anonKey = val
      }
    }
  }
} catch (e) {}

if (!supabaseUrl || !anonKey) {
  console.error('❌ Error: Missing configuration parameters in env.')
  process.exit(1)
}

// Initialize Supabase as an unauthenticated standard anonymous client
const supabase = createClient(supabaseUrl, anonKey)

async function testRLS() {
  console.log('📡 Testing RLS policies from an anonymous client context...')

  // 1. Try reading the kitchen_staff master list (should allow selecting names and statuses since SELECT is enabled for authenticated, but wait, anon doesn't have auth headers unless logged in)
  console.log('\n--- 1. SELECT * FROM public.kitchen_staff ---')
  const { data: staff, error: staffErr } = await supabase
    .from('kitchen_staff')
    .select('*')
  
  if (staffErr) {
    console.log('❌ staff select failed:', staffErr.message)
  } else {
    console.log('✓ staff select result (should have no PIN column):', staff)
  }

  // 2. Try reading the kitchen_staff_credentials table (should return EMPTY array or fail because RLS is active with ZERO select policies!)
  console.log('\n--- 2. SELECT * FROM public.kitchen_staff_credentials ---')
  const { data: creds, error: credsErr } = await supabase
    .from('kitchen_staff_credentials')
    .select('*')

  if (credsErr) {
    console.log('✓ creds select blocked correctly:', credsErr.message)
  } else {
    console.log('🔍 creds select result (MUST be empty/null to be secure):', creds)
  }

  // 3. Try executing pin verification RPC
  console.log('\n--- 3. RPC public.verify_staff_pin ---')
  const { data: rpcResult, error: rpcErr } = await supabase
    .rpc('verify_staff_pin', {
      p_staff_id: 'staff-sathveek',
      p_pin: '1234'
    })
  
  if (rpcErr) {
    console.log('❌ RPC execute failed (anon role cannot execute authenticated RPC, which is correct):', rpcErr.message)
  } else {
    console.log('✓ RPC execute result (should be verified):', rpcResult)
  }
}

testRLS()
