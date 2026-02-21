#!/usr/bin/env node

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function runTests() {
  console.log('🧪 Running test suite...\n')
  
  try {
    const { stdout, stderr } = await execAsync('pnpm test --run', {
      env: { ...process.env, NODE_ENV: 'test' }
    })
    
    console.log(stdout)
    if (stderr) console.error(stderr)
    
    console.log('\n✅ All tests passed!')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Tests failed:')
    console.error(error.stdout || error.message)
    process.exit(1)
  }
}

runTests()
