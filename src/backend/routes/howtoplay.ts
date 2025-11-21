import express from "express";

const router = express.Router();

router.get("/", (_req, res) => {
  res.render("howtoplay", { gamesListing: ["a", "b", "c", "etc"] });
});

export { router as howtoplayRouter };
