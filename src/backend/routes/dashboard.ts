import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    res.send('This is from the dashboard route!');
});



export {router as dashboardRouter}; // to be used in server.ts