// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('../..')(server);
var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatroom

var numUsers = 0;
var field_locked = false;
var locking_user = null;

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers,
      lockstatus: field_locked
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // someone is typing inside the answer field
  socket.on('ans typing', function (data) {
    socket.broadcast.emit('ans typing', {
      username: data.username
    });
  });

  socket.on('ans done', function (data) {
    // console.log(data.username + " has typed: " + data.answer);
    socket.broadcast.emit('ans done', {
      answer: data.answer
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
      if (socket.username == locking_user) // release the lock if this user is locking it.
      {
        field_locked = false;
        locking_user = null;
        socket.broadcast.emit('released');
      }
    }
  });

  // socket messages for locking and unlocking the answer field
  socket.on('request lock', function() {
    if (!field_locked || locking_user == socket.username) {
      field_locked = true;
      locking_user = socket.username;
      socket.emit('locked for you');
      socket.broadcast.emit('locked for someone else');
    }
  });
  socket.on('request release', function () {
    field_locked = false;
    locking_user = null;
    socket.emit('released');
    socket.broadcast.emit('released');
  });

});
