// Script to verify database operations are working
require('dotenv').config();
const pgPromise = require('pg-promise')();

const db = pgPromise(process.env.DATABASE_URL);

async function verifyDatabase() {
  try {
    console.log('\n=== Verifying Database Operations ===\n');

    // 1. Check users table
    console.log('1. Checking users table...');
    const users = await db.any('SELECT id, email, display_name, created_at FROM users ORDER BY created_at DESC LIMIT 5');
    console.log(`   Found ${users.length} user(s):`);
    users.forEach((user, i) => {
      console.log(`   ${i + 1}. ${user.display_name} (${user.email}) - ID: ${user.id}`);
    });
    if (users.length === 0) {
      console.log('   WARNING: No users found! Sign up should create users.');
    }

    // 2. Check games table
    console.log('\n2. Checking games table...');
    const games = await db.any('SELECT id, name, game_code, status, max_players, created_at FROM games ORDER BY created_at DESC LIMIT 5');
    console.log(`   Found ${games.length} game(s):`);
    games.forEach((game, i) => {
      console.log(`   ${i + 1}. ${game.name} (${game.game_code}) - Status: ${game.status} - ID: ${game.id}`);
    });
    if (games.length === 0) {
      console.log('   WARNING: No games found! Creating a game should save to database.');
    }

    // 3. Check game_participants table
    console.log('\n3. Checking game_participants table...');
    const participants = await db.any(`
      SELECT gp.*, u.display_name, g.name as game_name
      FROM game_participants gp
      JOIN users u ON gp.user_id = u.id
      JOIN games g ON gp.game_id = g.id
      ORDER BY gp.joined_at DESC
      LIMIT 5
    `);
    console.log(`   Found ${participants.length} participant(s):`);
    participants.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.display_name} in "${p.game_name}" - Cash: $${p.cash}, Position: ${p.position}`);
    });
    if (participants.length === 0) {
      console.log('   WARNING: No participants found! Joining a game should create participants.');
    }

    // 4. Check chat_messages table
    console.log('\n4. Checking chat_messages table...');
    const messages = await db.any(`
      SELECT cm.*, u.display_name, g.name as game_name
      FROM chat_messages cm
      JOIN users u ON cm.user_id = u.id
      LEFT JOIN games g ON cm.game_id = g.id
      ORDER BY cm.created_at DESC
      LIMIT 5
    `);
    console.log(`   Found ${messages.length} message(s):`);
    messages.forEach((msg, i) => {
      const gameInfo = msg.game_name ? ` in "${msg.game_name}"` : ' (lobby)';
      console.log(`   ${i + 1}. ${msg.display_name}${gameInfo}: "${msg.message.substring(0, 50)}${msg.message.length > 50 ? '...' : ''}"`);
    });
    if (messages.length === 0) {
      console.log('   WARNING: No messages found! Sending chat should save messages.');
    }

    // 5. Check ownerships table
    console.log('\n5. Checking ownerships table...');
    const ownerships = await db.any(`
      SELECT o.*, t.name as tile_name, t.position, u.display_name, g.name as game_name
      FROM ownerships o
      JOIN tiles t ON o.tile_id = t.id
      JOIN game_participants gp ON o.participant_id = gp.id
      JOIN users u ON gp.user_id = u.id
      JOIN games g ON o.game_id = g.id
      ORDER BY o.created_at DESC
      LIMIT 5
    `);
    console.log(`   Found ${ownerships.length} ownership(s):`);
    ownerships.forEach((own, i) => {
      console.log(`   ${i + 1}. ${own.display_name} owns "${own.tile_name}" (position ${own.position}) in "${own.game_name}"`);
    });
    if (ownerships.length === 0) {
      console.log('   WARNING: No ownerships found! Buying properties should create ownerships.');
    }

    // 6. Check transactions table
    console.log('\n6. Checking transactions table...');
    const transactions = await db.any(`
      SELECT t.*, u.display_name, g.name as game_name
      FROM transactions t
      JOIN game_participants gp ON t.from_participant_id = gp.id
      JOIN users u ON gp.user_id = u.id
      JOIN games g ON t.game_id = g.id
      ORDER BY t.created_at DESC
      LIMIT 5
    `);
    console.log(`   Found ${transactions.length} transaction(s):`);
    transactions.forEach((tx, i) => {
      const amount = tx.amount >= 0 ? `+$${tx.amount}` : `-$${Math.abs(tx.amount)}`;
      console.log(`   ${i + 1}. ${tx.display_name} in "${tx.game_name}": ${amount} - ${tx.description || tx.transaction_type}`);
    });
    if (transactions.length === 0) {
      console.log('   WARNING: No transactions found! Purchases/taxes should create transactions.');
    }

    console.log('\n=== Verification Complete ===\n');
    console.log('Summary:');
    console.log(`  - Users: ${users.length}`);
    console.log(`  - Games: ${games.length}`);
    console.log(`  - Participants: ${participants.length}`);
    console.log(`  - Messages: ${messages.length}`);
    console.log(`  - Ownerships: ${ownerships.length}`);
    console.log(`  - Transactions: ${transactions.length}\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error verifying database:', error);
    process.exit(1);
  }
}

verifyDatabase();

