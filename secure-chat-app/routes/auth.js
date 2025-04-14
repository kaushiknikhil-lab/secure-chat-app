const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authenticate = require('../middleware/auth');
const otpService = require('../routes/otpServices');


// Register route
router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  try {
    // Validate input
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Please provide username, password and email' });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = new User({ 
      username, 
      password: hashedPassword,
      email,
      isOnline: false,
      isIncognito: false
    });
    
    await newUser.save();

    // Generate and send OTP
    try {
      const otp = await otpService.generateOTP(email);
      await otpService.sendOTPEmail(email, otp);
      res.status(201).json({ 
        message: 'User registered successfully. Please check your email for verification code.',
        email: email
      });
    } catch (otpError) {
      console.error('OTP Error:', otpError);
      res.status(201).json({ 
        message: 'User registered successfully but there was an issue sending verification email. Please try again.',
        email: email
      });
    }
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/user', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Endpoint to search for users by username
router.get('/users/search', authenticate, async (req, res) => {
  const { username } = req.query;
  try {
    const users = await User.find({ username: new RegExp(username, 'i') }).select('username');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login Route - Generate and Send OTP
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: 'User not found' });

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

  const otp = await otpService.generateOTP(email);
  await otpService.sendOTPEmail(email, otp);
  res.json({ message: 'Verification code sent to your email' });
});

// OTP Verification Route
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!await otpService.verifyOTP(email, otp)) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  // Generate JWT token after OTP verification
  const user = await User.findOne({ email });
  const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });

  res.json({ message: 'OTP verified', token });
});

module.exports = router;