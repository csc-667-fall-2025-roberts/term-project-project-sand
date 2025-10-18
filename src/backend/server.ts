//entry point for the backend server

import express from 'express'; 
import createHttpError from 'http-errors';

import {mainRouter} from "./routes/root";
import {testRoutes} from './routes/test';
import {authRouter} from './routes/auth';

//up to this point he made all the routes that are defined in test route file
// realtive to /test URL
import {gamesRouter} from './routes/games';
import {lobbyRouters} from './routes/lobby';
import {dashboardRouter} from './routes/dashboard';


// Create an Express application
const app = express();

// Define the port
const PORT = process.env.PORT || 3005; 


// mount the routers
app.use('/', mainRouter);
// we can have a bunch of different routes files and have each of those
// routes files realive to a different URL
app.use("/test", testRoutes);
app.use("/auth", authRouter); // for login, signup, logout, register
app.use("/lobby", lobbyRouters); // lobby routes
app.use("/dashboard", dashboardRouter); // game related routes
app.use("/games", gamesRouter); // game related routes

// Error handling middleware
app.use((req, res, next) => {
  next(createHttpError(404));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Basic route for testing

app.get('/', (_req, res) => {
  res.send('Hello, World!');
});
//ask what are routes for