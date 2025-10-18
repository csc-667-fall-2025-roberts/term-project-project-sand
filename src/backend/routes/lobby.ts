import express from 'express';

const router = express.Router();

router.get('/', (_req, res) => {
    res.send('This is from the Lobby route!');

});

export {router as lobbyRouters}; // to be used in server.ts