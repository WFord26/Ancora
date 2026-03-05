#!/usr/bin/env node

/**
 * Setup verification script for Ancora
 * Run with: node scripts/setup-check.js
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

function checkItem(name, check, fix) {
  try {
    process.stdout.write(`Checking ${name}... `)
    check()
    console.log(`${GREEN}✓${RESET}`)
    return true
  } catch (error) {
    console.log(`${RED}✗${RESET}`)
    if (fix) {
      console.log(`  ${YELLOW}→ ${fix}${RESET}`)
    } else {
      console.log(`  ${RED}→ ${error.message}${RESET}`)
    }
    return false
  }
}

console.log('\n🔍 Ancora Setup Verification\n')

let allChecks = true

// Check Node.js version
allChecks &= checkItem(
  'Node.js version (18+)',
  () => {
    const version = process.version.match(/^v(\d+)\./)[1]
    if (parseInt(version) < 18) {
      throw new Error(`Node.js ${version} found, but 18+ required`)
    }
  },
  'Install Node.js 18 or higher from https://nodejs.org/'
)

// Check for package.json
allChecks &= checkItem(
  'package.json exists',
  () => {
    if (!fs.existsSync('package.json')) {
      throw new Error('package.json not found')
    }
  }
)

// Check for node_modules
allChecks &= checkItem(
  'Dependencies installed',
  () => {
    if (!fs.existsSync('node_modules')) {
      throw new Error('node_modules not found')
    }
  },
  'Run: npm install'
)

// Check for .env file
allChecks &= checkItem(
  '.env file exists',
  () => {
    if (!fs.existsSync('.env')) {
      throw new Error('.env file not found')
    }
  },
  'Copy .env.example to .env and configure your environment variables'
)

// Check DATABASE_URL in .env
if (fs.existsSync('.env')) {
  allChecks &= checkItem(
    'DATABASE_URL configured',
    () => {
      const envContent = fs.readFileSync('.env', 'utf8')
      if (!envContent.includes('DATABASE_URL=') || envContent.includes('DATABASE_URL=""')) {
        throw new Error('DATABASE_URL not configured')
      }
    },
    'Set DATABASE_URL in .env to your PostgreSQL connection string'
  )

  allChecks &= checkItem(
    'NEXTAUTH_SECRET configured',
    () => {
      const envContent = fs.readFileSync('.env', 'utf8')
      if (!envContent.includes('NEXTAUTH_SECRET=') || 
          envContent.includes('NEXTAUTH_SECRET="your-secret-key-here-change-in-production"')) {
        throw new Error('NEXTAUTH_SECRET not configured')
      }
    },
    'Generate with: openssl rand -base64 32'
  )
}

// Check Prisma Client
allChecks &= checkItem(
  'Prisma Client generated',
  () => {
    if (!fs.existsSync('node_modules/.prisma/client')) {
      throw new Error('Prisma Client not generated')
    }
  },
  'Run: npm run db:generate'
)

// Check PostgreSQL connection (if .env exists)
if (fs.existsSync('.env')) {
  allChecks &= checkItem(
    'Database connection',
    () => {
      try {
        execSync('npx prisma db execute --stdin < /dev/null', { 
          stdio: 'ignore',
          timeout: 5000 
        })
      } catch (error) {
        throw new Error('Cannot connect to database')
      }
    },
    'Ensure PostgreSQL is running and DATABASE_URL is correct'
  )
}

console.log('\n' + '='.repeat(50))

if (allChecks) {
  console.log(`${GREEN}✓ All checks passed!${RESET}`)
  console.log('\nNext steps:')
  console.log('  1. Push schema: npm run db:push')
  console.log('  2. Seed database: npm run db:seed')
  console.log('  3. Start dev server: npm run dev')
} else {
  console.log(`${RED}✗ Some checks failed${RESET}`)
  console.log('\nPlease fix the issues above and run this script again.')
  process.exit(1)
}

console.log('')
