const express = require('express'); // Import express
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
const dotenv = require('dotenv');
const router = express.Router();

// Load environment variables
dotenv.config();

const otpStore = new Map(); // Temporary OTP storage

// Debug environment variables
console.log('Email User:', process.env.EMAIL_USER);
console.log('Email Password:', process.env.EMAIL_PASSWORD ? 'Password is set' : 'Password is not set');

// Create reusable transporter object using Gmail SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false // This will ignore the self-signed certificate error
  }
});

// Verify the transporter configuration
transporter.verify(function(error, success) {
  if (error) {
    console.log('Transporter verification error:', error);
  } else {
    console.log('Server is ready to send emails');
  }
});

// Function to generate OTP using speakeasy
const generateOTP = (email) => {
  const secret = speakeasy.generateSecret({ length: 20 });
  const otp = speakeasy.totp({
    secret: secret.base32,
    encoding: 'base32',
    step: 300 // 5 minutes validity
  });
  
  otpStore.set(email, {
    otp,
    secret: secret.base32,
    timestamp: Date.now()
  });
  
  // Expire OTP after 5 minutes
  setTimeout(() => otpStore.delete(email), 5 * 60 * 1000);
  return otp;
};

// Function to send OTP via email
const sendOTPEmail = async (email, otp) => {
  try {
    console.log('Attempting to send email to:', email);
    console.log('Using sender email:', process.env.EMAIL_USER);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Verification Code - Secure Chat App',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <h2 style="color: #2c3e50; text-align: center;">Welcome to Secure Chat App!</h2>
          <p style="color: #34495e;">Your verification code is:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="color: #3498db; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #7f8c8d; font-size: 14px;">This code will expire in 5 minutes.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #95a5a6; font-size: 12px; text-align: center;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.response);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

// Function to verify OTP
const verifyOTP = (email, otp) => {
  const storedData = otpStore.get(email);
  if (!storedData) {
    return false;
  }

  const isValid = speakeasy.totp.verify({
    secret: storedData.secret,
    encoding: 'base32',
    token: otp,
    step: 300,
    window: 1
  });

  if (isValid) {
    otpStore.delete(email);
  }
  return isValid;
};

// Route to generate and send OTP
router.post('/generate', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const otp = generateOTP(email);
    await sendOTPEmail(email, otp);
    res.status(200).json({ message: 'Verification code sent successfully' });
  } catch (error) {
    console.error('OTP generation error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Route to verify OTP
router.post('/verify', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and verification code are required' });
  }
  const isValid = verifyOTP(email, otp);
  if (isValid) {
    res.status(200).json({ message: 'Verification successful' });
  } else {
    res.status(400).json({ error: 'Invalid or expired verification code' });
  }
});

// Export both the router and the functions
module.exports = {
  router,
  generateOTP,
  sendOTPEmail,
  verifyOTP
};