import { PrismaClient, RolloverCapType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create a tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Company',
      slug: 'demo',
      timezone: 'America/New_York',
      settings: {},
    },
  })
  console.log('✅ Created tenant:', tenant.name)

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
      passwordHash: adminPasswordHash,
      tenantId: tenant.id,
      timezone: 'America/New_York',
    },
  })
  console.log('✅ Created admin user:', admin.email)

  // Create staff user
  const staffPasswordHash = await bcrypt.hash('staff123', 10)
  const staff = await prisma.user.upsert({
    where: { email: 'staff@example.com' },
    update: {},
    create: {
      email: 'staff@example.com',
      name: 'Staff User',
      role: 'STAFF',
      passwordHash: staffPasswordHash,
      tenantId: tenant.id,
      timezone: 'America/New_York',
    },
  })
  console.log('✅ Created staff user:', staff.email)

  // Create time categories
  const categories = [
    { name: 'Development', color: '#3b82f6', sortOrder: 1 },
    { name: 'Consultation', color: '#8b5cf6', sortOrder: 2 },
    { name: 'Support', color: '#10b981', sortOrder: 3 },
    { name: 'Documentation', color: '#f59e0b', sortOrder: 4 },
    { name: 'Meeting', color: '#ef4444', sortOrder: 5 },
  ]

  for (const cat of categories) {
    await prisma.timeCategory.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: cat.name,
        },
      },
      update: {},
      create: {
        ...cat,
        tenantId: tenant.id,
      },
    })
  }
  console.log('✅ Created time categories')

  // Create retainer templates
  const templates: Array<{
    name: string
    description: string
    includedHours: number
    ratePerHour: number
    rolloverEnabled: boolean
    rolloverCapType: RolloverCapType | null
    rolloverCapValue: number | null
    rolloverExpiryMonths: number | null
    overageTiers: Array<{ from: number; to: number | null; rate: number }>
  }> = [
    {
      name: 'Bronze',
      description: 'Entry-level support retainer',
      includedHours: 10,
      ratePerHour: 150,
      rolloverEnabled: true,
      rolloverCapType: RolloverCapType.PERCENTAGE,
      rolloverCapValue: 25,
      rolloverExpiryMonths: 3,
      overageTiers: [
        { from: 0, to: 5, rate: 175 },
        { from: 5, to: null, rate: 200 },
      ],
    },
    {
      name: 'Silver',
      description: 'Standard support retainer',
      includedHours: 20,
      ratePerHour: 140,
      rolloverEnabled: true,
      rolloverCapType: RolloverCapType.PERCENTAGE,
      rolloverCapValue: 50,
      rolloverExpiryMonths: 3,
      overageTiers: [
        { from: 0, to: 10, rate: 160 },
        { from: 10, to: null, rate: 180 },
      ],
    },
    {
      name: 'Gold',
      description: 'Premium support retainer',
      includedHours: 40,
      ratePerHour: 130,
      rolloverEnabled: true,
      rolloverCapType: RolloverCapType.PERCENTAGE,
      rolloverCapValue: 50,
      rolloverExpiryMonths: 6,
      overageTiers: [
        { from: 0, to: 20, rate: 150 },
        { from: 20, to: null, rate: 170 },
      ],
    },
  ]

  for (const template of templates) {
    await prisma.retainerTemplate.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: template.name,
        },
      },
      update: {},
      create: {
        ...template,
        tenantId: tenant.id,
      },
    })
  }
  console.log('✅ Created retainer templates')

  // Create sample clients
  const clients = [
    {
      companyName: 'Acme Corporation',
      primaryContactName: 'John Doe',
      email: 'john@acme.com',
      phone: '(555) 123-4567',
      billingEmail: 'billing@acme.com',
      timezone: 'America/New_York',
    },
    {
      companyName: 'Tech Startup Inc',
      primaryContactName: 'Jane Smith',
      email: 'jane@techstartup.com',
      phone: '(555) 987-6543',
      billingEmail: 'accounting@techstartup.com',
      timezone: 'America/Los_Angeles',
    },
  ]

  for (const client of clients) {
    await prisma.client.upsert({
      where: {
        tenantId_companyName: {
          tenantId: tenant.id,
          companyName: client.companyName,
        },
      },
      update: {},
      create: {
        ...client,
        tenantId: tenant.id,
      },
    })
  }
  console.log('✅ Created sample clients')

  console.log('🎉 Database seeded successfully!')
  console.log('\n📝 Test credentials:')
  console.log('   Admin: admin@example.com / admin123')
  console.log('   Staff: staff@example.com / staff123')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
