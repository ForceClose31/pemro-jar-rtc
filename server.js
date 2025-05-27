const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const PORT = 3000;

app.use(express.static("public"));

io.on("connection", socket => {
    socket.join("room1");

    const joinedUsers = io.sockets.adapter.rooms.get("room1");
    const totalUsers = joinedUsers ? joinedUsers.size : 0;

    console.log(`User connected: ${socket.id}`);
    console.log(`Total users in room1: ${totalUsers}`);

    if (totalUsers > 1) {
        socket.emit("ada user lain", [...joinedUsers]);
    }

    socket.on("offer", ({ offer, to: targetId, from }) => {
        io.to(targetId).emit("offer", { offer, from });
    });

    socket.on("answer", ({ answer, to: targetId, from }) => {
        io.to(targetId).emit("answer", { answer, from });
    });

    socket.on("ice candidate", ({ iceCandidate, to: targetId, from }) => {
        io.to(targetId).emit("ice candidate", iceCandidate);
    });

    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
        const updatedUsers = io.sockets.adapter.rooms.get("room1");
        const updatedTotal = updatedUsers ? updatedUsers.size : 0;
        console.log(`Total users in room1: ${updatedTotal}`);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
