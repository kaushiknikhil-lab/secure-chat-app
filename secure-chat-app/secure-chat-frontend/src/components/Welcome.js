import React from 'react';
import './Welcome.css';

const Welcome = ({ username, notifications, onNotificationClick }) => {
  console.log("Welcome rendering with notifications:", notifications); // Debug

  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <h1>Welcome to Secure Chat, {username}!</h1>
        
        <div className="welcome-description">
          <p>Your private communication platform where security meets simplicity.</p>
          <div className="features">
            <div className="feature">
              <span className="feature-icon">🔒</span>
              <h3>End-to-End Encryption</h3>
              <p>All your messages are encrypted and can only be read by you and the recipient.</p>
            </div>
            <div className="feature">
              <span className="feature-icon">👤</span>
              <h3>Incognito Mode</h3>
              <p>Control your online visibility with our incognito mode feature.</p>
            </div>
            <div className="feature">
              <span className="feature-icon">⏱️</span>
              <h3>Self-Destructing Messages</h3>
              <p>Set expiration times for your messages to ensure they disappear after reading.</p>
            </div>
          </div>
        </div>
        
        {/* Display notifications if there are any */}
        {notifications && notifications.length > 0 && (
          <div className="welcome-notifications">
            <h3>New Messages</h3>
            {notifications.map((notification, index) => (
              <div key={index} className="welcome-notification">
                <h4>{notification.senderUsername} has sent you a message:</h4>
                <p className="notification-message">"{notification.message}"</p>
                <div className="notification-instructions">
                  <p>To chat with {notification.senderUsername}:</p>
                  <ol>
                    <li>Click on the menu icon (☰) in the top left</li>
                    <li>Search for "{notification.senderUsername}" in the search box</li>
                    <li>Click on their name to start chatting</li>
                  </ol>
                  <button 
                    className="start-chat-button"
                    onClick={() => onNotificationClick(notification)}
                  >
                    Start Chat
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Welcome;