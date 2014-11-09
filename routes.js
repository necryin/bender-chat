var Account = require('./models/account');

module.exports = function (app, passport, flash) {

    app.get('/', loggedIn, function (req, res) {
        res.render('index', { user : req.user, menu: 'Chat' });
    });

    app.get('/register', function(req, res) {
        res.render('register', { errors : req.flash('error'), menu: 'Register' });
    });

    app.post('/register', function(req, res) {
        Account.register(new Account({ username : req.body.username }), req.body.password, function(err, account) {
            if (err) {
                req.flash('error', err.message);
                return res.redirect('/register');
            } else {
                passport.authenticate('local')(req, res, function () {
                    res.redirect('/');
                })
            }
        });
    });

    app.get('/login', function(req, res) {
        res.render('login', { errors : req.flash('error'), menu: 'Log in' });
    });

    app.post('/login', passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureFlash: true
    }));

    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });

    app.get('/partials/:name', function (req, res) {
        var name = req.params.name;
        res.render('partials/' + name);
    });

    function loggedIn(req, res, next) {
        if (req.isAuthenticated()) {
            next();
        } else {
            res.redirect('/login');
        }
    }
};
