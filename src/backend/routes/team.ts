import express from "express";

const router = express.Router();

router.get("/", (_req, res) => {
  res.render("team", { gamesListing: ["Andre", "Daniel", "Charlie", "Nate"] });
});

export { router as teamRouter }; // to be used in server.ts
