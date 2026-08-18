import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * SERVER-SIDE ONLY: Agent Provisioning API Route
 * Uses SUPABASE_SERVICE_ROLE_KEY to safely create agent Auth users
 * without ever exposing the service key to the client browser bundle.
 */
export async function POST(req: Request) {
  try {
    const { id, name, username, password, whatsapp, coverageArea, vehicleType, deliveryRate } = await req.json()

    // Validation checks depending on whether it is an update or a new account creation
    const isUpdate = !!id
    if (isUpdate) {
      if (!name || !username || !whatsapp) {
        return NextResponse.json({ error: 'Missing required agent fields' }, { status: 400 })
      }
    } else {
      if (!name || !username || !password || !whatsapp) {
        return NextResponse.json({ error: 'Missing required agent fields' }, { status: 400 })
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cmwsffhenpckwkwgnmsy.supabase.co'
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_hZmCQNTdDAuysF3iU4IaYA_daEHVI8D'

    let supabaseAdmin: any = null
    try {
      supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      })
    } catch (initErr) {
      console.warn('Agent provision Supabase client init failed:', initErr)
      return NextResponse.json({ error: 'Database temporarily unavailable' }, { status: 500 })
    }

    // 0. Fail-closed Admin JWT Token Verification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: missing authorization token' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token)

    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized: invalid or expired token' }, { status: 401 })
    }

    if (user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin privilege required' }, { status: 403 })
    }

    const email = `${username.toLowerCase().trim()}@hfc-agents.com`
    let agentId = id

    if (isUpdate) {
      let finalId = id
      const isDummyId = id.startsWith('AGT-') || id.length < 36

      if (isDummyId) {
        // Recover legacy dummy ID
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
        const existingUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
        if (existingUser) {
          finalId = existingUser.id
        } else {
          // Create on the fly
          const { data: newAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: password || '123456',
            email_confirm: true,
            user_metadata: { role: 'agent', agent_name: name, username }
          })
          if (!createErr && newAuth?.user) {
            finalId = newAuth.user.id
          }
        }

        // Delete the old dummy ID agent row to prevent duplicate primary keys
        if (finalId !== id) {
          await supabaseAdmin.from('agents').delete().eq('id', id)
          agentId = finalId
        }
      }

      // Update metadata and credentials for the clean UUID
      const updateData: any = {
        email,
        user_metadata: {
          role: 'agent',
          agent_name: name,
          username,
        }
      }
      if (password && password.trim().length >= 4) {
        updateData.password = password
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(agentId, updateData)
      if (authError) {
        console.warn('Supabase Auth user update error:', authError.message)
        return NextResponse.json({ error: authError.message }, { status: 500 })
      }
    } else {
      // 1b. Create new Supabase Auth User with metadata claims
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: 'agent',
          agent_name: name,
          username,
        },
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          // Recover UUID by listing auth users and filtering by email
          const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers()
          let foundUser = null
          if (!listError && listData?.users) {
            foundUser = listData.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
          }
          if (foundUser) {
            agentId = foundUser.id
            // Also update the password and metadata for this recovered user
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(agentId, {
              password,
              user_metadata: {
                role: 'agent',
                agent_name: name,
                username,
              }
            })
            if (updateError) {
              console.warn('Failed to update credentials of recovered agent:', updateError.message)
            }
          } else {
            return NextResponse.json({ error: 'Agent username email already exists but could not be retrieved.' }, { status: 500 })
          }
        } else {
          console.warn('Supabase Auth user creation error:', authError.message)
          return NextResponse.json({ error: authError.message }, { status: 500 })
        }
      } else {
        agentId = authUser?.user?.id
      }
    }

    // 2. Insert/Upsert into public.agents database table (NO PASSWORD FIELD!)
    const { data: agentRow, error: dbError } = await supabaseAdmin
      .from('agents')
      .upsert({
        id: agentId,
        name,
        whatsapp,
        username,
        is_active: true,
        vehicle_type: vehicleType || 'Bike',
        coverage_area: coverageArea || 'Central',
        delivery_rate: deliveryRate !== undefined ? Number(deliveryRate) : 40.00,
      }, { onConflict: 'id' })
      .select()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      agent: agentRow ? agentRow[0] : null,
      message: `Agent ${name} provisioned/updated securely with role claims`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Provisioning/updating failed' }, { status: 500 })
  }
}
