# CSC 667 – Milestone 1: Game Decision & Wireframes  
### Team Project:

---

## Project Overview
Our game is a browser-based multiplayer board game inspired by *Monopoly*.  
Players take turns rolling dice, buying properties, collecting rent, and competing to become the wealthiest player before anyone goes bankrupt.  
The game blends luck and strategy in a modern, web-friendly format with real-time updates and persistent player stats.

---

## Features

### **Required Features (Course Requirements)**
- Deployment on **Render** (frontend + backend)
- **Node.js / Express.js** backend server
- **PostgreSQL** database for users, properties, and game state
- **User Authentication** (Sign Up / Log In / sessions)
- **REST API Endpoints** for moves, transactions, and game state
- Persistent storage of player profiles and leaderboards

### **Game-Specific Features**
- **Create / Join Game Rooms** (unique code or lobby list)
- **Virtual Dice Roll** → moves player pieces on the board
- **Property Ownership System** (buy, rent, upgrade)
- **Player Wallets** (real-time balance / rent / payments)
- **Chance & Community Chest Cards** (random events)
- **Real-Time Game Updates** via Socket.io
- **Leaderboard & Match History**
- **Game Over Screen** (winner + net worth summary)

*(Optional Stretch Goals: in-game chat, mobile layout, board themes)*

---

## Technologies

| Layer | Technology |
|:------|:------------|
| Frontend | HTML / CSS / JavaScript *(or React + Tailwind if approved)* |
| Backend | Node.js + Express.js |
| Database | PostgreSQL |
| Real-Time Communication | Socket.io |
| Deployment | Render |
| Version Control | GitHub (Classroom Repository) |

---

## Wireframes (Low-Fidelity Sketches)

| Screen | Description |
|:-------|:-------------|
| **Landing Page (Signed Out)** | Game logo + “Play Now” button → Log In / Sign Up options |
| **Sign Up Page** | Username / Email / Password fields + “Create Account” button |
| **Log In Page** | Username / Password + “Log In” button |
| **Lobby (Signed In)** | “Create Game” / “Join Game” buttons + list of active rooms |
| **Game Room (Board)** | Game board grid, dice button, player tokens, balance, property cards, event log, “End Turn” button |
| **Results Screen** | Winner banner, final balances, “Play Again” / “Return to Lobby” buttons |

**Interaction Examples**
- *Roll Dice → Move piece → trigger rent or purchase modal*  
- *Click Buy → update database → broadcast ownership change*  
- *Game End → navigate to Results Screen*

---

## Slide Deck Outline (5-Minute Presentation)

| Slide | Content |
|:------|:---------|
| ** Title Slide** | Project Name (**Webopoly**) + Team Members |
| ** Overview** | Short description (2–4 sentences) |
| ** Gameplay Summary** | Diagram or flow chart of turn logic |
| ** Core Features** | Required + Game-specific features |
| ** Technology Stack** | Table or icons for tools used |
| ** Wireframes** | Landing, Lobby, and Board screens |
| ** Game Flow Chart** | Screen connections and user journey |
| ** Next Steps** | Plans for Milestone 2 (e.g., DB schema + Socket.io setup) | 

---
