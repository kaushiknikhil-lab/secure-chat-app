import React, { useState } from "react";
import "./Form.css";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";

export default function Otp() {
  const [otp, setOtp] = useState(new Array(6).fill(""));

  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state.email;

  const handleChange = (index, event) => {
    let value = event.target.value;

    // Ensure only single digit input
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus to next input if a digit is entered
    if (value && index < 5) {
      document.getElementById(`otp-input-${index + 1}`).focus();
    }
  };

  const handleKeyDown = (index, event) => {
    // Move focus back when pressing backspace on empty field
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-input-${index - 1}`).focus();
    }
  };

  const handleSubmit = async () => {
    const otpValue = otp.join("");

    try {
      await axios.post("http://localhost:5000/api/otpServices/verify", {
        email,
        otp: otpValue,
      });
      alert("Verification successful");
      navigate("/login");
    } catch (error) {
      if (error.response && error.response.data) {
        alert(error.response.data.error);
      } else {
        alert("An error occurred during verification.");
      }
    }
  };

  return (
    <div className="form-container">
      <h2>Enter Verification Code</h2>
      <p>Please enter the verification code sent to your email</p>
      <div className="otp-inputs">
        {otp.map((digit, index) => (
          <input
            key={index}
            id={`otp-input-${index}`}
            type="text"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="otp-input"
          />
        ))}
      </div>
      <button onClick={handleSubmit} className="submit-button">
        Verify
      </button>
    </div>
  );
}
