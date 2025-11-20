# CSC 667 – Milestone 3: Game API Design (Webopoly)

---

## 1. Game Description

Our game is a turn-based, Monopoly-style board game where players roll dice, move around a shared board, buy properties, and pay rent when landing on opponents’ spaces. The goal is to stay solvent while strategically investing in properties and forcing other players toward bankruptcy. The last remaining player who is not bankrupt wins the game.

---

## 2. Socket.io Events

We follow the naming convention: `game:<entity>:<action>` and separate **public** (broadcast) from **private** (per-player) events.

### 2.1 `game:state:update` (Public)

- **Scope:** All players in the game room  
- **Trigger:** Any public state change (movement, property purchase, rent paid, bankruptcy)  
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
  
### 2.2 `game:turn:changed` (Public)

- **Scope:** All players  
- **Trigger:** When the active player changes  
- **Data:**
  ```json
  {
    "game_id": 123,
    "previous_player_id": 1,
    "current_player_id": 2,
    "turn_number": 8
  }

  ### 2.3 `game:player:joined` (Public)

- **Scope:** All players in the lobby/game room  
- **Trigger:** A new player successfully joins the game  
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

