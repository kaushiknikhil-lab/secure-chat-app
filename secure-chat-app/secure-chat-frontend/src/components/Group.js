-chat-app/secure-chat-frontend/src/components/Group.js
import React, { useState } from 'react';
import axios from 'axios';

const Group = ({ token }) => {
  const [groupName, setGroupName] = useState('');
  const [groups, setGroups] = useState([]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/groups', { name: groupName }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setGroups([...groups, response.data]);
      setGroupName('');
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const handleJoinGroup = async (groupId) => {
    try {
      await axios.post(`http://localhost:5000/api/groups/${groupId}/join`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      alert('Joined group successfully');
    } catch (error) {
      console.error('Error joining group:', error);
    }
  };

  return (
    <div>
      <h2>Create Group</h2>
      <form onSubmit={handleCreateGroup}>
        <input
          type="text"
          placeholder="Group Name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />
        <button type="submit">Create</button>
      </form>
      <h2>Join Group</h2>
      <ul>
        {groups.map((group) => (
          <li key={group._id}>
            {group.name} <button onClick={() => handleJoinGroup(group._id)}>Join</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Group;