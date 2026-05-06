import api from "./api";
import { useState } from "react";

function AdminRegister({ onClose, onSuccess }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const name = e.target.name.value;
      const email = e.target.email.value;
      const password = e.target.password.value;

      // Admin must use special endpoint (not shown in this case for security)
      // For now, we'll use the regular register and then the admin will manually promote
      await api.post("/register", {
        name,
        email,
        password,
        role: "student"
      });

      setSuccess("✅ User registered! Admin must assign admin role via database.");
      e.target.reset();

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: "white",
        borderRadius: 8,
        padding: 30,
        maxWidth: 500,
        width: "90%",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Create New Admin User</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer" }}>×</button>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleRegister}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#000", display: "block", marginBottom: 4 }}>
            Full Name
          </label>
          <input name="name" placeholder="Full Name" required style={{ marginBottom: 16 }} />

          <label style={{ fontSize: 12, fontWeight: 600, color: "#000", display: "block", marginBottom: 4 }}>
            Email (@nuaca.am)
          </label>
          <input name="email" type="email" placeholder="Email (@nuaca.am)" required style={{ marginBottom: 16 }} />

          <label style={{ fontSize: 12, fontWeight: 600, color: "#000", display: "block", marginBottom: 4 }}>
            Password (min 6 chars)
          </label>
          <input name="password" type="password" placeholder="Password" required style={{ marginBottom: 16 }} />

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create User"}
            </button>
            <button type="button" onClick={onClose} style={{ background: "#960000", color: "#fff" }}>
              Cancel
            </button>
          </div>

          <p style={{ fontSize: 12, color: "#000", marginTop: 12 }}>
            📌 <strong>Note:</strong> This creates a standard user. To promote to admin, update their role directly in the database.
          </p>
        </form>
      </div>
    </div>
  );
}

export default AdminRegister;
