const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Assuming you have a User model

// Search users by username
router.get('/search', async (req, res) => {
  try {
    // Check if authorization header is present
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    // Extract and verify the token
    const token = req.headers.authorization.split(' ')[1];
    console.log('Received token:', token); // Add logging to inspect the token

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Check if the username query parameter is present
    const query = req.query.username;
    if (!query) {
      return res.status(400).json({ error: 'Username query parameter is required' });
    }

    // Search for users with a case-insensitive regex match
    const users = await User.find({ username: new RegExp(query, 'i') }).select('username _id');
    res.status(200).json(users);
  } catch (err) {
    console.error('Error searching for users:', err);

    // Handle specific JWT errors
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    // Generic server error
    res.status(500).json({ error: 'Server error' });
  }
});

// Update incognito mode
router.post('/incognito', async (req, res) => {
  try {
    // Check if authorization header is present
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    // Extract and verify the token
    const token = req.headers.authorization.split(' ')[1];
    console.log('Received token:', token); // Add logging to inspect the token

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update incognito mode
    user.isIncognito = req.body.isIncognito;
    await user.save();

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error updating incognito mode:', err);

    // Handle specific JWT errors
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    // Generic server error
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;