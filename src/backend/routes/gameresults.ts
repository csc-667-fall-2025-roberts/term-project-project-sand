import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.render("Game Results", {
    gamesListing: ["Andre", "Daniel", "Charlie", "Nate"],
  });
});

export { router as gameresultsRouter }; // to be used in server.ts
