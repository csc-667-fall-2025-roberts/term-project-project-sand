import express from "express";

const router = express.Router();

router.get("/", (_req, res) => {
  res.redirect("/lobby");
});

export { router as dashboardRouter }; // to be used in server.ts
