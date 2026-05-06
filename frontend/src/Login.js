import api from "./api";
import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useTranslation } from "react-i18next";

function Login({ setUser, goRegister, onClose }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const { t } = useTranslation();

  const canSubmit = email.trim() && password;

  const login = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.target;

    try {
      const res = await api.post("/login", {
        email: email.trim(),
        password
      });

      // Store token and user in localStorage
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      setUser(res.data.user);
      if (onClose) onClose();
      setEmail("");
      setPassword("");
      setShowPassword(false);
      form.reset();
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-center">
      <div className="auth-card login-card">
        <button onClick={onClose} className="msg-close-btn" aria-label="Close">×</button>
        <div className="login-header">
          <h2>{t("loginTitle")}</h2>
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}

        <form onSubmit={login} className="auth-form login-form">
          <label className="field-block">
            <span>{t("email")}</span>
            <input
              name="email"
              type="email"
              autoComplete="username"
              placeholder="name@nuaca.am"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              aria-invalid={Boolean(error)}
              required
              autoFocus
            />
          </label>
          <label className="field-block">
            <span>{t("password")}</span>
            <div className="password-row">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder={t("password")}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                onKeyUp={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
                aria-invalid={Boolean(error)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
              </button>
            </div>
          </label>
          {capsLockOn && <p className="login-hint">Caps Lock is ON</p>}
          <button disabled={loading || !canSubmit}>{loading ? t("loggingIn") : t("login")}</button>
        </form>
      </div>
    </div>
  );
}

export default Login;