// Quick script to check games in database
require('dotenv').config();
const pgPromise = require('pg-promise')();

const db = pgPromise(process.env.DATABASE_URL);

async function checkGames() {
  try {
    console.log('\n=== Checking Games in Database ===\n');
    
    const games = await db.any('SELECT id, name, game_code, status, max_players, created_at FROM games ORDER BY created_at DESC LIMIT 10');
    
    if (games.length === 0) {
      console.log('No games found in database.');
    } else {
      console.log(`Found ${games.length} game(s):\n`);
      games.forEach((game, index) => {
        console.log(`${index + 1}. ${game.name}`);
        console.log(`   Code: ${game.game_code}`);
        console.log(`   Status: ${game.status}`);
        console.log(`   Max Players: ${game.max_players}`);
        console.log(`   Created: ${new Date(game.created_at).toLocaleString()}`);
        console.log(`   ID: ${game.id}\n`);
      });
    }
    
    const users = await db.any('SELECT id, display_name, email FROM users LIMIT 5');
    console.log(`\nUsers in database: ${users.length}`);
    if (users.length > 0) {
      users.forEach(user => {
        console.log(`  - ${user.display_name} (${user.email})`);
      });
    } else {
      console.log('  WARNING: No users found! You need to create a user first.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkGames();

