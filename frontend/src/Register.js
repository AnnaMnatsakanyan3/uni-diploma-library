import axios from "axios";
import React from "react";
import { useTranslation } from "react-i18next";

function Register({ goLogin }) {

  const register = async (e) => {
    e.preventDefault();
    const form = e.target;

    try {
      await axios.post("http://localhost:5000/register", {
        name: form.name.value,
        email: form.email.value,
        password: form.password.value,
        role: form.role.value
      });

      alert("Registered successfully");
      form.reset();

    } catch (err) {
       alert(err.response?.data?.error || "Registration failed");
    }
  };

  return (
    <div className="auth-center">
      <form onSubmit={register} className="auth-card">
        <h2>Register</h2>

        <input name="name" placeholder="Name" required />
        <input name="email" placeholder="Email (@nuaca.am)" required />
        <input name="password" type="password" placeholder="Password" required />

        <select name="role">
          <option value="student">Student</option>
          <option value="lecturer">Lecturer</option>
        </select>

        <button type="submit">Register</button>

        <p onClick={goLogin} style={{cursor:"pointer"}}>
          Already have account? Login
        </p>
      </form>
    </div>
  );
}

export default Register;