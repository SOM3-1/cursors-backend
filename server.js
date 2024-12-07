const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST"],
}));

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const cursors = {};

const cursorImages = Array.from({ length: 19 }, (_, i) => `/${i + 1}.svg`);

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  const randomCursorImage = cursorImages[Math.floor(Math.random() * cursorImages.length)];

  cursors[socket.id] = { name: "", cursorImage: randomCursorImage, lastActive: Date.now() };

  socket.on("cursor-move", (data) => {
    cursors[socket.id] = { ...cursors[socket.id], ...data, lastActive: Date.now() };
    io.emit("update-cursors", cursors);
  });

  const checkInactiveUsers = () => {
    const now = Date.now();
    Object.entries(cursors).forEach(([id, { lastActive }]) => {
      if (now - lastActive > 60000) { 
        delete cursors[id];
        io.emit("update-cursors", cursors);
      }
    });
  };

  const interval = setInterval(checkInactiveUsers, 5000);

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    delete cursors[socket.id];
    io.emit("update-cursors", cursors);
    clearInterval(interval);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
