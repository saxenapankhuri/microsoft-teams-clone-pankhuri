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

// auth router attaches /login, /logout, and /callback routes to the baseURL
const server = require('http').Server(app)
const io = require('socket.io')(server)
io.attach(server, {
  pingInterval: 10000,
  pingTimeout: 5000,
  cookie: false
});

const {
  ExpressPeerServer
} = require('peer');
const peerServer = ExpressPeerServer(server, {
  debug: true
});
const {
  v4: uuidV4
} = require('uuid')
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
  secret: 'LONG_RANDOM_STRING'
};

app.use(auth(config));
const db = mysql.createConnection({
  host: process.env.host,
  user: process.env.user,
  password: process.env.dbpassword,
  database: process.env.database
})

db.connect((err) => {
  if (err) {
    console.log(err + 'Error connecting to Db');
    return;
  }
  console.log('Connection established');
  db.query("CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY,email VARCHAR(255) UNIQUE, name VARCHAR(255), userid VARCHAR(255) UNIQUE,  CONSTRAINT userdatabase UNIQUE(email, userid)  )")
  db.query("CREATE TABLE IF NOT EXISTS listofteams (id INT AUTO_INCREMENT PRIMARY KEY, teamname VARCHAR(255), roomid VARCHAR(255) UNIQUE)")
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

app.get('/goToTeamsPage', (req, res) => {
  db.query("SELECT * FROM users WHERE email = '" + req.oidc.user.email + "'", function(err, result) {
    if (err) {
      console.log(result);
      console.log(err)
      res.send("Error")
    } else {
      if (result.length == 0) {
        let name = req.oidc.user.name;
        if (String(name).includes('@'))
          name = req.oidc.user.nickname
        db.query("INSERT INTO users (email, name) VALUES ('" + req.oidc.user.email + "','" + name + "')", function(e, r) {
          db.query("CREATE TABLE user" + r.insertId + " (id INT PRIMARY KEY, teamname VARCHAR(255), teamid VARCHAR(255))");
          res.render('teams', {
            emailID: req.oidc.user.email,
            name: name,
            teams: []
          })
        })
      } else {
        let name = req.oidc.user.name
        db.query("SELECT * FROM users WHERE email ='" + req.oidc.user.email + "'", function(error, result) {
          name = result[0].name;
          db.query("SELECT * FROM user" + result[0].id, function(e, r) {
            res.render('teams', {
              emailID: req.oidc.user.email,
              name: name,
              teams: r
            })
          })
        })
      }
    }
  })
})

app.post('/newTeamCreate', (req, res) => {
  const teamid = uuidV4();
  db.query("INSERT INTO listofteams" + " (teamname, roomid) VALUES ('" + req.body.teamName + "','" + teamid + "')", function(err, result) {
    db.query("CREATE TABLE team" + result.insertId + " (id INT PRIMARY KEY, participantEmail VARCHAR(255))");
    db.query("INSERT IGNORE INTO team" + result.insertId + " (participantEmail) VALUES ('" + req.body.emailID + "')");
    db.query("CREATE TABLE chat" + result.insertId + " (id INT AUTO_INCREMENT PRIMARY KEY, mssg VARCHAR(500), username VARCHAR(255), time VARCHAR(100))");
    db.query("SELECT * FROM users WHERE email = '" + req.oidc.user.email + "'", function(e, r) {
      db.query("INSERT INTO user" + r[0].id + " (id, teamname,teamid) VALUES ('" + result.insertId + "','" + req.body.teamName + "','" + teamid + "')");
    })
  });
  res.redirect('/goToTeamsPage')
})

app.post('/newTeamJoin', (req, res) => {
  db.query("SELECT * FROM listofteams WHERE roomid ='" + req.body.teamCode + "'", (e1, r1) => {
    if (r1.length != 0) {
      db.query("SELECT * FROM users WHERE email ='" + req.body.emailID + "'", (e2, r2) => {
        db.query("INSERT IGNORE INTO team" + r1[0].id + " (id,participantEmail) VALUES ('" + r2[0].id + "','" + req.body.emailID + "')");
        db.query("INSERT IGNORE INTO user" + r2[0].id + " (id,teamname,teamid) VALUES ('" + r1[0].id + "','" + r1[0].teamname + "','" + req.body.teamCode + "')");
      })
    }
  })
  res.redirect("/goToTeamsPage");
})

app.get("/changeUserName", (req, res) => {
  if (req.oidc.isAuthenticated() == false)
    res.redirect("/login")
  res.render('home');
})

app.post('/changeUserName', requiresAuth(), (req, res) => {
  db.query("UPDATE users SET name='" + req.body.newName + "' WHERE email='" + req.oidc.user.email + "'");
  res.redirect("/goToTeamsPage");
})

app.get('/:team', (req, res) => {
  if (req.oidc.isAuthenticated() == false)
    res.redirect("/login")
  if (String(req.params.team).substring(0, 4) === "room") {
    if (req.oidc.isAuthenticated()) {
      db.query("SELECT * FROM listofteams WHERE roomid = '" + String(req.params.team).substring(4) + "'", function(e1, r1) {
        db.query("SELECT * FROM team" + r1[0].id + " WHERE participantEmail = '" + req.oidc.user.email + "'", function(err, result) {
          if (result.length == 0)
            res.redirect("/")
        })
      })
      res.render('room', {
        roomId: String(req.params.team).substring(4),
        useremail: req.oidc.user.email
      })
    } else
      res.redirect('/login')
  } else if (String(req.params.team).length == 36) {

    db.query("SELECT * FROM listofteams WHERE roomid = '" + req.params.team + "'", function(e1, r1) {
      db.query("SELECT * FROM team" + r1[0].id + " WHERE participantEmail = '" + req.oidc.user.email + "'", function(err, result) {
        if (result.length == 0)
          res.redirect("/")
      })
      db.query("SELECT * FROM chat" + r1[0].id, function(e2, r2) {
        res.render('teampage', {
          roomsno: r1[0].id,
          roomId: req.params.team,
          messages: r2,
          participants: []
        })
      })
    })
  }
})

app.post("/addMessage", (req, res) => {
  db.query("SELECT * FROM users WHERE email ='" + req.oidc.user.email + "'", function(error, result) {
    let username = result[0].name;
    let today = new Date();
    let date = today.toLocaleDateString();
    let time = today.toLocaleTimeString();
    let dateTime = String(date) + ' ' + String(time);
    db.query("INSERT INTO chat" + req.body.roomsno + " (mssg,username,time) VALUES ('" + req.body.mssg + "','" + username + "','" + dateTime + "')");
    res.redirect("/" + req.body.roomId)
  })
})

io.on('connection', socket => {
  socket.on('error', function(){
  socket.socket.connect();
});

  socket.on('join-room', (roomId, useremail, userId) => {
    let username = useremail
    db.query("SELECT * FROM users WHERE email ='" + useremail + "'", function(error, result) {
      username = result[0].name;
      socket.join(roomId)
      db.query("SELECT * FROM listofteams WHERE roomid = '" + roomId + "'", function(e1, r1) {
        db.query("SELECT * FROM chat" + r1[0].id, function(e2, r2) {
          for (let i = 0; i < r2.length; i++) {
            io.to(socket.id).emit('initializeChatBox', r2[i].mssg, r2[i].username)
          }
        })
      })
      socket.broadcast.to(roomId).emit('user-connected', userId);

      // messages
      socket.on('message', (message) => {
        let today = new Date;
        let date = today.toLocaleDateString();
        let time = today.toLocaleTimeString();
        let dateTime = String(date) + ' ' + String(time);
        //send message to the same room
        db.query("SELECT * FROM listofteams WHERE roomid = '" + roomId + "'", function(e1, r1) {
          db.query("INSERT INTO chat" + r1[0].id + " (mssg, username,time) VALUES ('" + message + "','" + username + "','" + dateTime + "')")
        })
        io.to(roomId).emit('createMessage', '<b>' + username + ':<\/b><\/br>' + message)

      });

      socket.on('disconnect', () => {
        socket.broadcast.to(roomId).emit('user-disconnected', userId);
      })
    })
  })
})

server.listen(process.env.PORT || 3030)
