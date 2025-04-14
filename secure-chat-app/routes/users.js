const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authenticate = require('../middleware/auth');

// Add user profile route
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle incognito mode
router.post('/toggle-incognito', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Toggle the incognito status
    user.isIncognito = !user.isIncognito;
    await user.save();

    // Get the socket.io instance and users map
    const io = req.app.get('io');
    const users = req.app.get('users');
    
    if (io) {
      // Get user's socket ID
      const socketId = users.get(user._id.toString());
      
      if (socketId) {
        // Broadcast status change to all users
        io.emit('userStatusChange', {
          userId: user._id.toString(),
          isOnline: !user.isIncognito, // Show as offline if incognito
          lastSeen: user.isIncognito ? new Date() : null
        });
      }
    }

    res.json({ 
      message: `Incognito mode ${user.isIncognito ? 'enabled' : 'disabled'}`,
      isIncognito: user.isIncognito
    });
  } catch (error) {
    console.error('Error toggling incognito mode:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search users by username (for both authenticated and anonymous users)
router.get('/search', async (req, res) => {
  console.log('Received search request:', {
    query: req.query,
    headers: req.headers
  });
  
  try {
    const query = req.query.query;
    if (!query) {
      console.log('Search query missing');
      return res.status(400).json({ error: 'Search query parameter is required' });
    }

    console.log('Searching for users with query:', query);
    
    // Search for users with a case-insensitive regex match
    const users = await User.find({
      username: { $regex: query, $options: 'i' }
    }).select('username isOnline isIncognito _id lastSeen email');

    console.log('Found users:', users);

    // Filter out incognito users and format the response
    const filteredUsers = users
      .filter(user => !user.isIncognito)
      .map(user => ({
        _id: user._id,
        username: user.username,
        email: user.email,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        status: user.isOnline ? 'Online' : 'Offline'
      }));

    console.log('Filtered and formatted users:', filteredUsers);
    res.json(filteredUsers);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user status
router.get('/:userId/status', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('isOnline isIncognito lastSeen');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't show online status if user is in incognito mode
    if (user.isIncognito) {
      return res.json({ 
        isOnline: false,
        lastSeen: null
      });
    }

    res.json({ 
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    });
  } catch (error) {
    console.error('Error fetching user status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;