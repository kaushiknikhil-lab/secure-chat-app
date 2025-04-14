import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './AnonymousChat.css';

const socket = io('http://localhost:5000', {
    auth: {
        token: 'anonymous'
    }
});

const AnonymousChat = () => {
    const [isJoining, setIsJoining] = useState(false);
    const [nickname, setNickname] = useState('');
    const [email, setEmail] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [error, setError] = useState('');
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [participants, setParticipants] = useState([]);
    const [isChatStarted, setIsChatStarted] = useState(false);
    const [createdRoomCode, setCreatedRoomCode] = useState('');

    useEffect(() => {
        if (isChatStarted) {
            socket.emit('joinAnonymousRoom', {
                roomCode: createdRoomCode || roomCode,
                nickname
            });

            socket.on('newAnonymousMessage', (message) => {
                setMessages(prev => [...prev, message]);
            });

            socket.on('userJoined', (data) => {
                setParticipants(prev => [...prev, { nickname: data.nickname, isOnline: true }]);
            });

            socket.on('userLeft', (data) => {
                setParticipants(prev => 
                    prev.map(p => p.nickname === data.nickname ? { ...p, isOnline: false } : p)
                );
            });

            return () => {
                socket.off('newAnonymousMessage');
                socket.off('userJoined');
                socket.off('userLeft');
            };
        }
    }, [isChatStarted, createdRoomCode, roomCode, nickname]);

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!nickname || !email) {
            setError('Please enter your nickname and recipient email');
            return;
        }
        
        try {
            console.log('Creating room with:', { nickname, email });
            
            // Use socket.io instead of axios
            socket.emit('createRoom', {
                nickname,
                email
            });
            
            // Listen for room creation response
            socket.once('roomCreated', (data) => {
                console.log('Room created:', data);
                setCreatedRoomCode(data.roomCode);
                setIsChatStarted(true);
                
                // Add the current user to participants
                setParticipants([{ nickname, isOnline: true }]);
            });
            
            socket.once('roomError', (errorMsg) => {
                console.error('Room creation error:', errorMsg);
                setError(errorMsg || 'Failed to create room');
            });
        } catch (err) {
            console.error('Error creating room:', err);
            setError('Failed to create room');
        }
    };

    const handleJoinRoom = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!nickname || !roomCode) {
            setError('Please enter your nickname and room code');
            return;
        }
        
        try {
            console.log('Joining room with:', { nickname, roomCode });
            
            // Use socket.io instead of axios
            socket.emit('joinRoom', {
                nickname,
                roomCode
            });
            
            // Listen for room join response
            socket.once('roomJoined', (data) => {
                console.log('Room joined:', data);
                setIsChatStarted(true);
                
                // Add the current user to participants
                setParticipants([{ nickname, isOnline: true }]);
            });
            
            socket.once('roomError', (errorMsg) => {
                console.error('Room join error:', errorMsg);
                setError(errorMsg || 'Failed to join room');
            });
        } catch (err) {
            console.error('Error joining room:', err);
            setError('Failed to join room');
        }
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        
        const messageData = {
            roomCode: createdRoomCode || roomCode,
            message: newMessage,
            nickname
        };
        
        socket.emit('anonymousMessage', messageData);
        setNewMessage('');
    };

    // Toggle functions
    const handleSetCreateRoom = () => {
        console.log('Switching to Create Room');
        setIsJoining(false);
    };

    const handleSetJoinRoom = () => {
        console.log('Switching to Join Room');
        setIsJoining(true);
    };

    if (isChatStarted) {
        return (
            <div className="anonymous-chat-container">
                <div className="anonymous-chat-box">
                    {/* Participants Section */}
                    <div className="participants-section">
                        <h3>Participants</h3>
                        {participants.map((participant, index) => (
                            <div key={index} className="participant">
                                <span className="participant-name">{participant.nickname}</span>
                                <span className={`participant-status ${participant.isOnline ? 'online' : ''}`}>
                                    {participant.isOnline ? 'Online' : 'Offline'}
                                </span>
                            </div>
                        ))}
                        {createdRoomCode && (
                            <div className="room-code">
                                Room Code: {createdRoomCode}
                            </div>
                        )}
                    </div>

                    {/* Chat Section */}
                    <div className="anonymous-chat-content">
                        <h3 className="anonymous-chat-heading">You are chatting anonymously</h3>
                        <div className="anonymous-chat-messages">
                            {messages.map((message, index) => (
                                <div 
                                    key={index} 
                                    className={`message ${message.nickname === nickname ? 'own-message' : 'other-message'}`}
                                >
                                    <div className="message-content">
                                        <span className="message-sender">
                                            {message.nickname === nickname ? 'You' : message.nickname}
                                        </span>
                                        <p>{message.content}</p>
                                        <div className="message-time">
                                            {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <form className="anonymous-chat-form" onSubmit={handleSendMessage}>
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                            />
                            <button type="submit">Send</button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="anonymous-chat-container">
            <div className="anonymous-form-container">
                <h2 className="anonymous-chat-title">Anonymous Chat</h2>
                {error && <div className="error-message">{error}</div>}

                {/* Toggle Buttons - Moved to top */}
                <div className="tabs">
                    <button
                        type="button"
                        className={`tab ${!isJoining ? 'active' : ''}`}
                        onClick={handleSetCreateRoom}
                    >
                        Create Room
                    </button>
                    <button
                        type="button"
                        className={`tab ${isJoining ? 'active' : ''}`}
                        onClick={handleSetJoinRoom}
                    >
                        Join Room
                    </button>
                </div>

                <div className="room-options">
                    {!isJoining ? (
                        <form onSubmit={handleCreateRoom}>
                            <div className="anonymous-form-group">
                                <label>Your Nickname</label>
                                <input
                                    type="text"
                                    className="anonymous-form-input"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    placeholder="Enter your nickname"
                                    required
                                />
                            </div>
                            <div className="anonymous-form-group">
                                <label>Recipient's Email</label>
                                <input
                                    type="email"
                                    className="anonymous-form-input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter recipient's email"
                                    required
                                />
                            </div>
                            <button type="submit" className="anonymous-form-button">
                                Create Room & Send Invite
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleJoinRoom}>
                            <div className="anonymous-form-group">
                                <label>Your Nickname</label>
                                <input
                                    type="text"
                                    className="anonymous-form-input"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    placeholder="Enter your nickname"
                                    required
                                />
                            </div>
                            <div className="anonymous-form-group">
                                <label>Room Code</label>
                                <input
                                    type="text"
                                    className="anonymous-form-input"
                                    value={roomCode}
                                    onChange={(e) => setRoomCode(e.target.value)}
                                    placeholder="Enter room code"
                                    required
                                />
                            </div>
                            <button type="submit" className="anonymous-form-button">
                                Join Room
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnonymousChat;