const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const User = require('../models/User');
const authenticate = require('../middleware/auth');

// Get existing chat or return null
router.get('/find/:userId', authenticate, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      participants: {
        $all: [req.user.id, req.params.userId]
      }
    }).populate('participants', 'username isOnline');

    res.json(chat);
  } catch (error) {
    console.error('Error finding chat:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new chat
router.post('/', authenticate, async (req, res) => {
  try {
    const { recipientId } = req.body;

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Check if chat already exists
    const existingChat = await Chat.findOne({
      participants: {
        $all: [req.user.id, recipientId]
      }
    }).populate('participants', 'username isOnline');

    if (existingChat) {
      return res.json(existingChat);
    }

    // Create new chat
    const newChat = new Chat({
      participants: [req.user.id, recipientId],
      messages: []
    });

    await newChat.save();

    // Populate participants
    await newChat.populate('participants', 'username isOnline');

    // Get the io instance from app locals
    const io = req.app.get('io');
    
    // Emit events to both participants
    if (io) {
      const users = req.app.get('users');
      const recipientSocket = users.get(recipientId);
      const senderSocket = users.get(req.user.id);

      if (recipientSocket) {
        io.to(recipientSocket).emit('newChat', {
          chat: newChat,
          initiator: req.user.id
        });
      }

      if (senderSocket) {
        io.to(senderSocket).emit('newChat', {
          chat: newChat,
          initiator: req.user.id
        });
      }
    }

    res.json(newChat);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all chats for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user.id
    })
    .populate('participants', 'username isOnline')
    .sort({ lastMessage: -1 });

    res.json(chats);
  } catch (error) {
    console.error('Error getting chats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 