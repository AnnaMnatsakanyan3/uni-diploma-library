import { useState } from "react";
import { useTranslation } from "react-i18next";

function Navbar({ user, goLogin, goRegister, goAdmin, logout, setPage }) {
  const [open, setOpen] = useState(false);
  const { t, i18n } = useTranslation();

  return (
    <div className="navbar">

      <div className="nav-title">
        University Library System
      </div>

      <div className="nav-links">

        {!user && <button onClick={goLogin}>{t("login")}</button>}
        {!user && <button onClick={goRegister}>{t("register")}</button>}
        {user && (
  <button onClick={() => setPage("diploma")}>
    Diploma Works
  </button>

)}

        {user && user.role === "admin" && (
          <button onClick={goAdmin}>Admin</button>
        )}

        {/* ===== USER DROPDOWN ===== */}
        {user && (
          <div className="user-menu">

            <button
              className="user-btn"
              onClick={() => setOpen(!open)}
            >
              👤 {user.name} ▾
            </button>

            {open && (
              <div className="user-dropdown">
                <div className="user-role">
                  Role: {user.role}
                </div>
                <button onClick={() => i18n.changeLanguage("en")}>
  EN
</button>

<button onClick={() => i18n.changeLanguage("hy")}>
  HY
</button>

                <button onClick={logout}>
                  Logout
                </button>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

export default Navbar;