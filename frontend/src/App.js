import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Login from "./Login";
import Register from "./Register";
import Dashboard from "./Dashboard";
import Navbar from "./Navbar";
import Footer from "./Footer";
import AdminPanel from "./AdminPanel";
import Calendar from "./Calendar";
import Academics from "./Academics";
import DiplomaWorks from "./DiplomaWorks";
import Search from "./Search";
import LecturerSchedule from "./LecturerSchedule";
import SupportCenter from "./SupportCenter";
import Inbox from "./Inbox";
import CommunicationsPage from "./CommunicationsPage";

import "./library.css";

function App() {
  const [user, setUser] = useState(null);
  const [page, setPageState] = useState("home");
  const setPage = (p) => { setPageState(p); localStorage.setItem("page", p); };
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const { t } = useTranslation();

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  const guestHighlights = [
    { icon: "🔎", text: t("featureSearch") },
    { icon: "📚", text: t("featureReadingLists") },
    { icon: "🧑‍🏫", text: t("featureLecturers") },
    { icon: "🧠", text: t("featureAI") }
  ];

  const quickLinks = [
    { key: "dashboard", icon: "📚", label: t("library") },
    { key: "search", icon: "🔎", label: t("search") },
    { key: "calendar", icon: "📅", label: t("events") }
  ];

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        const savedPage = localStorage.getItem("page");
        setPage(savedPage || "dashboard");
      } catch (err) {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        localStorage.removeItem("page");
      }
    }
    setLoading(false);
  }, []);

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("page");
    setPage("home");
  };

  // Modal open/close handlers
  const openLogin = () => {
    setShowLogin(true);
    setShowRegister(false);
  };
  const openRegister = () => {
    setShowRegister(true);
    setShowLogin(false);
  };
  const closeModals = () => {
    setShowLogin(false);
    setShowRegister(false);
  };

  if (loading) {
    return <div className="container" style={{ textAlign: "center", paddingTop: 50 }}>{t("loading")}</div>;
  }

  return (
    <>
      <Navbar
        user={user}
        page={page}
        goLogin={openLogin}
        goRegister={openRegister}
        goAdmin={() => setPage("admin")}
        goHome={() => setPage("home")}
        goFaculty={() => setPage("faculty")}
        goSupport={() => setPage("support")}
        logout={logout}
        setPage={setPage}
        darkMode={darkMode}
        toggleDarkMode={() => setDarkMode(d => !d)}
      />

      {user && (
        <div className="session-banner">
          <div className="session-banner-pill">
            Signed in as <strong>{user.name}</strong>
            {user.course_code ? ` | Course: ${user.course_code}` : ""}
            {user.role ? ` | Role: ${user.role}` : ""}
          </div>
        </div>
      )}

      {user && page === "home" && (
        <>
          <section className="home-welcome">
            <div className="home-welcome-inner">
              <h1>{t("homeWelcomeTitle")}</h1>
              {t("homeWelcomeLine1") && <p className="home-welcome-text">{t("homeWelcomeLine1")}</p>}
              {t("homeWelcomeLine2") && <p className="home-welcome-text">{t("homeWelcomeLine2")}</p>}
            </div>
          </section>
          <section className="home-shortcuts-section">
            <div className="home-shortcuts">
              {quickLinks.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="home-shortcut-card"
                  onClick={() => setPage(item.key)}
                >
                  <span className="home-shortcut-icon">{item.icon}</span>
                  <span className="home-shortcut-label">{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {!user && page === "home" && (
        <section className="hero">
          <div className="hero-content">
            <h1>{t("heroTitle")}</h1>
            <p>{t("heroDescription")}</p>

          </div>
        </section>
      )}

      {page === "faculty" && (
        <Academics user={user} initialTab="faculty" />
      )}

      {page === "academics" && (
        <Academics user={user} />
      )}

      {page === "diploma" && (
        <DiplomaWorks user={user} />
      )}


      {/* Login/Register Modals */}
      {showLogin && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <Login setUser={(u) => { setUser(u); setPage(u.role === "admin" ? "admin" : "dashboard"); }} goRegister={openRegister} onClose={closeModals} />
          </div>
        </div>
      )}
      {showRegister && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <Register goLogin={openLogin} onClose={closeModals} />
          </div>
        </div>
      )}

      {user && user.role === "admin" && page === "admin" && (
        <AdminPanel logout={logout} />
      )}

      {user && page === "dashboard" && (
        <Dashboard user={user} setPage={setPage} />
      )}

      {user && page === "calendar" && (
        <Calendar user={user} />
      )}

      {user && page === "search" && (
        <Search user={user} />
      )}

      {user && user.role !== "admin" && page === "support" && (
        <CommunicationsPage user={user} initialTab="support" />
      )}

      {user && page === "inbox" && (
        <CommunicationsPage user={user} initialTab="inbox" />
      )}

      <Footer />
    </>
  );
}

export default App;
