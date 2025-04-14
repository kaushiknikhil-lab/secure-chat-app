import React, { useState, useEffect, useMemo, useRef } from "react";
import { io } from "socket.io-client";
import CryptoJS from "crypto-js";
import Sidebar from "./Sidebar";
import "./Chat.css";
import Welcome from './Welcome';

const Message = ({ message, isOwnMessage }) => {
  return (
    <div className={`message ${isOwnMessage ? 'own-message' : 'other-message'}`}>
      <div className="message-content">
        {message.type === 'file' ? (
          <div className="file-message">
            <a href={message.file} download={message.fileName}>
              📎 {message.fileName}
            </a>
          </div>
        ) : (
          <>
            {!isOwnMessage && <div className="message-sender">{message.sender || message.user}</div>}
            <p>{message.message}</p>
            <div className="message-time">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Notifications = ({ notifications, onNotificationClick, onClose }) => {
  return (
    <div className="notifications-panel">
      <div className="notifications-header">
        <h3>New Messages</h3>
        <button className="panel-close" onClick={onClose}>×</button>
      </div>
      
      {notifications.map((notification, index) => (
        <div 
          key={notification.id || index} 
          className="notification"
          onClick={() => onNotificationClick(notification)}
        >
          <div className="notification-header">
            <strong>{notification.senderUsername}</strong>
            <span className="notification-time">
              {new Date(notification.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          <p className="notification-message">{notification.message}</p>
          {notification.roomCode && (
            <div className="room-code">
              <p>Room Code: {notification.roomCode}</p>
              <button 
                className="join-room-button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `/anonymous?code=${notification.roomCode}`;
                }}
              >
                Join Room
              </button>
            </div>
          )}
        </div>
      ))}
      
      <div className="notification-help">
        <p>To start chatting with the sender, please:</p>
        <ol>
          <li>Click on any notification to start chatting with that person</li>
          <li>Or click on the menu icon (☰) in the top left</li>
          <li>Search for the user's username and click to start chatting</li>
        </ol>
      </div>
    </div>
  );
};

const Chat = ({ token, username, roomCode, isAnonymous }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [currentUsername, setCurrentUsername] = useState(username);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [expiryTime, setExpiryTime] = useState(0);
  const [attachedFile, setAttachedFile] = useState(null);
  const [isIncognito, setIsIncognito] = useState(false);
  const [incognitoLoading, setIncognitoLoading] = useState(false);
  const secretKey = process.env.REACT_APP_SECRET_KEY;

  const currentUsernameRef = useRef(username);
  const currentUserIdRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    currentUsernameRef.current = currentUsername;
    currentUserIdRef.current = currentUserId;
  }, [currentUsername, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const socket = useMemo(() => {
    const newSocket = io("http://localhost:5000", {
      transports: ["websocket"],
      auth: {
        token: token === "anonymous-token" ? "anonymous" : token,
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log("Socket connected successfully", newSocket.id);
    });

    newSocket.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
    });

    return newSocket;
  }, [token]);

  useEffect(() => {
    const fetchUsername = async () => {
      if (token === "anonymous-token") {
        setCurrentUsername(username);
        setCurrentUserId(null);
        socket.emit("login", "anonymous");
        return;
      }

      try {
        const response = await fetch("http://localhost:5000/api/auth/user", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          localStorage.removeItem("token");
          window.location = "/login";
          return;
        }

        const data = await response.json();
        setCurrentUsername(data.username);
        setCurrentUserId(data._id);
        socket.emit("login", data._id);
      } catch (error) {
        console.error("Error fetching username:", error);
      }
    };

    fetchUsername();
  }, [socket, token, username]);

  useEffect(() => {
    const handleIncomingMessage = (data) => {
      console.log("Incoming message:", data);
      console.log("Selected user:", selectedUser);

      // Decrypt message if needed
      let messageContent = data.message;
      if (!data.isIncognito && messageContent && typeof messageContent === "string" && messageContent.startsWith("U2F")) {
        try {
          messageContent = CryptoJS.AES.decrypt(messageContent, secretKey).toString(CryptoJS.enc.Utf8);
        } catch (err) {
          console.error("Decryption failed:", err);
        }
      }

      // Create message object
      const newMessage = {
        ...data,
        id: data.id || `msg_${Date.now()}`,
        message: messageContent,
        sender: data.sender || "Unknown",
        timestamp: data.timestamp || Date.now(),
        isOwnMessage: false
      };

      // Always add to messages
      setMessages(prev => [...prev, newMessage]);

      // Only create notification if not from current chat AND message is from another user
      const isCurrentChat = selectedUser && 
        (selectedUser._id === data.senderId || 
         selectedUser.username === data.sender);
      const isCurrentUser = data.senderId === currentUserIdRef.current;

      if (!isCurrentChat && !isCurrentUser) {
        const newNotification = {
          id: newMessage.id,
          senderUsername: data.sender || "Unknown User",
          senderId: data.senderId,
          message: messageContent || "New message",
          timestamp: newMessage.timestamp
        };

        setNotifications(prev => {
          if (prev.some(n => n.id === newNotification.id)) {
            return prev;
          }
          return [...prev, newNotification];
        });
      }
    };

    // Setup listeners
    socket.on("privateMessage", handleIncomingMessage);
    socket.on("message", handleIncomingMessage);
    socket.on("newMessage", handleIncomingMessage);
    socket.on("receiveMessage", handleIncomingMessage);
    
    return () => {
      socket.off("privateMessage", handleIncomingMessage);
      socket.off("message", handleIncomingMessage);
      socket.off("newMessage", handleIncomingMessage);
      socket.off("receiveMessage", handleIncomingMessage);
    };
  }, [selectedUser, socket, secretKey, currentUserIdRef]);

  const handleNotificationClick = (notification) => {
    console.log("Notification clicked:", notification);

    if (notification.senderId) {
      console.log("Fetching user data for:", notification.senderId);

      fetchUserById(notification.senderId)
        .then(user => {
          if (user) {
            console.log("Found user, selecting:", user);
            setSelectedUser(user);

            // Remove this notification now that we've handled it
            setNotifications(prev => 
              prev.filter(n => n.id !== notification.id)
            );
          } else {
            console.error("User not found for ID:", notification.senderId);
          }
        })
        .catch(err => {
          console.error("Error fetching user:", err);
        });
    } else {
      console.warn("No sender ID in notification:", notification);
    }
  };

  const fetchUserById = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error("Error fetching user:", error);
      return null;
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    if (!selectedUser) return;

    const messageId = generateId();

    const messageObj = {
      id: messageId,
      message: message,
      user: currentUsername,
      timestamp: Date.now(),
      status: 'sent',
      expiryTime: expiryTime > 0 ? Date.now() + expiryTime * 60000 : null,
    };

    setMessages(prev => [...prev, messageObj]);

    let messageToSend = messageObj.message;
    if (!isIncognito) {
      messageToSend = CryptoJS.AES.encrypt(messageToSend, secretKey).toString();
    }

    // Send the message to the selected user
    socket.emit("sendMessage", {
      id: messageId,
      message: messageToSend,
      receiverId: selectedUser._id,
      expiryTime: messageObj.expiryTime,
    });

    setMessage("");
    setExpiryTime(0);

    if (attachedFile) {
      setAttachedFile(null);
      document.getElementById("file-input").value = "";
    }
  };

  const handleAttachmentClick = () => {
    document.getElementById("file-input").click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("File size exceeds 20MB limit. Please choose a smaller file.");
      e.target.value = "";
      return;
    }

    setAttachedFile(file);
  };

  const generateRandomBytes = (length) => {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return array;
  };

  const generateId = () => {
    const bytes = generateRandomBytes(16);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const toggleIncognito = async () => {
    if (incognitoLoading) return;
    
    setIncognitoLoading(true);
    try {
      const newIncognitoState = !isIncognito;
      setIsIncognito(newIncognitoState);
    } catch (error) {
      console.error('Error toggling incognito mode:', error);
    } finally {
      setIncognitoLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="watermark-overlay"></div>
      <div className="chat-container">
        {notifications.length > 0 && (
          <button 
            className="notification-toggle-button"
            onClick={() => setShowNotificationsPanel(!showNotificationsPanel)}
          >
            🔔 Notifications ({notifications.length})
          </button>
        )}
        
        <Sidebar token={token} onSelectUser={setSelectedUser} selectedUser={selectedUser} />
        <div className="chat-content">
          {!selectedUser ? (
             <Welcome 
             username={currentUsername} 
             notifications={notifications}
             onNotificationClick={handleNotificationClick}
           />
          ) : (
            <>
              <div className="chat-header">
                <div className="user-info">
                  <h2>Chat with {selectedUser.username}</h2>
                  <div className="user-status">
                    {selectedUser.isOnline ? (
                      <span className="online-indicator">● Online</span>
                    ) : (
                      <span className="offline-indicator">○ Offline</span>
                    )}
                  </div>
                </div>
                <div className="incognito-control">
                  <button
                    className={`incognito-toggle ${isIncognito ? "active" : ""} ${
                      incognitoLoading ? "loading" : ""
                    }`}
                    onClick={toggleIncognito}
                    disabled={incognitoLoading || token === "anonymous-token"}
                  >
                    {incognitoLoading ? (
                      <span>Loading...</span>
                    ) : (
                      isIncognito ? "🔒 Incognito Mode" : "👤 Normal Mode"
                    )}
                  </button>
                </div>
              </div>
              <div className="chat-box">
                <div className="chat-messages">
                  {messages
                    .filter(msg => 
                      !selectedUser || 
                      msg.user === currentUsername || 
                      msg.sender === selectedUser.username || 
                      msg.senderId === selectedUser._id
                    )
                    .map((msg, index) => (
                      <Message
                        key={msg.id || index}
                        message={msg}
                        isOwnMessage={msg.user === currentUsername || msg.isOwnMessage}
                      />
                    ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
              <form className="chat-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  id="message-input"
                  name="message"
                  placeholder="Type a message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  autoComplete="off"
                />
                <label
                  htmlFor="file-input"
                  className="attachment-button"
                  onClick={handleAttachmentClick}
                >
                  📎
                </label>
                <input
                  id="file-input"
                  name="file"
                  type="file"
                  className="file-input"
                  onChange={handleFileChange}
                />
                {attachedFile && (
                  <p className="attached-file">
                    Attached: {attachedFile.name} (
                    {Math.round(attachedFile.size / 1024)} KB)
                  </p>
                )}
                <div className="expiry-input-container">
                  <label htmlFor="expiry-time" className="expiry-label">
                    Expiry time (minutes):
                  </label>
                  <input
                    id="expiry-time"
                    name="expiryTime"
                    type="number"
                    className="expiry-input"
                    placeholder="0"
                    value={expiryTime}
                    onChange={(e) => setExpiryTime(Number(e.target.value))}
                    min="0"
                  />
                </div>
                <button type="submit" id="send-button" name="send">
                  Send
                </button>
              </form>
            </>
          )}
        </div>
        {showNotificationsPanel && notifications.length > 0 && (
          <Notifications 
            notifications={notifications} 
            onNotificationClick={handleNotificationClick}
            onClose={() => setShowNotificationsPanel(false)} 
          />
        )}
      </div>
    </div>
  );
};

export default Chat;
