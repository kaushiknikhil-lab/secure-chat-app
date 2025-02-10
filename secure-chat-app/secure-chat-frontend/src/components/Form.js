import React from 'react';
import './Form.css';

const Form = ({ title, children, onSubmit }) => {
  return (
    <form className="form-container" onSubmit={onSubmit}>
      <h2>{title}</h2>
      {children}
    </form>
  );
};

export default Form;