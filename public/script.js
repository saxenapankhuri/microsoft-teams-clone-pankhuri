const socket = io('/')
const videoGrid = document.getElementById('video-grid')
var myPeer = new Peer(undefined)

let myVideoStream;
let myScreenStream;
const myVideo = document.createElement('video')
myVideo.muted = true;
const myScreen = document.createElement('video')
myScreen.muted = true;
const peers = {}
if (adapter.browserDetails.browser == 'firefox') {
  adapter.browserShim.shimGetDisplayMedia(window, 'screen');
}

//respond once audio and video are accessible
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  myVideoStream = stream;
  //append own video to the grid
  addVideoStream(myVideo, stream)
  //append video to video grids of all connections
  myPeer.on('call', call => {
    call.answer(stream)
    const video = document.createElement('video')
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream)
    })
  })

  //alert on connection of new user
  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream)
  })

  //MESSAGES
  // input value
  let text = $("input");
  // when press enter send message
  $('html').keydown(function(e) {
    if (e.which == 13 && text.val().length !== 0) {
      socket.emit('message', text.val());
      text.val('')
    }
  });
  //alert for new message sent
  socket.on("createMessage", message => {
    $("ul").append(`<li class="message">${message}</li>`);
    scrollToBottom()
  })
  //alert for user disconnected
  socket.on('user-disconnected', userId => {
    if (peers[userId]) peers[userId].close()
  })

})

//emit 'join-room' when a user logs in
myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, useremail, id)

  //initialize chatbox with chat history
  socket.on("initializeChatBox", (message, username) => {
    $("ul").append(`<li class="message"><b>${username}:</b><br>${message}</li>`);
    scrollToBottom()
  })
})


//connect to new peer
function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream)
  const video = document.createElement('video')
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream)
  })
  call.on('close', () => {
    video.remove()
  })

  peers[userId] = call
}

//connect to screen video stream
function connectToScreen(userId, stream) {
  const call = myPeer.call(userId, stream)
  const video = document.createElement('video')
  call.on('stream', stream => {
    addScreenStream(video, stream)
  })
  call.on('close', () => {
    video.remove()
  })
}

//append video to video-grid
function addVideoStream(video, stream) {
  video.srcObject = stream
  videoGrid.append(video)
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
}

//append screen stream to video-grid
function addScreenStream(video, stream) {
  video.srcObject = stream
  videoGrid.append(video)
  video.play()
  stream.addEventListener('ended', () => {
    video.remove()
  })
}

//scroll to bottom of chatbox
const scrollToBottom = () => {
  var d = $('.main__chat_window');
  d.scrollTop(d.prop("scrollHeight"));
}

//mute and unmute self
const muteUnmute = () => {
  const enabled = myVideoStream.getAudioTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getAudioTracks()[0].enabled = false;
    setUnmuteButton();
  } else {
    setMuteButton();
    myVideoStream.getAudioTracks()[0].enabled = true;
  }
}

//stop sharing video stream
const playStop = () => {
  console.log('object')
  let enabled = myVideoStream.getVideoTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getVideoTracks()[0].enabled = false;
    setPlayVideo()
  } else {
    setStopVideo()
    myVideoStream.getVideoTracks()[0].enabled = true;
  }
}

//update state of mute buton
const setMuteButton = () => {
  const html = `
    <i class="fas fa-microphone"></i>
    <span>Mute</span>
  `
  document.querySelector('.main__mute_button').innerHTML = html;
}
const setUnmuteButton = () => {
  const html = `
    <i class="unmute fas fa-microphone-slash"></i>
    <span>Unmute</span>
  `
  document.querySelector('.main__mute_button').innerHTML = html;
}

//update state of video button
const setStopVideo = () => {
  const html = `
    <i class="fas fa-video"></i>
    <span>Stop Video</span>
  `
  document.querySelector('.main__video_button').innerHTML = html;
}

const setPlayVideo = () => {
  const html = `
  <i class="stop fas fa-video-slash"></i>
    <span>Play Video</span>
  `
  document.querySelector('.main__video_button').innerHTML = html;
}

//respond when some user activates screen sharing
const startScreenShare = () => {
  navigator.mediaDevices.getDisplayMedia({
    video: true
  }).then(
    stream => {
      const screenStream = stream
      myScreenStream = stream;
      addScreenStream(myScreen, stream)
      myPeer.on('call', call => {
        call.answer(stream)
        const video = document.createElement('video')
        call.on('stream', stream => {
          addVideoStream(video, stream)
        })
      })

      socket.on('user-connected', userId => {
        const call = myPeer.call(userId, stream)
        const video = document.createElement('video')
      })

      socket.on('user-disconnected', userId => {
        if (peers[userId]) peers[userId].close()
      })
    }
  )
}

//disconnect a user and redirect to home page
const leave_user = () => {
  setStopVideo()
  window.location.href = "https://microsoft-teams-clone-pankhuri.herokuapp.com"
}
