import express from "express";

const router = express.Router();

router.get("/", (_req, res) => {
  res.render("Dashboard", {
    gamesListing: ["Andre", "Daniel", "Charlie", "Nate"],
  });
});

export { router as dashboardRouter }; // to be used in server.ts
