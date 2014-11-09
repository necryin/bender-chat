module.exports = function (server, client) {

    var io = require("socket.io").listen(server),
        Room = require('./room.js'),
        escape = require('escape-html');

    client.flushdb();
    var g_people = {};
    var g_rooms = {};
    var g_chatHistory = {};
    var HISTORY_LENGTH = 10;
    var DEFAULT_ROOM = "default";
    var BENDER = "bender";
    //when start we get people from redis
    client.hgetall("people", function (err, result) {
        for (key in result) {
            g_people[key] = JSON.parse(result[key]);
        }
    });

    //TODO save rooms to redis needed
    //when start we get rooms from redis
    client.hgetall("rooms", function (err, result) {
        for (key in result) {
            g_rooms[key] = JSON.parse(result[key]);
        }
    });

    //create default room
    var room = new Room(DEFAULT_ROOM, BENDER, null);
    g_rooms[room.name] = room;

    //create bender!!!
    g_people[BENDER] = {
        name: BENDER,
        owns: {},
        rooms: {},
        friends: {},
        device: "desktop",
        status: "offline"
    };
    g_chatHistory[DEFAULT_ROOM] = [];

    console.log(g_rooms);
    console.log(g_people);

    function filterPeople(status) {
        var result = {};
        if (status == "offline") {
            for (key in g_people) {
                if (!g_people[key].hasOwnProperty("status")) {
                    result[key] = g_people[key];
                }
            }
        } else {
            for (key in g_people) {
                if (g_people[key].status == status) {
                    result[key] = g_people[key];
                }
            }
        }

        return result;
    }

    function findClientsSocket(roomId, namespace) {
        var res = [], ns = io.of(namespace || "/");    // the default namespace is "/"
        if (ns) {
            for (var id in ns.connected) {
                if (roomId) {
                    var index = ns.connected[id].rooms.indexOf(roomId);
                    if (index !== -1) {
                        res.push(ns.connected[id]);
                    }
                } else {
                    res.push(ns.connected[id]);
                }
            }
        }
        return res;
    }

    function log(msg) {
        var d = new Date();
        console.log(d.getDate() + "." + d.getMonth() + "." + d.getFullYear() +
            " " + d.getHours() + ":" + d.getMinutes() + ":" +  d.getSeconds() + " " + msg);
    }


    io.on("connection", function (socket) {

        socket.on("join:server", function (data) {

            if (!data.hasOwnProperty('username') || !data.hasOwnProperty('device')) {
                log(" INVALID DATA join:server from <" + socket.name + ">");
                return;
            }
            var name = data.username;
            var device = data.device;
            var status = "online";

            //we will use it as key for people
            socket.name = name;

            if (!g_people.hasOwnProperty(name)) {
                var person = {
                    name: name,
                    owns: {},
                    rooms: {},
                    friends: {},
                    device: device
                };
                person.rooms[DEFAULT_ROOM] = true;
                client.hset("people", name, JSON.stringify(person));
                g_people[name] = person;
            }

            socket.emit("update", "You have connected to the server.");
            //join in saved rooms
            var msg = socket.name + " has connected.";
            socket.emit("get:rooms", g_rooms);
            for (room in g_people[name].rooms) {
                console.log("room");
                console.log(room);
                socket.join(room);
                g_rooms[room].people[socket.name] = true;
                io.in(room).emit("get:msg", {name: BENDER, message: msg, room: room});
                socket.emit("get:history", {history: g_chatHistory[room], room: room});
                socket.emit("update", "Welcome to room (" +room + " ).");
            }

            console.log("connected " + socket.name);
            g_people[name].status = status;
            g_people[name].socketID = socket.id;
            socket.emit("get:people", filterPeople("online"));
            socket.emit("get:rooms", g_rooms);

            io.emit("update", name + " is online.");
            socket.broadcast.emit("get:person", g_people[name]);

            socket.emit("joined:server"); //extra emit for GeoLocation
        });

        socket.on("set:user:country", function (data) { //we know which country the user is from
            if (g_people.hasOwnProperty(socket.name)) {
                g_people[socket.name].country = data.country.toLowerCase();
                io.emit("get:person", g_people[socket.name]);
            }
        });

        socket.on("typing", function (data) {
            if (g_people.hasOwnProperty(socket.name)) {
                io.in(socket.room).emit("isTyping", {isTyping: data, person: socket.name});
            }
        });

        //TODO add datetime to messages
        socket.on("send:msg", function (data) {

            if (!data.hasOwnProperty('msg') || !data.hasOwnProperty('room')) {
                log(" INVALID DATA send:msg from <" + socket.name + ">");
                return;
            }

            var msg = escape(data.msg);
            var roomName = data.room;

            var re = /^[w]:.*:/;
            var whisper = re.test(msg);

            if (whisper) {
                var whisperStr = msg.split(":");
                var whisperTo = whisperStr[1];
                var whisperMsg = whisperStr[2];

                if (!g_people.hasOwnProperty(whisperTo)) {
                    socket.emit("update", "Can't find " + whisperTo);
                } else {
                    if (socket.name === whisperTo) {
                        socket.emit("update", "You can't whisper to yourself.");
                    } else {
                        socket.emit("whisper", {name: socket.name, msg: whisperMsg, to: whisperTo});
                        io.sockets.connected[g_people[whisperTo].socketID].emit("whisper", {name: socket.name, msg: whisperMsg});
                    }
                }
            } else {
                log(" send:msg roomName " + roomName);
                io.in(roomName).emit("get:msg", {name: socket.name, message: msg, room: roomName});
//                socket.emit("isTyping", false);

                //no more then HISTORY_LENGTH
                if (Object.keys(g_rooms[roomName].people).length > HISTORY_LENGTH) {
                    g_chatHistory[roomName].splice(0, 1);
                } else {
                    g_chatHistory[roomName].push(socket.name + ": " + msg);
                }
            }
        });

        socket.on("disconnect", function () {
            log("disconnect " + socket.name);
            if (!g_people.hasOwnProperty(socket.name)) {
                console.log("AHTUNG: disconnect something need check!!!");
                return;
            }

            // say everybody goodbye!
            var msg = "User (" + socket.name + ") disconnected";
            for (var roomName in g_people[socket.name].rooms) {
                io.in(roomName).emit("get:msg", {name: BENDER, message: msg, room: roomName});
            }

            delete g_people[socket.name].status;
            io.emit("delete:person", g_people[socket.name]); // update people view
        });

        //create new room
        socket.on("put:room", function (data) {
            if (!data.hasOwnProperty('name') || !data.hasOwnProperty('password')) {
                log(" INVALID DATA put:room from <" + socket.name + ">");
                return;
            }

            var name = data.name;
            var password = data.password;

            if (!g_rooms.hasOwnProperty(name)) {
                if (name.trim().length <= 0) {
                    socket.emit("update", "Invalid room name");
                    return;
                }
                var room = new Room(name, socket.name, password);
                room.people[socket.name] = true;
                g_rooms[name] = room;

                log(" put:room");
                console.log(room);
                io.emit("get:room", room);

                socket.join(room.name);

                g_people[socket.name].owns[room.name] = true;
                g_people[socket.name].rooms[room.name] = true;

                client.hset("people", socket.name, JSON.stringify(g_people[socket.name])); //update user

                socket.emit("get:person", g_people[socket.name]);
                socket.emit("update", "Room " + room.name + " created.");
                g_chatHistory[room.name] = [];
            } else {
                socket.emit("update", "Room with (" + name + ") name is already exist");
            }
        });

        //not in use (when last person leave room it's autodelete)
        socket.on("delete:room", function (name) {
            var room = g_rooms[name];
            if (typeof room === 'undefined') {
                console.log("AHTUNG: delete:room cheater!!!");
                return false;
            }
            if (socket.name === room.owner) {
                delete g_rooms[room.name];

                io.in(room.name).emit("update", "The owner (" + socket.name + ") has removed the room. The room is removed and you have been disconnected from it as well.");

                var clients = findClientsSocket(room.name);

                delete g_people[socket.name].owns[room.name];
                console.log(g_people[socket.name]);
                for (var i = 0; i < clients.length; i++) {
                    clients[i].leave(room.name);
                    if (typeof g_people[clients[i].name].rooms[room.name] !== 'undefined') {
                        delete g_people[clients[i].name].rooms[room.name];
                        client.hset("people", clients[i].name, JSON.stringify(g_people[clients[i].name])); //update user
                    }
                }
                delete g_chatHistory[room.name]; //clear chat history

                io.emit("get:rooms", g_rooms);
            } else {
                socket.emit("update", "Only the owner can remove a room.");
            }
        });

        socket.on("join:room", function (data) {
            if (!data.hasOwnProperty('name') || !data.hasOwnProperty('password')) {
                log(" INVALID DATA from join:room <" + socket.name + ">");
                return;
            }
            var roomName = data.name;
            var roomPass = data.password;

            console.log(roomName);
            console.log(g_rooms);

            if (!g_rooms.hasOwnProperty(roomName)) {
                log(" INVALID join:room - roomName from : <" + socket.name + ">");
                return;
            }

            var room = g_rooms[roomName];
            if (room.private) {
                if (!roomPass || roomPass !== room.getPassword()) {
                    socket.emit("update", "Wrong password!");
                    return;
                }
            }

            g_rooms[room.name].people[socket.name] = true;
            g_people[socket.name].rooms[room.name] = true;
            socket.join(room.name);

            io.in(room.name).emit("update", socket.name + " has connected.");
            client.hset("people", socket.name, JSON.stringify(g_people[socket.name])); //update user

            socket.emit("update", "Welcome to room (" + room.name + ").");
            socket.emit("get:rooms", g_rooms);

            socket.emit("get:history", {history: g_chatHistory[room.name], room: room.name});

        });

        socket.on("leave:room", function (roomName) {
            if (!g_rooms.hasOwnProperty(roomName)) {
                log(" INVALID leave:room - roomName from : <" + socket.name + ">");
                return;
            }
            var room = g_rooms[roomName];

            console.log("leave");
            console.log(room.people);

            socket.leave(room.name);

            // if last user in room - delete it!
            if (Object.keys(room.people).length <= 1) {
                delete g_rooms[room.name];

                //againsts errors check
                if (!g_people[socket.name].owns.hasOwnProperty(room.name)) {
                    delete g_people[socket.name].owns[room.name];
                }
                delete g_people[socket.name].rooms[room.name];

                io.emit("delete:room", room.name);
                socket.emit("update", "You leave room " + room.name + ". Room destroyed.");
            } else {
                var msg ='';
                if (room.owner === socket.name) {
                    delete g_rooms[room.name].people[socket.name]; // delete from room
                    delete g_people[socket.name].owns[room.name]; // clear user owns
                    delete g_people[socket.name].rooms[room.name]; //clear user rooms
                    g_rooms[room.name].owner = Object.keys(g_rooms[room.name].people)[0]; // new owner -> take first
                    io.sockets.connected[g_people[g_rooms[room.name].owner].socketID].emit("get:person",
                        g_people[g_rooms[room.name].owner]); // update new owner's view
                    msg = "Owner (" + socket.name + ") leave room. New owner is " + g_rooms[room.name].owner;
                } else {
                    delete g_rooms[room.name].people[socket.name]; // delete from room
                    delete g_people[socket.name].rooms[room.name]; //clear user rooms
                    msg = "User (" + socket.name + ") leave room";
                }
                io.in(room.name).emit("get:msg", {name: BENDER, message: msg, room: room.name});
                socket.emit("get:room", g_rooms[room.name]);
                socket.emit("update", "You leave room " + room.name + ".");
            }
            client.hset("people", socket.name, JSON.stringify(g_people[socket.name])); //update user
        });
    });
};