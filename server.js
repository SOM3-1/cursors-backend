const express = require("express");
const http = require("http");
const axios = require("axios");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config(); 

const app = express();
const server = http.createServer(app);

const isDev = process.env.NODE_ENV === "development";
const allowedOrigin = isDev
  ? "http://localhost:3000" 
  : process.env.ALLOWED_ORIGIN;

  const baseURL = isDev ? "" : process.env.ALLOWED_ORIGIN;

console.log(allowedOrigin)
app.use(
  cors({
    origin: allowedOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  })
);

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"],
  },
});

const cursorImages = Array.from({ length: 19 }, (_, i) => `${baseURL}/${i + 1}.svg`);

const cursors = {};

// const getUserLocation = async () => {
//   try {
//     const response = await axios.get("http://ip-api.com/json");
//     const { country, countryCode } = response.data;
//     const flag = `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
//     return { country, flag };
//   } catch (error) {
//     console.error("Error fetching location:", error);
//     return { country: "Unknown", flag: "" }; 
//   }
// };

const getUserLocation = async (ip) => {
  try {
    const response = await axios.get(`https://geolocation-db.com/json/`);
    const { country_name, country_code } = response.data;

    const flag = country_code ? `https://flagcdn.com/w40/${country_code.toLowerCase()}.png` : "";

    return { country: country_name || "Unknown", flag };
  } catch (error) {
    console.error("Error fetching location:", error);
    return { country: "Unknown", flag: "" };
  }
};


io.on("connection", async (socket) => {
  console.log(`User connected: ${socket.id}`);

  const randomCursorImage = cursorImages[Math.floor(Math.random() * cursorImages.length)];
  const forwardedFor = socket.handshake.headers["x-forwarded-for"];
  const clientIp = forwardedFor ? forwardedFor.split(",")[0] : socket.handshake.address;
  const locationData = await getUserLocation(clientIp);

  cursors[socket.id] = {
    name: "",
    cursorImage: randomCursorImage,
    country: locationData.country,
    flag: locationData.flag,
    lastActive: Date.now(),
  };

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

app.get("/", (req, res) => {
  res.send("Global Cursors API is running");
});

app.get("/cursors", (req, res) => {
  res.json(cursors);
});

app.get("/cursor/:id", (req, res) => {
  const { id } = req.params;
  if (cursors[id]) {
    return res.json(cursors[id]);
  }
  res.status(404).json({ error: "Cursor not found" });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(
    `Server running in ${isDev ? "development" : "production"} mode on port ${PORT}`
  );
});
