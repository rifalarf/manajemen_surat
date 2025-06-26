const express = require('express');
const router = express.Router();

// Ganti dengan kredensial admin yang lebih aman di production
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'password';

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        req.session.loggedin = true;
        req.session.username = username;
        res.redirect('/admin');
    } else {
        res.send('Username atau Password salah!');
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return console.log(err);
        }
        res.redirect('/');
    });
});

module.exports = router;
