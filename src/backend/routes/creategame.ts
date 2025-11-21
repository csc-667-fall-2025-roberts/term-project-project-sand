import express from "express";

const router = express.Router();

router.get("/", (_req, res) => {
  res.render("CreateGame", {
    gamesListing: ["Andre", "Daniel", "Charlie", "Nate"],
  });
});

export { router as creategameRouter }; // to be used in server.ts
