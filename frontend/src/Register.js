import api from "./api";
import React, { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useTranslation } from "react-i18next";

const COURSE_OPTIONS = ["HK12-1", "HK12-2", "HK13", "K12"];
const DEPARTMENT_OPTIONS = [
  "Architecture",
  "Design",
  "Construction",
  "Urban Economy and Ecology",
  "Management and Technology"
];

function Register({ goLogin, onClose }) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("student");
  const [showPassword, setShowPassword] = useState(false);

  const displayCourseCode = (code) => (
    i18n.language === "hy"
      ? code.replace(/HK/g, "ՀԿ").replace(/\bK12\b/g, "Կ12")
      : code
  );

  const register = async (e) => {
    e.preventDefault();
    setSuccess("");
    setError("");
    setLoading(true);
    const form = e.target;
    const email = form.email.value.trim().toLowerCase();

    // Validation
    if (!email.endsWith("@nuaca.am")) {
      setError(t("registerNuacaEmail"));
      setLoading(false);
      return;
    }
    if (form.password.value.length < 6) {
      setError(t("passwordMinChars"));
      setLoading(false);
      return;
    }

    if (role === "student" && !form.course_code.value) {
      setError(t("selectCourseRequired"));
      setLoading(false);
      return;
    }

    if (role === "lecturer" && !form.department.value) {
      setError(t("selectDepartmentRequired"));
      setLoading(false);
      return;
    }

    try {
      await api.post("/register", {
        name: form.name.value,
        email: email,
        password: form.password.value,
        role,
        course_code: role === "student" ? form.course_code.value : null,
        department: role === "lecturer" ? form.department.value : null
      });
      setSuccess(t("registeredSuccess"));
      form.reset();
      setRole("student");
      setTimeout(() => goLogin(), 2000);
    } catch (err) {
      setError(err.response?.data?.error || t("registrationFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-center">
      <form onSubmit={register} className="auth-card login-card auth-form">
        <button type="button" onClick={onClose} className="msg-close-btn" aria-label="Close">×</button>
        <h2>{t("createAccount")}</h2>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <label className="field-block">
          <span>{t("fullName")}</span>
          <input name="name" placeholder={t("fullName")} required />
        </label>
        <label className="field-block">
          <span>{t("email")}</span>
          <input name="email" type="email" placeholder={t("emailNuaca")} required />
        </label>
        <label className="field-block">
          <span>{t("password")}</span>
          <div className="password-row">
            <input name="password" type={showPassword ? "text" : "password"} placeholder={t("passwordMin")} required />
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

        <label className="field-block">
          <span>{t("profile")}</span>
          <select name="role" required value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="student">{t("student")}</option>
            <option value="lecturer">{t("lecturer")}</option>
          </select>
        </label>

        {role === "student" && (
          <label className="field-block">
            <span>{t("course")}</span>
            <select name="course_code" required defaultValue="">
              <option value="" disabled>{t("selectCourse")}</option>
              {COURSE_OPTIONS.map((course) => (
                <option key={course} value={course}>{displayCourseCode(course)}</option>
              ))}
            </select>
          </label>
        )}

        {role === "lecturer" && (
          <label className="field-block">
            <span>{t("department")}</span>
            <select name="department" required defaultValue="">
              <option value="" disabled>{t("selectDepartment")}</option>
              {DEPARTMENT_OPTIONS.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </label>
        )}

        <button type="submit" disabled={loading}>
          {loading ? t("registering") : t("register")}
        </button>

        <p className="auth-login-row" style={{ marginTop: 12 }}>
          {t("alreadyHaveAccount")}
          <span className="auth-login-link" onClick={goLogin}>
            {t("login")}
          </span>
        </p>
      </form>
    </div>
  );
}

export default Register;