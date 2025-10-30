import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.render("Signin", {
    gamesListing: ["Andre", "Daniel", "Charlie", "Nate"],
  });
});

export { router as signinRouter }; // to be used in server.ts
