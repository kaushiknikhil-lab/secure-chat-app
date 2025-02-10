import React, { useState, useEffect, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import CryptoJS from 'crypto-js';
import Sidebar from './Sidebar';
import './Chat.css';

const Chat = ({ token, username }) => {
  // Socket initialization
  const socket = useMemo(() => io('http://localhost:5000', {
    transports: ['websocket'],
    auth: {
      token: token === 'anonymous-token' ? 'anonymous' : token
    },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  }), [token]);

  // State management
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentUsername, setCurrentUsername] = useState(username);
  const [expiryTime, setExpiryTime] = useState(0);
  const [attachedFile, setAttachedFile] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isIncognito, setIsIncognito] = useState(false); // Incognito mode state
  const [messageStatuses, setMessageStatuses] = useState({}); // Track message statuses
  const secretKey = process.env.REACT_APP_SECRET_KEY;

  // Ref for current username to avoid stale closures
  const currentUsernameRef = useRef(username);
  
  // Sync ref with state changes
  useEffect(() => {
    currentUsernameRef.current = currentUsername;
  }, [currentUsername]);

  // Main effect for connection logic
  useEffect(() => {
    const fetchUsername = async () => {
      if (token === 'anonymous-token') {
        setCurrentUsername(username);
        socket.emit('registerUser', 'anonymous');
        return;
      }

      try {
        const response = await fetch('http://localhost:5000/api/auth/user', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location = '/login';
          return;
        }

        const data = await response.json();
        setCurrentUsername(data.username);
        socket.emit('registerUser', data._id);
      } catch (error) {
        console.error('Error fetching username:', error);
      }
    };

    // Message handlers using refs
    const handleReceivedMessage = (encryptedMessage) => {
      console.log('Received message:', encryptedMessage);
      const bytes = CryptoJS.AES.decrypt(encryptedMessage.message, secretKey);
      const decryptedMessage = bytes.toString(CryptoJS.enc.Utf8);
      const msg = { ...encryptedMessage, message: decryptedMessage };
      
      if (msg.user === currentUsernameRef.current) return;
      setMessages(prev => [...prev, msg]);
    };

    const handleReceivedFile = (encryptedFileMessage) => {
      console.log('Received file message:', encryptedFileMessage);
      try {
        const fileBytes = CryptoJS.AES.decrypt(encryptedFileMessage.file, secretKey);
        const decryptedBase64 = fileBytes.toString(CryptoJS.enc.Base64);
        const decryptedFile = `data:${encryptedFileMessage.fileType};base64,${decryptedBase64}`;
        
        setMessages(prev => [
          ...prev,
          { ...encryptedFileMessage, file: decryptedFile }
        ]);
      } catch (error) {
        console.error('File decryption error:', error);
      }
    };

    // Handle message status updates
    const handleMessageStatus = (status) => {
      console.log(`Message ${status.id} status updated: ${status.status}`);
      setMessageStatuses((prev) => ({ ...prev, [status.id]: status.status }));
    };

    // Setup event listeners
    fetchUsername();
    socket.on('receiveMessage', handleReceivedMessage);
    socket.on('receiveFile', handleReceivedFile);
    socket.on('messageStatus', handleMessageStatus);
    socket.on('messageRecalled', (messageId) => {
      console.log('Message recalled:', messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    });

    // Cleanup function
    return () => {
      if (socket.connected) {
        socket.disconnect();
      }
      socket.off('receiveMessage', handleReceivedMessage);
      socket.off('receiveFile', handleReceivedFile);
      socket.off('messageStatus', handleMessageStatus);
      socket.off('messageRecalled');
    };
  }, [token, username, secretKey, socket]);

  // Add connection status handling
  useEffect(() => {
    const handleConnect = () => {
      console.log('Socket connected');
      setIsConnected(true);
      if (token === 'anonymous-token') {
        socket.emit('registerUser', 'anonymous');
      }
    };

    const handleDisconnect = () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    };

    const handleConnectError = (err) => {
      console.error('Connection error:', err);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [socket, token]);

  // Track message reads
  useEffect(() => {
    const unreadMessages = messages.filter(
      (msg) => msg.user !== currentUsername && !messageStatuses[msg.id]
    );

    if (unreadMessages.length > 0) {
      unreadMessages.forEach((msg) => {
        console.log('Marking message as read:', msg.id);
        socket.emit('messageRead', { 
          id: msg.id, 
          senderId: msg.user === 'anonymous' ? 'anonymous' : msg.user._id 
        });
      });
    }
  }, [messages, currentUsername, socket, messageStatuses]);

  const encryptMessage = (message, secretKey) => {
    return CryptoJS.AES.encrypt(message, secretKey).toString();
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!isConnected) return;

    const clientMessageId = Date.now(); // Generate client-side ID

    const newMessage = {
      id: clientMessageId, // Use client-generated ID
      message: encryptMessage(message, secretKey),
      user: currentUsername,
      to: selectedUser?._id,
      timestamp: new Date(),
      expiryTime: expiryTime > 0 ? Date.now() + expiryTime * 60000 : null,
      fileType: attachedFile?.type
    };

    socket.emit('sendMessage', newMessage);

    // Add temporary status for immediate UI update
    setMessageStatuses((prev) => ({
      ...prev,
      [clientMessageId]: 'sent',
    }));

    if (attachedFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fileData = event.target.result;
        const base64Data = fileData.split(',')[1];
        const encryptedFile = CryptoJS.AES.encrypt(base64Data, secretKey).toString();
        
        socket.emit('sendFile', {
          ...newMessage,
          file: encryptedFile,
          fileType: attachedFile.type
        });

        setMessages(prev => [
          ...prev,
          { ...newMessage, message: message, file: fileData }
        ]);
        
        setAttachedFile(null);
      };
      reader.readAsDataURL(attachedFile);
    } else {
      setMessages(prev => [
        ...prev,
        { ...newMessage, message: message }
      ]);
    }

    setMessage('');
  };

  const handleRecallMessage = (messageId) => {
    socket.emit('recallMessage', messageId);
    setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setMessages([]);
  };

  const handleAttachmentClick = () => {
    document.getElementById('file-input').click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('File size exceeds 20MB limit. Please choose a smaller file.');
      e.target.value = '';
      return;
    }

    setAttachedFile(file);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => !msg.expiryTime || now < msg.expiryTime)
      );
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Add useEffect for incognito mode
  useEffect(() => {
    if (token === 'anonymous-token') return;

    const updateIncognito = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/users/incognito', { // Ensure the correct URL
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isIncognito }),
        });

        if (!response.ok) {
          throw new Error('Failed to update incognito mode');
        }

        const data = await response.json();
        console.log('Incognito mode updated:', data);
      } catch (error) {
        console.error('Failed to update incognito mode:', error);
      }
    };

    updateIncognito();
  }, [isIncognito, token]);

  const toggleIncognito = () => {
    setIsIncognito((prev) => !prev);
  };

  return (
    <div className="app-container">
      <div className="watermark-overlay"></div>
      <div className="chat-container">
        <Sidebar token={token} onSelectUser={handleSelectUser} />
        <div className="chat-content">
          {token === 'anonymous-token' && <p className="anonymous-message">You are chatting anonymously as {currentUsername}</p>}
          <button onClick={toggleIncognito}>
            {isIncognito ? 'Disable Incognito Mode' : 'Enable Incognito Mode'}
          </button>
          <div className="chat-box">
          {messages.map((msg, index) => (
  <div
    key={index}
    className={`chat-message ${msg.user === currentUsername ? 'sender' : 'receiver'}`}
  >
    <strong>{msg.user}:</strong> {msg.message}
    {msg.file && (
      <div className="file-preview">
        {msg.file.startsWith("data:image/") ? (
          <img 
            src={msg.file} 
            alt="Sent content" 
            style={{ maxWidth: '200px', maxHeight: '200px' }}
          />
        ) : (
          <a 
            href={msg.file} 
            download={`file_${msg.id}.${msg.fileType?.split('/')[1] || 'dat'}`}
          >
            Download File
          </a>
        )}
      </div>
    )}
    {msg.user === currentUsername && (
      <span className="message-status">
        {messageStatuses[msg.id] === 'read' ? '✓✓ Read' :
         messageStatuses[msg.id] === 'delivered' ? '✓✓ Delivered' :
         '✓ Sent'}
      </span>
    )}
    {msg.user === currentUsername && (
      <button className="recall-button" onClick={() => handleRecallMessage(msg.id)}>Recall</button>
    )}
  </div>
))}
          </div>
          <form className="chat-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              placeholder="Type a message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <label htmlFor="file-input" className="attachment-button" onClick={handleAttachmentClick}>
              📎
            </label>
            <input
              id="file-input"
              type="file"
              className="file-input"
              onChange={handleFileChange}
            />
            {attachedFile && (
              <p className="attached-file">
                Attached: {attachedFile.name} ({Math.round(attachedFile.size / 1024)} KB)
              </p>
            )}
            <div className="expiry-input-container">
              <label htmlFor="expiry-time" className="expiry-label">Expiry time (minutes):</label>
              <input
                id="expiry-time"
                type="number"
                className="expiry-input"
                placeholder="Expiry time (minutes)"
                value={expiryTime}
                onChange={(e) => setExpiryTime(Number(e.target.value))}
              />
            </div>
            <button type="submit">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;