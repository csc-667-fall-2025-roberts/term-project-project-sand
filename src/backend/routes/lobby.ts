import express from "express";

const router = express.Router();

router.get("/", (_req, res) => {
  res.render("lobby", { gamesListing: ["Andre", "Daniel", "Charlie", "Nate"] });
});

export { router as lobbyRouters }; // to be used in server.ts
