import React, { useState } from 'react';
import Chat from './Chat';


const AnonymousChat = () => {
  const [token] = useState('anonymous-token'); // Use a placeholder token for anonymous chat
  const [username, setUsername] = useState('');
  const [isChatStarted, setIsChatStarted] = useState(false);

  const handleStartChat = (e) => {
    e.preventDefault();
    if (username.trim()) {
      setIsChatStarted(true);
    }
  };

  if (isChatStarted) {
    return <Chat token={token} username={username} />;
  }

  return (
    <div className="anonymous-chat-container">
      <h2>Enter your name to start chatting anonymously</h2>
      <form onSubmit={handleStartChat} className="anonymous-chat-form">
        <input
          type="text"
          placeholder="Enter your name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <button type="submit">Start Chat</button>
      </form>
    </div>
  );
};

export default AnonymousChat;