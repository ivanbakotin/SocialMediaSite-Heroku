const path = require("path")
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const passport = require("./passport/index.js");
const session = require('express-session')
const auth_routes = require("./routes/auth_routes.js");
const all_routes = require("./routes/all_routes.js");
const pool = require("./db.js");
const PORT = process.env.PORT || 8080;

pool.connect()

const pgSession = require('connect-pg-simple')(session)

const io = require('socket.io')(http);

const authCheck = (req, res, next) => {
    if (req.user) next();
};

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const sessionMiddleware = session({
    name: 'profile_session',
    secret: "1244343ascsdf",
    resave: true,
    saveUninitialized: false,
    store: new pgSession({
        pool : pool,               
        tableName : 'session',
        ttl: 60 * 60 * 24,  // 1 day
        pruneSessionInterval: 60
    })
});

app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());

app.use("/auth", auth_routes);
app.use("/api", authCheck, all_routes);

http.listen(PORT, () => console.log(`Server started on ${PORT}`));

app.use(express.static(path.join(__dirname, "build")));

app.get( `*`, (req, res, next) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

const wrap = (middleware) => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

io.on('connection', async function(socket) {
    console.log("connected")
    const result = await pool.query("SELECT sess FROM session WHERE sid=$1", [socket.request.sessionID])       
    let curr_user = result.rows[0].sess.passport.user

    socket.join(curr_user);
    
    socket.on("send_chat_message", message => {
        console.log("message")
        pool.query("INSERT INTO chats (msg, username, sendername) VALUES ($1, $2, $3)", [message.msg, message.username, message.sendername])
        io.to(message.username).emit("message", message);
    })
});

module.exports = app;

/*
BACKEND:
post images, add avatar to userprofile
form validation for register, login, posts, comments, chat

FRONTEND:
add styling, css
render replies, edits on frontend
pagination

USERPROFILE
TABS - USER SETTINGS -  CHANGE EMAIL
                        CHANGE PASSWORD                   
*/
