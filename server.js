var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    mongoose = require('mongoose'),
    passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    flash = require('connect-flash'),
    redis = require("redis"),
    logger = require("./logger");

if (process.env.rediscloud_41eef) {
    var redis_config = JSON.parse(process.env.rediscloud_41eef);
    var redisClient = redis.createClient(redis_config['port'], redis_config['hostname']);
    redisClient.auth(redis_config['password']);
} else {
    var redisClient = redis.createClient();
}

redisClient.on("error", function (err) {
    logger.log("Redis error: " + err);
});

app.configure(function () {
    app.set('port', process.env.OPENSHIFT_NODEJS_PORT || 80);
    app.set('ipaddr', process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1");

    var mong_db = 'benderchat';
    app.set('mong', 'mongodb://127.0.0.1:27017/' + mong_db);
    if (process.env.OPENSHIFT_MONGODB_DB_URL) {
        app.set('mong', process.env.OPENSHIFT_MONGODB_DB_URL + mong_db);
    }

    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.static(__dirname + '/public'));

    app.use(express.cookieParser());
    app.use(express.cookieSession({ secret: 'bender chat has you twice' }));

    app.use(passport.initialize());
    app.use(passport.session({ secret: 'bender chat has you' }));
    app.use(flash());

    app.use(app.router);

    app.use('/components', express.static(__dirname + '/components'));
    app.use('/js', express.static(__dirname + '/js'));
    app.use('/icons', express.static(__dirname + '/icons'));
    app.use('/images', express.static(__dirname + '/images'));
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.set('view options', { layout: false });
});

// Configure passport
var Account = require('./models/account');

passport.use(new LocalStrategy(Account.authenticate()));

passport.serializeUser(Account.serializeUser());
passport.deserializeUser(Account.deserializeUser());

// Connect mongoose
mongoose.connect(app.get('mong'), function (err, res) {
    if (err) {
        logger.log('ERROR connecting to: ' + app.get('mong') + '. ' + err);
    } else {
        logger.log('Success connect to: ' + app.get('mong'));
    }
});

require('./routes')(app, passport, flash);
require('./chat')(server, redisClient);

server.listen(app.get('port'), app.get('ipaddr'), function () {
    logger.log('Express server listening on  IP: ' + app.get('ipaddr') + ' and port ' + app.get('port'));
});
