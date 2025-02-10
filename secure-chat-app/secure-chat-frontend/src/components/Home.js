import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  return (
    <div className="home-container">
      <h1>Welcome to Secure Chat App</h1>
      <p className="app-description">
        Secure Chat App allows you to communicate with your friends and family securely. 
        Enjoy private and anonymous chats with end-to-end encryption. 
        Join us today and experience secure messaging like never before.
      </p>
      <div className="home-buttons">
        <Link to="/login" className="home-button">Login</Link>
        <p className="first-time">First time here?</p>
        <Link to="/register" className="home-button">Register</Link>
        <p className="or-chat-anonymously">Or chat anonymously</p>
        <Link to="/anonymous-chat" className="home-button">Chat Anonymously</Link>
      </div>
    </div>
  );
};

export default Home;