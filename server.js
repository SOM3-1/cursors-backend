const express = require("express");
const http = require("http");
const axios = require("axios");
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

// Array of random images for cursors
const cursorImages = Array.from({ length: 19 }, (_, i) => `/${i + 1}.svg`);

// Fetch user's location and flag
const getUserLocation = async () => {
  try {
    const response = await axios.get("http://ip-api.com/json");
    const { country, countryCode } = response.data;
    const flag = `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`; // Generate flag URL
    return { country, flag };
  } catch (error) {
    console.error("Error fetching location:", error);
    return { country: "Unknown", flag: "" }; // Fallback
  }
};

io.on("connection", async (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Assign random cursor image and fetch location
  const randomCursorImage = cursorImages[Math.floor(Math.random() * cursorImages.length)];
  const locationData = await getUserLocation();

  // Initialize cursor data for the user
  cursors[socket.id] = {
    name: "",
    cursorImage: randomCursorImage,
    country: locationData.country,
    flag: locationData.flag,
    lastActive: Date.now(),
  };

  socket.on("cursor-move", (data) => {
    // Update cursor position and keep other details
    cursors[socket.id] = { ...cursors[socket.id], ...data, lastActive: Date.now() };
    io.emit("update-cursors", cursors); // Broadcast updated cursors
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
