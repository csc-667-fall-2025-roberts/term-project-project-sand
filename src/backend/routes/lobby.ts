import express from "express";
import db from "../db/connection";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    // Fetch all games with player counts
    const games = await db.any(`
      SELECT 
        g.*,
        COUNT(gp.id) as current_players
      FROM games g
      LEFT JOIN game_participants gp ON g.id = gp.game_id
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `);

    // Fetch recent chat messages (optional - can be empty for now)
    const messages = await db.any(`
      SELECT cm.*, u.display_name
      FROM chat_messages cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.game_id IS NULL
      ORDER BY cm.created_at DESC
      LIMIT 50
    `);

    res.render("lobby", {
      games: games || [],
      messages: messages || [],
      user: { display_name: "Player" }, // TODO: Get from session
    });
  } catch (error) {
    console.error("Error fetching lobby data:", error);
    res.render("lobby", {
      games: [],
      messages: [],
      user: { display_name: "Player" },
    });
  }
});

router.post("/create", async (req, res) => {
  try {
    const { game_name, max_players } = req.body;
    
    // Generate a random game code
    const game_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // TODO: Get user_id from session when auth is implemented
    // For now, get the first user from the database as a placeholder
    // In production, this should be: const user_id = req.session.userId;
    let created_by: string;
    try {
      const firstUser = await db.oneOrNone('SELECT id FROM users LIMIT 1');
      if (!firstUser) {
        return res.redirect("/lobby?error=No users found. Please sign up first.");
      }
      created_by = firstUser.id;
    } catch (userError) {
      console.error("Error finding user:", userError);
      return res.redirect("/lobby?error=Please sign up first before creating a game.");
    }
    
    const game = await db.one(
      `INSERT INTO games (name, game_code, max_players, status, created_by)
       VALUES ($1, $2, $3, 'waiting', $4)
       RETURNING *`,
      [game_name, game_code, parseInt(max_players), created_by]
    );

    res.redirect(`/games/${game.id}`);
  } catch (error) {
    console.error("Error creating game:", error);
    res.redirect("/lobby?error=Failed to create game");
  }
});

export { router as lobbyRouters }; // to be used in server.ts
