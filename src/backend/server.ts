//entry point for the backend server
import * as path from "path";
import express from "express";
import morgan from "morgan";
import createHttpError from "http-errors";

import { mainRouter } from "./routes/root";
import { testRoutes } from "./routes/test";
import { authRouter } from "./routes/auth";
import { teamRouter } from "./routes/team";
import { gameroomRouter } from "./routes/gameroom";
import { lobbyRouters } from "./routes/lobby";
import { dashboardRouter } from "./routes/dashboard";
import { settingsRouter } from "./routes/settings";
import { signinRouter } from "./routes/signin";
import { signoutRouter } from "./routes/signout";
import { gameresultsRouter } from "./routes/gameresults";
import { howtoplayRouter } from "./routes/howtoplay";
import { creategameRouter } from "./routes/creategame";

const app = express();

const PORT = process.env.PORT || 3005;

app.use(morgan("dev"));
app.use(express.static(path.join("dist", "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// mount the routers
app.use("/", mainRouter);

app.use("/test", testRoutes);
app.use("/auth", authRouter);
app.use("/lobby", lobbyRouters);
app.use("/dashboard", dashboardRouter);
app.use("/games", gameroomRouter);
app.use("/team", teamRouter);
app.use("/settings", settingsRouter);
app.use("/signin", signinRouter);
app.use("/signout", signoutRouter);
app.use("/gameresults", gameresultsRouter);
app.use("/howtoplay", howtoplayRouter);
app.use("/creategame", creategameRouter);

// Error handling middleware
app.use((req, _res, next) => {
  next(createHttpError(404));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
