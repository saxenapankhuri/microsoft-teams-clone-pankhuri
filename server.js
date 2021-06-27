//jshint esversion:6

const express = require('express')
const app = express()
require('dotenv').config()
// const cors = require('cors')
// app.use(cors())

const { auth } = require('express-openid-connect');
const config = {
  authRequired: false,
  auth0Logout: true,
  baseURL: process.env.baseURL,
  clientID: process.env.clientID,
  issuerBaseURL: process.env.issuerBaseURL,
  secret: process.env.secret
};

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

const server = require('http').Server(app)
const io = require('socket.io')(server)
const { ExpressPeerServer } = require('peer');
const peerServer = ExpressPeerServer(server, {
  debug: true
});
const { v4: uuidV4 } = require('uuid')

app.use('/peerjs', peerServer);

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.get('/', (req, res) => {
  if(req.oidc.isAuthenticated()){
    res.sendFile( __dirname+"/index.html")
  }
  else{
    res.redirect('/login')
  }
})
// req.isAuthenticated is provided from the auth router

app.get('/start',(req,res)=>
{
  res.redirect(`/${uuidV4()}`)
})

app.get('/:room', (req, res) => {
  if(req.oidc.isAuthenticated()){
    res.render('room', { roomId: req.params.room })
  }
  else{
    res.redirect('/login')
  }
})

io.on('connection', socket => {
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId)
    socket.broadcast.to(roomId).emit('user-connected', userId);
    // messages
    socket.on('message', (message) => {
      //send message to the same room
      message='<b>'+userId+'<\/b><\/br>'+message
      io.to(roomId).emit('createMessage', message)
  });

// socket.on('screensharestart',(userId)=>{
//   socket.broadcast.to(roomId).emit('screensharing')
// })
    socket.on('disconnect', () => {
      socket.broadcast.to(roomId).emit('user-disconnected', userId);
      //socket.to(roomId).broadcast.emit('user-disconnected', userId)
    })
  })
})

server.listen(process.env.PORT||3030)
