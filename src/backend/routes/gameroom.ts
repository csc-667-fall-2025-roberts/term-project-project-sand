import express from "express";
import db from "../db/connection";

const router = express.Router();

router.get("/:id", async (req, res) => {
  try {
    const gameId = req.params.id;

    // Fetch game details
    const game = await db.oneOrNone("SELECT * FROM games WHERE id = $1", [gameId]);
    
    if (!game) {
      return res.status(404).render("error", {
        status: 404,
        message: "Game not found",
      });
    }

    // Fetch all participants with user info
    const players = await db.any(`
      SELECT 
        gp.*,
        u.display_name,
        u.email
      FROM game_participants gp
      JOIN users u ON gp.user_id = u.id
      WHERE gp.game_id = $1
      ORDER BY gp.joined_at
    `, [gameId]);

    // Fetch properties owned by current player (placeholder - will need user session)
    // For now, get properties owned by the first participant
    const properties = await db.any(`
      SELECT 
        o.*,
        t.name,
        t.rent_base,
        t.purchase_price
      FROM ownerships o
      JOIN tiles t ON o.tile_id = t.id
      JOIN game_participants gp ON o.participant_id = gp.id
      WHERE o.game_id = $1
      ORDER BY gp.joined_at
      LIMIT 10
    `, [gameId]);

    // Get current player (placeholder - will need user session)
    const currentPlayer = players[0] || {
      cash: 1500,
      position: 0,
      token_color: "blue",
    };

    // Fetch tile at current player position
    const currentTile = await db.oneOrNone(
      `SELECT * FROM tiles WHERE position = $1`,
      [currentPlayer.position || 0]
    );

    // Check if current player owns the current tile
    let isOwned = false;
    let owner = null;
    if (currentTile && currentPlayer.id) {
      const ownership = await db.oneOrNone(
        `SELECT o.*, gp.user_id, u.display_name
         FROM ownerships o
         JOIN game_participants gp ON o.participant_id = gp.id
         JOIN users u ON gp.user_id = u.id
         WHERE o.game_id = $1 AND o.tile_id = $2`,
        [gameId, currentTile.id]
      );
      if (ownership) {
        isOwned = true;
        owner = ownership;
      }
    }

    // Fetch chat messages for this game
    const messages = await db.any(`
      SELECT cm.*, u.display_name
      FROM chat_messages cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.game_id = $1
      ORDER BY cm.created_at DESC
      LIMIT 50
    `, [gameId]);

    res.render("gameroom", {
      game: game,
      players: players || [],
      player: currentPlayer,
      properties: properties || [],
      messages: messages || [],
      currentTile: currentTile,
      isOwned: isOwned,
      owner: owner,
    });
  } catch (error) {
    console.error("Error fetching game data:", error);
    res.status(500).render("error", {
      status: 500,
      message: "Error loading game",
    });
  }
});

// POST endpoint for buying a property
router.post("/:id/buy", async (req, res) => {
  try {
    const gameId = req.params.id;
    const { position } = req.body;

    if (position === undefined || position === null) {
      return res.status(400).json({ error: "Position is required" });
    }

    // TODO: Get user_id from session when auth is implemented
    // For now, get the first participant in this game, or create one if none exists
    let participant = await db.oneOrNone(
      `SELECT * FROM game_participants WHERE game_id = $1 ORDER BY joined_at LIMIT 1`,
      [gameId]
    );
    
    if (!participant) {
      // Create a participant with the first user
      const firstUser = await db.oneOrNone('SELECT id FROM users LIMIT 1');
      if (!firstUser) {
        return res.status(400).json({ error: "No user found. Please create a user first." });
      }
      
      participant = await db.one(
        `INSERT INTO game_participants (game_id, user_id, cash, position, token_color)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [gameId, firstUser.id, 1500, 0, 'blue']
      );
    }

    // Get tile at position, or create it if it doesn't exist
    let tile = await db.oneOrNone(
      `SELECT * FROM tiles WHERE position = $1`,
      [position]
    );
    
    if (!tile) {
      // Tile doesn't exist, create it based on position
      // Get property data from frontend (we'll use a simple mapping)
      const propertyNames: { [key: number]: { name: string; type: string; price: number; rent: number } } = {
        1: { name: "Market St", type: "property", price: 60, rent: 2 },
        2: { name: "Mission St", type: "property", price: 60, rent: 4 },
        4: { name: "Union Square", type: "property", price: 100, rent: 6 },
        5: { name: "Chinatown", type: "property", price: 100, rent: 6 },
        7: { name: "Fisherman's Wharf", type: "property", price: 120, rent: 8 },
        8: { name: "Lombard St", type: "property", price: 140, rent: 10 },
        11: { name: "Golden Gate Park", type: "property", price: 140, rent: 10 },
        13: { name: "Alcatraz", type: "property", price: 160, rent: 12 },
        14: { name: "Pier 39", type: "property", price: 180, rent: 14 },
        15: { name: "Coit Tower", type: "property", price: 180, rent: 14 },
        16: { name: "Cable Car", type: "railroad", price: 200, rent: 25 },
        17: { name: "Twin Peaks", type: "property", price: 200, rent: 16 },
        19: { name: "Haight-Ashbury", type: "property", price: 220, rent: 18 },
        22: { name: "Golden Gate Bridge", type: "property", price: 400, rent: 50 },
        24: { name: "Presidio", type: "property", price: 400, rent: 50 },
        26: { name: "Marina", type: "property", price: 350, rent: 35 },
        27: { name: "North Beach", type: "property", price: 320, rent: 28 },
        29: { name: "Castro", type: "property", price: 300, rent: 26 },
        31: { name: "Russian Hill", type: "property", price: 300, rent: 26 },
        32: { name: "Nob Hill", type: "property", price: 280, rent: 24 },
        34: { name: "Muni", type: "railroad", price: 200, rent: 25 },
        35: { name: "Embarcadero", type: "property", price: 260, rent: 22 },
        36: { name: "Water Works", type: "utility", price: 150, rent: 0 },
        37: { name: "Financial Dist", type: "property", price: 240, rent: 20 },
        38: { name: "SOMA", type: "property", price: 220, rent: 18 },
      };
      
      const propData = propertyNames[position];
      if (!propData) {
        return res.status(404).json({ error: `Tile at position ${position} cannot be purchased` });
      }
      
      // Create the tile
      tile = await db.one(
        `INSERT INTO tiles (position, name, tile_type, purchase_price, rent_base)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [position, propData.name, propData.type, propData.price, propData.rent]
      );
    }

    if (tile.tile_type !== 'property' && tile.tile_type !== 'railroad' && tile.tile_type !== 'utility') {
      return res.status(400).json({ error: "This space cannot be purchased" });
    }

    if (!tile.purchase_price) {
      return res.status(400).json({ error: "This property has no purchase price" });
    }

    // Check if already owned
    const existingOwnership = await db.oneOrNone(
      `SELECT * FROM ownerships WHERE game_id = $1 AND tile_id = $2`,
      [gameId, tile.id]
    );
    if (existingOwnership) {
      return res.status(400).json({ error: "This property is already owned" });
    }

    // Check if player has enough money
    if (participant.cash < tile.purchase_price) {
      return res.status(400).json({ error: "Insufficient funds" });
    }

    // Start transaction
    const updatedParticipant = await db.tx(async (t) => {
      // Create ownership
      await t.none(
        `INSERT INTO ownerships (game_id, tile_id, participant_id)
         VALUES ($1, $2, $3)`,
        [gameId, tile.id, participant.id]
      );

      // Deduct money from player
      await t.none(
        `UPDATE game_participants SET cash = cash - $1 WHERE id = $2`,
        [tile.purchase_price, participant.id]
      );

      // Record transaction
      await t.none(
        `INSERT INTO transactions (game_id, from_participant_id, amount, transaction_type, description)
         VALUES ($1, $2, $3, 'purchase', $4)`,
        [gameId, participant.id, -tile.purchase_price, `Purchased ${tile.name}`]
      );

      // Get updated balance
      return await t.one(
        `SELECT cash FROM game_participants WHERE id = $1`,
        [participant.id]
      );
    });

    res.json({
      success: true,
      message: `Successfully purchased ${tile.name} for $${tile.purchase_price}`,
      newBalance: updatedParticipant.cash,
    });
  } catch (error) {
    console.error("Error buying property:", error);
    res.status(500).json({ error: "Failed to purchase property" });
  }
});

// POST endpoint for paying taxes
router.post("/:id/tax", async (req, res) => {
  try {
    const gameId = req.params.id;
    const { position, amount } = req.body;

    if (amount === undefined || amount === null || amount <= 0) {
      return res.status(400).json({ error: "Invalid tax amount" });
    }

    // TODO: Get user_id from session when auth is implemented
    // For now, get the first participant in this game, or create one if none exists
    let participant = await db.oneOrNone(
      `SELECT * FROM game_participants WHERE game_id = $1 ORDER BY joined_at LIMIT 1`,
      [gameId]
    );
    
    if (!participant) {
      // Create a participant with the first user
      const firstUser = await db.oneOrNone('SELECT id FROM users LIMIT 1');
      if (!firstUser) {
        return res.status(400).json({ error: "No user found. Please create a user first." });
      }
      
      participant = await db.one(
        `INSERT INTO game_participants (game_id, user_id, cash, position, token_color)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [gameId, firstUser.id, 1500, 0, 'blue']
      );
    }

    // Check if player has enough money
    if (participant.cash < amount) {
      return res.status(400).json({ error: "Insufficient funds to pay tax" });
    }

    // Get tile at position for description
    const tile = await db.oneOrNone(
      `SELECT * FROM tiles WHERE position = $1`,
      [position]
    );
    const tileName = tile?.name || "Tax";

    // Start transaction
    const updatedParticipant = await db.tx(async (t) => {
      // Deduct money from player
      await t.none(
        `UPDATE game_participants SET cash = cash - $1 WHERE id = $2`,
        [amount, participant.id]
      );

      // Record transaction
      await t.none(
        `INSERT INTO transactions (game_id, from_participant_id, amount, transaction_type, description)
         VALUES ($1, $2, $3, 'tax', $4)`,
        [gameId, participant.id, -amount, `Paid ${tileName} - $${amount}`]
      );

      // Get updated balance
      return await t.one(
        `SELECT cash FROM game_participants WHERE id = $1`,
        [participant.id]
      );
    });

    res.json({
      success: true,
      message: `Paid $${amount} in taxes`,
      newBalance: updatedParticipant.cash,
    });
  } catch (error) {
    console.error("Error paying tax:", error);
    res.status(500).json({ error: "Failed to pay tax" });
  }
});

// POST endpoint for card effects
router.post("/:id/card-effect", async (req, res) => {
  try {
    const gameId = req.params.id;
    const { effect, currentPosition } = req.body;

    if (!effect || !effect.type) {
      return res.status(400).json({ error: "Invalid card effect" });
    }

    // TODO: Get user_id from session when auth is implemented
    const firstUser = await db.oneOrNone('SELECT id FROM users LIMIT 1');
    if (!firstUser) {
      return res.status(400).json({ error: "No user found" });
    }

    // Get participant for this user and game
    const participant = await db.oneOrNone(
      `SELECT * FROM game_participants WHERE game_id = $1 AND user_id = $2`,
      [gameId, firstUser.id]
    );
    if (!participant) {
      return res.status(400).json({ error: "Participant not found" });
    }

    let newBalance = participant.cash;
    let newPosition = participant.position || currentPosition || 0;
    let message = "";
    let reload = false;

    // Start transaction
    const result = await db.tx(async (t) => {
      // Handle different effect types
      if (effect.type === "money") {
        // Money effect (positive or negative)
        const amount = effect.amount || 0;
        newBalance = participant.cash + amount;
        
        if (amount > 0) {
          message = `You received $${amount}!`;
        } else {
          message = `You paid $${Math.abs(amount)}.`;
        }

        await t.none(
          `UPDATE game_participants SET cash = cash + $1 WHERE id = $2`,
          [amount, participant.id]
        );

        await t.none(
          `INSERT INTO transactions (game_id, from_participant_id, amount, transaction_type, description)
           VALUES ($1, $2, $3, 'card', $4)`,
          [gameId, participant.id, amount, `Card effect: ${amount > 0 ? 'Received' : 'Paid'} $${Math.abs(amount)}`]
        );
      } else if (effect.type === "move") {
        // Move spaces
        const spaces = effect.spaces || 0;
        newPosition = (newPosition + spaces + 40) % 40; // Handle negative moves
        
        message = spaces > 0 
          ? `You moved forward ${spaces} space${spaces > 1 ? 's' : ''}.`
          : `You moved back ${Math.abs(spaces)} space${Math.abs(spaces) > 1 ? 's' : ''}.`;

        await t.none(
          `UPDATE game_participants SET position = $1 WHERE id = $2`,
          [newPosition, participant.id]
        );
      } else if (effect.type === "go_to") {
        // Go to specific position
        const targetPosition = effect.position || 0;
        const passedGo = targetPosition < newPosition;
        newPosition = targetPosition;

        if (passedGo) {
          // Collect $200 for passing GO
          newBalance = participant.cash + 200;
          await t.none(
            `UPDATE game_participants SET cash = cash + 200 WHERE id = $1`,
            [participant.id]
          );
          await t.none(
            `INSERT INTO transactions (game_id, from_participant_id, amount, transaction_type, description)
             VALUES ($1, $2, $3, 'pass_go', 'Passed GO - Collected $200')`,
            [gameId, participant.id, 200]
          );
          message = `You advanced to position ${targetPosition} and collected $200 for passing GO!`;
        } else {
          message = `You advanced to position ${targetPosition}.`;
        }

        await t.none(
          `UPDATE game_participants SET position = $1 WHERE id = $2`,
          [newPosition, participant.id]
        );
      } else if (effect.type === "go_to_jail") {
        // Go to jail (position 10 in standard Monopoly, but we'll use position 9 for JAIL)
        newPosition = 9; // JAIL position
        message = "You went to Jail!";

        await t.none(
          `UPDATE game_participants SET position = $1 WHERE id = $2`,
          [newPosition, participant.id]
        );
        reload = true;
      } else if (effect.type === "repairs") {
        // Street repairs - calculate based on owned properties
        // For now, we'll use a simplified calculation
        const houseCost = effect.houseCost || 0;
        const hotelCost = effect.hotelCost || 0;
        
        // Get player's properties with houses/hotels
        const ownerships = await t.any(
          `SELECT o.houses, o.hotels FROM ownerships o
           JOIN game_participants gp ON o.participant_id = gp.id
           WHERE o.game_id = $1 AND gp.id = $2`,
          [gameId, participant.id]
        );

        let totalCost = 0;
        ownerships.forEach((own: any) => {
          totalCost += (own.houses || 0) * houseCost;
          totalCost += (own.hotels || 0) * hotelCost;
        });

        if (totalCost > 0) {
          newBalance = participant.cash - totalCost;
          await t.none(
            `UPDATE game_participants SET cash = cash - $1 WHERE id = $2`,
            [totalCost, participant.id]
          );
          await t.none(
            `INSERT INTO transactions (game_id, from_participant_id, amount, transaction_type, description)
             VALUES ($1, $2, $3, 'card', 'Street repairs: $${totalCost}')`,
            [gameId, participant.id, -totalCost]
          );
          message = `You paid $${totalCost} for street repairs.`;
        } else {
          message = "No repairs needed - you don't own any properties with houses or hotels.";
        }
      }

      // Get updated balance
      const updated = await t.one(
        `SELECT cash FROM game_participants WHERE id = $1`,
        [participant.id]
      );
      return { newBalance: updated.cash, newPosition, message, reload };
    });

    res.json({
      success: true,
      newBalance: result.newBalance,
      newPosition: result.newPosition,
      message: result.message,
      reload: result.reload,
    });
  } catch (error) {
    console.error("Error applying card effect:", error);
    res.status(500).json({ error: "Failed to apply card effect" });
  }
});

// GET endpoint to fetch tile at position
router.get("/:id/tile/:position", async (req, res) => {
  try {
    const gameId = req.params.id;
    const position = parseInt(req.params.position);

    let tile = await db.oneOrNone(
      `SELECT * FROM tiles WHERE position = $1`,
      [position]
    );

    // If tile doesn't exist, create a placeholder for special spaces
    if (!tile) {
      // Special spaces that don't need database entries
      // These match the frontend propertyData positions
      const specialSpaces: { [key: number]: { name: string; tile_type: string; purchase_price: number; rent_base: number } } = {
        0: { name: "GO", tile_type: "go", purchase_price: 0, rent_base: 0 },
        3: { name: "Chance", tile_type: "chance", purchase_price: 0, rent_base: 0 },
        6: { name: "Community Chest", tile_type: "community_chest", purchase_price: 0, rent_base: 0 },
        9: { name: "Income Tax", tile_type: "tax", purchase_price: 0, rent_base: 0 },
        10: { name: "JAIL", tile_type: "jail", purchase_price: 0, rent_base: 0 },
        12: { name: "Chance", tile_type: "chance", purchase_price: 0, rent_base: 0 },
        18: { name: "Community Chest", tile_type: "community_chest", purchase_price: 0, rent_base: 0 },
        20: { name: "Go To Jail", tile_type: "go_to_jail", purchase_price: 0, rent_base: 0 },
        21: { name: "Luxury Tax", tile_type: "tax", purchase_price: 0, rent_base: 0 },
        23: { name: "Community Chest", tile_type: "community_chest", purchase_price: 0, rent_base: 0 },
        28: { name: "Chance", tile_type: "chance", purchase_price: 0, rent_base: 0 },
        30: { name: "Free Parking", tile_type: "free_parking", purchase_price: 0, rent_base: 0 },
        33: { name: "Chance", tile_type: "chance", purchase_price: 0, rent_base: 0 },
        39: { name: "Luxury Tax", tile_type: "tax", purchase_price: 0, rent_base: 0 },
      };
      
      const specialSpace = specialSpaces[position];
      if (specialSpace) {
        // Return a mock tile object for special spaces
        tile = {
          id: null,
          position: position,
          name: specialSpace.name,
          tile_type: specialSpace.tile_type,
          purchase_price: specialSpace.purchase_price,
          rent_base: specialSpace.rent_base,
        } as any;
      } else {
        return res.status(404).json({ error: "Tile not found" });
      }
    }

    // Check if owned (only for properties that can be owned)
    let ownership = null;
    if (tile.id && (tile.tile_type === 'property' || tile.tile_type === 'railroad' || tile.tile_type === 'utility')) {
      ownership = await db.oneOrNone(
        `SELECT o.*, gp.user_id, u.display_name
         FROM ownerships o
         JOIN game_participants gp ON o.participant_id = gp.id
         JOIN users u ON gp.user_id = u.id
         WHERE o.game_id = $1 AND o.tile_id = $2`,
        [gameId, tile.id]
      );
    }

    res.json({
      tile: tile,
      isOwned: !!ownership,
      owner: ownership,
    });
  } catch (error) {
    console.error("Error fetching tile:", error);
    res.status(500).json({ error: "Failed to fetch tile" });
  }
});

// POST endpoint for sending chat messages
router.post("/:id/chat", async (req, res) => {
  try {
    const gameId = req.params.id;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    // TODO: Get user_id from session when auth is implemented
    // For now, use the first user as placeholder
    const firstUser = await db.oneOrNone('SELECT id FROM users LIMIT 1');
    if (!firstUser) {
      return res.status(400).json({ error: "No user found" });
    }

    const chatMessage = await db.one(
      `INSERT INTO chat_messages (game_id, user_id, message)
       VALUES ($1, $2, $3)
       RETURNING id, message, created_at`,
      [gameId, firstUser.id, message.trim()]
    );

    // Get user display name
    const user = await db.one('SELECT display_name FROM users WHERE id = $1', [firstUser.id]);

    res.json({
      id: chatMessage.id,
      message: chatMessage.message,
      display_name: user.display_name,
      created_at: chatMessage.created_at,
    });
  } catch (error) {
    console.error("Error sending chat message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// GET endpoint for fetching owned properties
router.get("/:id/properties", async (req, res) => {
  try {
    const gameId = req.params.id;
    
    // Get the first participant in this game
    const participant = await db.oneOrNone(
      `SELECT * FROM game_participants WHERE game_id = $1 ORDER BY joined_at LIMIT 1`,
      [gameId]
    );
    
    if (!participant) {
      return res.json({ properties: [] });
    }
    
    // Fetch properties owned by this participant
    const properties = await db.any(`
      SELECT 
        t.name,
        t.rent_base as rent,
        t.purchase_price
      FROM ownerships o
      JOIN tiles t ON o.tile_id = t.id
      WHERE o.game_id = $1 AND o.participant_id = $2
      ORDER BY t.name
    `, [gameId, participant.id]);
    
    res.json({ properties });
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

export { router as gameroomRouter }; // to be used in server.ts
