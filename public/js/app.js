(function() {
    var app = angular.module('benderChat', ['ui.bootstrap']);

    var CHAT = window.location.host;
    if(CHAT.indexOf('rhcloud.com') !== -1) {
        CHAT += ":8000";
    }

    app.factory('socket', function ($rootScope) {
        var socket = io.connect(CHAT);
        return {
            on: function (eventName, callback) {
                socket.on(eventName, function () {
                    var args = arguments;
                    $rootScope.$apply(function () {
                        callback.apply(socket, args);
                    });
                });
            },
            emit: function (eventName, data, callback) {
                socket.emit(eventName, data, function () {
                    var args = arguments;
                    $rootScope.$apply(function () {
                        if (callback) {
                            callback.apply(socket, args);
                        }
                    });
                })
            }
        };
    });

    app.factory('device',  function ($window) {
        if ($window.navigator.userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i)) {
            return "mobile";
        }
        return "desktop";
    });

    app.controller('tabsCtrl', function ($scope, $rootScope, $interval, socket) {
        $scope.leaveRoom = function (roomName) {
            socket.emit("leave:room", roomName);
            delete $scope.userRooms[roomName];
        };
        $scope.clicked = function (roomName) {
            $interval.cancel($rootScope.tabIntervals[roomName]);
            $("tab-heading[data-id='"+roomName+"']").parents("a").css("background-color", "#fff");
        };

    });

    app.controller('ChatController', function($scope, $rootScope, $interval, socket, device) {
//        if (typeof user === 'undefined') alert('FATAL ERROR!!!');

        $scope.DEFAULT_ROOM = "default";
        $scope.rooms = {};
        $scope.roomsCount = 0;
        $scope.user = user;
        $scope.userRooms = {};
        $scope.people = {};
        $scope.peopleCount = 0;

        $rootScope.tabIntervals = {};

        socket.emit("disconnect");

        socket.emit("join:server", {username: $scope.user.username, device: device});

        //emoticons
        var definition = {smile:{title:"Smile",codes:[":)",":=)",":-)"]},"sad-smile":{title:"Sad Smile",codes:[":(",":=(",":-("]},"big-smile":{title:"Big Smile",codes:[":D",":=D",":-D",":d",":=d",":-d"]},cool:{title:"Cool",codes:["8)","8=)","8-)","B)","B=)","B-)","(cool)"]},wink:{title:"Wink",codes:[":o",":=o",":-o",":O",":=O",":-O"]},crying:{title:"Crying",codes:[";(",";-(",";=("]},sweating:{title:"Sweating",codes:["(sweat)","(:|"]},speechless:{title:"Speechless",codes:[":|",":=|",":-|"]},kiss:{title:"Kiss",codes:[":*",":=*",":-*"]},"tongue-out":{title:"Tongue Out",codes:[":P",":=P",":-P",":p",":=p",":-p"]},blush:{title:"Blush",codes:["(blush)",":$",":-$",":=$",':">']},wondering:{title:"Wondering",codes:[":^)"]},sleepy:{title:"Sleepy",codes:["|-)","I-)","I=)","(snooze)"]},dull:{title:"Dull",codes:["|(","|-(","|=("]},"in-love":{title:"In love",codes:["(inlove)"]},"evil-grin":{title:"Evil grin",codes:["]:)",">:)","(grin)"]},talking:{title:"Talking",codes:["(talk)"]},yawn:{title:"Yawn",codes:["(yawn)","|-()"]},puke:{title:"Puke",codes:["(puke)",":&",":-&",":=&"]},"doh!":{title:"Doh!",codes:["(doh)"]},angry:{title:"Angry",codes:[":@",":-@",":=@","x(","x-(","x=(","X(","X-(","X=("]},"it-wasnt-me":{title:"It wasn't me",codes:["(wasntme)"]},party:{title:"Party!!!",codes:["(party)"]},worried:{title:"Worried",codes:[":S",":-S",":=S",":s",":-s",":=s"]},mmm:{title:"Mmm...",codes:["(mm)"]},nerd:{title:"Nerd",codes:["8-|","B-|","8|","B|","8=|","B=|","(nerd)"]},"lips-sealed":{title:"Lips Sealed",codes:[":x",":-x",":X",":-X",":#",":-#",":=x",":=X",":=#"]},hi:{title:"Hi",codes:["(hi)"]},call:{title:"Call",codes:["(call)"]},devil:{title:"Devil",codes:["(devil)"]},angel:{title:"Angel",codes:["(angel)"]},envy:{title:"Envy",codes:["(envy)"]},wait:{title:"Wait",codes:["(wait)"]},bear:{title:"Bear",codes:["(bear)","(hug)"]},"make-up":{title:"Make-up",codes:["(makeup)","(kate)"]},"covered-laugh":{title:"Covered Laugh",codes:["(giggle)","(chuckle)"]},"clapping-hands":{title:"Clapping Hands",codes:["(clap)"]},thinking:{title:"Thinking",codes:["(think)",":?",":-?",":=?"]},bow:{title:"Bow",codes:["(bow)"]},rofl:{title:"Rolling on the floor laughing",codes:["(rofl)"]},whew:{title:"Whew",codes:["(whew)"]},happy:{title:"Happy",codes:["(happy)"]},smirking:{title:"Smirking",codes:["(smirk)"]},nodding:{title:"Nodding",codes:["(nod)"]},shaking:{title:"Shaking",codes:["(shake)"]},punch:{title:"Punch",codes:["(punch)"]},emo:{title:"Emo",codes:["(emo)"]},yes:{title:"Yes",codes:["(y)","(Y)","(ok)"]},no:{title:"No",codes:["(n)","(N)"]},handshake:{title:"Shaking Hands",codes:["(handshake)"]},skype:{title:"Skype",codes:["(skype)","(ss)"]},heart:{title:"Heart",codes:["(h)","<3","(H)","(l)","(L)"]},"broken-heart":{title:"Broken heart",codes:["(u)","(U)"]},mail:{title:"Mail",codes:["(e)","(m)"]},flower:{title:"Flower",codes:["(f)","(F)"]},rain:{title:"Rain",codes:["(rain)","(london)","(st)"]},sun:{title:"Sun",codes:["(sun)"]},time:{title:"Time",codes:["(o)","(O)","(time)"]},music:{title:"Music",codes:["(music)"]},movie:{title:"Movie",codes:["(~)","(film)","(movie)"]},phone:{title:"Phone",codes:["(mp)","(ph)"]},coffee:{title:"Coffee",codes:["(coffee)"]},pizza:{title:"Pizza",codes:["(pizza)","(pi)"]},cash:{title:"Cash",codes:["(cash)","(mo)","($)"]},muscle:{title:"Muscle",codes:["(muscle)","(flex)"]},cake:{title:"Cake",codes:["(^)","(cake)"]},beer:{title:"Beer",codes:["(beer)"]},drink:{title:"Drink",codes:["(d)","(D)"]},dance:{title:"Dance",codes:["(dance)","\\o/","\\:D/","\\:d/"]},ninja:{title:"Ninja",codes:["(ninja)"]},star:{title:"Star",codes:["(*)"]},mooning:{title:"Mooning",codes:["(mooning)"]},finger:{title:"Finger",codes:["(finger)"]},bandit:{title:"Bandit",codes:["(bandit)"]},drunk:{title:"Drunk",codes:["(drunk)"]},smoking:{title:"Smoking",codes:["(smoking)","(smoke)","(ci)"]},toivo:{title:"Toivo",codes:["(toivo)"]},rock:{title:"Rock",codes:["(rock)"]},headbang:{title:"Headbang",codes:["(headbang)","(banghead)"]},bug:{title:"Bug",codes:["(bug)"]},fubar:{title:"Fubar",codes:["(fubar)"]},poolparty:{title:"Poolparty",codes:["(poolparty)"]},swearing:{title:"Swearing",codes:["(swear)"]},tmi:{title:"TMI",codes:["(tmi)"]},heidy:{title:"Heidy",codes:["(heidy)"]},myspace:{title:"MySpace",codes:["(MySpace)"]},malthe:{title:"Malthe",codes:["(malthe)"]},tauri:{title:"Tauri",codes:["(tauri)"]},priidu:{title:"Priidu",codes:["(priidu)"]}};
        $.emoticons.define(definition);

        $scope.send = function () {
            var roomName =  $(".tab-pane.active > div").attr('data-id');
            var msg = $("#msg");
            if (msg.val() !== "") {
                socket.emit("send:msg", {msg: msg.val(), room: roomName});
                msg.val("");
            }
        };

        // sockets handlers
        socket.on("joined:server", function () {

            if (navigator.geolocation) { //get lat lon of user
                navigator.geolocation.getCurrentPosition(positionSuccess, positionError, { enableHighAccuracy: true });
            }

            function positionError(e) {
                console.log(e);
            }

            function positionSuccess(position) {
                var lat = position.coords.latitude;
                var lon = position.coords.longitude;
                //consult the yahoo service
                $.ajax({
                    type: "GET",
                    url: "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20geo.placefinder%20where%20text%3D%22" +
                        lat + "%2C" + lon + "%22%20and%20gflags%3D%22R%22&format=json",
                    dataType: "json",
                    success: function (data) {
                        socket.emit("set:user:country", {country: data.query.results.Result.countrycode});
                    }
                });
            }
        });

        whisper = function(name) {
            if (name !== user.username) {
                $("#msg").val("w:" + name + ":").focus();
            }
        };

        socket.on('get:msg', function (data) {
            var $conv = $(".conversation[data-id='"+data.room+"']");
            var $tab = $("tab-heading[data-id='"+data.room+"']").parents("a");
            var $to = $conv.find(".msgs");

            //TODO clear $interval
            if (!$tab.parents("li").hasClass('active')) {
                $tab.css("background-color", "#449d44");
                $rootScope.tabIntervals[data.room] = $interval(function(){
                    $tab.fadeTo(300, 0.5).fadeTo(300, 1.0);
                }, 1000, 0, false);
            }

            try { // silence!!!
                $conv.animate({
                    scrollTop: $conv[0].scrollHeight
                });
            } catch (e) {}

            console.log($to);
            console.log(data.message);
            data.message = $.emoticons.replace(data.message);
            $to.append("<li class='msg-text bg-warning'><strong><span class='component' onclick='whisper(\"" +
                data.name  + "\");' class='text-success'>" + data.name + "</span></strong>: " +
                Autolinker.link(data.message) + "</li>");
        });

        socket.on('get:history', function (data) {
            var $to = $(".conversation[data-id='"+data.room+"'] .msgs");
            console.log($to);
            console.log(data.history);
            $.each(data.history, function( index, value ) {
                $to.append("<li class='msg-text bg-warning'>" + value + "</li>");
            });
        });

        socket.on('get:rooms', function (data) {
            console.log("get:rooms");
            console.log(data);
            $scope.rooms = data;
            for (room in data) {
                if (data[room].people.hasOwnProperty(user.username)) {
                    $scope.userRooms[room] = data[room];
                }
            }
            $scope.roomsCount = Object.keys(data).length;
        });

        socket.on('get:people', function (data) {
            $scope.people = data;
            console.log("get:people");
            console.log(data);
            $scope.peopleCount = Object.keys(data).length;
        });

        socket.on('get:person', function (data) {
            console.log('get:person');
            console.log(data);
            if (!$scope.people.hasOwnProperty(data.name)) {
                $scope.peopleCount += 1;
            }
            $scope.people[data.name] = data;

            console.log($scope.people);
        });

        socket.on('delete:person', function (data) {
            console.log('delete:person');
            console.log(data);
            if ($scope.people.hasOwnProperty(data.name)) {
                $scope.peopleCount -= 1;
            }
            delete $scope.people[data.name];

            console.log($scope.people);
        });

        socket.on('delete:room', function (roomName) {
            console.log('delete:room');
            console.log(roomName);
            console.log($scope.rooms);
            console.log($scope.rooms.hasOwnProperty(roomName));
            if ($scope.rooms.hasOwnProperty(roomName)) {
                $scope.roomsCount -= 1;
            }
            delete $scope.rooms[roomName];

            console.log($scope.rooms);
        });

        socket.on('get:room', function (data) {
            console.log('get:room');
            console.log(data);
            console.log(!$scope.rooms.hasOwnProperty(data.name));
            if (!$scope.rooms.hasOwnProperty(data.name)) {
                $scope.roomsCount += 1;
            }
            $scope.rooms[data.name] = data;
            if(data.people.hasOwnProperty(user.username)) {
                $scope.userRooms[data.name] = data;
            }
            console.log($scope.rooms);
        });

        var inRun = false;
        socket.on("update", function (msg) {
            var $system = $("#system");
            $system.append("<li class='list-unstyled'>" + msg + "</li>");

            $system.animate({
                scrollTop: $system[0].scrollHeight
            });

            if (inRun) {
                $interval.cancel(inRun);
            }
            inRun = $interval(function(){
                $system.fadeTo(300, 0.5).fadeTo(300, 1.0);
            }, 700, 3);

        });

        socket.on('whisper', function (data) {
            var handler = "", s = "";
            if (data.name == user.username) {
                data.name = "You";
                s = "whisper to <strong><span class='component' onclick='whisper(\"" +
                    data.to  + "\");'>" + data.to + "</span></strong>: ";
            } else {
                s ="whispers: ";
                handler = "class='component' onclick='whisper(\"" + data.name  + "\");'";
            }
            $("#whispers").append("<li class='text-whisper msg-text'><strong><span " + handler + ">" +
                data.name + "</span></strong> " + s + data.msg + "</li>");
        });

        socket.on("disconnect", function () {
            $("#main-chat-screen").html("<h1 style='padding-left: 15%;'>SERVER IS GO AWAY. " +
                "<a href='/'>CLICK HERE</a> TO RELOAD OR PRESS F5<br>(if you see white screen - try later)</h1>");
        });
    });

    app.directive("rooms", function(socket) {
        return {
            restrict: "E",
            templateUrl: "partials/rooms-part",
            controller: function($scope, $modal) {
                $scope.createRoom = function(size) {
                    var modalInstance = $modal.open({
                        templateUrl: 'partials/room-modal',
                        size: size,
                        controller: function($scope, $modalInstance){

                            $scope.create = function () {
                                var roomName = $(".roomModal .roomName").val();
                                var roomPass = $(".roomModal .roomPass").val();
                                socket.emit("put:room", {name: roomName, password: roomPass});
                                $modalInstance.dismiss('cancel');
                            };

                            $scope.cancel = function () {
                                $modalInstance.dismiss('cancel');
                            };
                        },
                        controllerAs: "roomModal"
                    });
                };

                $scope.deleteRoom = function(roomid) {
                    socket.emit("delete:room", roomid);
                };

                $scope.leaveRoom = function(roomid) {
                    socket.emit("leave:room", roomid);
                };

                $scope.notInRoom = function(people) {
                    $scope.nir = (!people.hasOwnProperty(user.username));
                    return $scope.nir;
                };

                $scope.isBoss = function(owner) {
                    $scope.boss = owner == user.username;
                    return $scope.boss;
                };

                $scope.showLeave = function(roomName) {
                    return $scope.nir &&  $scope.boss && roomName !== "default";
                };

                $scope.joinRoom = function(roomid, isPrivate, size) {
                    if(isPrivate) {
                        var modalInstance = $modal.open({
                            templateUrl: 'partials/join-room-modal',
                            size: size,
                            controller: function($scope, $modalInstance){
                                $scope.error = false;

                                $scope.join = function () {
                                    var $modalElem = $(".joinRoomModal");
                                    var password = $($modalElem).find(".roomPass").val();
                                    if (password) {
                                        socket.emit("join:room", {name: roomid, password: password});
                                        $modalInstance.dismiss('cancel');
                                    } else {
                                        $scope.error = true;
                                    }
                                };

                                $scope.clear = function () {
                                    $scope.error = false;
                                };

                                $scope.cancel = function () {
                                    $modalInstance.dismiss('cancel');
                                };
                            },
                            controllerAs: "joinRoomModal"
                        });
                    } else {
                        socket.emit("join:room", {name: roomid, password: null});
                    }
                };
            },
            controllerAs: "roomsCtrl"
        };
    });

    app.directive("people", function() {
        return {
            restrict: "E",
            templateUrl: "partials/people-part",
            controller: function($scope) {
                $scope.isOwner = function(name) {
                    return name == user.username;
                };
                $scope.whisper = function(name) {
                    $("#msg").val("w:" + name + ":").focus();
                };
            },
            controllerAs: "peopleCtrl"
        };
    });
})();