# Database Setup Guide for Webopoly

This guide will help you set up PostgreSQL for your Webopoly project.

## Step 1: Install PostgreSQL

### Option A: Download PostgreSQL (Recommended for Windows)

1. **Download PostgreSQL:**
   - Go to https://www.postgresql.org/download/windows/
   - Download the PostgreSQL installer (latest version recommended)
   - Or use: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

2. **Install PostgreSQL:**
   - Run the installer
   - During installation, remember the password you set for the `postgres` user
   - Default port is `5432` (keep this unless you have a conflict)
   - Complete the installation

3. **Verify Installation:**
   - Open Command Prompt or PowerShell
   - Run: `psql --version`
   - If you see a version number, PostgreSQL is installed!

### Option B: Use Docker (Alternative)

If you have Docker installed:

```bash
docker run --name webopoly-db -e POSTGRES_PASSWORD=yourpassword -e POSTGRES_DB=webopoly -p 5432:5432 -d postgres
```

Then use: `postgresql://postgres:yourpassword@localhost:5432/webopoly`

## Step 2: Create Your Database

### Using pgAdmin (GUI - Recommended for beginners)

1. Open **pgAdmin** (installed with PostgreSQL)
2. Connect to your PostgreSQL server (use the password you set during installation)
3. Right-click on "Databases" → "Create" → "Database"
4. Name it: `webopoly`
5. Click "Save"

### Using Command Line (psql)

1. Open Command Prompt or PowerShell
2. Connect to PostgreSQL:
   ```bash
   psql -U postgres
   ```
   (Enter your password when prompted)

3. Create the database:
   ```sql
   CREATE DATABASE webopoly;
   ```

4. Exit psql:
   ```sql
   \q
   ```

## Step 3: Create Your .env File

1. **Copy the example file:**
   - Copy `.env.example` to `.env` in your project root
   - Or create a new `.env` file

2. **Edit the DATABASE_URL:**
   ```
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/webopoly
   ```

   Replace:
   - `postgres` with your PostgreSQL username (usually `postgres`)
   - `YOUR_PASSWORD` with your PostgreSQL password
   - `webopoly` with your database name (if you used a different name)

   **Example:**
   ```
   DATABASE_URL=postgresql://postgres:mypassword123@localhost:5432/webopoly
   ```

## Step 4: Run Migrations

Once your `.env` file is set up:

1. **Run migrations to create all tables:**
   ```bash
   npm run migrate:up
   ```

2. **Verify it worked:**
   - You should see messages about each migration running
   - No errors should appear

3. **Test rollback (optional):**
   ```bash
   npm run migrate:down
   npm run migrate:up
   ```

## Step 5: Verify Your Setup

You can verify your database is set up correctly by:

1. **Using pgAdmin:**
   - Open pgAdmin
   - Navigate to `webopoly` database
   - Check the "Schemas" → "public" → "Tables"
   - You should see all your tables: `users`, `games`, `game_participants`, etc.

2. **Using psql:**
   ```bash
   psql -U postgres -d webopoly
   ```
   Then:
   ```sql
   \dt  -- Lists all tables
   \q   -- Exit
   ```

## Troubleshooting

### "Connection refused" or "Cannot connect"
- Make sure PostgreSQL service is running
- On Windows: Check Services (search "Services" in Start menu) and start "postgresql-x64" service
- Verify your DATABASE_URL is correct

### "Database does not exist"
- Make sure you created the `webopoly` database (Step 2)
- Check the database name in your DATABASE_URL matches

### "Password authentication failed"
- Double-check your password in the DATABASE_URL
- Make sure there are no extra spaces or special characters that need escaping

### "psql: command not found"
- PostgreSQL might not be in your PATH
- Try using pgAdmin instead, or add PostgreSQL's bin folder to your PATH

## Quick Reference

**Connection String Format:**
```
postgresql://[username]:[password]@[host]:[port]/[database]
```

**Common Defaults:**
- Username: `postgres`
- Host: `localhost`
- Port: `5432`
- Database: `webopoly` (you create this)

## Next Steps

Once your database is set up:
1. Run `npm run migrate:up` to create all tables
2. Start your server: `npm run dev` or `npm start`
3. Test by creating a user account (signup page)
4. Test by creating a game (lobby page)

Good luck with your presentation!

