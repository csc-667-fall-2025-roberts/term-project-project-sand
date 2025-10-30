import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.render("login", {
    gamesListing: ["Andre", "Daniel", "Charlie", "Nate"],
  });
});

export { router as loginRouter }; // to be used in server.ts
