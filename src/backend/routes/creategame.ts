import express from "express";

const router = express.Router();

router.get("/", (_req, res) => {
  res.redirect("/lobby");
});

export { router as creategameRouter }; // to be used in server.ts
