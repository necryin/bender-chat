var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require("socket.io").listen(server),
    uuid = require('node-uuid'),
    Room = require('./room.js'),
    _ = require('underscore')._;

app.configure(function() {
    app.set('port', 15500 );
    app.set('ipaddr', process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1");
});

server.listen(app.get('port'), app.get('ipaddr'), function(){
    console.log('Express server listening on  IP: ' + app.get('ipaddr') + ' and port ' + app.get('port'));
});

io.set("log level", 1);
var people = {};
var rooms = {};
var sockets = [];
var chatHistory = {};
var HISTORY_LENGTH = 10;

function purge(s, action) {
    /*
     The action will determine how we deal with the room/user removal.
     These are the following scenarios:
     if the user is the owner and (s)he:
     1) disconnects (i.e. leaves the whole server)
     - advise users
     - delete user from people object
     - delete room from rooms object
     - delete chat history
     - remove all users from room that is owned by disconnecting user
     2) removes the room
     - same as above except except not removing user from the people object
     3) leaves the room
     - same as above
     if the user is not an owner and (s)he's in a room:
     1) disconnects
     - delete user from people object
     - remove user from room.people object
     2) removes the room
     - produce error message (only owners can remove rooms)
     3) leaves the room
     - same as point 1 except not removing user from the people object
     if the user is not an owner and not in a room:
     1) disconnects
     - same as above except not removing user from room.people object
     2) removes the room
     - produce error message (only owners can remove rooms)
     3) leaves the room
     - n/a
     */
    if (people[s.id].inroom) { //user is in a room
        var room = rooms[people[s.id].inroom]; //check which room user is in.
        if (s.id === room.owner) { //user in room and owns room
            if (action === "disconnect") {
                io.sockets.in(s.room).emit("update", "The owner (" +people[s.id].name + ") has left the server. The room is removed and you have been disconnected from it as well.");
                var socketids = [];
                for (var i=0; i<sockets.length; i++) {
                    socketids.push(sockets[i].id);
                    if(_.contains((socketids)), room.people) {
                        sockets[i].leave(room.name);
                    }
                }

                if(_.contains((room.people)), s.id) {
                    for (var i=0; i<room.people.length; i++) {
                        people[room.people[i]].inroom = null;
                    }
                }
                room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
                delete rooms[people[s.id].owns]; //delete the room
                delete people[s.id]; //delete user from people collection
                delete chatHistory[room.name]; //delete the chat history
                sizePeople = _.size(people);
                sizeRooms = _.size(rooms);
                io.sockets.emit("get:people", people);
                io.sockets.emit("get:rooms", rooms);
                var o = _.findWhere(sockets, {'id': s.id});
                sockets = _.without(sockets, o);
            } else if (action === "delete:room") { //room owner removes room
                io.sockets.in(s.room).emit("update", "The owner (" +people[s.id].name + ") has removed the room. The room is removed and you have been disconnected from it as well.");
                var socketids = [];
                for (var i=0; i<sockets.length; i++) {
                    socketids.push(sockets[i].id);
                    if(_.contains((socketids)), room.people) {
                        sockets[i].leave(room.name);
                    }
                }

                if(_.contains((room.people)), s.id) {
                    for (var i=0; i<room.people.length; i++) {
                        people[room.people[i]].inroom = null;
                    }
                }
                delete rooms[people[s.id].owns];
                people[s.id].owns = null;
                room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
                delete chatHistory[room.name]; //delete the chat history
                sizeRooms = _.size(rooms);
                io.sockets.emit("get:rooms", rooms);
            } else if (action === "leaveRoom") { //room owner leaves room
                io.sockets.in(s.room).emit("update", "The owner (" +people[s.id].name + ") has left the room. The room is removed and you have been disconnected from it as well.");
                var socketids = [];
                for (var i=0; i<sockets.length; i++) {
                    socketids.push(sockets[i].id);
                    if(_.contains(socketids), room.people) {
                        sockets[i].leave(room.name);
                    }
                }

                if(_.contains((room.people)), s.id) {
                    for (var i=0; i<room.people.length; i++) {
                        people[room.people[i]].inroom = null;
                    }
                }
                delete rooms[people[s.id].owns];
                people[s.id].owns = null;
                room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
                delete chatHistory[room.name]; //delete the chat history
                io.sockets.emit("get:rooms", rooms);
            }
        } else {//user in room but does not own room
            if (action === "disconnect") {
                io.sockets.emit("update", people[s.id].name + " has disconnected from the server.");
                if (_.contains((room.people), s.id)) {
                    var personIndex = room.people.indexOf(s.id);
                    room.people.splice(personIndex, 1);
                    s.leave(room.name);
                }
                delete people[s.id];
                sizePeople = _.size(people);
                io.sockets.emit("get:people", people);
                var o = _.findWhere(sockets, {'id': s.id});
                sockets = _.without(sockets, o);
            } else if (action === "delete:room") {
                s.emit("update", "Only the owner can remove a room.");
            } else if (action === "leaveRoom") {
                if (_.contains((room.people), s.id)) {
                    var personIndex = room.people.indexOf(s.id);
                    room.people.splice(personIndex, 1);
                    people[s.id].inroom = null;
                    s.emit("get:rooms", rooms);
                    io.sockets.emit("update", people[s.id].name + " has left the room.");
                    s.leave(room.name);
                }
            }
        }
    } else {
        //The user isn't in a room, but maybe he just disconnected, handle the scenario:
        if (action === "disconnect") {
            io.sockets.emit("update", people[s.id].name + " has disconnected from the server.");
            delete people[s.id];
            sizePeople = _.size(people);
            io.sockets.emit("get:people", people);
            var o = _.findWhere(sockets, {'id': s.id});
            sockets = _.without(sockets, o);
        }
    }
}

io.sockets.on("connection", function (socket) {

    socket.on("join:server", function(data) {
        var name = data.username;
        var device = data.device;
        var ownerRoomID = inRoomID = null;
        people[socket.id] = {"name" : name, "owns" : ownerRoomID, "inroom": inRoomID, "device": device};
        socket.emit("update", "You have connected to the server.");

        io.sockets.emit("update", people[socket.id].name + " is online.")
        io.sockets.emit("get:people", people);

        socket.emit("joined:server", socket.id); //extra emit for GeoLocation
        socket.emit("get:rooms", rooms);
        sockets.push(socket);
    });

    socket.on("set:user:country", function(data) { //we know which country the user is from
        people[socket.id].country = data.country.toLowerCase();
        io.sockets.emit("get:people", people);
    });

    socket.on("typing", function(data) {
        if (typeof people[socket.id] !== "undefined")
            io.sockets.in(socket.room).emit("isTyping", {isTyping: data, person: people[socket.id].name});
    });

    socket.on("send:msg", function(msg) {
        //process.exit(1);
        var re = /^[w]:.*:/;
        var whisper = re.test(msg);
        var whisperStr = msg.split(":");
        var found = false;
        if (whisper) {
            var whisperTo = whisperStr[1];
            var keys = Object.keys(people);
            for (var i = 0; i<keys.length; i++) {
                if (people[keys[i]].name === whisperTo) {
                    var whisperId = keys[i];
                    found = true;
                    if (socket.id === whisperId) { //can't whisper to ourselves
                        socket.emit("update", "You can't whisper to yourself.");
                    }
                    break;
                }
            }

            if (found && socket.id !== whisperId) {
                var whisperMsg = whisperStr[2];
                socket.emit("whisper", {name: "You"}, whisperMsg);
                io.sockets.socket(whisperId).emit("whisper", people[socket.id], whisperMsg);
            } else {
                socket.emit("update", "Can't find " + whisperTo);
            }
        } else {
            if (io.sockets.manager.roomClients[socket.id]['/'+socket.room] !== undefined ) {
                io.sockets.in(socket.room).emit("get:msg", {name: people[socket.id].name, message: msg});
                socket.emit("isTyping", false);
                if (_.size(chatHistory[socket.room]) > HISTORY_LENGTH) {
                    chatHistory[socket.room].splice(0,1);
                } else {
                    chatHistory[socket.room].push(people[socket.id].name + ": " + msg);
                }
            } else {
                socket.emit("update", "Please connect to a room.");
            }
        }
    });

    socket.on("disconnect", function() {
        if (typeof people[socket.id] !== "undefined") {
            purge(socket, "disconnect");
        }
    });

    //Room functions
    socket.on("put:room", function(data) {
        var name = data.name;
        var password = data.password;
        if (people[socket.id].inroom) {
            socket.emit("update", "You are in a room. Please leave it first to create your own.");
        } else if (!people[socket.id].owns) {
            var id = uuid.v4();
            var room = new Room(name, id, socket.id, password);
            room.private = password ? true : false;
            room.addPerson(socket.id);
            rooms[id] = room;
            console.log(room);
            io.sockets.emit("get:rooms", rooms);
            //add room to socket, and auto join the creator of the room
            socket.room = name;
            socket.join(socket.room);
            people[socket.id].owns = id;
            people[socket.id].inroom = id;

            socket.emit("update", "Welcome to " + room.name + ".");
            socket.emit("sendRoomID", {id: id});
            chatHistory[socket.room] = [];
        } else {
            socket.emit("update", "You have already created a room.");
        }
    });

    socket.on("check", function(name, fn) {
        var match = false;
        _.find(rooms, function(key,value) {
            if (key.name === name)
                return match = true;
        });
        fn({result: match});
    });

    socket.on("delete:room", function(id) {
        var room = rooms[id];
        if (socket.id === room.owner) {
            purge(socket, "delete:room");
        } else {
            socket.emit("update", "Only the owner can remove a room.");
        }
    });

    socket.on("join:room", function(data) {
        var id = data.id;
        var password = data.password;
        console.log(id)
        console.log(password)
        if (typeof people[socket.id] !== "undefined") {
            var room = rooms[id];
            if (socket.id === room.owner) {
                socket.emit("update", "You are the owner of this room and you have already been joined.");
            } else {
                if (_.contains((room.people), socket.id)) {
                    socket.emit("update", "You have already joined this room.");
                } else {
                    if (people[socket.id].inroom !== null) {
                        socket.emit("update", "You are already in a room ("+rooms[people[socket.id].inroom].name+"), please leave it first to join another room.");
                    } else {
                        if (room.private) {
                            if (!password || password !== room.getPassword()) {
                                socket.emit("update", "Wrong password!");
                                return;
                            }
                        }
                        room.addPerson(socket.id);
                        people[socket.id].inroom = id;
                        socket.room = room.name;
                        socket.join(socket.room);
                        user = people[socket.id];
                        io.sockets.in(socket.room).emit("update", user.name + " has connected to " + room.name + " room.");
                        socket.emit("update", "Welcome to " + room.name + ".");
                        socket.emit("get:rooms", rooms);
                        var keys = _.keys(chatHistory);
                        if (_.contains(keys, socket.room)) {
                            socket.emit("history", chatHistory[socket.room]);
                        }
                    }
                }
            }
        } else {
            socket.emit("update", "Please enter a valid name first.");
        }
    });

    socket.on("leave:room", function(id) {
        var room = rooms[id];
        if (room){
            purge(socket, "leaveRoom");
        }
    });
});
