//jshint esversion:6

const express = require('express')
const app = express()
const mysql = require('mysql2')
require('dotenv').config()
const cors = require('cors')
app.use(cors())
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({
  extended: true
}));

const {
  auth
} = require('express-openid-connect');
const {
  requiresAuth
} = require('express-openid-connect');
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
const {
  ExpressPeerServer
} = require('peer');
const peerServer = ExpressPeerServer(server, {
  debug: true
});
const {
  v4: uuidV4
} = require('uuid')
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: process.env.dbpassword,
  database: 'mydb'
})

db.connect((err) => {
  if (err) {
    console.log(err + 'Error connecting to Db');
    return;
  }
  console.log('Connection established');
  //db.query("CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY,email VARCHAR(255) UNIQUE, name VARCHAR(255), userid VARCHAR(255) UNIQUE,  CONSTRAINT userdatabase UNIQUE(email, userid)  )")
  //db.query("CREATE TABLE listofteams (id INT AUTO_INCREMENT PRIMARY KEY, teamname VARCHAR(255), roomid VARCHAR(255) UNIQUE)")
});

app.use('/peerjs', peerServer);

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.get('/', (req, res) => {
  if (req.oidc.isAuthenticated()) {
    res.redirect("/goToTeamsPage")
    //res.sendFile(__dirname + "/index.html")
  } else {
    res.redirect("/login")
  }
})

app.get('/goToTeamsPage', requiresAuth(), (req, res) => {
  db.query("SELECT * FROM users WHERE email = '" + req.oidc.user.email + "'", function(err, result) {
    if (result.length == 0) {
      db.query("INSERT INTO users (email, name) VALUES ('" + req.oidc.user.email + "','" + req.oidc.user.name + "')", function(e, r) {
        db.query("CREATE TABLE user" + r.insertId + " (id INT PRIMARY KEY, teamname VARCHAR(255), teamid VARCHAR(255))");
        res.render('teams', {
          emailID: req.oidc.user.email,
          name: req.oidc.user.name,
          teams: []
        })
      })
    } else {
      db.query("SELECT * FROM user" + result[0].id, function(e, r) {
        res.render('teams', {
          emailID: req.oidc.user.email,
          name: req.oidc.user.name,
          teams: r
        })
      })
    }
  })
})

app.post('/newTeamCreate', (req, res) => {
  const teamid = uuidV4();
  db.query("INSERT INTO listofteams" + " (teamname, roomid) VALUES ('" + req.body.teamName + "','" + teamid + "')", function(err, result) {
    db.query("CREATE TABLE team" + result.insertId + " (id INT PRIMARY KEY, participantEmail VARCHAR(255))");
    db.query("INSERT IGNORE INTO team" + result.insertId + " (participantEmail) VALUES ('" + req.body.emailID + "')");
    db.query("CREATE TABLE chat" + result.insertId + " (id INT AUTO_INCREMENT PRIMARY KEY, mssg VARCHAR(500), username VARCHAR(255))");
    db.query("SELECT * FROM users WHERE email = '" + req.oidc.user.email + "'", function(e, r) {
      db.query("INSERT INTO user" + r[0].id + " (id, teamname,teamid) VALUES ('" + result.insertId + "','" + req.body.teamName + "','" + teamid + "')");
    })
  });
  res.redirect('/goToTeamsPage')
})

app.post('/newTeamJoin', (req,res)=>{
  db.query("SELECT * FROM listofteams WHERE roomid ='"+req.body.teamCode+"'", (e1,r1)=>{
    if(r1.length==0)
    res.redirect("/goToTeamsPage");
    db.query("SELECT * FROM users WHERE email ='"+req.body.emailID+"'", (e2,r2)=>{
      db.query("INSERT IGNORE INTO team"+r1[0].id+" (id,participantEmail) VALUES ('"+r2[0].id+ "','"+req.body.emailID+"')");
      db.query("INSERT IGNORE INTO user"+r2[0].id+" (teamname,teamid) VALUES ('"+ r1[0].teamname+"','"+req.body.teamCode+"')");
    })
  })
  res.redirect("/goToTeamsPage");
  })

app.get('/:team', requiresAuth(), (req, res) => {
  if (String(req.params.team).substring(0, 4) === "room") {
    if (req.oidc.isAuthenticated()) {
      res.render('room', {
        roomId: String(req.params.team).substring(4),
        username: req.oidc.user.name
      })
    } else
      res.redirect('/login')
  }
  else if (String(req.params.team).length==36){
    db.query("SELECT * FROM listofteams WHERE roomid = '" + req.params.team + "'", function(e1, r1) {
        db.query("SELECT * FROM chat" + r1[0].id, function(e2, r2) {
          res.render('teampage', {
            roomsno: r1[0].id,
            roomId: req.params.team,
            messages: r2
          })
        })
    })
  }
})

app.post("/addMessage", requiresAuth(),(req, res) => {
  db.query("INSERT INTO chat" + req.body.roomsno + " (mssg,username) VALUES ('" + req.body.mssg + "','"+req.oidc.user.name+"')");
  res.redirect("/" + req.body.roomId)
})

io.on('connection', socket => {
  socket.on('join-room', (roomId, username,userId) => {
    socket.join(roomId)
    socket.broadcast.to(roomId).emit('user-connected', userId);
    db.query("SELECT * FROM listofteams WHERE roomid = '" + roomId + "'", function(e1, r1) {
        db.query("SELECT * FROM chat" + r1[0].id, function(e2, r2) {
          for(let i=0;i<r2.length;i++){
            io.to(socket.id).emit('initializeChatBox',r2[i].mssg, r2[i].username)
          }
          })
        })
    // messages
    socket.on('message', (message) => {
      //send message to the same room
      db.query("SELECT * FROM listofteams WHERE roomid = '" + roomId + "'", function(e1, r1) {
          db.query("INSERT INTO chat"+r1[0].id+" (mssg, username) VALUES ('"+message+"','"+username+"')")
          })
      io.to(roomId).emit('createMessage','<b>' + username + '<\/b><\/br>' + message)

    });

    socket.on('disconnect', () => {
      socket.broadcast.to(roomId).emit('user-disconnected', userId);
    })
  })
})

server.listen(process.env.PORT || 3030)
