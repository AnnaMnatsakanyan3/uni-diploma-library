import api from "./api";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "./i18n";

const COURSE_OPTIONS = ["HK12-1", "HK12-2", "HK13", "K12"];
const displayCode = (code) =>
  i18n.language === "hy" ? code.replace(/HK/g, "ՀԿ").replace(/\bK12\b/g, "Կ12") : code;

function ExamSchedule({ user }) {
  const { t } = useTranslation();
  const lockedCourse = user?.role === "student" ? (user?.course_code || "") : "";
  const [selectedCourse, setSelectedCourse] = useState(lockedCourse);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newExam, setNewExam] = useState({
    course_code: "HK12-1",
    exam_name: "",
    exam_date: "",
    start_time: "",
    end_time: "",
    auditorium: ""
  });

  const effectiveCourse = lockedCourse || selectedCourse;

  const fetchExams = async () => {
    setLoading(true);
    setError("");
    try {
      const query = effectiveCourse ? `?course_code=${encodeURIComponent(effectiveCourse)}` : "";
      const res = await api.get(`/exams${query}`);
      setExams(res.data || []);
    } catch (err) {
      setError(t("failedFetchExams"));
      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [effectiveCourse]);

  const displayedCourses = useMemo(() => {
    const fromData = [...new Set((exams || []).map((e) => e.course_code).filter(Boolean))];
    return [...new Set([...COURSE_OPTIONS, ...fromData])];
  }, [exams]);

  const addExam = async (e) => {
    e.preventDefault();
    setNotice("");
    setError("");
    try {
      const res = await api.post("/admin/exams", newExam);
      setNotice(res.data?.message || t("examAdded"));
      setNewExam({
        course_code: newExam.course_code,
        exam_name: "",
        exam_date: "",
        start_time: "",
        end_time: "",
        auditorium: ""
      });
      fetchExams();
    } catch (err) {
      setError(err.response?.data?.error || t("failedAddExam"));
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("examScheduleTitle")}</h2>
        <button
          className="print-hide"
          onClick={() => window.print()}
          style={{
            background: "#960000", color: "#fff", border: "none",
            borderRadius: 8, padding: "8px 18px", fontWeight: 600,
            cursor: "pointer", fontSize: 14
          }}
        >
          🖨️ Print / Export
        </button>
      </div>
      <p>{t("examScheduleDesc")}</p>

      <div className="print-header" style={{ display: "none" }}>
        <h2>NUACA — Exam Schedule</h2>
        <p>Printed on {new Date().toLocaleDateString()}</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <select
          value={effectiveCourse}
          onChange={e => setSelectedCourse(e.target.value)}
          disabled={!!lockedCourse}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1.5px solid #d1d5db",
            fontSize: 15,
            minWidth: 220,
            background: "#fff"
          }}
        >
          <option value="">{t("allCourses")}</option>
          {displayedCourses.map(c => (
            <option key={c} value={c}>{displayCode(c)}</option>
          ))}
        </select>
        {!!lockedCourse && (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#666" }}>
            {t("showingMyCourseExams")}: <strong>{lockedCourse}</strong>
          </p>
        )}
      </div>

      {user?.role === "admin" && (
        <form onSubmit={addExam} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 16, background: "#fff" }}>
          <h3 style={{ margin: "0 0 12px" }}>{t("addExam")}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <select
              value={newExam.course_code}
              onChange={(e) => setNewExam((p) => ({ ...p, course_code: e.target.value }))}
              required
            >
              {COURSE_OPTIONS.map((c) => <option key={c} value={c}>{displayCode(c)}</option>)}
            </select>
            <input
              type="text"
              placeholder={t("examName")}
              value={newExam.exam_name}
              onChange={(e) => setNewExam((p) => ({ ...p, exam_name: e.target.value }))}
              required
            />
            <input
              type="date"
              value={newExam.exam_date}
              onChange={(e) => setNewExam((p) => ({ ...p, exam_date: e.target.value }))}
              required
            />
            <input
              type="time"
              value={newExam.start_time}
              onChange={(e) => setNewExam((p) => ({ ...p, start_time: e.target.value }))}
              required
            />
            <input
              type="time"
              value={newExam.end_time}
              onChange={(e) => setNewExam((p) => ({ ...p, end_time: e.target.value }))}
              required
            />
            <input
              type="text"
              placeholder={t("auditorium")}
              value={newExam.auditorium}
              onChange={(e) => setNewExam((p) => ({ ...p, auditorium: e.target.value }))}
              required
            />
          </div>
          <button type="submit" style={{ marginTop: 10 }}>{t("addExam")}</button>
        </form>
      )}

      {notice && <div className="success-message">{notice}</div>}
      {error && <div className="error-message">{error}</div>}

      <table className="exam-table">
        <thead>
          <tr>
            <th>{t("course")}</th>
            <th>{t("examName")}</th>
            <th>{t("date")}</th>
            <th>{t("time")}</th>
            <th>{t("auditorium")}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan="5" style={{ textAlign: "center", padding: 20, color: "#999" }}>{t("loading")}</td></tr>
          ) : exams.length === 0 ? (
            <tr><td colSpan="5" style={{ textAlign: "center", padding: 20, color: "#999" }}>{t("noExams")}</td></tr>
          ) : (
            exams.map((e) => (
              <tr key={e.id}>
                <td>{displayCode(e.course_code)}</td>
                <td>{e.exam_name}</td>
                <td>{new Date(e.exam_date).toLocaleDateString()}</td>
                <td>{`${e.start_time} - ${e.end_time}`}</td>
                <td>{e.auditorium}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="exam-hint">
        <p>{t("examHint")}</p>
      </div>
    </div>
  );
}

export default ExamSchedule;
