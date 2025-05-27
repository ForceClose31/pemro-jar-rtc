const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const PORT = 3001;

app.use(express.static("public"));

const rooms = {};

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.join("room1");
    if (!rooms["room1"]) rooms["room1"] = new Set();
    rooms["room1"].add(socket.id);

    const joinedUsers = Array.from(rooms["room1"]).filter((id) => id !== socket.id);
    if (joinedUsers.length > 0) {
        socket.emit("ada user lain", joinedUsers);
    }

    socket.broadcast.to("room1").emit("ada user lain", [socket.id]);

    socket.on("offer", ({ offer, to: targetId, from }) => {
        io.to(targetId).emit("offer", { offer, from });
    });

    socket.on("answer", ({ answer, to: targetId, from }) => {
        io.to(targetId).emit("answer", { answer, from });
    });

    socket.on("ice candidate", ({ iceCandidate, to: targetId, from }) => {
        io.to(targetId).emit("ice candidate", iceCandidate);
    });

    socket.on("chatMessage", ({ message, from, to: targetId }) => {
        io.to(targetId).emit("chatMessage", { message, from });
    });

    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
        rooms["room1"].delete(socket.id);
        socket.broadcast.to("room1").emit("ada user lain", Array.from(rooms["room1"]));
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
