import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import ExamSchedule from "./ExamSchedule";
import Courses from "./Courses";
import Bookmarks from "./Bookmarks";
import LecturerSchedule from "./LecturerSchedule";

function Academics({ user, initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || "exams");
  const { t } = useTranslation();

  return (
    <div className="container">
      <div className="academics-tabs">
        <button
          className={activeTab === "exams" ? "acad-tab active" : "acad-tab"}
          onClick={() => setActiveTab("exams")}
        >
          📝 {t("examSchedule")}
        </button>
        <button
          className={activeTab === "courses" ? "acad-tab active" : "acad-tab"}
          onClick={() => setActiveTab("courses")}
        >
          📚 {t("courses")}
        </button>
        <button
          className={activeTab === "reading" ? "acad-tab active" : "acad-tab"}
          onClick={() => setActiveTab("reading")}
        >
          📖 {t("readingLists")}
        </button>
        <button
          className={activeTab === "faculty" ? "acad-tab active" : "acad-tab"}
          onClick={() => setActiveTab("faculty")}
        >
          🏛️ {t("faculty")}
        </button>
      </div>

      <div className="academics-content">
        {activeTab === "exams" && <ExamSchedule user={user} />}
        {activeTab === "courses" && <Courses user={user} />}
        {activeTab === "reading" && <Bookmarks user={user} />}
        {activeTab === "faculty" && <LecturerSchedule user={user} />}
      </div>
    </div>
  );
}

export default Academics;
