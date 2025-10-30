import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.render("Signout", {
    gamesListing: ["Andre", "Daniel", "Charlie", "Nate"],
  });
});

export { router as signoutRouter }; // to be used in server.ts
