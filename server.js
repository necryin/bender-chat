var express = require('express')
, app = express()
, server = require('http').createServer(app)
, mongoose = require('mongoose')
, passport = require('passport')
, LocalStrategy = require('passport-local').Strategy
, flash = require('connect-flash')
, _ = require('underscore')._;

app.configure(function() {
	app.set('port', process.env.OPENSHIFT_NODEJS_PORT || 8080);
  	app.set('ipaddr', process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1");
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.static(__dirname + '/public'));

    app.use(express.cookieParser());
    app.use(express.session({ secret: 'bender chat has you twice' }));

    app.use(passport.initialize());
    app.use(passport.session({ secret: 'bender chat has you' }));
    app.use(flash());

    app.use(app.router);

	app.use('/components', express.static(__dirname + '/components'));
	app.use('/js', express.static(__dirname + '/js'));
	app.use('/icons', express.static(__dirname + '/icons'));
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
mongoose.connect('mongodb://localhost/benderchat');

require('./routes')(app);

server.listen(app.get('port'), app.get('ipaddr'), function(){
	console.log('Express server listening on  IP: ' + app.get('ipaddr') + ' and port ' + app.get('port'));
});
