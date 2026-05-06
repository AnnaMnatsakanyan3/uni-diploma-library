import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import UserProfile from "./UserProfile";
import NotificationBell from "./NotificationBell";

function Navbar({ user, page, goLogin, goRegister, goAdmin, goHome, goFaculty, goSupport, logout, setPage, darkMode, toggleDarkMode }) {
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { t, i18n } = useTranslation();
  const userMenuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handlePageClick = (page, callback) => {
    setMobileOpen(false);
    callback();
  };

  const changeLanguage = (e) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    localStorage.setItem("lang", lang);
  };

  return (
    <>
      <div className="navbar">
        <div className="nav-brand">
          <img src="/nuaca-logo.png" alt="NUACA" className="brand-logo" />
          <div className="brand-text-block">
            <span className="brand-text-title">{t("digitalLibrary")}</span>
          </div>
        </div>

        <button
          type="button"
          className="nav-menu-toggle"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
        >
          {mobileOpen ? "✕" : "☰"}
        </button>

        <div className={`nav-panel ${mobileOpen ? "nav-panel-open" : ""}`}>
          {user && (
            <div className="nav-links">
              <button className={page === "home" ? "nav-active" : ""} onClick={() => handlePageClick("home", goHome)}>{t("home")}</button>
              <button className={page === "dashboard" ? "nav-active" : ""} onClick={() => handlePageClick("dashboard", () => setPage("dashboard"))}>{t("library")}</button>
              <button className={page === "calendar" ? "nav-active" : ""} onClick={() => handlePageClick("calendar", () => setPage("calendar"))}>{t("events")}</button>
              <button className={page === "search" ? "nav-active" : ""} onClick={() => handlePageClick("search", () => setPage("search"))}>{t("search")}</button>
              <button className={page === "inbox" || page === "support" ? "nav-active" : ""} onClick={() => handlePageClick("inbox", () => setPage("inbox"))}>📬 Inbox & Support</button>
              <button className={page === "academics" ? "nav-active" : ""} onClick={() => handlePageClick("academics", () => setPage("academics"))}>{t("academics")}</button>

              {user.role === "admin" && <button className={page === "admin" ? "nav-active" : ""} onClick={() => handlePageClick("admin", goAdmin)}>{t("admin")}</button>}
            </div>
          )}

          <div className="nav-right">
            <button className="dark-toggle-btn" onClick={toggleDarkMode} title="Toggle dark mode">
              {darkMode ? "☀️" : "🌙"}
            </button>

            {user && <NotificationBell setPage={setPage} />}

            <select className="nav-lang-select" value={i18n.language} onChange={changeLanguage}>
              <option value="en">EN</option>
              <option value="hy">ՀՅ</option>
            </select>

            {!user && (
              <>
                <button onClick={goLogin} className="nav-auth-btn">{t("login")}</button>
                <button onClick={goRegister} className="nav-auth-btn">{t("register")}</button>
              </>
            )}
            {user && (
              <div className="user-menu" ref={userMenuRef}>
                <button className="user-btn" onClick={() => setOpen(!open)}>
                  {user.name.includes(" ") ? (
                    <span className="user-btn-name">
                      <span>{user.name.split(" ")[0]}</span>
                      <span>{user.name.split(" ").slice(1).join(" ")}</span>
                    </span>
                  ) : user.name} ▾
                </button>
                {open && (
                  <div className="user-dropdown">
                    <div className="user-role">{user.role}</div>
                    <button onClick={() => {
                      setShowProfile(true);
                      setOpen(false);
                      setMobileOpen(false);
                    }}>
                      {t("profile")}
                    </button>
                    <button onClick={() => {
                      logout();
                      setOpen(false);
                      setMobileOpen(false);
                    }} className="logout-btn">
                      {t("logout")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showProfile && <UserProfile user={user} onClose={() => setShowProfile(false)} />}
    </>
  );
}

export default Navbar;