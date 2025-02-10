const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// Fetch messages
router.get('/', async (req, res) => {
  try {
    const messages = await Message.find();
    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

// Send message
router.post('/', async (req, res) => {
  try {
    const newMessage = new Message({
      message: req.body.message,
      user: req.user.id // Assuming you have user authentication
    });
    const savedMessage = await newMessage.save();
    res.status(201).json(savedMessage);
  } catch (err) {
    res.status(500).json({ error: 'Error sending message' });
  }
});

// Anonymous message route
router.post('/anonymous', async (req, res) => {
  try {
    const newMessage = new Message({
      message: req.body.message,
      user: 'Anonymous'
    });
    const savedMessage = await newMessage.save();
    res.status(201).json(savedMessage);
  } catch (err) {
    res.status(500).json({ error: 'Error sending message' });
  }
});

module.exports = router;