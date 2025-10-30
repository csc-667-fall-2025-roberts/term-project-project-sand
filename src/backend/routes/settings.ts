import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.render("settings", {
    gamesListing: ["Andre", "Daniel", "Charlie", "Nate"],
  });
});

export { router as settingsRouter }; // to be used in server.ts
