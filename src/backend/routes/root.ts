import express from "express";

const router = express.Router();

router.get("/", (_req, res) => {
  res.render("root", { gamesListing: ["a", "b", "c", "etc"] });
});

export { router as mainRouter };
