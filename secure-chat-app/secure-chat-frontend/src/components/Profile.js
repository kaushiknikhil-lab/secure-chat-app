import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Profile.css';

const Profile = ({ token, onLogout }) => {
  const [user, setUser] = useState(null);
  const [isIncognito, setIsIncognito] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/auth/user', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setUser(response.data);
        setIsIncognito(response.data.isIncognito);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setError('Failed to load profile');
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [token]);

  const handleIncognitoToggle = async () => {
    try {
      const response = await axios.put(
        'http://localhost:5000/api/users/toggle-incognito',
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      setIsIncognito(response.data.isIncognito);
    } catch (error) {
      console.error('Error toggling incognito mode:', error);
      setError('Failed to update incognito mode');
    }
  };

  if (loading) return <div className="profile-container">Loading...</div>;
  if (error) return <div className="profile-container error">{error}</div>;

  return (
    <div className="profile-container">
      <h2>Profile Settings</h2>
      {user && (
        <div className="profile-info">
          <p><strong>Username:</strong> {user.username}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <div className="incognito-toggle">
            <label>
              <input
                type="checkbox"
                checked={isIncognito}
                onChange={handleIncognitoToggle}
              />
              Incognito Mode
            </label>
            <p className="incognito-info">
              When enabled, other users won't see when you're online.
            </p>
          </div>
        </div>
      )}
      <button onClick={onLogout} className="logout-button">
        Logout
      </button>
    </div>
  );
};

export default Profile; 