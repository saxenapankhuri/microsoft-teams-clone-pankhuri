# microsoft-teams-clone-pankhuri

Built for completion of Microsoft Engage 2021 project.  

In simple words, the website helps establish peer to peer video conferencing. Other features include user authentication, screensharing, pre and post video call chat functionality, creating and joining teams and changing username.  

TECH STACK  
Backend 
  NodeJS 14.17.0  
  Frameworks: WebRTC, express, peerjs, socket, uuid, google-auth-library  
  Database: MySQL 8.0.25  
Frontend  
  HTML/CSS  
  Bootstrap 5.0  
  JavaScript HTML Document Object Model  
Version control 
  Git 2.30.0  
Authentication  
  Auth0

GETTING STARTED  
1. Install NodeJS dependencies  
2. Get API credentials for Auth0 (https://auth0.com/)  
3. Create MySQL database 

WORKING  
-> The web-app uses socket and peerjs modules for establishing connections and communicating between sockets.  
-> The database is used to store users' and teams' information  
-> Auth0 is used for user authentication  
  
DATABASE SCHEMA  
-> A table for list of users' emails and their usernames  
-> A table for the team names and their meeting ids  
-> A table for each user containing ids of all teams  
-> A table for each team containing ids of all participants  
-> A table for each team for storing their chat history
