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

            $conv.animate({
                scrollTop: $conv[0].scrollHeight
            });

            console.log($to);
            console.log(data.message);
            $to.append("<li class='bg-warning'><strong><span class='component' onclick='whisper(\"" +
                data.name  + "\");' class='text-success'>" + data.name + "</span></strong>: " +
                Autolinker.link(data.message) + "</li>");
        });

        socket.on('get:history', function (data) {
            var $to = $(".conversation[data-id='"+data.room+"'] .msgs");
            console.log($to);
            console.log(data.history);
            $.each(data.history, function( index, value ) {
                $to.append("<li>" + value + "</li>");
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
            $("#whispers").append("<li class='text-whisper'><strong><span " + handler + ">" +
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