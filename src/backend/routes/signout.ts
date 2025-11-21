import express from "express";

const router = express.Router();

router.get("/", (_req, res) => {
  res.render("signout", {
    gamesListing: ["Andre", "Daniel", "Charlie", "Nate"],
  });
});

export { router as signoutRouter }; // to be used in server.ts
