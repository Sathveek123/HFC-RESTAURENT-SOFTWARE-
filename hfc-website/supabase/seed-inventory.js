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

const defaultIngredients = [
  { id: 'ing-chicken', name: 'Fresh Chicken', unit: 'KG', category: 'Protein', cost_per_unit: 250.00, min_stock: 5.00 },
  { id: 'ing-rice', name: 'Basmati Rice', unit: 'KG', category: 'Dry', cost_per_unit: 80.00, min_stock: 10.00 },
  { id: 'ing-oil', name: 'Vegetable Oil', unit: 'L', category: 'Oil', cost_per_unit: 130.00, min_stock: 5.00 },
  { id: 'ing-paneer', name: 'Fresh Paneer', unit: 'KG', category: 'Protein', cost_per_unit: 320.00, min_stock: 3.00 },
  { id: 'ing-lentils', name: 'Black Lentils (Urad)', unit: 'KG', category: 'Dry', cost_per_unit: 110.00, min_stock: 4.00 },
  { id: 'ing-spices', name: 'Garam Masala Blend', unit: 'KG', category: 'Spices', cost_per_unit: 450.00, min_stock: 1.00 }
]

const defaultRecipes = [
  // mc-1 Butter Chicken
  { id: 'rec-mc-1-chicken', product_id: 'mc-1', product_name: 'Butter Chicken', ingredient_id: 'ing-chicken', quantity_per_unit: 0.2500, unit: 'KG' },
  { id: 'rec-mc-1-oil', product_id: 'mc-1', product_name: 'Butter Chicken', ingredient_id: 'ing-oil', quantity_per_unit: 0.0500, unit: 'L' },
  { id: 'rec-mc-1-spices', product_id: 'mc-1', product_name: 'Butter Chicken', ingredient_id: 'ing-spices', quantity_per_unit: 0.0150, unit: 'KG' },
  
  // mc-2 Dal Makhani
  { id: 'rec-mc-2-lentils', product_id: 'mc-2', product_name: 'Dal Makhani', ingredient_id: 'ing-lentils', quantity_per_unit: 0.1500, unit: 'KG' },
  { id: 'rec-mc-2-oil', product_id: 'mc-2', product_name: 'Dal Makhani', ingredient_id: 'ing-oil', quantity_per_unit: 0.0300, unit: 'L' },
  
  // st-1 Paneer Tikka
  { id: 'rec-st-1-paneer', product_id: 'st-1', product_name: 'Paneer Tikka', ingredient_id: 'ing-paneer', quantity_per_unit: 0.2000, unit: 'KG' },
  { id: 'rec-st-1-oil', product_id: 'st-1', product_name: 'Paneer Tikka', ingredient_id: 'ing-oil', quantity_per_unit: 0.0200, unit: 'L' }
]

const defaultStaff = [
  { id: 'staff-sathveek', name: 'Sathveek', is_active: true },
  { id: 'staff-raju', name: 'Raju', is_active: true },
  { id: 'staff-chef', name: 'Kitchen Chef', is_active: true }
]

// Credentials seeded securely
const defaultCredentials = [
  { staff_id: 'staff-sathveek', pin: '1234' },
  { staff_id: 'staff-raju', pin: '5678' },
  { staff_id: 'staff-chef', pin: '2026' }
]

async function run() {
  console.log('🔄 Pre-seeding ingredients...')
  for (const ing of defaultIngredients) {
    const { error } = await supabase
      .from('ingredients')
      .upsert(ing, { onConflict: 'id' })
    if (error) {
      console.error(`❌ Failed to seed ingredient "${ing.name}":`, error.message)
    } else {
      console.log(`✓ Seeded ingredient "${ing.name}"`)
    }
  }

  console.log('\n🔄 Pre-seeding default recipes...')
  for (const rec of defaultRecipes) {
    const { error } = await supabase
      .from('recipes')
      .upsert(rec, { onConflict: 'id' })
    if (error) {
      console.error(`❌ Failed to seed recipe for "${rec.product_name}":`, error.message)
    } else {
      console.log(`✓ Seeded recipe mapping for "${rec.product_name}" -> "${rec.ingredient_id}"`)
    }
  }

  console.log('\n🔄 Pre-seeding default kitchen staff profiles...')
  for (const staff of defaultStaff) {
    const { error } = await supabase
      .from('kitchen_staff')
      .upsert(staff, { onConflict: 'id' })
    if (error) {
      console.error(`❌ Failed to seed staff profile "${staff.name}":`, error.message)
    } else {
      console.log(`✓ Seeded staff profile "${staff.name}"`)
    }
  }

  console.log('\n🔄 Pre-seeding default kitchen staff credentials...')
  for (const cred of defaultCredentials) {
    const { error } = await supabase
      .from('kitchen_staff_credentials')
      .upsert(cred, { onConflict: 'staff_id' })
    if (error) {
      console.error(`❌ Failed to seed credentials for "${cred.staff_id}":`, error.message)
    } else {
      console.log(`✓ Seeded staff credentials for "${cred.staff_id}"`)
    }
  }

  console.log('\n🎉 Pre-seeding completed successfully!')
}

run()
