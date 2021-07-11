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

app.use('/peerjs', peerServer);
app.set('view engine', 'ejs')
app.use(express.static('public'))

// auth router attaches /login, /logout, and /callback routes to the baseURL
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

app.use(auth(config));

//database: creating and initializing connection
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

//landing page
app.get('/', (req, res) => {
  //check for authentication
  if (req.oidc.isAuthenticated()) {
    res.redirect("/goToTeamsPage")
  }
  //if not authenticated, prompt for login
  else {
    res.redirect("/login")
  }
})

//request to page containing options to create and join teams; collection of all teams
app.get('/goToTeamsPage', requiresAuth(), (req, res) => {
  db.query("SELECT * FROM users WHERE email = '" + req.oidc.user.email + "'", function(err, result) {
    if (err) {
      //block gets executed when database connection times out
      db.connect();
      res.render("errorpage");
    } else {
      if (result.length == 0) {
        //new user check
        let name = req.oidc.user.name;
        if (String(name).includes('@'))
          name = req.oidc.user.nickname

        //insert new user's credentials to table 'users'
        db.query("INSERT INTO users (email, name) VALUES ('" + req.oidc.user.email + "','" + name + "')", function(e, r) {
          //create a table of user's teams
          db.query("CREATE TABLE user" + r.insertId + " (id INT PRIMARY KEY, teamname VARCHAR(255), teamid VARCHAR(255))");
          res.render('teams', {
            emailID: req.oidc.user.email,
            name: name,
            teams: []
          })
        })
      } else {
        //registered user
        let name = req.oidc.user.name
        //load his username and all his teams and
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

//CREATING AND JOINING TEAMS
//creating a new team
app.post('/newTeamCreate', requiresAuth(), (req, res) => {
  //allocate url for the new team of length 36
  const teamid = uuidV4();

  //update database to include the new team
  db.query("INSERT INTO listofteams" + " (teamname, roomid) VALUES ('" + req.body.teamName + "','" + teamid + "')", function(err, result) {
    //create a table of team's participants
    db.query("CREATE TABLE team" + result.insertId + " (id INT PRIMARY KEY, participantEmail VARCHAR(255))");
    db.query("INSERT IGNORE INTO team" + result.insertId + " (participantEmail) VALUES ('" + req.body.emailID + "')");
    //create a table for team's chat history
    db.query("CREATE TABLE chat" + result.insertId + " (id INT AUTO_INCREMENT PRIMARY KEY, mssg VARCHAR(500), username VARCHAR(255), time VARCHAR(100))");
    db.query("SELECT * FROM users WHERE email = '" + req.oidc.user.email + "'", function(e, r) {
      db.query("INSERT INTO user" + r[0].id + " (id, teamname,teamid) VALUES ('" + result.insertId + "','" + req.body.teamName + "','" + teamid + "')");
    })
  });
  //go back to teams page after updation
  res.redirect('/goToTeamsPage')
})

//joining a new team via invite code
app.post('/newTeamJoin', requiresAuth(), (req, res) => {
  //find out unique id for the team
  db.query("SELECT * FROM listofteams WHERE roomid ='" + req.body.teamCode + "'", (e1, r1) => {
    if (r1.length != 0) {
      //append user's email to the list of team's participants
      db.query("SELECT * FROM users WHERE email ='" + req.body.emailID + "'", (e2, r2) => {
        db.query("INSERT IGNORE INTO team" + r1[0].id + " (id,participantEmail) VALUES ('" + r2[0].id + "','" + req.body.emailID + "')");
        //insert team's name and id to user's list of teams
        db.query("INSERT IGNORE INTO user" + r2[0].id + " (id,teamname,teamid) VALUES ('" + r1[0].id + "','" + r1[0].teamname + "','" + req.body.teamCode + "')");
      })
    }
  })
  //go back to teams page after updation
  res.redirect("/goToTeamsPage");
})


//UPDATE USERNAME
//form page for changing user name
app.get("/changeUserName", requiresAuth(), (req, res) => {
  //check for
  if (req.oidc.isAuthenticated() == false)
    res.redirect("/login")
  res.render('home');
})

//changing username
app.post('/changeUserName', requiresAuth(), (req, res) => {
  db.query("UPDATE users SET name='" + req.body.newName + "' WHERE email='" + req.oidc.user.email + "'");
  res.redirect("/goToTeamsPage");
})


//TEAM'S UNIQUE PAGES
//roomId refers to pre-meeting landing page of a team containing chat history
//room<roomId> refers to meeting link of team
app.get('/:team', requiresAuth(), (req, res) => {
  if (req.oidc.isAuthenticated() == false)
    res.redirect("/login")
  if (String(req.params.team).substring(0, 4) === "room") {
    //meeting link
    if (req.oidc.isAuthenticated()) {
      //check if user is a part of the team; if false, redirect to home page
      db.query("SELECT * FROM listofteams WHERE roomid = '" + String(req.params.team).substring(4) + "'", function(e1, r1) {
        db.query("SELECT * FROM team" + r1[0].id + " WHERE participantEmail = '" + req.oidc.user.email + "'", function(err, result) {
          console.log(result);
          if (result==undefined||result.length == 0)
            res.redirect("/")
        })
      })
      //enter meeting room
      res.render('room', {
        roomId: String(req.params.team).substring(4),
        useremail: req.oidc.user.email
      })
    } else
      res.redirect('/login')
  }
  //pre-meeting landing page
  else if (String(req.params.team).length == 36) {

    db.query("SELECT * FROM listofteams WHERE roomid = '" + req.params.team + "'", function(e1, r1) {
      //check if user is a part of the team; if false, redirect to home page
      db.query("SELECT * FROM team" + r1[0].id + " WHERE participantEmail = '" + req.oidc.user.email + "'", function(err, result) {
        if (result==undefined||result.length == 0)
          res.redirect("/")
      })
      db.query("SELECT * FROM chat" + r1[0].id, function(e2, r2) {
        //r2 contains chat history
        res.render('teampage', {
          roomsno: r1[0].id,
          roomId: req.params.team,
          messages: r2
        })
      })
    })
  }
})

//NEW MESSAGE ALERT
app.post("/addMessage", requiresAuth(), (req, res) => {
  //find user's name
  db.query("SELECT * FROM users WHERE email ='" + req.oidc.user.email + "'", function(error, result) {
    //get current local date and time
    let username = result[0].name;
    let today = new Date();
    let date = today.toLocaleDateString();
    let time = today.toLocaleTimeString();
    let dateTime = String(date) + ' ' + String(time);
    //update database to store the new message
    db.query("INSERT INTO chat" + req.body.roomsno + " (mssg,username,time) VALUES ('" + req.body.mssg + "','" + username + "','" + dateTime + "')");
    //redirect to the requesting page
    res.redirect("/" + req.body.roomId)
  })
})

//MEETING ROOM
io.on('connection', socket => {
  socket.on('join-room', (roomId, useremail, userId) => {
    let username = useremail
    db.query("SELECT * FROM users WHERE email ='" + useremail + "'", function(error, result) {
      //find username
      username = result[0].name;
      socket.join(roomId)
      //extract team's chat history from database and initialize the chatbox
      db.query("SELECT * FROM listofteams WHERE roomid = '" + roomId + "'", function(e1, r1) {
        db.query("SELECT * FROM chat" + r1[0].id, function(e2, r2) {
          for (let i = 0; i < r2.length; i++) {
            io.to(socket.id).emit('initializeChatBox', r2[i].mssg, r2[i].username)
          }
        })
      })
      socket.broadcast.to(roomId).emit('user-connected', userId);

      // new messages
      socket.on('message', (message) => {
        //get current local date and time
        let today = new Date;
        let date = today.toLocaleDateString();
        let time = today.toLocaleTimeString();
        let dateTime = String(date) + ' ' + String(time);
        // update database to store new message
        db.query("SELECT * FROM listofteams WHERE roomid = '" + roomId + "'", function(e1, r1) {
          db.query("INSERT INTO chat" + r1[0].id + " (mssg, username,time) VALUES ('" + message + "','" + username + "','" + dateTime + "')")
        })
        //send message to the same meeting room
        io.to(roomId).emit('createMessage', '<b>' + username + ':<\/b><\/br>' + message)

      });

      // alert disconnection from a user's side
      socket.on('disconnect', () => {
        socket.broadcast.to(roomId).emit('user-disconnected', userId);
      })
    })
  })
})

server.listen(process.env.PORT || 3030)
