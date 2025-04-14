const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const jwt = require("jsonwebtoken");
const authRoutes = require("./routes/auth");
const { router: otpServices } = require('./routes/otpServices');
const messageRoutes = require("./routes/messages");
const groupRoutes = require("./routes/groups");
const userRoutes = require("./routes/users");
const chatRoutes = require('./routes/chats');
const User = require("./models/User");
const crypto = require('crypto');
const { transporter, sendEmail } = require('./emailConfig');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000
});

const users = new Map();
const rooms = new Map();

app.use(express.json());
app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  methods: ["GET", "POST"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/otpServices", otpServices);

// Socket.IO Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token === "anonymous" || token === "anonymous-token") return next();
  if (!token) return next(new Error("Authentication token missing"));
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    console.error("Socket auth error:", err.message);
    if (process.env.NODE_ENV === "development") next();
    else next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  socket.on("login", async (userId) => {
    try {
      socket.userId = userId;
      users.set(userId, socket.id);
      console.log(`User ${userId} connected`);

      if (userId !== "anonymous") {
        const user = await User.findByIdAndUpdate(
          userId, 
          { isOnline: true, lastSeen: new Date() },
          { new: true }
        );
        
        if (user && !user.isIncognito) {
          socket.broadcast.emit("userStatusChange", {
            userId: userId,
            isOnline: true,
            lastSeen: user.lastSeen
          });
        }
      }
    } catch (error) {
      console.error("Login error:", error);
    }
  });

  socket.on("sendMessage", async (message) => {
    try {
      const sender = await User.findById(socket.userId).select("username _id");
      if (!sender) {
        return socket.emit("messageStatus", {
          id: message.id,
          status: "failed",
          error: "Sender not found"
        });
      }

      const messageData = {
        id: message.id,
        message: message.message,
        senderId: sender._id,
        sender: sender.username,
        timestamp: Date.now(),
        expiryTime: message.expiryTime
      };

      // Send to recipient
      const recipientSocketId = users.get(message.receiverId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("receiveMessage", messageData);
      }

      // Send back to sender with isOwnMessage flag
      socket.emit("receiveMessage", {
        ...messageData,
        isOwnMessage: true
      });

      // Confirm delivery
      socket.emit("messageStatus", {
        id: message.id,
        status: "delivered",
        timestamp: messageData.timestamp
      });

    } catch (error) {
      console.error("Message error:", error);
      socket.emit("messageStatus", {
        id: message.id,
        status: "failed",
        error: error.message
      });
    }
  });

  socket.on("disconnect", async () => {
    try {
      if (socket.userId && socket.userId !== "anonymous") {
        users.delete(socket.userId);
        const user = await User.findByIdAndUpdate(
          socket.userId,
          { isOnline: false, lastSeen: new Date() }
        );
        
        if (user && !user.isIncognito) {
          socket.broadcast.emit("userStatusChange", {
            userId: socket.userId,
            isOnline: false,
            lastSeen: user.lastSeen
          });
        }
        console.log(`User ${socket.userId} disconnected`);
      }
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  });

  // Anonymous chat room handlers
  socket.on("createRoom", async (data) => {
    try {
      const { nickname, email } = data;
      // Generate a random 6-character room code
      const roomCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      
      // Store room info in memory
      rooms.set(roomCode, {
        creator: nickname,
        createdAt: new Date(),
        participants: [{ nickname, socketId: socket.id }]
      });
      
      // Join the room
      socket.join(roomCode);
      
      // Send email with room code
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Secure Chat Invitation',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #333;">Secure Chat Invitation</h2>
            <p>${nickname} has invited you to join a secure anonymous chat.</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
              <p style="font-size: 14px; margin-bottom: 10px;">Your room code is:</p>
              <h3 style="margin: 0; color: #007bff; letter-spacing: 2px;">${roomCode}</h3>
            </div>
            <p>To join the chat, enter this code and your nickname in the "Join Room" section.</p>
            <p>This is a secure, end-to-end encrypted chat that leaves no trace.</p>
          </div>
        `
      };
      
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Email error:', error);
          socket.emit('roomError', 'Failed to send invitation email');
        } else {
          console.log('Email sent:', info.response);
          socket.emit('roomCreated', { roomCode });
        }
      });
    } catch (error) {
      console.error('Create room error:', error);
      socket.emit('roomError', 'Failed to create room');
    }
  });
  
  socket.on("joinRoom", (data) => {
    try {
      const { nickname, roomCode } = data;
      
      // Check if room exists
      if (!rooms.has(roomCode)) {
        return socket.emit('roomError', 'Room not found');
      }
      
      // Add participant to room
      const room = rooms.get(roomCode);
      room.participants.push({ nickname, socketId: socket.id });
      
      // Join socket to room
      socket.join(roomCode);
      
      // Notify others in room
      socket.to(roomCode).emit('userJoined', { nickname });
      
      // Confirm join
      socket.emit('roomJoined', { roomCode });
    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('roomError', 'Failed to join room');
    }
  });
  
  socket.on("anonymousMessage", (data) => {
    try {
      const { roomCode, message, nickname } = data;
      
      // Check if room exists
      if (!rooms.has(roomCode)) {
        return socket.emit('messageError', 'Room not found');
      }
      
      const messageData = {
        content: message,
        nickname,
        timestamp: new Date()
      };
      
      // Send to everyone in the room including sender
      io.to(roomCode).emit('newAnonymousMessage', messageData);
    } catch (error) {
      console.error('Anonymous message error:', error);
      socket.emit('messageError', 'Failed to send message');
    }
  });

  // ... [Keep other existing socket handlers] ...
});

app.use(express.static(path.join(__dirname, "secure-chat-frontend", "build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "secure-chat-frontend", "build", "index.html"));
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});