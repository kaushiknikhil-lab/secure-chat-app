const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const otpServiceRoutes = require('./routes/otpServices');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const userRoutes = require('./routes/users'); // Ensure this line is present
const Message = require('./models/Message'); // Import the Message model
const User = require('./models/User'); // Import the User model

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Modify the Socket.IO server creation
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 30000
  },
  pingTimeout: 60000, // Increase from default 5000
  pingInterval: 25000  // Increase from default 25000
});

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/users', userRoutes); // Ensure this line is present
app.use('/api/otpServices', otpServiceRoutes);
// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'secure-chat-frontend', 'build')));

// Socket.IO middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (token === 'anonymous') {
    // Allow anonymous connections
    return next();
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Socket.IO connection
const users = new Map();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle both authenticated and anonymous users
  socket.on('registerUser', (userId) => {
    if (userId === 'anonymous') {
      socket.join('anonymous-chat');
    } else {
      users.set(userId, socket.id);
    }
    console.log(`User ${userId} registered`);
  });

  // Handle file transfers
  socket.on('sendFile', (message) => {
    try {
      console.log('Received file message:', {
        from: message.user,
        to: message.to,
        type: message.fileType
      });

      // Send to specific user
      if (message.to !== 'anonymous') {
        const recipientSocket = users.get(message.to);
        if (recipientSocket) {
          io.to(recipientSocket).emit('receiveFile', message);
          console.log(`File forwarded to ${message.to} (socket ${recipientSocket})`);
        }
      } else {
        // Broadcast to all except sender for anonymous
        socket.broadcast.emit('receiveFile', message);
      }
    } catch (error) {
      console.error('Error handling file transfer:', error);
    }
  });

  // Modify the sendMessage handler
  socket.on('sendMessage', (message) => {
    console.log('Received sendMessage event:', message);

    try {
      // Emit to receiver
      const receiverSocket = users.get(message.to);
      if (receiverSocket) {
        io.to(receiverSocket).emit('receiveMessage', message);

        // Notify sender using client's original ID
        socket.emit('messageStatus', {
          id: message.id, // Use client's ID
          status: 'delivered',
        });
        console.log(`Message ${message.id} delivered to ${message.to}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  // Handle message read status
  socket.on('messageRead', async (messageId) => {
    console.log('Received messageRead event:', messageId);

    try {
      // Find the message sender
      const message = await Message.findById(messageId.id);
      if (!message) {
        console.error('Message not found:', messageId.id);
        return;
      }

      // Check if the receiver is in incognito mode
      const receiver = await User.findById(message.receiver);
      if (receiver && receiver.isIncognito) {
        console.log(`User ${receiver._id} is in incognito mode. Not emitting read status.`);
        return;
      }

      // Emit read status to sender
      const senderSocket = users.get(message.sender);
      if (senderSocket) {
        io.to(senderSocket).emit('messageStatus', {
          id: messageId.id,
          status: 'read',
        });
        console.log(`Message ${messageId.id} read by ${messageId.senderId}`);
      }
    } catch (error) {
      console.error('Error handling message read status:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove from user mapping
    for (let [userId, sockId] of users.entries()) {
      if (sockId === socket.id) {
        users.delete(userId);
        console.log(`Removed user ${userId} from mapping`);
      }
    }
  });
});

// The "catchall" handler must be placed AFTER all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'secure-chat-frontend', 'build', 'index.html'));
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});