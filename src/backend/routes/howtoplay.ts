import express from "express";
import { rootCertificates } from "tls";

const router = express.Router();

router.get("/", (req, res) => {
  res.render("howtoplay", { gamesListing: ["a", "b", "c", "etc"] });
});

export { router as howtoplayRouter };
