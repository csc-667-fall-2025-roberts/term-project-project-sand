# Troubleshooting Guide

## PostgreSQL Connection Error

If you get this error:
```
psql: error: connection to server at "localhost" (::1), port 5432 failed: Connection refused
Is the server running on that host and accepting TCP/IP connections?
```

**What this means:**
- You have `psql` (the PostgreSQL **client**) installed ✅
- But the PostgreSQL **server** is NOT running ❌
- `psql` is just a tool to connect to the server - you need the server running too!

**Think of it like this:**
- `psql` = the phone (client) - you have this ✅
- PostgreSQL server = the person you're calling (server) - need to start this ❌
- You can't make a call if the other person isn't available!

**Quick Fix (Windows):**
1. Press `Win + R`
2. Type `services.msc` and press Enter
3. Find **"postgresql-x64-18"** (or similar version number)
4. Right-click → **Start**
5. Try `psql -U postgres` again

Follow these detailed steps below:

---

## Step 1: Check if PostgreSQL is Installed

### On Windows:
1. Open **Services** (Press `Win + R`, type `services.msc`, press Enter)
2. Look for **"postgresql"** or **"PostgreSQL"** in the list
3. If you see it, go to Step 2
4. If you DON'T see it, PostgreSQL is not installed - go to **Installation** section below

### On Mac:
1. Open **Terminal**
2. Run: `brew services list` (if using Homebrew)
3. Look for `postgresql` in the list
4. Or check: `psql --version`

### On Linux:
1. Open **Terminal**
2. Run: `sudo systemctl status postgresql`
3. Or check: `psql --version`

---

## Step 2: Start PostgreSQL Service

### On Windows:

**Method 1: Using Services (Easiest)**
1. Press `Win + R`
2. Type `services.msc` and press Enter
3. Find **"postgresql-x64-XX"** or **"PostgreSQL"** (where XX is version number)
4. Right-click on it → **Start**
5. If it's already running, right-click → **Restart**

**Method 2: Using Command Prompt (as Administrator)**
```powershell
# Find the service name first
sc query | findstr postgresql

# Then start it (replace SERVICE_NAME with actual name)
net start SERVICE_NAME
```

**Method 3: Using pg_ctl (if installed)**
```powershell
# Navigate to PostgreSQL bin directory (usually in Program Files)
cd "C:\Program Files\PostgreSQL\15\bin"

# Start the service
pg_ctl start -D "C:\Program Files\PostgreSQL\15\data"
```

### On Mac (Homebrew):
```bash
brew services start postgresql@15
# Or if you have a different version:
brew services start postgresql
```

### On Linux:
```bash
sudo systemctl start postgresql
# Or for specific version:
sudo systemctl start postgresql@15-main
```

---

## Step 3: Verify PostgreSQL is Running

### Test Connection:
```bash
psql -U postgres
```

If it asks for a password and connects, you're good! Type `\q` to exit.

### Check Service Status:

**Windows:**
```powershell
sc query postgresql-x64-15
# Should show "RUNNING"
```

**Mac/Linux:**
```bash
# Mac (Homebrew)
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql
```

---

## Step 4: Verify .env File

Make sure your `.env` file exists and has the correct connection string:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/webopoly
```

**Important:**
- Replace `YOUR_PASSWORD` with your actual PostgreSQL password
- The password is the one you set when installing PostgreSQL
- If you forgot it, you may need to reset it (see below)

---

## Step 5: Test Database Connection

Run the verification script:
```bash
node verify-database.js
```

If it connects successfully, you'll see database contents. If not, check the error message.

---

## Installation (If PostgreSQL is Not Installed)

### Windows:
1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Run the installer
3. **Remember the password you set for the `postgres` user!**
4. Default port is `5432` (keep this)
5. After installation, start the service (see Step 2)

### Mac:
```bash
# Using Homebrew
brew install postgresql@15
brew services start postgresql@15
```

### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

---

## Common Issues

### Issue 1: "Password authentication failed"

**Solution:**
- Check your `.env` file has the correct password
- Try resetting the PostgreSQL password (see below)

### Issue 2: "Database 'webopoly' does not exist"

**Solution:**
- Run migrations: `npm run migrate:up`
- Or create database manually:
  ```bash
  psql -U postgres
  CREATE DATABASE webopoly;
  \q
  ```

### Issue 3: "Port 5432 is already in use"

**Solution:**
- Another PostgreSQL instance might be running
- Check what's using port 5432:
  ```powershell
  # Windows
  netstat -ano | findstr :5432
  
  # Mac/Linux
  lsof -i :5432
  ```
- Stop the conflicting service or change PostgreSQL port

### Issue 4: "Service won't start"

**Solution:**
- Check PostgreSQL logs for errors:
  - **Windows:** `C:\Program Files\PostgreSQL\15\data\log\`
  - **Mac:** `/usr/local/var/log/postgresql.log`
  - **Linux:** `/var/log/postgresql/postgresql-15-main.log`
- Try restarting your computer
- Reinstall PostgreSQL if necessary

---

## Resetting PostgreSQL Password (If Forgotten)

### Windows:
1. Stop PostgreSQL service
2. Edit `pg_hba.conf` (usually in `C:\Program Files\PostgreSQL\15\data\`)
3. Change `md5` to `trust` for local connections
4. Start PostgreSQL service
5. Connect: `psql -U postgres`
6. Change password: `ALTER USER postgres PASSWORD 'newpassword';`
7. Change `pg_hba.conf` back to `md5`
8. Restart service

### Mac/Linux:
Similar process - edit `pg_hba.conf` in PostgreSQL data directory.

---

## Quick Checklist

Before running the app, make sure:
- [ ] PostgreSQL service is **RUNNING**
- [ ] `.env` file exists with correct `DATABASE_URL`
- [ ] Password in `.env` matches your PostgreSQL password
- [ ] Database `webopoly` exists (run `npm run migrate:up` if not)
- [ ] Migrations have been run (`npm run migrate:up`)

---

## Build Error: "xcopy: not found" or "Syntax error: end of file unexpected"

If you get errors like:
```
sh: 1: xcopy: not found
sh: 1: Syntax error: end of file unexpected (expecting "then")
```

**This means you're on Linux/Mac, but the scripts use Windows commands!**

### Solution:

The scripts have been updated to be cross-platform. Make sure you have the latest code:

1. **Pull the latest changes:**
   ```bash
   git pull
   ```

2. **Install dependencies (including new cross-platform tools):**
   ```bash
   npm install
   ```

3. **Try building again:**
   ```bash
   npm run build
   ```

The scripts now use `shx` which works on Windows, Linux, and Mac.

---

## Migration Error: "does not provide an export named 'register'"

If you get this error when running `npm run migrate:up`:
```
SyntaxError: The requested module 'node:module' does not provide an export named 'register'
```

**This means your Node.js version is too old!**

### Solution:

1. **Check your Node.js version:**
   ```bash
   node --version
   ```

2. **You need Node.js version 20.6.0 or higher** (or Node.js 18.17.0+)

3. **Update Node.js:**
   - Download latest LTS from: https://nodejs.org/
   - Or use nvm (Node Version Manager):
     ```bash
     # Install nvm first, then:
     nvm install 20
     nvm use 20
     ```

4. **After updating, try again:**
   ```bash
   npm run migrate:up
   ```

### Alternative: Use ts-node instead of tsx

If you can't update Node.js, you can modify `package.json`:

```json
"migrate:up": "node --require ts-node/register node_modules/node-pg-migrate/bin/node-pg-migrate up"
```

But **updating Node.js is the recommended solution**.

---

## Still Having Issues?

1. **Check PostgreSQL logs** for specific error messages
2. **Verify installation** - make sure PostgreSQL is actually installed
3. **Check firewall** - Windows Firewall might be blocking port 5432
4. **Try different connection method** - some systems use `127.0.0.1` instead of `localhost`
5. **Check Node.js version** - must be 18.17.0+ or 20.6.0+
6. **Contact team** - share the exact error message you're seeing

---

## Quick Test Commands

```bash
# Test PostgreSQL connection
psql -U postgres -d webopoly

# Check if service is running (Windows)
sc query postgresql-x64-15

# Check if service is running (Mac/Linux)
sudo systemctl status postgresql

# List all databases
psql -U postgres -c "\l"

# Check if webopoly database exists
psql -U postgres -c "\l" | grep webopoly
```

