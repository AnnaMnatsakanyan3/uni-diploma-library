import { useState, useEffect } from "react";
import api from "./api";
import { useTranslation } from "react-i18next";

function Inbox({ user }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState("inbox");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchMessages = async (activeTab) => {
    setLoading(true);
    setSelected(null);
    try {
      const endpoint = activeTab === "inbox" ? "/messages/inbox" : "/messages/sent";
      const res = await api.get(endpoint);
      setMessages(res.data || []);
      if (activeTab === "inbox") {
        setUnreadCount((res.data || []).filter(m => !m.is_read).length);
      }
    } catch (err) {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages(tab);
  }, [tab]);

  const openMessage = async (msg) => {
    setSelected(msg);
    if (tab === "inbox" && !msg.is_read) {
      await api.put(`/messages/${msg.id}/read`).catch(() => {});
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: 1 } : m));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const formatDate = (d) => new Date(d).toLocaleString();

  return (
    <div className="inbox-container">
      <h2>📬 {t("inbox")}</h2>

      <div className="inbox-tabs">
        <button
          className={`inbox-tab${tab === "inbox" ? " active" : ""}`}
          onClick={() => setTab("inbox")}
        >
          {t("inbox")}
          {unreadCount > 0 && <span className="inbox-tab-badge">{unreadCount}</span>}
        </button>
        <button
          className={`inbox-tab${tab === "sent" ? " active" : ""}`}
          onClick={() => setTab("sent")}
        >
          {t("sent")}
        </button>
      </div>

      {selected ? (
        <div className="inbox-msg-detail">
          <button className="inbox-back-btn" onClick={() => setSelected(null)}>← {t("back")}</button>
          <div className="inbox-msg-top">
            <span className="inbox-msg-from">
              {tab === "inbox"
                ? `${t("from")}: ${selected.sender_name || t("adminLabel")} (${selected.sender_role || ""})`
                : `${t("to")}: ${selected.recipient_name || selected.recipient_email}`}
            </span>
            <span className="inbox-msg-time">{formatDate(selected.created_at)}</span>
          </div>
          <div className="inbox-msg-subject">{selected.subject}</div>
          <div className="inbox-msg-body">{selected.body}</div>
        </div>
      ) : (
        <>
          {loading && <p style={{ color: "var(--text-secondary)" }}>{t("loading")}</p>}
          {!loading && messages.length === 0 && (
            <p style={{ color: "var(--text-secondary)", textAlign: "center", marginTop: 40 }}>
              {tab === "inbox" ? `📭 ${t("noInboxMessages")}` : `📤 ${t("noSentMessages")}`}
            </p>
          )}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`inbox-message${!msg.is_read && tab === "inbox" ? " unread" : ""}`}
              onClick={() => openMessage(msg)}
            >
              <div className="inbox-msg-top">
                <span className="inbox-msg-from">
                  {tab === "inbox"
                    ? `${msg.sender_name || t("adminLabel")}`
                    : `${t("to")}: ${msg.recipient_name || msg.recipient_email}`}
                </span>
                <span className="inbox-msg-time">{formatDate(msg.created_at)}</span>
              </div>
              <div className="inbox-msg-subject">{msg.subject}</div>
              <div className="inbox-msg-preview">
                {msg.body?.substring(0, 100)}{msg.body?.length > 100 ? "..." : ""}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default Inbox;
