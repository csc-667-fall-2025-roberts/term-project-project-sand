# How to Verify Database Operations

This guide shows you multiple ways to check if data is being saved to your database.

---

## Method 1: Using the Verification Script (Easiest)

Run this command in your terminal:

```bash
node verify-database.js
```

This will show you:
- All users in the database
- All games
- All participants
- All chat messages
- All property ownerships
- All transactions

**Example output:**
```
1. Checking users table...
   Found 2 user(s):
   1. Nate (nateamoreno13@gmail.com) - ID: 42f5e18b-8fee-46a2-b260-7097d3420166
   2. Test Player (test@example.com) - ID: bfceed31-7d4d-447d-bf56-45697c49072b
```

---

## Method 2: Using pgAdmin (Visual/GUI)

1. **Open pgAdmin** (installed with PostgreSQL)

2. **Connect to your database:**
   - Expand "Servers" → "PostgreSQL" (or your server name)
   - Enter your password if prompted

3. **Navigate to your database:**
   - Expand "Databases" → "webopoly" → "Schemas" → "public" → "Tables"

4. **View the users table:**
   - Right-click on "users" table
   - Select "View/Edit Data" → "All Rows"
   - You'll see all users with their emails, display names, and IDs

5. **To check other tables:**
   - Repeat for "games", "game_participants", "chat_messages", "ownerships", "transactions"

---

## Method 3: Using psql Command Line

1. **Open Command Prompt or PowerShell**

2. **Connect to PostgreSQL:**
   ```bash
   psql -U postgres -d webopoly
   ```
   (Enter your password when prompted)

3. **Query the users table:**
   ```sql
   SELECT id, email, display_name, created_at FROM users;
   ```

4. **Query other tables:**
   ```sql
   -- See all games
   SELECT id, name, game_code, status FROM games;
   
   -- See all participants
   SELECT gp.*, u.display_name, g.name as game_name
   FROM game_participants gp
   JOIN users u ON gp.user_id = u.id
   JOIN games g ON gp.game_id = g.id;
   
   -- See all chat messages
   SELECT cm.*, u.display_name
   FROM chat_messages cm
   JOIN users u ON cm.user_id = u.id;
   
   -- See all ownerships
   SELECT o.*, t.name as tile_name, u.display_name
   FROM ownerships o
   JOIN tiles t ON o.tile_id = t.id
   JOIN game_participants gp ON o.participant_id = gp.id
   JOIN users u ON gp.user_id = u.id;
   ```

5. **Exit psql:**
   ```sql
   \q
   ```

---

## Method 4: Check Server Console Logs

When you run `npm run dev`, watch the terminal output. You should see log messages like:

**When signing up:**
```
[Auth] Signup successful: User Demo User (demo@example.com) created with ID abc-123-def
```

**When creating a game:**
```
[Lobby] Game created successfully: Demo Game (ABC123) with ID xyz-456-uvw
```

**When sending chat:**
```
[Game] Chat message saved: ID 789 in game xyz-456-uvw by user abc-123-def
```

**When buying property:**
```
[Game] Property purchase saved: Golden Gate Park at position 11 by participant 123 in game xyz-456-uvw
```

---

## Method 5: Test Flow - Create Account and Verify

### Step-by-Step Test:

1. **Start your server:**
   ```bash
   npm run dev
   ```

2. **Open browser to:** `http://localhost:3005/auth/signup`

3. **Create a new account:**
   - Display Name: "Test User 2"
   - Email: "test2@example.com"
   - Password: "test123"
   - Click "Create Account"

4. **Check the server console:**
   - You should see: `[Auth] Signup successful: User Test User 2 (test2@example.com) created with ID ...`

5. **Verify in database:**
   ```bash
   node verify-database.js
   ```
   - The new user should appear in the list

6. **Or check with SQL:**
   ```bash
   psql -U postgres -d webopoly -c "SELECT email, display_name FROM users WHERE email = 'test2@example.com';"
   ```

---

## Method 6: Quick SQL Queries (One-liners)

You can run these directly in Command Prompt/PowerShell:

```bash
# Check users
psql -U postgres -d webopoly -c "SELECT email, display_name, created_at FROM users ORDER BY created_at DESC LIMIT 5;"

# Check games
psql -U postgres -d webopoly -c "SELECT name, game_code, status FROM games ORDER BY created_at DESC LIMIT 5;"

# Check participants
psql -U postgres -d webopoly -c "SELECT COUNT(*) as total_participants FROM game_participants;"

# Check chat messages
psql -U postgres -d webopoly -c "SELECT COUNT(*) as total_messages FROM chat_messages;"

# Check ownerships
psql -U postgres -d webopoly -c "SELECT COUNT(*) as total_ownerships FROM ownerships;"
```

---

## What to Look For

### When Testing Signup:
- ✅ User appears in `users` table
- ✅ Console shows: `[Auth] Signup successful`
- ✅ Can log in with that account
- ✅ User ID is a valid UUID

### When Testing Game Creation:
- ✅ Game appears in `games` table
- ✅ Console shows: `[Lobby] Game created successfully`
- ✅ Game appears in lobby game list
- ✅ Game has a unique `game_code`

### When Testing Joining Game:
- ✅ Participant appears in `game_participants` table
- ✅ Participant has `cash: 1500`, `position: 0`
- ✅ Participant is linked to both `game_id` and `user_id`

### When Testing Chat:
- ✅ Message appears in `chat_messages` table
- ✅ Console shows: `[Game] Chat message saved`
- ✅ Message appears in game chat UI
- ✅ Message is linked to `game_id` and `user_id`

### When Testing Property Purchase:
- ✅ Ownership appears in `ownerships` table
- ✅ Transaction appears in `transactions` table
- ✅ Participant `cash` is updated
- ✅ Console shows: `[Game] Property purchase saved`

---

## Troubleshooting

**If signup doesn't save:**
- Check server console for errors
- Verify database connection (check `.env` file)
- Make sure PostgreSQL is running
- Check that migrations have been run (`npm run migrate:up`)

**If you don't see console logs:**
- Make sure you're looking at the terminal where `npm run dev` is running
- Check that the server restarted after code changes
- Rebuild: `npm run build:backend`

**If verification script shows 0 users:**
- Try creating a new account
- Check server console for errors
- Verify the signup route is being called (check browser network tab)

---

## Quick Test Checklist

Before your presentation, verify:

- [ ] Can create a user account (signup works)
- [ ] User appears in database (`node verify-database.js`)
- [ ] Can log in with created account
- [ ] Can create a game
- [ ] Game appears in database
- [ ] Can join a game
- [ ] Participant appears in database
- [ ] Can send chat message
- [ ] Message appears in database
- [ ] Can buy property
- [ ] Ownership and transaction appear in database

---

**Tip:** Run `node verify-database.js` before and after each test to see the changes!

