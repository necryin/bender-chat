function Room(name, owner, pass) {

  this.name = name;
  this.owner = owner;
  this.people = {};
  this.private = pass ? true : false;
  var password = pass || null;

  this.getPassword = function() {
      return password;
  };
};

module.exports = Room;
