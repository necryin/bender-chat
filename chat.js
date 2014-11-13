module.exports = function (server, client, log) {

    var io = require("socket.io").listen(server),
        escape = require('escape-html'),
        logger = require("./logger"),
        bcrypt = require('bcrypt');

//    client.flushdb();

    // GLOBAL VARS
    var g_people = {};
    var g_rooms = {};
    var g_chatHistory = {};
    var HISTORY_LENGTH = 100;
    var DEFAULT_ROOM = "default";
    var BENDER = "bender";
    var MAX_MSG_LENGTH = 800;

    //when start we get people from redis
    client.hgetall("people", function (err, result) {
        for (key in result) {
            g_people[key] = JSON.parse(result[key]);
        }
    });

    //when start we get rooms from redis
    client.hgetall("rooms", function (err, result) {
        for (key in result) {
            g_rooms[key] = JSON.parse(result[key]);
        }
    });

    //when start we get history from redis
    client.hgetall("history", function (err, result) {
        for (key in result) {
            g_chatHistory[key] = JSON.parse(result[key]);
        }
    });

    //create default room
    var droom = {
        name: DEFAULT_ROOM,
        owner: BENDER,
        people: {},
        private: false,
        password: null
    };
    g_rooms[droom.name] = droom;

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
            for (var k in g_people) {
                if (!g_people[k].hasOwnProperty("status")) {
                    result[k] = g_people[k];
                }
            }
        } else {
            for (var key in g_people) {
                if (g_people[key].status == status) {
                    result[key] = g_people[key];
                }
            }
        }

        return result;
    }

    function findClientsSocket(roomId, namespace) {
        var res = [], ns = io.of(namespace || "/"); // the default namespace is "/"
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

    io.on("connection", function (socket) {

        socket.on("join:server", function (data) {
            if (!data.hasOwnProperty('username') || !data.hasOwnProperty('device')) {
                logger.log(" INVALID DATA join:server from <" + socket.name + ">");
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
            for (roomName in g_people[name].rooms) {
                socket.join(roomName);
                g_rooms[roomName].people[socket.name] = true;
                client.hset("rooms", roomName, JSON.stringify(g_rooms[roomName]));
                io.in(roomName).emit("get:msg", {name: BENDER, message: msg, room: roomName});
                if (g_chatHistory.hasOwnProperty(roomName)) {
                    for (var i=-1; i < g_chatHistory[roomName].length; ++i) {
                        if(typeof g_chatHistory[roomName][i] !== 'undefined'){
                            socket.emit("get:msg", g_chatHistory[roomName][i]);
                        }
                    }
                }
                socket.emit("update", "Welcome to room [" + roomName + "].");
            }

            logger.log("connected " + socket.name);
            g_people[name].status = status;
            g_people[name].socketID = socket.id;
            socket.emit("get:people", filterPeople("online"));
            socket.emit("get:rooms", g_rooms);

            socket.broadcast.emit("update", name + " is online.");
            socket.broadcast.emit("get:person", g_people[name]);

            socket.emit("joined:server"); //extra emit for GeoLocation
        });

        //TODO: fix or delete this functional
        socket.on("set:user:country", function (data) { //we know which country the user is from
            if (g_people.hasOwnProperty(socket.name)) {
                g_people[socket.name].country = data.country.toLowerCase();
                io.emit("get:person", g_people[socket.name]);
            }
        });

        //TODO: fix or delete this functional
        socket.on("typing", function (data) {
            if (g_people.hasOwnProperty(socket.name)) {
                io.in(socket.room).emit("isTyping", {isTyping: data, person: socket.name});
            }
        });

        //TODO add msg entity
        socket.on("send:msg", function (data) {
            if (!data.hasOwnProperty('msg') || !data.hasOwnProperty('room') || !data.hasOwnProperty('datetime')) {
                logger.log(" INVALID DATA send:msg from <" + socket.name + ">");
                return;
            }
            if (data.msg.length > MAX_MSG_LENGTH) {
                logger.log(" SO BIG DATA send:msg from <" + socket.name + ">");
                data.msg = data.msg.substr(0, MAX_MSG_LENGTH);
            }
            var msg = escape(data.msg);
            var roomName = data.room;
            var datetime = new Date(data.datetime).toUTCString();

            var re = /^[w]:.*:/;
            var whisper = re.test(msg);

            if (whisper) {
                var whisperStr = msg.split(":");
                var whisperTo = whisperStr[1];
                var whisperMsg = whisperStr[2];

                logger.log(socket.name + "whisper to " + whisperTo);
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
                logger.log(socket.name + " in room " + roomName + " say: " + msg);

                var msgEntity = {name: socket.name, message: msg, room: roomName, datetime: datetime};
                io.in(roomName).emit("get:msg", msgEntity);
//                socket.emit("isTyping", false);

                //no more then HISTORY_LENGTH
                if (Object.keys(g_rooms[roomName].people).length > HISTORY_LENGTH) {
                    g_chatHistory[roomName].splice(0, 1);
                } else {
                    g_chatHistory[roomName].push(msgEntity);
                }
                client.hset("history", roomName, JSON.stringify( g_chatHistory[roomName] )); //update room
            }
        });

        //TODO: disconnect not active users (memory leaks I think)
        socket.on("disconnect", function () {
            logger.log("disconnect " + socket.name);
            if (!g_people.hasOwnProperty(socket.name)) {
                console.log("AHTUNG: disconnect something need check!!!"); //there are problems with disconnecting
                return;
            }

            // say everybody goodbye!
            var msg = "User [" + socket.name + "] disconnected";
            for (var roomName in g_people[socket.name].rooms) {
                io.in(roomName).emit("get:msg", {name: BENDER, message: msg, room: roomName});
            }

            delete g_people[socket.name].status;
            io.emit("delete:person", g_people[socket.name]); // update people view
        });

        //create new room
        socket.on("put:room", function (data) {
            if (!data.hasOwnProperty('name') || !data.hasOwnProperty('password')) {
                logger.log(" INVALID DATA put:room from <" + socket.name + ">");
                return;
            }

            var name = data.name;
            var password = data.password;

            if (!g_rooms.hasOwnProperty(name)) {
                if (name.trim().length <= 0) {
                    socket.emit("update", "Invalid room name");
                    return;
                }
                var hash = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
                var room = {
                    name: name,
                    owner: socket.name,
                    people: {},
                    private: password ? true : false,
                    password: hash || null
                };

                room.people[socket.name] = true;
                g_rooms[room.name] = room;

                logger.log(socket.name + " put:room " + room.name);

                io.emit("get:room", room);

                socket.join(room.name);

                g_people[socket.name].owns[room.name] = true;
                g_people[socket.name].rooms[room.name] = true;

                client.hset("people", socket.name, JSON.stringify(g_people[socket.name])); //update user
                client.hset("rooms", room.name, JSON.stringify( g_rooms[room.name])); //update room
                socket.emit("get:person", g_people[socket.name]);
                socket.emit("update", "Room " + room.name + " created.");
                g_chatHistory[room.name] = [];
            } else {
                socket.emit("update", "Room with [" + name + "] name is already exist");
            }
        });

        // not in use bcs (when last person leave room it's autodelete)
        socket.on("delete:room", function (name) {
            var room = g_rooms[name];
            if (!name || typeof room === 'undefined' || name === DEFAULT_ROOM) {
                console.log("AHTUNG: delete:room cheater!!!");
                return false;
            }
            if (socket.name === room.owner) {
                logger.log(socket.name + " delete:room" + room.name);
                delete g_rooms[room.name];

                io.in(room.name).emit("update", "The owner [" + socket.name + "] has removed the room. The room is removed and you have been disconnected from it as well.");

                delete g_people[socket.name].owns[room.name];

                var clients = findClientsSocket(room.name);
                for (var i = 0; i < clients.length; i++) {
                    clients[i].leave(room.name);

                    if (g_people[clients[i].name].rooms.hasOwnProperty(room.name)) {
                        delete g_people[clients[i].name].rooms[room.name];
                        client.hset("people", clients[i].name, JSON.stringify(g_people[clients[i].name])); //update user
                    }
                }
                delete g_chatHistory[room.name]; //clear chat history
                client.hdel("rooms", room.name);
                io.emit("get:room", room);
            } else {
                socket.emit("update", "Only the owner can remove a room.");
            }
        });

        socket.on("join:room", function (data) {
            if (!data.hasOwnProperty('name') || !data.hasOwnProperty('password')) {
                logger.log(" INVALID DATA from join:room <" + socket.name + ">");
                return;
            }
            var roomName = data.name;
            var roomPass = data.password;

            if (!g_rooms.hasOwnProperty(roomName)) {
                logger.log(" INVALID join:room - roomName from : <" + socket.name + ">");
                return;
            }

            var room = g_rooms[roomName];

            logger.log(socket.name + " join:room " + roomName);
            if (room.private) {
                if (!roomPass || !bcrypt.compareSync(roomPass, room.password)) {
                    socket.emit("update", "Wrong password!");
                    return;
                }
            }

            g_rooms[room.name].people[socket.name] = true;
            g_people[socket.name].rooms[room.name] = true;
            socket.join(room.name);

            io.in(room.name).emit("update", socket.name + " has connected.");
            client.hset("people", socket.name, JSON.stringify(g_people[socket.name])); //update user
            client.hset("rooms", room.name, JSON.stringify( g_rooms[room.name]));

            socket.emit("update", "Welcome to room [" + room.name + "].");
            socket.emit("get:room", room);

            for (var i=-1; i < g_chatHistory[room.name].length; ++i) {
                if(typeof g_chatHistory[room.name][i] !== 'undefined'){
                    socket.emit("get:msg", g_chatHistory[room.name][i]);
                }
            }
        });

        socket.on("leave:room", function (roomName) {
            if (!g_rooms.hasOwnProperty(roomName)) {
                logger.log(" INVALID leave:room - roomName from : <" + socket.name + ">");
                return;
            }
            logger.log(socket.name + " leave:room " + roomName);
            var room = g_rooms[roomName];

            socket.leave(room.name);

            // if last user in room - delete it!
            if (Object.keys(room.people).length <= 1) {
                logger.log(socket.name + " leave:room " + roomName + " and room deleted");
                delete g_rooms[room.name];
                client.hdel("rooms", room.name);

                // check against errors
                if (g_people[socket.name].owns.hasOwnProperty(room.name)) {
                    delete g_people[socket.name].owns[room.name];
                }
                delete g_people[socket.name].rooms[room.name];

                io.emit("delete:room", room.name);
                socket.emit("update", "You leave room [" + room.name + "]. Room destroyed.");
            } else {
                var msg = '';
                if (room.owner === socket.name) {
                    delete g_rooms[room.name].people[socket.name]; // delete from room
                    delete g_people[socket.name].owns[room.name]; // clear user owns
                    delete g_people[socket.name].rooms[room.name]; //clear user rooms
                    g_rooms[room.name].owner = Object.keys(g_rooms[room.name].people)[0]; // new owner -> take first
                    io.sockets.connected[g_people[g_rooms[room.name].owner].socketID].emit("get:person",
                        g_people[g_rooms[room.name].owner]); // update new owner's view
                    msg = "Owner [" + socket.name + "] leave room. New owner is " + g_rooms[room.name].owner;
                } else {
                    delete g_rooms[room.name].people[socket.name]; // delete from room
                    delete g_people[socket.name].rooms[room.name]; //clear user rooms
                    msg = "User [" + socket.name + "] leave room";
                }
                io.in(room.name).emit("get:msg", {name: BENDER, message: msg, room: room.name});
                socket.emit("get:room", room);
                socket.emit("update", "You leave room [" + room.name + "].");
            }
            client.hset("people", socket.name, JSON.stringify(g_people[socket.name])); //update user
            client.hset("rooms", room.name, JSON.stringify( g_rooms[room.name]));
        });
    });
};