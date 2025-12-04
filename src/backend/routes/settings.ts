import express from "express";
import db from "../db/connection";
import bcrypt from "bcrypt";

const router = express.Router();

// Middleware to check if user is logged in
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.redirect("/auth/login?error=Please log in to access settings");
  }
  next();
};

router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    
    // Get user data from database
    const user = await db.oneOrNone(
      "SELECT id, email, display_name, created_at FROM users WHERE id = $1",
      [userId]
    );

    if (!user) {
      return res.redirect("/auth/login?error=User not found");
    }

    res.render("settings", {
      user: user,
      error: null,
      success: null,
    });
  } catch (error) {
    console.error("Error loading settings:", error);
    res.render("settings", {
      user: null,
      error: "Error loading settings",
      success: null,
    });
  }
});

// Update display name
router.post("/update-name", requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const { display_name } = req.body;

    if (!display_name || display_name.trim().length === 0) {
      return res.render("settings", {
        user: await db.one("SELECT * FROM users WHERE id = $1", [userId]),
        error: "Display name cannot be empty",
        success: null,
      });
    }

    await db.none(
      "UPDATE users SET display_name = $1, updated_at = current_timestamp WHERE id = $2",
      [display_name.trim(), userId]
    );

    // Update session
    (req.session as any).userDisplayName = display_name.trim();

    console.log(`[Settings] Display name updated for user ${userId} to ${display_name.trim()}`);

    const user = await db.one("SELECT * FROM users WHERE id = $1", [userId]);
    res.render("settings", {
      user: user,
      error: null,
      success: "Display name updated successfully",
    });
  } catch (error) {
    console.error("Error updating display name:", error);
    const userId = (req.session as any).userId;
    const user = await db.one("SELECT * FROM users WHERE id = $1", [userId]);
    res.render("settings", {
      user: user,
      error: "Error updating display name",
      success: null,
    });
  }
});

// Update password
router.post("/update-password", requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      const user = await db.one("SELECT * FROM users WHERE id = $1", [userId]);
      return res.render("settings", {
        user: user,
        error: "All password fields are required",
        success: null,
      });
    }

    if (new_password !== confirm_password) {
      const user = await db.one("SELECT * FROM users WHERE id = $1", [userId]);
      return res.render("settings", {
        user: user,
        error: "New passwords do not match",
        success: null,
      });
    }

    if (new_password.length < 6) {
      const user = await db.one("SELECT * FROM users WHERE id = $1", [userId]);
      return res.render("settings", {
        user: user,
        error: "Password must be at least 6 characters",
        success: null,
      });
    }

    // Verify current password
    const user = await db.one("SELECT password_hash FROM users WHERE id = $1", [userId]);
    const passwordMatch = await bcrypt.compare(current_password, user.password_hash);

    if (!passwordMatch) {
      const fullUser = await db.one("SELECT * FROM users WHERE id = $1", [userId]);
      return res.render("settings", {
        user: fullUser,
        error: "Current password is incorrect",
        success: null,
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // Update password
    await db.none(
      "UPDATE users SET password_hash = $1, updated_at = current_timestamp WHERE id = $2",
      [newPasswordHash, userId]
    );

    console.log(`[Settings] Password updated for user ${userId}`);

    const updatedUser = await db.one("SELECT * FROM users WHERE id = $1", [userId]);
    res.render("settings", {
      user: updatedUser,
      error: null,
      success: "Password updated successfully",
    });
  } catch (error) {
    console.error("Error updating password:", error);
    const userId = (req.session as any).userId;
    const user = await db.one("SELECT * FROM users WHERE id = $1", [userId]);
    res.render("settings", {
      user: user,
      error: "Error updating password",
      success: null,
    });
  }
});

export { router as settingsRouter }; // to be used in server.ts
