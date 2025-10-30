//entry point for the backend server
import * as path from "path";
import express from "express";
import morgan from "morgan";
import createHttpError from "http-errors";

import { mainRouter } from "./routes/root";
import { testRoutes } from "./routes/test";
import { authRouter } from "./routes/auth";

import { gamesRouter } from "./routes/games";
import { lobbyRouters } from "./routes/lobby";
import { dashboardRouter } from "./routes/dashboard";

const app = express();

const PORT = process.env.PORT || 3005;

app.use(morgan("dev"));
app.use(express.static(path.join("dist", "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// mount the routers
app.use("/", mainRouter);
// we can have a bunch of different routes files and have each of those

app.use("/test", testRoutes);
app.use("/auth", authRouter); // for login, signup, logout, register
app.use("/lobby", lobbyRouters); // lobby routes
app.use("/dashboard", dashboardRouter); // game related routes
app.use("/games", gamesRouter); // game related routes

// Error handling middleware
app.use((req, _res, next) => {
  next(createHttpError(404));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
