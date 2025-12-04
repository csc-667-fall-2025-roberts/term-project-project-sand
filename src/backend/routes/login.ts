import express from "express";

const router = express.Router();

router.get("/", (_req, res) => {
  res.redirect("/auth/login");
});

export { router as loginRouter }; // to be used in server.ts
