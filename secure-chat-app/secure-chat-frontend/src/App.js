import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Register from './components/Register';
import Login from './components/Login';
import Chat from './components/Chat';
import AnonymousChat from './components/AnonymousChat';
import Contact from './components/Contact';
import Home from './components/Home';
import './App.css';

function App() {
  const [token, setToken] = useState(null);
  const overlayRef = useRef(null);

  // Function to show the screenshot warning overlay
  const showOverlay = () => {
    if (overlayRef.current) {
      overlayRef.current.style.display = 'flex';
      setTimeout(() => {
        overlayRef.current.style.display = 'none';
      }, 3000); // Hide after 3 seconds
    }
  };

  // Detect screenshot attempts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Detect common screenshot shortcuts
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') || // Ctrl/Cmd + Shift + S
        e.key === 'PrintScreen' || // PrintScreen
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') || // Ctrl/Cmd + P (Print)
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === '4') // Ctrl/Cmd + 4 (Mac screenshot)
      ) 
      {
        e.preventDefault();
        showOverlay();
        alert('Screenshots are disabled for security reasons.');
    }
    };

    // Add event listener for keydown
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <Router>
      <div className="app-container">
        {/* Screenshot Warning Overlay */}
        <div ref={overlayRef} className="screenshot-overlay">
          <div className="screenshot-warning">
            ⚠️ Screenshots Disabled
            <p>Taking screenshots is not allowed for security reasons.</p>
          </div>
        </div>

        {/* Navbar and Routes */}
        <Navbar />
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login setToken={setToken} />} />
          <Route path="/chat" element={<Chat token={token} />} />
          <Route path="/anonymous-chat" element={<AnonymousChat />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/" element={<Home />} />
        </Routes>

        {/* Decorative Image */}
        <img src="/images/4957160.jpg" alt="Decorative" className="decorative-image" />
      </div>
    </Router>
  );
}

export default App;