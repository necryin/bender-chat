module.exports = {
    log: function (msg) {
        var d = new Date();
        console.log(d.getDate() + "." + d.getMonth() + "." + d.getFullYear() +
            " " + d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds() + " " + msg);
    }
};
