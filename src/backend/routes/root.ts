import express from "express";
import { rootCertificates } from "tls";

const router = express.Router();

router.get("/", (req, res) => {
  res.render("root", { gamesListing: ["a", "b", "c", "etc"] });
});

export { router as mainRouter }; // to be used in server.ts
