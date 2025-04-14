const nodemailer = require('nodemailer');
require('dotenv').config(); // Add this to ensure environment variables are loaded

console.log('Initializing email configuration...');
console.log('Environment variables:', {
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? '***' : 'undefined'
});

// Create a transporter using environment variables
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
    tls: {
        rejectUnauthorized: false // This is not recommended for production
    },
    debug: true, // Enable debug logging
    logger: true // Enable logger
});

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('Email configuration error:', error);
        console.error('Error details:', {
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode
        });
    } else {
        console.log('Email server is ready to send messages');
    }
});

// Function to send email with error handling
const sendEmail = async (options) => {
    console.log('Attempting to send email...');
    console.log('Email details:', {
        from: process.env.EMAIL_USER,
        to: options.to,
        subject: options.subject
    });

    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: options.to,
            subject: options.subject,
            html: options.html
        };

        console.log('Sending email with options:', {
            ...mailOptions,
            auth: { user: process.env.EMAIL_USER, pass: '***' }
        });

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully!');
        console.log('Email info:', {
            messageId: info.messageId,
            response: info.response,
            accepted: info.accepted,
            rejected: info.rejected
        });
        return { success: true, info };
    } catch (error) {
        console.error('Error sending email:', error);
        console.error('Error details:', {
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode,
            stack: error.stack
        });
        return { success: false, error: error.message };
    }
};

module.exports = { transporter, sendEmail }; 