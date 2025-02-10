import React, { useState } from 'react';
import axios from 'axios';
import './Search.css';

const Search = ({ token, onSelectUser }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.get(`http://localhost:5000/api/users/search?username=${query}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('Fetched data:', response.data);
      setResults(response.data);
    } catch (error) {
      console.error('Error searching for users:', error);
    }
  };

  if (!Array.isArray(results)) {
    console.error('Expected results to be an array, but got:', results);
    return <div>Error: Unexpected data format</div>;
  }

  return (
    <div>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users"
        />
        <button type="submit">Search</button>
      </form>
      <div>
        {results.map(result => (
          <div key={result._id} onClick={() => onSelectUser(result)}>
            {result.username}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Search;