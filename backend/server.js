const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const Message = require("./models/Message");
const User = require("./models/User");

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const CLIENT_URL =
  process.env.CLIENT_URL || "https://real-time-chat-app-frontend-blush.vercel.app";
const allowedOrigins = CLIENT_URL.split(",").map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.get("/", (req, res) => {
  res.send("Chat backend is running");
});

let isDatabaseConnected = false;
connectDB().then((connected) => {
  isDatabaseConnected = connected;
});

// The "connection" event runs every time a new client establishes
// a websocket connection with this server.
io.on("connection", (socket) => {
  // socket.id is a unique id created by Socket.io for this client session.
  // It helps us identify which browser/tab is currently connected.
  console.log(`User connected: ${socket.id}`);

  // Client emits "join_room" with a room id (example: "general-room").
  // Rooms are logical channels managed by Socket.io so that messages are
  // sent only to users in the same room, not to every connected client.
  socket.on("join_room", (roomId) => {
    // This call subscribes the current socket connection to the given room.
    // One user can join multiple rooms if the client emits multiple times.
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room: ${roomId}`);
  });

  // Client emits "send_message" with message payload.
  // Expected payload shape:
  // {
  //   sender: "<mongodb user id>",
  //   roomId: "<room id>",
  //   content: "<message text>"
  // }
  socket.on("send_message", async (messageData) => {
    try {
      const { sender, roomId, content } = messageData;

      // Basic safety check before touching DB.
      if (!sender || !roomId || !content) {
        socket.emit("message_error", "sender, roomId, and content are required");
        return;
      }

      // If DB is not connected, we still allow realtime chat to work.
      // In this fallback mode, message is broadcast only in-memory
      // and is not persisted to MongoDB.
      let messageForClients;

      if (isDatabaseConnected) {
        // The schema expects `sender` as a User ObjectId.
        // If client sends a username instead, we create/find a user record
        // so beginners can chat immediately without full auth implemented yet.
        let senderUserId = sender;

        if (!mongoose.isValidObjectId(sender)) {
          const normalizedUsername = String(sender).trim();
          let user = await User.findOne({ username: normalizedUsername });

          if (!user) {
            user = await User.create({
              username: normalizedUsername,
              email: `${normalizedUsername
                .replace(/\s+/g, ".")
                .toLowerCase()}@chat.local`,
            });
          }

          senderUserId = user._id;
        }

        // Persist the message in MongoDB so chat history is stored.
        const savedMessage = await Message.create({
          sender: senderUserId,
          roomId,
          content,
        });

        messageForClients = {
          _id: savedMessage._id,
          sender: String(sender).trim(),
          roomId: savedMessage.roomId,
          content: savedMessage.content,
          timestamp: savedMessage.timestamp,
        };
      } else {
        // Temporary message object when DB is down.
        messageForClients = {
          _id: `temp-${Date.now()}`,
          sender: String(sender).trim(),
          roomId: String(roomId).trim(),
          content: String(content).trim(),
          timestamp: new Date(),
        };
      }

      // Broadcast to everyone in the same room (including sender).
      // Data flow:
      // 1) client sends "send_message"
      // 2) server saves to DB
      // 3) server emits "receive_message" to room members
      io.to(roomId).emit("receive_message", messageForClients);
    } catch (error) {
      console.error("Error saving/sending message:", error.message);
      socket.emit("message_error", "Unable to send message");
    }
  });

  // Fired when client disconnects (tab close, refresh, network drop, etc.).
  // Socket.io automatically removes this socket from all joined rooms.
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
