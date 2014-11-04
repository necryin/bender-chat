(function() {
    var CHAT = "127.8.4.129:15500";
    var app = angular.module('benderChat', ['ui.bootstrap']);

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

    var $conv = $("#conversation");
    $conv.on("DOMSubtreeModified", function () {
        $conv.animate({
            scrollTop: $conv[0].scrollHeight
        });
    });

    app.factory('device',  function ($window) {
        if ($window.navigator.userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i)) {
            return "mobile";
        }
        return "desktop";
    });

    app.controller('ChatController', function($scope, socket, device) {
        if (user === undefined) alert('FATAL ERROR!!!');

        $scope.rooms = null;
        $scope.roomsCount = 0;
        $scope.user = user;
        $scope.people = null;
        $scope.peopleCount = 0;

        socket.emit("join:server", {username: $scope.user.username, device: device});

        $scope.send = function () {
            var msg = $("#msg");
            if (msg.val() !== "") {
                socket.emit("send:msg", msg.val());
                msg.val("");
            }
        };

        // sockets handlers
        socket.on("joined:server", function (id) {
            $scope.user.chatID = id;

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

        socket.on('get:msg', function (data) {
            $("#msgs").append("<li class='bg-warning'><strong><span class='text-success'>" + data.name + "</span></strong>: " + data.message + "</li>");
        });

        socket.on('get:rooms', function (data) {
            $scope.rooms = data;
            console.log(data);
            $scope.roomsCount = Object.keys(data).length;
        });

        socket.on('get:people', function (data) {
            $scope.people = data;
            console.log(data);
            $scope.peopleCount = Object.keys(data).length;
        });

        socket.on("update", function (msg) {
            $("#msgs").append("<li class='bg-danger'>" + msg + "</li>");
        });

        socket.on("disconnect", function () {
            $("#send").attr("disabled", "disabled");
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
                    $scope.nir = people.indexOf(user.chatID) === -1;
                    return $scope.nir;
                };

                $scope.isBoss = function(owner) {
                    $scope.boss = owner == user.chatID;
                    return  $scope.boss;
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
                                        socket.emit("join:room", {id: roomid, password: password});
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
                        socket.emit("join:room", roomid);
                    }
                };
            },
            controllerAs: "roomsCtrl"
        };
    });

    app.directive("people", function(socket) {
        return {
            restrict: "E",
            templateUrl: "partials/people-part",
            controller: function($scope) {
                $scope.whisper = function(name) {
                    $("#msg").val("w:" + name + ":").focus();
                };
            },
            controllerAs: "peopleCtrl"
        };
    });
})();