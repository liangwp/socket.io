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
var field_answer = null;

var locking_user = null;
var unique_counter = 0;
var unique_users = new Object(); // we will use this as an associative array of "unique client id" => "client nick"

io.on('connection', function (socket) {
  var addedUser = false;
  //console.log("a:"+unique_counter);

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
    if (addedUser) {
      return;
    }

    // we store the username in the socket session for this client
    socket.username = username;

    // console.log("b:" + unique_counter);
    socket.unique_id = unique_counter;

    // console.log("c:"+socket.unique_id);

    ++numUsers;
    ++unique_counter;
    addedUser = true;

    // add user to the global list of users
    unique_users["user"+socket.unique_id] = username;
    // console.log(unique_users);

    socket.emit('login', {
      numUsers: numUsers,
      lockstatus: field_locked,
      list: unique_users
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers,
      list: unique_users
    });
    // populate that user's answer field
    socket.emit('ans done', {
      answer: field_answer
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
    field_answer = data.answer;
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

      // remove user from global list of users
      delete unique_users["user"+socket.unique_id];
      // console.log("d:"+socket.unique_id);
      // console.log(unique_users);

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers,
        list: unique_users
      });
      if (socket.username == locking_user) // release the lock if this user was locking it.
      {
        field_locked = false;
        locking_user = null;
        socket.broadcast.emit('released');
      }
    }
  });

  // socket messages for locking and unlocking the answer field
  socket.on('request lock', function() {
    // console.log('lock requested: ' + socket.username);
    if (!field_locked || locking_user == socket.username) {
      field_locked = true;
      locking_user = socket.username;
      socket.emit('locked for you');
      socket.broadcast.emit('locked for someone else', {
        user: locking_user
      });
      // console.log('field locked: ' + locking_user);
    }
  });
  socket.on('request release', function () {
    field_locked = false;
    locking_user = null;
    socket.emit('released');
    socket.broadcast.emit('released');
    // console.log('field released: ' + socket.username);
  });

});
