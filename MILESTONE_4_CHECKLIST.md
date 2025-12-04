# Milestone 4: Database Setup & Application Styling - Checklist

## Part 1: Database Migrations

### Required Tables
- [x] **Users table** - Created (`001_create_users.ts`)
  - id, email, display_name, password_hash, created_at, updated_at
  - Indexes on email and display_name
  
- [x] **Games table** - Created (`002_create_games.ts`)
  - id, name, created_by, game_code, status (default: 'waiting'), max_players, created_at, updated_at
  - Foreign key to users(id)
  - Indexes on game_code, status, created_at, created_by
  
- [x] **Game_participants table** - Created (`003_create_game_participants.ts`)
  - Links users to games (game_id, user_id)
  - Stores cash, position, token_color, joined_at
  
- [x] **Additional tables from Milestone 2** - All created:
  - `004_create_tiles.ts` - Board spaces/properties
  - `005_create_ownerships.ts` - Property ownership
  - `006_create_turns.ts` - Turn history
  - `007_create_transactions.ts` - Financial transactions
  - `008_create_card_decks.ts` - Card decks
  - `009_create_cards.ts` - Card definitions
  - `010_create_card_draws.ts` - Card draw history
  - `011_create_chat_messages.ts` - Chat messages
  - `012_create_trades.ts` - Trade offers
  - `013_create_trade_properties.ts` - Properties in trades

### Migration Requirements
- [x] **Migrations run successfully** - `npm run migrate:up` works
- [x] **Migrations can roll back** - `npm run migrate:down` works
- [x] **Foreign keys defined** - All relationships properly linked
- [x] **Indexes on frequently queried columns** - email, game_code, status, etc.
- [x] **NOT NULL constraints** - Applied where appropriate
- [x] **Default values** - status defaults to 'waiting', timestamps auto-set

---

## Part 2: Styling

### Technology Choice
- [x] **Tailwind CSS** - Using utility classes consistently throughout
- [x] **No mixing approaches** - Only Tailwind, no inline styles or vanilla CSS

### Pages Styled (All Required)
- [x] **Login page** (`/auth/login`) - Styled with warm gradient theme
- [x] **Signup page** (`/auth/signup`) - Styled with warm gradient theme
- [x] **Lobby page** (`/lobby`) - Styled with warm gradient theme
- [x] **Game page** (`/games/:id`) - Styled with warm gradient theme + board mockup
- [x] **Error page** (`/error`) - Styled with warm gradient theme

---

## Part 3: Design Requirements

### Visual Design
- [x] **Consistent color scheme** - Warm gradient (amber → orange → pink) across all pages
- [x] **Professional typography** - Clear font hierarchy, appropriate sizes
- [x] **Adequate spacing** - Proper padding and margins, not cramped
- [x] **Visual hierarchy** - Headers, body text, labels clearly differentiated
- [x] **Professional appearance** - Polished, intentional design

### Forms & Interactive Elements
- [x] **Styled form inputs** - Visible borders, proper padding
- [x] **Styled buttons** - Gradient primary buttons, clear hover states
- [x] **Focus states** - Visible indicators when tabbing/clicking inputs
- [x] **Consistent button styling** - Same style across all pages

### Layout & Structure
- [x] **Centered/aligned content** - Not flush to browser edge
- [x] **Logical grouping** - Related elements grouped together
- [x] **Containers/cards** - Content sections properly contained

---

## Part 4: Specific Page Requirements

### Lobby Page
- [x] **Styled header** - Gradient header with user info and logout button
- [x] **Styled "Create Game" form** - Professional form with styled inputs
- [x] **Styled game list** - Shows games from database with proper styling
- [x] **Styled chat area** - (Optional - can mention if not fully implemented)

### Login/Signup Pages
- [x] **Centered form layout** - Forms centered on page
- [x] **Clear labels and inputs** - Properly styled and labeled
- [x] **Styled submit button** - Gradient button with hover effects
- [x] **Styled error messages** - Error messages displayed properly
- [x] **Link to alternate page** - Login ↔ Signup links

### Game Page
- [x] **Consistent header styling** - Matches other pages
- [x] **Clear game information display** - Shows game data from database
- [x] **Navigation back to lobby** - "Back to Lobby" button
- [x] **Visual mock-up of game interface** - Complete board mockup with:
  - Game board with properties
  - Player tokens
  - Dice display
  - Current spot card
  - Actions section
  - Players list
  - Properties owned
  - Chat area

---

## Presentation Checklist (5 Minutes)

### 1. Styling Choice (~30 seconds)
- [ ] Explain: "We chose Tailwind CSS because..."
  - Fast development with utility classes
  - Consistent design system
  - Easy to maintain

### 2. Live Application Demo (~3 minutes)
- [ ] **Navigate through all styled pages:**
  - [ ] Show login page
  - [ ] Show signup page
  - [ ] Show lobby page
  - [ ] Show game page
  - [ ] Show error page (if possible)

- [ ] **Demonstrate database connection:**
  - [ ] Create a user account (signup) - shows data saved
  - [ ] Log in with that account
  - [ ] Create a game - shows in database
  - [ ] Game list updates - shows new game
  - [ ] Join a game - shows participant added
  - [ ] Show chat messages (if implemented)

- [ ] **Show styling consistency:**
  - [ ] Point out gradient theme across pages
  - [ ] Show button styling consistency
  - [ ] Show form styling consistency

### 3. Quick Code Look (~1 minute)
- [ ] Open `src/styles/input.css` - Show Tailwind setup
- [ ] Open one EJS template - Show Tailwind classes
- [ ] Highlight one styling choice you're proud of:
  - Warm gradient theme
  - Consistent button gradients
  - Professional card layouts
  - Board mockup design

### 4. Wrap Up (~30 seconds)
- [ ] One challenge you faced:
  - Example: "Getting the board mockup to display correctly with the grid layout"
  - Example: "Ensuring consistent styling across all pages"
  - Example: "Setting up migrations with proper foreign keys"
- [ ] How you solved it:
  - Example: "Used CSS Grid for the board layout"
  - Example: "Created a consistent color system with Tailwind"
  - Example: "Tested migrations up and down multiple times"

---

## Pre-Presentation Testing

Before class, make sure:
- [ ] Application is running (`npm run dev`)
- [ ] Migrations are run (`npm run migrate:up`)
- [ ] Database has test data:
  - [ ] At least one user account
  - [ ] At least one game
  - [ ] Test that you can log in
  - [ ] Test that you can create a game
  - [ ] Test that games show in the lobby
- [ ] All pages load correctly
- [ ] No console errors
- [ ] Browser DevTools ready to show code

---

## Notes for Presentation

### Key Points to Emphasize:
1. **Complete database schema** - All tables from Milestone 2 implemented
2. **Consistent styling** - Same warm gradient theme throughout
3. **Professional appearance** - Polished, intentional design
4. **Functional game mockup** - Board shows how game will work
5. **Database integration** - Real data flowing through the app

### Potential Demo Flow:
1. Start at login page → show styling
2. Sign up new account → show database save
3. Log in → show database query
4. Go to lobby → show styled game list from database
5. Create game → show it appears in list
6. Join game → show game page with board mockup
7. Show error page styling
8. Quick code tour
9. Wrap up

---

## Final Verification

Before submitting:
- [ ] All migrations run successfully
- [ ] All 5 pages styled consistently
- [ ] Forms have hover and focus states
- [ ] Professional appearance achieved
- [ ] Ready for 5-minute presentation
- [ ] Test data in database
- [ ] Application runs without errors

---

**Status: READY FOR PRESENTATION**

