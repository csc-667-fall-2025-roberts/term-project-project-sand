import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.render("gameroom", {
    gamesListing: ["Andre", "Daniel", "Charlie", "Nate"],
  });
});

export { router as gameroomRouter }; // to be used in server.ts
