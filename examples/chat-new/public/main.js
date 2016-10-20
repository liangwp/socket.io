$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page
  var $answerInput = $('.ansArea'); // The answer input at the top
  var $answerStatus = $('.ansStatus'); // The portion that says "X is editing..."
  var $answerContainer = $('.ansContainer'); // the border part
  var $userslist = $('.userList'); // the list of users
  var $releaseButton = $('.releaseButton'); // the release button

  var set_field_status = function (field_status) { //0 = open; 1 = locked; 2 = locked for this user;
    switch (field_status) {
      case 0:
        $answerContainer.removeClass('border1 border2');
        $answerContainer.addClass('border0')
        break;
      case 1:
      $answerContainer.removeClass('border0 border2');
      $answerContainer.addClass('border1')
        break;
      case 2:
      $answerContainer.removeClass('border0 border1');
      $answerContainer.addClass('border2')
        break;
      default:
        console.log('error');
    }
  }


  // bells and whistles, wrapped in a closure
  var playnotification = (function () {
    var all_tracks = [];
    all_tracks.push(new Audio('served.mp3'));
    all_tracks.push(new Audio('gets-in-the-way.mp3'));
    all_tracks.push(new Audio('you-wouldnt-believe.mp3'));
    // all_tracks.push(new Audio('coins.mp3')); // not for this purpose...
    // console.log("audio in");
    function playaudio() {
      var playthis = Math.round(Math.random()*(all_tracks.length-1));
      all_tracks[playthis].play();
    }
    // console.log("play function done");
    return playaudio;
  })(); // self-invoking, assigns the inside 'playaudio' function to 'playnotification'.

  // Prompt for setting a username
  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

  var socket = io();

  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      message += "there are " + data.numUsers + " participants";
    }
    log(message);

    while ($userslist[0].firstChild) {
      $userslist[0].removeChild($userslist[0].firstChild); // just remove all and recreate, instead of finding and deleting.
    }
    for (k in data.list)
    {
      var a_user = document.createElement("div");
      var a_username = document.createTextNode(data.list[k]);
      a_user.appendChild(a_username);
      $userslist[0].appendChild(a_user);
    }
  }

  // Sets the client's username
  function setUsername () {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', username);
    }
  }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
      playnotification();
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  function releaseLock() {
    socket.emit('ans done', {
      username: username,
      answer: $answerInput.val()
    });
    // console.log("unlock the answer field");
    socket.emit('request release');
    $currentInput.focus(); // send focus back to the chat input box.
  }

  // on mousedown, request lock, prevent focus on $answerInput unless field status is 0
  $answerInput.on('mousedown', function(event) {
    event.preventDefault();
    // console.log('request a lock from server')
    socket.emit('request lock');
    // event.stopImmediatePropagation();
  })

  // Keyboard events

  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      if (document.activeElement != $answerInput[0]) {
        $currentInput.focus();
        // When the client hits ENTER on their keyboard: 13 = ENTER
        if (event.which === 13) {
          if (username) {
            sendMessage();
            socket.emit('stop typing');
            typing = false;
          } else {
            setUsername();
          }
        }
      } else {
        // typing on answer box
        // console.log('typing on answer box');
        socket.emit('ans typing', {
          username: username
        });
        if (event.which === 13) {
          event.stopPropagation(); // prevents the linebreak from going into the textarea
          releaseLock();
        }
      }
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  // also release the lock when the release button is clicked. Note, duplicated code.
  $releaseButton.on("click", function () {
    releaseLock();
  });

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Display the welcome message
    var message = "Welcome to Socket.IO Chat – ";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
    if (data.lockstatus)
    {
      set_field_status(1);
    }
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    addChatMessage(data);
    playnotification();
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' joined');
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });

  // socket messages for typing in answer field
  socket.on('ans typing', function (data) {
    $answerStatus[0].innerHTML = data.username + ' is editing...';
  });
  socket.on('ans done', function (data) {
    $answerStatus[0].innerHTML = '';
    $answerInput.val(data.answer);
  });

  // socket messages for locking and unlocking the answer field
  socket.on('locked for you', function() {
    // console.log('server says \'locked for you\'');
    set_field_status(2);
    $answerInput.focus();

    // show release button when the field is locked for this user
    $releaseButton[0].style.display = "block";
  });
  socket.on('locked for someone else', function(data) {
    // console.log('server says \'locked for someone else\'');
    $answerStatus[0].innerHTML = data.user + ' has locked the field.';
    set_field_status(1);
  });
  socket.on('released', function() {
    // console.log('server says \'released\'');
    $releaseButton[0].style.display = "none";
    set_field_status(0);
  })
});
