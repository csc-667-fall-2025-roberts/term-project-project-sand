# CSC 667 – Milestone 3: Game API Design (Webopoly)

---

## 1. Game Description

Webopoly is a turn-based, Monopoly-style multiplayer board game where players roll dice, move around a shared board, buy properties, and pay rent when landing on opponents’ spaces. Each player must strategically manage money, acquire properties, and avoid bankruptcy. The last remaining player who is not bankrupt wins the game.

---

## 2. Socket.io Events

We follow the naming convention: `game:<entity>:<action>` and separate **public** (broadcast) from **private** (per-player) events.

---

### 2.1 `game:state:update` (Public)

- **Scope:** All players in the game room  
- **Trigger:** Any public state change  
- **Data:**
```json
{
  "game_id": 123,
  "board": [],
  "players": [
    { "id": 1, "position": 10, "is_bankrupt": false },
    { "id": 2, "position": 5, "is_bankrupt": false }
  ],
  "current_player_id": 1,
  "phase": "playing",
  "turn_number": 7
}
```

---

### 2.2 `game:turn:changed` (Public)

- **Scope:** All players  
- **Trigger:** Active turn changes  
- **Data:**
```json
{
  "game_id": 123,
  "previous_player_id": 1,
  "current_player_id": 2,
  "turn_number": 8
}
```

---

### 2.3 `game:player:joined` (Public)

- **Scope:** All players in the lobby/game room  
- **Trigger:** A player joins  
- **Data:**
```json
{
  "game_id": 123,
  "player": {
    "id": 4,
    "username": "nate",
    "token_color": "blue"
  },
  "player_count": 4,
  "max_players": 6
}
```

---

### 2.4 `game:player:options` (Private)

- **Scope:** Current player only  
- **Trigger:** Player needs to make a decision  
- **Data:**
```json
{
  "game_id": 123,
  "player_id": 1,
  "context": "landed_on_unowned_property",
  "options": [
    { "action": "buy_property", "property_id": 15, "cost": 200 },
    { "action": "skip_purchase" }
  ]
}
```

---

### 2.5 `game:player:balance:update` (Private)

- **Scope:** Single player  
- **Trigger:** Player balance changes  
- **Data:**
```json
{
  "game_id": 123,
  "player_id": 1,
  "balance": 1350
}
```

---

### 2.6 `game:ended` (Public)

- **Scope:** All players  
- **Trigger:** Game concludes  
- **Data:**
```json
{
  "game_id": 123,
  "winner_id": 2,
  "final_standings": [
    { "player_id": 2, "rank": 1, "balance": 2500 },
    { "player_id": 1, "rank": 2, "balance": 0 }
  ]
}
```

---

## 3. API Endpoints

Pattern for all endpoints:

1. Client sends HTTP request  
2. Server validates everything  
3. Server returns **202 Accepted**  
4. Server updates DB state  
5. Server emits Socket.io events  

---

### 3.1 Create Game

- **Route:** `POST /api/games`  
- **Purpose:** Creates a new game lobby.

**Request Body:**
```json
{
  "max_players": 4,
  "starting_balance": 1500
}
```

**Validation:**
- max_players 2–6  
- starting_balance valid  

**Socket Events:**  
- `game:player:joined`  
- `game:state:update`

---

### 3.2 Join Game

- **Route:** `POST /api/games/:game_id/join`  
- **Purpose:** Adds player to lobby.

**Request Body:**
```json
{ "token_color": "red" }
```

**Socket Events:**  
- `game:player:joined`  
- `game:state:update`

---

### 3.3 Start Game

- **Route:** `POST /api/games/:game_id/start`  
- **Purpose:** Moves game from lobby to playing.

**Socket Events:**  
- `game:state:update`  
- `game:turn:changed`  
- `game:player:options`

---

### 3.4 Get Game State

- **Route:** `GET /api/games/:game_id/state`  
- **Purpose:** Returns public + private player data.

**Response Example:**
```json
{
  "game": { "id": 123, "state": "playing" },
  "board": [],
  "players": [],
  "self": { "player_id": 1, "balance": 1450 }
}
```

---

### 3.5 Roll Dice & Move (Complex)

- **Route:** `POST /api/games/:game_id/turn/roll`  
- **Purpose:** Rolls dice, moves player, triggers tile effects.

**Response Example:**
```json
{
  "dice": [3, 4],
  "new_position": 17,
  "pending_action": { "type": "buy_property", "property_id": 15 }
}
```

**Socket Events:**  
- `game:state:update`  
- `game:player:options`  
- `game:player:balance:update`

---

### 3.6 Buy Property (Complex)

- **Route:** `POST /api/games/:game_id/properties/:property_id/buy`

**Request Body:**
```json
{ "pending_action_id": 42 }
```

**Socket Events:**  
- `game:state:update`  
- `game:player:balance:update`  
- `game:player:options`

---

### 3.7 End Turn

- **Route:** `POST /api/games/:game_id/turn/end`

**Socket Events:**  
- `game:turn:changed`  
- `game:player:options`  
- `game:ended`  

---

### 3.8 Pay Rent

- **Route:** `POST /api/games/:game_id/properties/:property_id/pay-rent`

**Request Body:**
```json
{ "pending_action_id": 77 }
```

**Socket Events:**  
- `game:state:update`  
- `game:player:balance:update`

---

## 4. Summary

This API design defines all required Socket.io events, validation rules, and game action endpoints for Webopoly. It ensures secure server-driven game logic and prepares the project for Milestone 4 implementation.

---

