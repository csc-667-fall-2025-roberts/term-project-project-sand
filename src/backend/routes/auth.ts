import express from "express";
import db from "../db/connection";
import bcrypt from "bcrypt";

const router = express.Router();

router.get("/", (_req, res) => {
  res.send("This is from the Authication route!");
});

router.get("/login", (req, res) => {
  const error = req.query.error as string | undefined;
  const success = req.query.success as string | undefined;
  res.render("login", { error: error || null, success: success || null });
});

router.get("/signup", (_req, res) => {
  res.render("signup", { error: null });
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("login", { error: "Email and password are required" });
    }

    // Find user by email
    const user = await db.oneOrNone("SELECT * FROM users WHERE email = $1", [email]);

    if (!user) {
      console.log(`[Auth] Login failed: User not found for email ${email}`);
      return res.render("login", { error: "Invalid email or password" });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      console.log(`[Auth] Login failed: Invalid password for email ${email}`);
      return res.render("login", { error: "Invalid email or password" });
    }

    console.log(`[Auth] Login successful: User ${user.display_name} (${user.email}) logged in`);
    
    // Set session
    (req.session as any).userId = user.id;
    (req.session as any).userEmail = user.email;
    (req.session as any).userDisplayName = user.display_name;
    
    return res.redirect("/lobby");
  } catch (error) {
    console.error("Error during login:", error);
    return res.render("login", { error: "An error occurred. Please try again." });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const { display_name, email, password, confirm_password } = req.body;

    // Validation
    if (!display_name || !email || !password || !confirm_password) {
      return res.render("signup", { error: "All fields are required" });
    }

    if (password !== confirm_password) {
      return res.render("signup", { error: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.render("signup", { error: "Password must be at least 6 characters" });
    }

    // Check if user already exists
    const existingUser = await db.oneOrNone("SELECT id FROM users WHERE email = $1", [email]);

    if (existingUser) {
      console.log(`[Auth] Signup failed: User already exists with email ${email}`);
      return res.render("signup", { error: "An account with this email already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user in database
    const newUser = await db.one(
      `INSERT INTO users (email, display_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, created_at`,
      [email, display_name, passwordHash]
    );

    console.log(`[Auth] Signup successful: User ${newUser.display_name} (${newUser.email}) created with ID ${newUser.id}`);

    // Set session and auto-login
    (req.session as any).userId = newUser.id;
    (req.session as any).userEmail = newUser.email;
    (req.session as any).userDisplayName = newUser.display_name;
    
    return res.redirect("/lobby");
  } catch (error) {
    console.error("Error during signup:", error);
    return res.render("signup", { error: "An error occurred. Please try again." });
  }
});

router.post("/logout", (req, res) => {
  // Clear session
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
    }
    res.redirect("/auth/login");
  });
});

export { router as authRouter }; // to be used in server.ts
