$(document).ready(function () {
    var socket = io.connect("127.0.0.1:3000");
    var myRoomID = null;
    
    var errorsField = $("#errors");
    var msgField = $("#msg");
    var msgs = $("#msgs");
    var $rooms = $("#rooms");
    var myId = null;
    var people =  $("#people");

    $("form").submit(function (event) {
        event.preventDefault();
    });

    var $conv = $("#conversation");
    $conv.bind("DOMSubtreeModified", function () {
        $conv.animate({
            scrollTop: $conv[0].scrollHeight
        });
    });

    if (navigator.userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i)) {
        var device = "mobile";
    }
    //user set in index.jade
    socket.emit("join:server", user.username, device || "desktop");

    //main chat screen
    $("#chatForm").submit(function () {
        var msg = msgField.val();
        if (msg !== "") {
            socket.emit("send:msg", msg);
            msgField.val("");
        }
    });

    //'is typing' message
    var typing = false;
    var timeout = undefined;

    function timeoutFunction() {
        typing = false;
        socket.emit("typing", false);
    }

    msgField.keypress(function (e) {
        if (e.which !== 13) {
            if (typing === false && myRoomID !== null && msgField.is(":focus")) {
                typing = true;
                socket.emit("typing", true);
            } else {
                clearTimeout(timeout);
                timeout = setTimeout(timeoutFunction, 5000);
            }
        }
    });

    socket.on("isTyping", function (data) {
        if (data.isTyping) {
            if ($("#" + data.person + "").length === 0) {
                $("#updates").append("<li id='" + data.person + "'><span class='text-muted'><small><i class='fa fa-keyboard-o'></i> " + data.person + " is typing.</small></li>");
                timeout = setTimeout(timeoutFunction, 5000);
            }
        } else {
            $("#" + data.person + "").remove();
        }
    });

    $("#showCreateRoom").click(function () {
        $("#roomModal").modal("show");
    });

    $("#createRoomBtn").click(function () {
        var roomExists = false;
        var roomName = $("#createRoomName").val();
        var roomPass = $("#createRoomPass").val();
        socket.emit("check", roomName, function (data) {
            roomExists = data.result;
            if (roomExists) {
               errorsField.empty();
               errorsField.show();
               errorsField.append("Room <i>" + roomName + "</i> already exists");
            } else {
                if (roomName.length > 0) { //also check for roomname
                    socket.emit("put:room", roomName, roomPass);
                    errorsField.empty();
                    errorsField.hide();
                }
            }
        });
    });

    $rooms.on('click', '.joinRoomBtn', function () {
        var roomID = $(this).attr("id");
        var isPrivate = !!$(this).parent().find(".fa-lock");
        if(isPrivate) {
            $("#joinPrivateRoomId").val(roomID);
            $("#roomPasswordModal").modal("show");

        } else {
            socket.emit("join:room", roomID);
        }

    });

    $("#joinPrivateRoomBtn").click(function () {
        var roomId = $("#joinPrivateRoomId").val();
        var roomPass = $("#joinRoomPass").val();
        socket.emit("join:room", roomId, roomPass);
    });

    $rooms.on('click', '.removeRoomBtn', function () {
        var roomID = $(this).attr("id");
        socket.emit("removeRoom", roomID);
        $("#createRoom").show();
    });

    $("#leave").click(function () {
        socket.emit("leaveRoom", myRoomID);
        $("li#"+myRoomID).find(".fa-chevron-left").remove();
        $("#createRoom").show();
    });

    $(document.body).on('click', ".leaveRoomBtn", function(e){
        socket.emit("leaveRoom", myRoomID);
        $(this).parent().find(".fa-chevron-left").remove();
        $(this).remove();
        $("#createRoom").show();
    });

    $("#people").on('click', '.whisper', function () {
        var name = $(this).siblings("span").text();
        msgField.val("w:" + name + ":");
        msgField.focus();
    });

    socket.on("joined:server", function (id) {
       myId = id;
       errorsField.hide();
        if (navigator.geolocation) { //get lat lon of user
            navigator.geolocation.getCurrentPosition(positionSuccess, positionError, { enableHighAccuracy: true });
        } else {
           errorsField.show();
           errorsField.append("Your browser is ancient and it doesn't support GeoLocation.");
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
                url: "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20geo.placefinder%20where%20text%3D%22" + lat + "%2C" + lon + "%22%20and%20gflags%3D%22R%22&format=json",
                dataType: "json",
                success: function (data) {
                    socket.emit("set:user:country", {country: data.query.results.Result.countrycode});
                }
            });
        }
    });

    socket.on("history", function (data) {
        if (data.length !== 0) {
           msgs.append("<li><strong><span class='text-warning'>Last 10 messages:</li>");
            $.each(data, function (data, msg) {
               msgs.append("<li><span class='text-warning'>" + msg + "</span></li>");
            });
        } else {
           msgs.append("<li><strong><span class='text-warning'>No past messages in this room.</li>");
        }
    });

    socket.on("update", function (msg) {
       msgs.append("<li>" + msg + "</li>");
    });

    socket.on("get:people", function (data) {
        people.empty();
        people.append("<li data-toggle='collapse' data-target='#people-items' aria-expanded='true'" +
            " aria-controls='people-items' class='people-header list-group-item active'>People online <span class=\"badge\">" +
            Object.keys(data).length + "</span></li>");
        people.append("<div id='people-items'></div>");

        $.each(data, function (a, obj) {
            if (!("country" in obj)) {
                html = "";
            } else {
                html = "<img class=\"flag flag-" + obj.country + "\"/>";
            }
            $("#people-items").append("<li class=\"list-group-item\"><span>" + obj.name + "</span> <i class=\"fa fa-" + obj.device + "\"></i> " + html + " <a href=\"#\" class=\"whisper btn btn-xs\">whisper</a></li>");
        });
    });

    socket.on("chat", function (person, msg) {
       msgs.append("<li><strong><span class='text-success'>" + person.name + "</span></strong>: " + msg + "</li>");
        //clear typing field
        $("#" + person.name + "").remove();
        clearTimeout(timeout);
        timeout = setTimeout(timeoutFunction, 0);
    });

    socket.on("whisper", function (person, msg) {
        var s = person.name === "You" ? "whisper" : "whispers";
        msgs.append("<li><strong><span class='text-muted'>" + person.name + "</span></strong> " + s + ": " + msg + "</li>");
    });

    socket.on("get:rooms", function (data) {
        $rooms.empty();
        $rooms.append("<li data-toggle='collapse' data-target='.rooms-item' aria-expanded='true' aria-controls='rooms-item' " +
            "class='rooms-header list-group-item active'>List of rooms <span class=\"badge\">" + Object.keys(data).length + "</span></li>");
        if (data) {
            $.each(data, function (id, room) {
                console.log(room);
                console.log(myId);

                if (room.owner == myId) {
                    var remove = "<button id=" + id + " class='removeRoomBtn btn btn-default btn-xs'>Remove</button>";
                }
                if ($.inArray(myId, room.people) !== -1) {
                    if (!remove) {
                        var leaveBtn = "<button id=" + id + " class='leaveRoomBtn btn btn-default btn-xs'>Leave</button>";
                    }
                    var here = "<i class='mrg4 fa fa-chevron-left'>&nbsp;You here</i>";
                } else {
                    var inRoom = "rooms-item";
                    var join = "<button id=" + id + " class='joinRoomBtn btn btn-default btn-xs' >Join</button>";
                }
                var lock = room.private ? "<i class='mrg4 fa fa-lock'></i>" : "<i class='mrg4 fa fa-unlock'></i>";
                $rooms.append("<li id=" + id + " class='" + (inRoom || '') + " collapse in list-group-item'><span>" + room.name +
                    "</span>" + lock + (join || '') + (remove || '') + (leaveBtn || '') + (here || '') + "</li>");
            });
        } else {
            $rooms.append("<li class=\"list-group-item\">There are no rooms yet.</li>");
        }
    });

    socket.on("sendRoomID", function (data) {
        myRoomID = data.id;
    });

    socket.on("disconnect", function () {
        msgs.append("<li><strong><span class='text-warning'>The server is not available</span></strong></li>");
        msgField.attr("disabled", "disabled");
        $("#send").attr("disabled", "disabled");
    });

});
