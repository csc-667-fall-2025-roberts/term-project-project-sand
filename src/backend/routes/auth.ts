import express from 'express';

const router = express.Router();


router.get('/', (req, res) => {
    res.send('This is from the Authication route!');
});



router.get('/login', (_req, res) => {
    res.render('login');
});

router.get('/signup', (_req, res) => {
    res.render('signup');
});

router.post('/login', (req, res) => {
    
    return res.redirect('/dashboard');
});

router.post('/signup', (req, res) => {
    
    return res.redirect('/auth/login');
});

router.post('/logout', (_req, res) => {
    
    return res.render('/auth/login');
}); 

export {router as authRouter}; // to be used in server.ts
