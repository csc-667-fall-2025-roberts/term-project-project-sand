import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.render("Team", { gamesListing: ["Andre", "Daniel", "Charlie", "Nate"] });
});

export { router as teamRouter }; // to be used in server.ts
