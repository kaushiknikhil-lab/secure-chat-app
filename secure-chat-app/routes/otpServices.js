const express = require('express'); // Import express
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
const router = express.Router();

const otpStore = new Map(); // Temporary OTP storage

// Function to generate OTP
const generateOTP = (email) => {
  const otp = speakeasy.totp({ secret: process.env.OTP_SECRET, encoding: 'base32' });
  otpStore.set(email, otp); // Store OTP temporarily
  setTimeout(() => otpStore.delete(email), 5 * 60 * 1000); // Expire OTP after 5 minutes
  return otp;
};

// Function to send OTP via email
const sendOTPEmail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP code is: ${otp}`
  };

  await transporter.sendMail(mailOptions);
};

// Function to verify OTP
const verifyOTP = (email, otp) => {
  return otpStore.get(email) === otp;
};

// Define routes
router.post('/generate', async (req, res) => {
  const { email } = req.body;
  const otp = generateOTP(email);
  await sendOTPEmail(email, otp);
  res.status(200).send('OTP sent');
});

router.post('/verify', (req, res) => {
  const { email, otp } = req.body;
  const isValid = verifyOTP(email, otp);
  if (isValid) {
    res.status(200).send('OTP verified');
  } else {
    res.status(400).send('Invalid OTP');
  }
});

module.exports = router;