const express = require("express");
const app = express();
const path = require("path");

const http=require("http");

const socketio = require("socket.io");
const server = http.createServer(app);
const io = socketio(server);


app.set(express.static(path.join(__dirname, "public")));
app.use(express.static("public"));
io.on("connection", function (socket){
    socket.on("send-location", function (data){
        const { latitude, longitude, deviceName } = data;
        io.emit('receive-location', { id: socket.id, latitude, longitude, deviceName });

    });

    socket.on("disconnect", function(){
        io.emit("user-disconncet", socket.id);
    });
});

app.get("/", function(req, res){
    res.render("index.ejs");
});

server.listen(3000);

