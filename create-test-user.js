// Script to create a test user for game creation
require('dotenv').config();
const pgPromise = require('pg-promise')();
const bcrypt = require('bcrypt');

const db = pgPromise(process.env.DATABASE_URL);

async function createTestUser() {
  try {
    console.log('\n=== Creating Test User ===\n');
    
    const displayName = 'Test Player';
    const email = 'test@example.com';
    const password = 'test123';
    
    // Check if user already exists
    const existing = await db.oneOrNone('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) {
      console.log('User already exists!');
      console.log(`  ID: ${existing.id}`);
      console.log(`  Email: ${email}`);
      return;
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await db.one(
      `INSERT INTO users (email, display_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, created_at`,
      [email, displayName, passwordHash]
    );
    
    console.log('User created successfully!');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Display Name: ${user.display_name}`);
    console.log(`  Password: ${password} (for testing)`);
    console.log(`  Created: ${new Date(user.created_at).toLocaleString()}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createTestUser();

