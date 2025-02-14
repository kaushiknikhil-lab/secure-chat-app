import React, { useState } from "react";

import Search from "./Search";
import "./Sidebar.css";

const Sidebar = ({ token, onSelectUser }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div>
      <button
        className={`menu-button ${isOpen ? "hidden" : ""}`}
        onClick={toggleSidebar}
      >
        &#9776;
      </button>
      <div className={`sidebar ${isOpen ? "open" : ""}`}>
        <button className="close-button" onClick={toggleSidebar}>
          &times;
        </button>
        <h2>Search a User</h2>
        <Search
          token={token}
          onSelectUser={onSelectUser}
          setIsOpen={setIsOpen}
        />
        <ul>
          {/* <li><Link to="/create-group">Create Group</Link></li>
          <li><Link to="/join-group">Join Group</Link></li> */}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
