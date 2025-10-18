import express from 'express';

const router = express.Router();



router.get('/', (req, res) => {
  res.send('This from the router!');
});

export {router as mainRouter}; // to be used in server.ts