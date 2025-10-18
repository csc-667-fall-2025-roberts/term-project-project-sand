import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    res.send('This is from the games route!');
});



export {router as gamesRouter}; // to be used in server.ts