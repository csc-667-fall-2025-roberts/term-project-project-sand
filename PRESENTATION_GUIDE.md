# Milestone 4 Presentation Guide

This guide provides step-by-step instructions for presenting the Webopoly application during the Milestone 4 in-class demonstration.

---

## Prerequisites

Before starting, make sure you have:

1. **Node.js installed** (version 16 or higher)
   - Check with: `node --version`
   - Download from: https://nodejs.org/

2. **PostgreSQL installed and running**
   - Check if running: Open pgAdmin or check services
   - Default port: 5432
   - Default username: postgres
   - You'll need your PostgreSQL password
   - Create database named webopoly if needed

3. **Git repository cloned** (if working from a shared repo)
   - All code files should be present

4. **Database credentials**
   - Your `.env` file should have the correct `DATABASE_URL`
   - Format: `postgresql://postgres:YOUR_PASSWORD@localhost:5432/webopoly`

---

## Step 1: Initial Setup (Do This Before Class)

### 1.1 Navigate to Project Directory

```bash
cd path/to/term-project-project-sand-1
```

### 1.2 Install Dependencies

```bash
npm install
```

This installs all required packages (Express, PostgreSQL, Tailwind CSS, etc.)

### 1.3 Verify Database Connection

Check your `.env` file exists and has the correct database URL:

```bash
# On Windows (PowerShell)
type .env

# On Mac/Linux
cat .env
```

Should show:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/webopoly
```

### 1.4 Run Database Migrations

This creates all the database tables:

```bash
npm run migrate:up
```

**Expected output:** Should show migration files being executed without errors.

**If you get errors:**
- Make sure PostgreSQL is running
- Check your password in `.env` is correct
- Verify the database `webopoly` exists (create it in pgAdmin if needed)

### 1.5 Create Test User (Optional but Recommended)

Create a test user account for demonstration:

```bash
node create-test-user.js
```

This creates:
- Email: `test@example.com`
- Password: `test123`
- Display Name: `Test Player`

### 1.6 Build the Application

Compile TypeScript and build CSS:

```bash
npm run build
```

This runs:
- `npm run build:css` - Compiles Tailwind CSS
- `npm run build:backend` - Compiles TypeScript backend
- `npm run build:frontend` - Compiles TypeScript frontend

---

## Step 2: Starting the Application

### 2.1 Start the Development Server

```bash
npm run dev
```

**Expected output:**
```
Server running on http://localhost:3005
Database connected successfully
```

**Keep this terminal window open!** The server must stay running.

### 2.2 Verify Application is Running

Open your browser and navigate to:
```
http://localhost:3005
```

You should be redirected to the login page.

---

## Step 3: Presentation Flow (5 Minutes)

### 3.1 Introduction - Styling Choice (30 seconds)

**What to say:**
> "We chose Tailwind CSS for our styling approach. We selected it because it allows for fast development with utility classes, provides a consistent design system, and is easy to maintain across all pages."

**What to show:**
- Briefly mention that all pages use Tailwind utility classes
- Point out the consistent warm gradient theme (amber, orange, pink)

---

### 3.2 Live Application Demo (3 minutes)

#### A. Navigate Through All Styled Pages

**Login Page** (`http://localhost:3005/auth/login`)
- Show the warm gradient background
- Point out the styled form inputs
- Show the gradient "WEBOPOLY" logo
- Mention the "Sign up" link at the bottom

**Signup Page** (`http://localhost:3005/auth/signup`)
- Show consistent styling with login page
- Point out the same gradient theme
- Show the form layout

**Lobby Page** (`http://localhost:3005/lobby`)
- Show the gradient header with user info
- Point out the "Create Game" form
- Show the styled game list
- Mention the logout button

**Game Page** (`http://localhost:3005/games/:id`)
- Show the complete board mockup
- Point out the game board with properties
- Show the sidebars (Current Spot, Actions, Players, Properties)
- Point out the chat area
- Show the "Back to Lobby" button

**Error Page** (if possible to demonstrate)
- Navigate to a non-existent route like `/games/invalid-id`
- Show the styled error page

#### B. Demonstrate Database Connection

**Create a User Account:**
1. Go to signup page
2. Fill in the form:
   - Display Name: "Demo User"
   - Email: "demo@example.com"
   - Password: "demo123"
3. Click "Sign Up"
4. **Say:** "This creates a new user record in the database"

**Log In:**
1. Use the account you just created (or use test@example.com / test123)
2. Click "Log In"
3. **Say:** "This queries the database to verify credentials"

**Create a Game:**
1. In the lobby, fill out "Create Game" form:
   - Game Name: "Demo Game"
   - Max Players: 4
2. Click "Create Game"
3. **Say:** "This inserts a new game record into the database"
4. Point out the game appears in the "Available Games" list
5. **Say:** "The game list is populated from the database"

**Join a Game:**
1. Click "Join Game" on any available game
2. **Say:** "This adds a participant record linking the user to the game"
3. Show the game page loads with game data from the database

**Show Chat (if time permits):**
1. Type a message in the chat
2. Click "Send"
3. **Say:** "This saves the message to the chat_messages table"

#### C. Show Styling Consistency

**Point out:**
- Same gradient header on all pages (amber → orange → pink)
- Same button styling (gradient buttons with hover effects)
- Same form input styling (bordered, rounded, with focus states)
- Same card/container styling throughout

---

### 3.3 Quick Code Look (1 minute)

**Open your code editor and show:**

**1. Tailwind Setup** (`src/styles/input.css`)
- Show the `@tailwind` directives
- Show custom component classes (`.btn-primary`, `.card`, etc.)
- **Say:** "This is our Tailwind configuration with custom components"

**2. Example Template** (e.g., `src/backend/views/login.ejs`)
- Show Tailwind utility classes in action
- Point out classes like `bg-gradient-to-br`, `from-amber-50`, `rounded-lg`
- **Say:** "We use utility classes directly in our templates for consistent styling"

**3. Highlight One Styling Choice**
- **Option 1:** "We're proud of our warm gradient theme that creates a cohesive visual experience"
- **Option 2:** "Our button gradients provide clear visual feedback with hover states"
- **Option 3:** "The game board mockup uses CSS Grid for a responsive layout"

---

### 3.4 Wrap Up (30 seconds)

**One Challenge:**
- **Example 1:** "Getting the board mockup to display correctly with the grid layout was challenging"
- **Example 2:** "Ensuring consistent styling across all five pages required careful planning"
- **Example 3:** "Setting up migrations with proper foreign keys required multiple iterations"

**How We Solved It:**
- **Example 1:** "We used CSS Grid with absolute positioning for the center logo"
- **Example 2:** "We created a consistent color system using Tailwind's gradient utilities"
- **Example 3:** "We tested migrations up and down multiple times to ensure they worked correctly"

---

## Step 4: Troubleshooting

### If the Server Won't Start

**Error: "Port 3005 already in use"**
```bash
# Find and kill the process (Windows)
netstat -ano | findstr :3005
taskkill /PID <PID_NUMBER> /F

# Or change the port in your server file
```

**Error: "Cannot connect to database"**
- Check PostgreSQL is running
- Verify `.env` file has correct `DATABASE_URL`
- Check database `webopoly` exists

### If Migrations Fail

**Error: "Migration already applied"**
```bash
# Check migration status
npm run migrate:up

# If needed, roll back and re-run
npm run migrate:down
npm run migrate:up
```

**Error: "Table already exists"**
- The database might have tables from a previous run
- You can drop the database and recreate it, or continue (tables exist is okay)

### If Pages Don't Load

**Error: "Cannot GET /route"**
- Make sure server is running (`npm run dev`)
- Check the route exists in your routes files
- Rebuild the application: `npm run build`

**Error: "Styles not loading"**
- Rebuild CSS: `npm run build:css`
- Check browser console for 404 errors
- Verify `dist/public/css/styles.css` exists

---

## Step 5: Pre-Presentation Checklist

Before class starts, verify:

- [ ] Application is running (`npm run dev` shows "Server running")
- [ ] Can access `http://localhost:3005` in browser
- [ ] Login page loads and looks styled
- [ ] Can create a user account (signup works)
- [ ] Can log in with created account
- [ ] Can create a game in lobby
- [ ] Game appears in the game list
- [ ] Can join a game and see the game page
- [ ] Game board mockup displays correctly
- [ ] No console errors in browser DevTools
- [ ] Code editor is open and ready
- [ ] `.env` file is present (but don't show it - contains password)

---

## Step 6: Quick Reference Commands

### Essential Commands

```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate:up

# Roll back migrations (if needed)
npm run migrate:down

# Build everything
npm run build

# Start development server
npm run dev

# Create test user
node create-test-user.js

# Check games in database
node check-games.js
```

### Build Commands (if you make changes)

```bash
# Build CSS only
npm run build:css

# Build backend only
npm run build:backend

# Build frontend only
npm run build:frontend

# Build everything
npm run build
```

---

## Step 7: What NOT to Show

**Avoid showing:**
- `.env` file (contains database password)
- `node_modules` folder (too many files)
- Migration files in detail (just mention they exist)
- Console errors (fix them before presenting)
- Unstyled pages (make sure everything is styled)

**Do show:**
- Styled pages in browser
- Code editor with template files
- Tailwind CSS configuration
- Database working (through creating users/games)

---

## Step 8: Presentation Tips

1. **Practice the flow once** before class to ensure everything works
2. **Have browser tabs ready** - You can pre-open login, signup, lobby pages
3. **Keep it moving** - 5 minutes goes fast, don't spend too long on one thing
4. **If something breaks** - Stay calm, mention it's a demo environment, move on
5. **Emphasize consistency** - Point out the same styling across all pages
6. **Show database integration** - This is important for Milestone 4

---

## Step 9: Key Points to Emphasize

1. **Complete database schema** - All tables from Milestone 2 are implemented
2. **Consistent styling** - Same warm gradient theme throughout all 5 pages
3. **Professional appearance** - Polished, intentional design
4. **Functional game mockup** - Board shows how the game will work
5. **Database integration** - Real data flowing through the application

---

## Step 10: After Presentation

### Clean Up (Optional)

If you want to reset for next time:

```bash
# Roll back all migrations
npm run migrate:down

# Re-run migrations
npm run migrate:up

# Recreate test user
node create-test-user.js
```

---

## Contact & Help

If you encounter issues:
1. Check the error message in the terminal
2. Check browser console (F12) for frontend errors
3. Verify database is running and accessible
4. Make sure all dependencies are installed (`npm install`)
5. Try rebuilding: `npm run build`

---

**Good luck with your presentation!**

