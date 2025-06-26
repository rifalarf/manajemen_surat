const express = require('express');
const app = express();
const port = 3000;
const adminRoutes = require('./routes/admin');
const verifyRoutes = require('./routes/verify');
const authRoutes = require('./routes/auth');
const db = require('./db');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

app.use(express.urlencoded({ extended: true }));

app.use(session({
    store: new FileStore(),
    secret: 'your-secret-key', // Ganti dengan secret key yang kuat
    resave: false,
    saveUninitialized: false
}));

app.use(express.static('public'));
app.set('view engine', 'ejs');

const checkAuth = (req, res, next) => {
    if (req.session.loggedin) {
        next();
    } else {
        res.redirect('/login');
    }
};

app.use('/auth', authRoutes);
app.use('/admin', checkAuth, adminRoutes);
app.use('/verify', verifyRoutes);

app.get('/', (req, res) => {
    res.redirect('/admin');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.listen(port, () => {
    console.log(`Aplikasi berjalan di http://localhost:${port}`);
});
