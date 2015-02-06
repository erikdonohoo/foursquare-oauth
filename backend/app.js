var express = require('express');
var app = express();

var fs = require('fs');

app.set('view engine', 'html');
app.use(express.bodyParser());

var path = '/home/ubuntu/www/foursquare-oauth/backend/data.json';

function getJson() {
	return JSON.parse(fs.readFileSync(path));
}

function saveDb(db) {
	try {
		fs.writeFile(path, JSON.stringify(db), function(err) {
			if (err) {
				console.log(err);
			}
		});
	} catch (e) {
		console.log(e);
	}
}

app.post('/push/checkin', function (req, res) {
	var checkin = JSON.parse(req.body.checkin);
	var db = getJson();
	db.users.forEach(function (user) {
		if (checkin.user.id === user.id) {
			user.checkins = user.checkins || {};
			user.checkins.push(checkin);
		}
	});
	saveDb(db);
	res.json({msg: 'ok'});
});

app.get('/users', function(req, res) {
	res.json(getJson().users);
});

app.get('/users/:id', function(req, res) {
	var id = req.params.id;
	var user;
	getJson().users.forEach(function (u) {
		if (u.id === id) user = u;
	});

	res.json(user);
});

app.post('/users', function (req, res) {
	var user = req.body;
	var db = getJson();
	db.users.push(user);
	saveDb(db);
	res.json(user);
});

app.put('/users/:id', function (req, res) {
	var db = getJson();
	for (var i = 0; i < db.users.length; i++) {
		var user = db.users[i];
		if (user.id === req.params.id) {
			db.users[i] = req.body;
		}
	}
	saveDb(db);
	res.json(req.body);
});

app.listen(3000);
