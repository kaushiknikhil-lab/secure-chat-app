import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../api";
import "./Search.css"; // Import the CSS file
import debounce from "lodash/debounce";

const Search = ({ token, onSelectUser, setIsOpen, socket }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const refreshInterval = useRef(null);

  const createOrGetChat = async (selectedUser) => {
    try {
      // First try to get existing chat
      const response = await api.get(`/chats/find/${selectedUser._id}`);
      
      if (response.data) {
        // Join the chat room
        socket?.emit('joinChat', response.data._id);
        return response.data;
      }

      // If no existing chat, create a new one
      const createResponse = await api.post('/chats', {
        recipientId: selectedUser._id,
      });
      
      // Join the new chat room
      socket?.emit('joinChat', createResponse.data._id);
      return createResponse.data;
    } catch (error) {
      console.error("Error creating/getting chat:", error);
      throw error;
    }
  };

  const handleUserSelect = async (selectedUser) => {
    try {
      const chat = await createOrGetChat(selectedUser);
      onSelectUser({ ...selectedUser, chatId: chat._id });
      setIsOpen(false);
      setQuery("");
      setResults([]);
      setShowResults(false);
    } catch (error) {
      setError("Failed to create chat. Please try again.");
    }
  };

  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setError(null);
      setLoading(false);
      setShowResults(false);
      return;
    }

    setLoading(true);
    setError(null);
    setShowResults(true);

    try {
      const config = {
        params: { query: searchQuery }
      };

      // Only add Authorization header if we have a valid token and it's not anonymous
      if (token && token !== "anonymous-token") {
        config.headers = {
          Authorization: `Bearer ${token}`
        };
      }

      console.log('Making search request with config:', config);
      const response = await api.get('/users/search', config);
      console.log('Search response:', response.data);
      setResults(response.data);
    } catch (error) {
      console.error("Error searching for users:", error);
      // Don't show error for anonymous users
      if (token !== "anonymous-token") {
        if (error.response) {
          console.error('Error response:', error.response.data);
          setError(error.response.data.details || error.response.data.error || "Failed to search users");
        } else if (error.request) {
          console.error('No response received:', error.request);
          setError("No response from server. Please try again.");
        } else {
          console.error('Error setting up request:', error.message);
          setError("Failed to search users. Please try again.");
        }
      }
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Function to refresh online status
  const refreshOnlineStatus = useCallback(async () => {
    if (!query.trim() || !showResults) return;

    try {
      const config = {
        params: { query }
      };

      // Only add Authorization header if not anonymous
      if (token !== "anonymous-token") {
        config.headers = {
          Authorization: `Bearer ${token}`
        };
      }

      const response = await api.get('/users/search', config);
      setResults(response.data);
    } catch (error) {
      // Don't log errors for anonymous users
      if (token !== "anonymous-token") {
        console.error("Error refreshing online status:", error);
      }
    }
  }, [query, token, showResults]);

  // Create a ref to store the debounced function
  const debouncedSearchRef = useRef(
    debounce((searchQuery) => {
      performSearch(searchQuery);
    }, 300)
  );

  useEffect(() => {
    const currentDebouncedSearch = debouncedSearchRef.current;
    
    if (query) {
      currentDebouncedSearch(query);
    } else {
      setResults([]);
      setError(null);
      setShowResults(false);
    }
    
    return () => {
      currentDebouncedSearch.cancel();
    };
  }, [query]);

  // Set up periodic refresh of online status
  useEffect(() => {
    if (showResults && query.trim() && token !== "anonymous-token") {
      refreshInterval.current = setInterval(refreshOnlineStatus, 1000); // Refresh every 1 second
    }

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [showResults, query, refreshOnlineStatus, token]);

  // Update results when user status changes
  useEffect(() => {
    if (!socket || token === "anonymous-token") return;

    const handleStatusChange = (data) => {
      setResults(prevResults => 
        prevResults.map(user => 
          user._id === data.userId 
            ? { ...user, isOnline: data.isOnline }
            : user
        )
      );
    };

    socket.on('userStatusChange', handleStatusChange);

    return () => {
      socket.off('userStatusChange', handleStatusChange);
    };
  }, [socket, token]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      performSearch(query);
    }
  };

  return (
    <div className="search-container">
      <form className="search-form" onSubmit={handleSearch}>
        <div className="search-input-group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users..."
            className="search-input"
          />
          <button type="submit" className="search-button">
            <span className="search-icon">🔍</span>
          </button>
        </div>
      </form>

      {loading && <div className="loading">Searching...</div>}
      {error && <div className="error">{error}</div>}

      {showResults && (
        <div className="search-results">
          {results.length > 0 ? (
            results.map((result) => (
              <div
                key={result._id}
                className="user-result"
                onClick={() => handleUserSelect(result)}
              >
                <div className="user-info">
                  <span className="username">{result.username}</span>
                  {token !== "anonymous-token" && (
                    <span className={`status ${result.isOnline ? 'online' : 'offline'}`}>
                      {result.isOnline ? 'Online' : 'Offline'}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="no-results">No users found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Search;
