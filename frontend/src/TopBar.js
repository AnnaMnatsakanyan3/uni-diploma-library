import React from "react";

function TopBar() {
  return (
    <div className="nuaca-topbar">

      <div className="topbar-left">
        <img
          src="/nuaca-logo.png"
          alt="NUACA"
          className="topbar-logo"
        />
      </div>

      <div className="topbar-menu">
        <a href="#">NUACA</a>
        <a href="#">EDUCATION</a>
        <a href="#">SCIENCE</a>
        <a href="#">INTERNATIONAL RELATIONS</a>
        <a href="#">APPLICANT</a>
        <a href="#">STUDENT</a>
        <a href="#">ALUMNI</a>
      </div>

      <div className="topbar-right">

        <select>
          <option>English</option>
          <option>Հայերեն</option>
        </select>
      </div>

    </div>
  );
}

export default TopBar;
