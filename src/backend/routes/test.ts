import express from 'express';

const router = express.Router();


//using the root of /test for this route
router.get('/', (req, res) => {
    res.send('This is from the test route!');
});



export {router as testRoutes}; // to be used in server.ts