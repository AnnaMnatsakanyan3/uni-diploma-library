import { useEffect, useState } from "react";
import api from "./api";
import { useTranslation } from "react-i18next";

function SupportCenter({ user }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchMyQuestions = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.get("/support/my");
      setQuestions(res.data || []);
    } catch (err) {
      setQuestions([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchMyQuestions();
  }, []);

  const submitQuestion = async (e) => {
    e.preventDefault();
    setSending(true);
    setSuccess("");
    setError("");

    try {
      await api.post("/support/questions", {
        category,
        subject,
        body: message
      });

      setSuccess(t("supportSentSuccess"));
      setSubject("");
      setMessage("");
      setCategory("general");
      fetchMyQuestions();
    } catch (err) {
      setError(err.response?.data?.error || t("failedSendQuestion"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container support-layout">
      <div className="support-hero">
        <div className="support-badge">{t("adminSupport")}</div>
        <h2>{t("supportCenter")}</h2>
        <p>{t("supportDesc")}</p>
        <div className="support-user-meta">{t("sender")}: {user.name} ({user.email})</div>
      </div>

      <div className="support-grid">
        <form className="support-card" onSubmit={submitQuestion}>
          <h3>{t("newQuestion")}</h3>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <label className="field-block">
            <span>{t("category")}</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="general">{t("general")}</option>
              <option value="exam">{t("examSchedule")}</option>
              <option value="account">{t("profile")}</option>
              <option value="library">{t("library")}</option>
              <option value="technical">{t("technical")}</option>
            </select>
          </label>

          <label className="field-block">
            <span>{t("subject")}</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={255}
              required
              placeholder={t("questionShortSummary")}
            />
          </label>

          <label className="field-block">
            <span>{t("message")}</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows="7"
              required
              placeholder={t("questionDetailed")}
            />
          </label>

          <button type="submit" disabled={sending}>
            {sending ? t("sending") : t("send")}
          </button>
        </form>

        <div className="support-card">
          <h3>{t("myQuestions")}</h3>
          {loadingHistory ? (
            <p>{t("loadingQuestions")}</p>
          ) : questions.length === 0 ? (
            <p>{t("noQuestions")}</p>
          ) : (
            <div className="support-history-list">
              {questions.map((q) => (
                <div key={q.id} className="support-history-item">
                  <div className="support-history-top">
                    <span className="support-cat">{t(q.category || "general")}</span>
                    <span className="support-time">{new Date(q.created_at).toLocaleString()}</span>
                  </div>
                  <h4>{q.subject}</h4>
                  <p>{q.body}</p>
                  {q.admin_reply && (
                    <div style={{ marginTop: 10, background: "#ecfeff", border: "1px solid #99f6e4", borderRadius: 8, padding: 10 }}>
                      <strong style={{ color: "#0f766e" }}>{t("adminAnswer")}:</strong>
                      <p style={{ margin: "6px 0 4px", whiteSpace: "pre-wrap" }}>{q.admin_reply}</p>
                      {q.replied_at && (
                        <span className="support-time">{t("answeredAt")}: {new Date(q.replied_at).toLocaleString()}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupportCenter;
