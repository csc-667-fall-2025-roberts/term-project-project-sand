import { Router, Request, Response, NextFunction } from "express";
import db from "../db/connection";

const router = Router();

router.get("/", async (_req, res) => {
  const users = await db.any("SELECT * FROM users");

  res.render("users/index", { users });
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = await db.one("SELECT * FROM users WHERE id = $1", [id]);
    return res.render("users/show", { user });
  } catch (error) {
    return next(error);
  }
});

/*
router.post("/users", async (req: Request res: Response, next: NextFunction) => {
    try {
    const { username, email} = req.body as { username: string; email: string};

    const { id } await db.one<{id: number}>(
        "INSERT INTO users (email, username, password) VALUES ($1, $2 '3') RETURNING id" 
    [email, username, "password"]);
    res.redirect(`/users/${id}`);
});
*/

export { router as userRouter };
