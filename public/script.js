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

navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  myVideoStream = stream;
  addVideoStream(myVideo, stream)
  myPeer.on('call', call => {
    call.answer(stream)
    const video = document.createElement('video')
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream)
    })
  })

  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream)
  })

  // input value
  let text = $("input");
  // when press enter send message
  $('html').keydown(function(e) {
    if (e.which == 13 && text.val().length !== 0) {
      socket.emit('message', text.val());
      text.val('')
    }
  });
  socket.on("createMessage", message => {
    $("ul").append(`<li class="message">${message}</li>`);
    scrollToBottom()
  })

  socket.on('user-disconnected', userId => {
    if (peers[userId]) peers[userId].close()
  })

})

myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID,username, id)


    socket.on("initializeChatBox", (message,username) =>{
      $("ul").append(`<li class="message"><b>${username}</b>:${message}</li>`);
      scrollToBottom()
    })
})


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

function addVideoStream(video, stream) {
  video.srcObject = stream
  videoGrid.append(video)
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
}

function addScreenStream(video, stream){
  video.srcObject = stream
  videoGrid.append(video)
  video.play()
  stream.addEventListener('ended', () => {
    video.remove()
  })
}

const scrollToBottom = () => {
  var d = $('.main__chat_window');
  d.scrollTop(d.prop("scrollHeight"));
}


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

// socket.on('screensharing', (userId) => {
//   connectToScreen(userId, stream);
// })
const startScreenShare=()=> {
    navigator.mediaDevices.getDisplayMedia({
      video: true
    }).then(
      stream => {
        const screenStream=stream
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

    const leave_user = () => {
      setStopVideo()
      window.location.href = "http://localhost:3030"
    }
