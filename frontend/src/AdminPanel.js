import api from "./api";
import { useCallback, useEffect, useState } from "react";
import AdminRegister from "./AdminRegister";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

function AdminPanel({ logout }) {
  const [books, setBooks] = useState([]);
  const [diplomaWorks, setDiplomaWorks] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState("books");
  const [supportQuestions, setSupportQuestions] = useState([]);
  const [supportReplyDrafts, setSupportReplyDrafts] = useState({});
  const [replyLoadingId, setReplyLoadingId] = useState(null);
  const [supportNotice, setSupportNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [reminderMsg, setReminderMsg] = useState("");
  const [reminderError, setReminderError] = useState(false);
  const [reminderLoadingId, setReminderLoadingId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [auditFilter, setAuditFilter] = useState("");
  const [uploadingBook, setUploadingBook] = useState(false);
  const [bookUploadNotice, setBookUploadNotice] = useState("");
  const [bookUploadError, setBookUploadError] = useState("");
  const [adminUploadCategory, setAdminUploadCategory] = useState("book");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [booksRes, diplomaRes, statsRes, ordersRes, reservationsRes] = await Promise.all([
        api.get("/admin/books"),
        api.get("/admin/diploma"),
        api.get("/admin/statistics"),
        api.get("/admin/orders").catch(() => ({ data: [] })),
        api.get("/admin/reservations").catch(() => ({ data: [] }))
      ]);

      setBooks(booksRes.data || []);
      setDiplomaWorks(diplomaRes.data || []);
      setOrders(ordersRes.data || []);
      setReservations(reservationsRes.data || []);
      setStats(statsRes.data);
      const supportRes = await api.get("/admin/support/questions").catch(() => ({ data: [] }));
      setSupportQuestions(supportRes.data || []);
      const analyticsRes = await api.get("/admin/analytics").catch(() => ({ data: null }));
      setAnalytics(analyticsRes.data);
      const auditRes = await api.get("/admin/audit-log?limit=100").catch(() => ({ data: [] }));
      setAuditLog(auditRes.data || []);
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const approve = async (id, type) => {
    try {
      const endpoint = type === "book" ? `/admin/books/${id}/approve` : `/admin/diploma/${id}/approve`;
      await api.post(endpoint);
      fetchData();
    } catch (err) {
      console.error("Approval failed:", err);
    }
  };

  const deleteBook = async (id) => {
    if (!window.confirm("Are you sure you want to delete this book?")) return;
    try {
      await api.delete(`/admin/books/${id}`);
      fetchData();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await api.put(`/admin/orders/${orderId}`, { status });
      fetchData();
    } catch (err) {
      console.error("Order update failed:", err);
    }
  };

  const markBorrowed = async (resId) => {
    const dueDays = window.prompt("Due in how many days? (default 14)", "14");
    if (dueDays === null) return;
    const days = parseInt(dueDays) || 14;
    const dueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
    try {
      await api.put(`/admin/reservations/${resId}/borrow`, { due_date: dueDate });
      fetchData();
    } catch (err) {
      console.error("Borrow update failed:", err);
    }
  };

  const markReturned = async (resId) => {
    try {
      await api.put(`/admin/reservations/${resId}/return`);
      fetchData();
    } catch (err) {
      console.error("Return update failed:", err);
    }
  };

  const sendReminder = async (resId) => {
    setReminderLoadingId(resId);
    setReminderMsg("");
    setReminderError(false);
    try {
      const res = await api.post(`/admin/reservations/${resId}/remind`);
      setReminderMsg(res.data.message);
      setReminderError(false);
      setTimeout(() => setReminderMsg(""), 6000);
    } catch (err) {
      setReminderMsg(err.response?.data?.error || "Failed to send reminder");
      setReminderError(true);
      setTimeout(() => setReminderMsg(""), 6000);
    } finally {
      setReminderLoadingId(null);
    }
  };

  const sendSupportReply = async (questionId) => {
    const body = (supportReplyDrafts[questionId] || "").trim();
    if (!body) return;

    try {
      setReplyLoadingId(questionId);
      await api.post(`/admin/support/questions/${questionId}/reply`, { body });
      setSupportReplyDrafts((prev) => ({ ...prev, [questionId]: "" }));
      setSupportNotice("Reply sent successfully.");
      setTimeout(() => setSupportNotice(""), 3000);
      fetchData();
    } catch (err) {
      setSupportNotice(err.response?.data?.error || "Failed to send reply.");
      setTimeout(() => setSupportNotice(""), 3500);
    } finally {
      setReplyLoadingId(null);
    }
  };

  const handleBookUpload = async (e) => {
    e.preventDefault();
    setUploadingBook(true);
    setBookUploadNotice("");
    setBookUploadError("");

    try {
      const data = new FormData(e.target);
      const res = await api.post("/books/upload", data, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setBookUploadNotice(res.data.message || "Material uploaded successfully.");
      e.target.reset();
      setAdminUploadCategory("book");
      fetchData();
    } catch (err) {
      setBookUploadError(err.response?.data?.error || "Upload failed");
    } finally {
      setUploadingBook(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ textAlign: "center", padding: 40 }}>Loading...</div>;
  }

  return (
    <>
      <div style={{ padding: 40, maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1>Admin Panel</h1>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowRegister(true)} style={{ background: "#960000" }}>
              ➕ Add User
            </button>
          </div>
        </div>

        {/* STATISTICS */}
        {stats && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 30
          }}>
            <div style={{
              background: "#fff",
              border: "1px solid #000",
              padding: 20,
              borderRadius: 8,
              textAlign: "center"
            }}>
              <div style={{ fontSize: 32, fontWeight: "bold", color: "#960000" }}>{stats.users}</div>
              <div style={{ fontSize: 14, color: "#000" }}>Total Users</div>
            </div>

            <div style={{
              background: "#fff",
              border: "1px solid #000",
              padding: 20,
              borderRadius: 8,
              textAlign: "center"
            }}>
              <div style={{ fontSize: 32, fontWeight: "bold", color: "#960000" }}>{stats.approvedBooks}</div>
              <div style={{ fontSize: 14, color: "#000" }}>Approved Books</div>
            </div>

            <div style={{
              background: "#fff",
              border: "1px solid #000",
              padding: 20,
              borderRadius: 8,
              textAlign: "center"
            }}>
              <div style={{ fontSize: 32, fontWeight: "bold", color: "#960000" }}>{stats.pendingBooks}</div>
              <div style={{ fontSize: 14, color: "#000" }}>Pending Approval</div>
            </div>

            <div style={{
              background: "#fff",
              border: "1px solid #000",
              padding: 20,
              borderRadius: 8,
              textAlign: "center"
            }}>
              <div style={{ fontSize: 32, fontWeight: "bold", color: "#960000" }}>{stats.totalDownloads}</div>
              <div style={{ fontSize: 14, color: "#000" }}>Total Downloads</div>
            </div>
          </div>
        )}

        {/* TABS */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: "2px solid #000" }}>
          <button
            onClick={() => setTab("books")}
            style={{
              background: tab === "books" ? "#960000" : "transparent",
              color: tab === "books" ? "#fff" : "#000",
              border: "1px solid #000",
              padding: "10px 20px",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            Books ({books.length})
          </button>
          <button
            onClick={() => setTab("diploma")}
            style={{
              background: tab === "diploma" ? "#0b2a4a" : "transparent",
              color: tab === "diploma" ? "white" : "#0b2a4a",
              border: "none",
              padding: "10px 20px",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            Diploma Works ({diplomaWorks.length})
          </button>
          <button
            onClick={() => setTab("orders")}
            style={{
              background: tab === "orders" ? "#f59e0b" : "transparent",
              color: tab === "orders" ? "#fff" : "#92400e",
              border: "1px solid #f59e0b",
              padding: "10px 20px",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            Orders ({orders.filter(o => o.status === "pending").length} pending)
          </button>
          <button
            onClick={() => setTab("reservations")}
            style={{
              background: tab === "reservations" ? "#16a34a" : "transparent",
              color: tab === "reservations" ? "#fff" : "#166534",
              border: "1px solid #16a34a",
              padding: "10px 20px",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            📚 Reservations ({reservations.filter(r => r.status === "reserved" || r.status === "borrowed").length} active)
          </button>
          <button
            onClick={() => setTab("support")}
            style={{
              background: tab === "support" ? "#0f766e" : "transparent",
              color: tab === "support" ? "#fff" : "#134e4a",
              border: "1px solid #0f766e",
              padding: "10px 20px",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            Support ({supportQuestions.length})
          </button>
          <button
            onClick={() => setTab("analytics")}
            style={{
              background: tab === "analytics" ? "#7c3aed" : "transparent",
              color: tab === "analytics" ? "#fff" : "#4c1d95",
              border: "1px solid #7c3aed",
              padding: "10px 20px",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            📊 Analytics
          </button>
          <button
            onClick={() => setTab("audit")}
            style={{
              background: tab === "audit" ? "#374151" : "transparent",
              color: tab === "audit" ? "#fff" : "#374151",
              border: "1px solid #374151",
              padding: "10px 20px",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            🔍 Audit Log
          </button>
        </div>

        {/* BOOKS TAB */}
        {tab === "books" && (
          <div>
            <h2>Books and Materials</h2>
            <div style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 16,
              marginBottom: 20,
              background: "#fafafa"
            }}>
              <h3 style={{ marginTop: 0 }}>Upload New PDF Material</h3>
              {bookUploadError && <div style={{ color: "#b91c1c", marginBottom: 12 }}>{bookUploadError}</div>}
              {bookUploadNotice && <div style={{ color: "#166534", marginBottom: 12 }}>{bookUploadNotice}</div>}
              <form onSubmit={handleBookUpload} encType="multipart/form-data" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <input name="title" placeholder="Title" required />
                <input name="author" placeholder="Author" required />
                <select name="category" value={adminUploadCategory} onChange={(e) => setAdminUploadCategory(e.target.value)}>
                  <option value="book">Book</option>
                  <option value="exam_questions">Քննության հարցաշար</option>
                </select>
                <select name="faculty" defaultValue="">
                  <option value="">Faculty</option>
                  <option value="Architecture">Architecture</option>
                  <option value="Design">Design</option>
                  <option value="Construction">Construction</option>
                  <option value="Urban Economy and Ecology">Urban Economy and Ecology</option>
                  <option value="Management and Technology">Management and Technology</option>
                </select>
                <textarea name="description" placeholder="Description" rows="3" style={{ gridColumn: "1 / -1" }} />
                {adminUploadCategory !== "exam_questions" && (
                  <>
                    <select name="book_type" defaultValue="online">
                      <option value="online">Online only</option>
                      <option value="physical">Physical library</option>
                      <option value="both">Online and physical</option>
                    </select>
                    <input name="total_copies" type="number" min="0" placeholder="Copies available" />
                    <input name="price" type="number" step="0.01" min="0" placeholder="Price (AMD)" />
                    <select name="is_available" defaultValue="1">
                      <option value="1">Available in university</option>
                      <option value="0">Not available</option>
                    </select>
                  </>
                )}
                <input name="file" type="file" accept=".pdf" required style={{ gridColumn: "1 / -1" }} />
                <button type="submit" disabled={uploadingBook} style={{ width: "fit-content" }}>
                  {uploadingBook ? "Uploading..." : "Upload PDF"}
                </button>
              </form>
            </div>
            {books.filter(b => !b.approved).length === 0 && (
              <p style={{ color: "#666" }}>No pending approvals.</p>
            )}
            {books.length === 0 ? (
              <p style={{ color: "#666" }}>No materials uploaded yet.</p>
            ) : (
              books.map(b => (
                <div
                  key={b.id}
                  style={{
                    border: "1px solid #ddd",
                    padding: 16,
                    marginBottom: 12,
                    borderRadius: 8,
                    background: b.approved ? "#f0fdf4" : "#fff"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: "0 0 8px 0" }}>{b.title}</h4>
                      <p style={{ margin: 0, fontSize: 14, color: "#666" }}>Author: {b.author}</p>
                      <p style={{ margin: 0, fontSize: 14, color: "#666" }}>Material: {b.category === "exam_questions" ? "Քննության հարցաշար" : "Book"}</p>
                      <p style={{ margin: 0, fontSize: 14, color: "#666" }}>Uploaded by: {b.uploader}</p>
                      {b.approved && (
                        <span style={{
                          background: "#dcfce7",
                          color: "#166534",
                          padding: "4px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          marginTop: 8,
                          display: "inline-block"
                        }}>
                          ✅ Approved
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      {!b.approved && (
                        <button
                          onClick={() => approve(b.id, "book")}
                          style={{ background: "#16a34a", padding: "8px 16px", fontSize: 12 }}
                        >
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => deleteBook(b.id)}
                        style={{ background: "#dc2626", padding: "8px 16px", fontSize: 12 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* DIPLOMA TAB */}
        {tab === "diploma" && (
          <div>
            <h2>Diploma Works Awaiting Approval</h2>
            {diplomaWorks.filter(d => !d.approved).length === 0 ? (
              <p style={{ color: "#666" }}>No pending approvals</p>
            ) : (
              diplomaWorks.map(d => (
                <div
                  key={d.id}
                  style={{
                    border: "1px solid #ddd",
                    padding: 16,
                    marginBottom: 12,
                    borderRadius: 8,
                    background: d.approved ? "#f0fdf4" : "#fff"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: "0 0 8px 0" }}>{d.title}</h4>
                      <p style={{ margin: 0, fontSize: 14, color: "#666" }}>Student: {d.student}</p>
                      <p style={{ margin: 0, fontSize: 14, color: "#666" }}>Supervisor: {d.supervisor}</p>
                      <p style={{ margin: 0, fontSize: 14, color: "#666" }}>Department: {d.department}</p>
                      <p style={{ margin: 0, fontSize: 14, color: "#666" }}>Year: {d.year}</p>
                      {d.approved && (
                        <span style={{
                          background: "#dcfce7",
                          color: "#166534",
                          padding: "4px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          marginTop: 8,
                          display: "inline-block"
                        }}>
                          ✅ Approved
                        </span>
                      )}
                    </div>

                    {!d.approved && (
                      <button
                        onClick={() => approve(d.id, "diploma")}
                        style={{ background: "#16a34a", padding: "8px 16px", fontSize: 12 }}
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ORDERS TAB */}
        {tab === "orders" && (
          <div>
            <h2>Book Orders & Purchases</h2>
            {orders.length === 0 ? (
              <p style={{ color: "#666" }}>No orders yet</p>
            ) : (
              orders.map(o => (
                <div key={o.id} style={{
                  border: "1px solid #e5e7eb",
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 12,
                  background: o.status === "pending" ? "#fffbeb" : "#fff"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <h4 style={{ margin: "0 0 6px" }}>{o.title}</h4>
                      <p style={{ margin: 0, fontSize: 14, color: "#666" }}>by {o.author}</p>
                      <p style={{ margin: "4px 0", fontSize: 14 }}>
                        <strong>Type:</strong>{" "}
                        <span style={{
                          background: o.order_type === "purchase" ? "#f59e0b" : "#ef4444",
                          color: "#fff",
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600
                        }}>
                          {o.order_type === "purchase" ? "💳 Purchase" : "📦 Order"}
                        </span>
                        {o.price > 0 && <span style={{ marginLeft: 8 }}>💰 {o.price} AMD</span>}
                      </p>
                      <p style={{ margin: "4px 0", fontSize: 14, color: "#666" }}>
                        👤 {o.user_name} ({o.user_email})
                      </p>
                      <p style={{ margin: "4px 0", fontSize: 13, color: "#999" }}>
                        {new Date(o.created_at).toLocaleString()}
                      </p>
                      {o.notes && <p style={{ margin: "4px 0", fontSize: 13, fontStyle: "italic" }}>Note: {o.notes}</p>}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexDirection: "column", alignItems: "flex-end" }}>
                      <span style={{
                        background: o.status === "pending" ? "#fbbf24" : o.status === "confirmed" ? "#3b82f6" : o.status === "completed" ? "#22c55e" : "#ef4444",
                        color: "#fff",
                        padding: "4px 10px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 700
                      }}>
                        {o.status.toUpperCase()}
                      </span>
                      {o.status === "pending" && (
                        <>
                          <button onClick={() => updateOrderStatus(o.id, "confirmed")} style={{ background: "#3b82f6", fontSize: 12, padding: "6px 12px" }}>
                            ✓ Confirm
                          </button>
                          <button onClick={() => updateOrderStatus(o.id, "cancelled")} style={{ background: "#ef4444", fontSize: 12, padding: "6px 12px" }}>
                            ✗ Cancel
                          </button>
                        </>
                      )}
                      {o.status === "confirmed" && (
                        <button onClick={() => updateOrderStatus(o.id, "completed")} style={{ background: "#22c55e", fontSize: 12, padding: "6px 12px" }}>
                          ✓ Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* RESERVATIONS TAB */}
        {tab === "reservations" && (
          <div>
            <h2>📚 Book Reservations</h2>

            {reminderMsg && (
              <div style={{
                background: reminderError ? "#fef2f2" : "#dbeafe",
                color: reminderError ? "#dc2626" : "#1e40af",
                border: `1px solid ${reminderError ? "#fca5a5" : "#93c5fd"}`,
                padding: "10px 16px",
                borderRadius: 8,
                marginBottom: 16,
                fontWeight: 600
              }}>
                {reminderError ? "❌ " : "✅ "}{reminderMsg}
              </div>
            )}

            {/* OVERDUE SUMMARY */}
            {reservations.filter(r => (r.status === "borrowed" || r.status === "overdue") && r.days_held >= 30).length > 0 && (
              <div style={{
                background: "#fef2f2",
                border: "2px solid #ef4444",
                borderRadius: 10,
                padding: 16,
                marginBottom: 20
              }}>
                <h3 style={{ margin: "0 0 8px", color: "#dc2626" }}>
                  ⚠️ {reservations.filter(r => (r.status === "borrowed" || r.status === "overdue") && r.days_held >= 30).length} book(s) held 30+ days
                </h3>
                <p style={{ margin: 0, fontSize: 14, color: "#991b1b" }}>
                  These students need to return books immediately. Use "Send Reminder" to notify them.
                </p>
              </div>
            )}

            {reservations.length === 0 ? (
              <p style={{ color: "#666" }}>No reservations yet</p>
            ) : (
              reservations.map(r => (
                <div key={r.id} style={{
                  border: r.days_held >= 30 && (r.status === "borrowed" || r.status === "overdue") ? "2px solid #ef4444" : "1px solid #e5e7eb",
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 12,
                  background: r.days_held >= 30 && (r.status === "borrowed" || r.status === "overdue") ? "#fef2f2" : r.is_overdue ? "#fff7ed" : r.status === "borrowed" ? "#eff6ff" : r.status === "reserved" ? "#fffbeb" : "#fff"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <h4 style={{ margin: "0 0 6px" }}>
                        {r.title}
                        {r.days_held >= 30 && (r.status === "borrowed" || r.status === "overdue") && (
                          <span style={{
                            background: "#ef4444",
                            color: "#fff",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            marginLeft: 8,
                            animation: "pulse 1.5s infinite"
                          }}>
                            🚨 {r.days_held} DAYS
                          </span>
                        )}
                      </h4>
                      <p style={{ margin: 0, fontSize: 14, color: "#666" }}>by {r.author}</p>
                      <p style={{ margin: "4px 0", fontSize: 14 }}>
                        👤 {r.user_name} ({r.user_email})
                      </p>
                      <p style={{ margin: "4px 0", fontSize: 14 }}>
                        <strong>Status:</strong>{" "}
                        <span style={{
                          background: r.status === "reserved" ? "#f59e0b" : r.status === "borrowed" ? "#3b82f6" : r.status === "returned" ? "#22c55e" : r.status === "overdue" ? "#ef4444" : "#9ca3af",
                          color: "#fff",
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600
                        }}>
                          {r.status.toUpperCase()}
                        </span>
                        {r.is_overdue === 1 && (
                          <span style={{ background: "#ef4444", color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 700, marginLeft: 6 }}>
                            ⚠️ OVERDUE
                          </span>
                        )}
                      </p>
                      {(r.status === "borrowed" || r.status === "returned" || r.status === "overdue") && (
                        <p style={{ margin: "4px 0", fontSize: 14, fontWeight: 600, color: r.days_held >= 30 ? "#dc2626" : r.is_overdue ? "#ea580c" : "#166534" }}>
                          📅 Days held: <strong>{r.days_held}</strong>
                          {r.due_date && ` | Due: ${new Date(r.due_date).toLocaleDateString()}`}
                          {r.days_held >= 30 && (r.status === "borrowed" || r.status === "overdue") && " — ⚠️ EXCEEDS 30 DAY LIMIT"}
                        </p>
                      )}
                      <p style={{ margin: "4px 0", fontSize: 13, color: "#999" }}>
                        Reserved: {new Date(r.reserved_at).toLocaleString()}
                        {r.borrowed_at && ` | Borrowed: ${new Date(r.borrowed_at).toLocaleString()}`}
                        {r.returned_at && ` | Returned: ${new Date(r.returned_at).toLocaleString()}`}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexDirection: "column", alignItems: "flex-end" }}>
                      {r.status === "reserved" && (
                        <button onClick={() => markBorrowed(r.id)} style={{ background: "#3b82f6", fontSize: 12, padding: "6px 12px" }}>
                          📖 Mark Borrowed
                        </button>
                      )}
                      {(r.status === "borrowed" || r.status === "overdue") && (
                        <>
                          <button onClick={() => markReturned(r.id)} style={{ background: "#22c55e", fontSize: 12, padding: "6px 12px" }}>
                            ✅ Mark Returned
                          </button>
                          <button
                            onClick={() => sendReminder(r.id)}
                            disabled={reminderLoadingId === r.id}
                            style={{ background: reminderLoadingId === r.id ? "#9ca3af" : "#ef4444", fontSize: 12, padding: "6px 12px", cursor: reminderLoadingId === r.id ? "not-allowed" : "pointer" }}
                          >
                            {reminderLoadingId === r.id ? "⏳ Sending..." : "📧 Send Reminder"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "support" && (
          <div>
            <h2>Support Questions</h2>
            {supportNotice && (
              <div style={{ marginBottom: 12 }} className={supportNotice.includes("Failed") ? "error-message" : "success-message"}>
                {supportNotice}
              </div>
            )}
            {supportQuestions.length === 0 ? (
              <p style={{ color: "#666" }}>No support questions yet</p>
            ) : (
              supportQuestions.map((q) => (
                <div key={q.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 14, marginBottom: 10, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                    <div>
                      <h4 style={{ margin: "0 0 6px" }}>{q.subject}</h4>
                      <p style={{ margin: "0 0 4px", color: "#4b5563", fontSize: 13 }}>
                        From: {q.sender_name} ({q.sender_email})
                      </p>
                      <p style={{ margin: "0 0 8px", fontSize: 13, color: "#9ca3af" }}>
                        {new Date(q.created_at).toLocaleString()}
                      </p>
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{q.body}</p>
                    </div>
                    <span style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      background: q.admin_reply ? "#dcfce7" : (q.is_read ? "#dcfce7" : "#fef3c7"),
                      color: q.admin_reply ? "#166534" : (q.is_read ? "#166534" : "#92400e")
                    }}>
                      {q.admin_reply ? "Answered" : (q.is_read ? "Read" : "New")}
                    </span>
                  </div>

                  {q.admin_reply && (
                    <div style={{ marginTop: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 10 }}>
                      <strong style={{ color: "#166534" }}>Your reply:</strong>
                      <p style={{ margin: "6px 0 4px", whiteSpace: "pre-wrap" }}>{q.admin_reply}</p>
                      {q.replied_at && (
                        <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                          Replied at: {new Date(q.replied_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <textarea
                      rows={3}
                      placeholder={q.admin_reply ? "Write follow-up reply..." : "Write answer to this question..."}
                      value={supportReplyDrafts[q.id] || ""}
                      onChange={(e) => setSupportReplyDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      style={{ width: "100%", resize: "vertical", borderRadius: 8, border: "1px solid #d1d5db", padding: 10, fontFamily: "inherit" }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                      <button
                        onClick={() => sendSupportReply(q.id)}
                        disabled={replyLoadingId === q.id || !(supportReplyDrafts[q.id] || "").trim()}
                        style={{ background: "#0f766e", padding: "8px 14px", fontSize: 13 }}
                      >
                        {replyLoadingId === q.id ? "Sending..." : (q.admin_reply ? "Send Follow-up" : "Send Answer")}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ANALYTICS TAB */}
        {tab === "analytics" && (
          <div>
            <h2>📊 Analytics Dashboard</h2>
            {!analytics ? (
              <p style={{ color: "#666" }}>Loading analytics...</p>
            ) : (
              <>
                {/* Summary stats */}
                <div className="analytics-stat-row">
                  {[
                    { val: analytics.totals?.total_users ?? 0, lbl: "Total Users" },
                    { val: analytics.totals?.total_books ?? 0, lbl: "Books" },
                    { val: analytics.totals?.total_downloads ?? 0, lbl: "Downloads" },
                    { val: analytics.totals?.active_reservations ?? 0, lbl: "Active Borrows" },
                    { val: analytics.totals?.total_enrollments ?? 0, lbl: "Enrollments" },
                    { val: analytics.totals?.total_tickets ?? 0, lbl: "Support Tickets" }
                  ].map(s => (
                    <div key={s.lbl} className="analytics-stat">
                      <div className="stat-val">{s.val}</div>
                      <div className="stat-lbl">{s.lbl}</div>
                    </div>
                  ))}
                </div>

                <div className="analytics-grid">
                  {/* Top Books */}
                  <div className="analytics-card">
                    <h3>📥 Top Downloaded Books</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analytics.topBooks || []} layout="vertical" margin={{ left: 10 }}>
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="title" type="category" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="downloads" fill="#960000" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Books by Faculty */}
                  <div className="analytics-card">
                    <h3>🏛️ Books by Faculty</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={analytics.booksByFaculty || []}
                          dataKey="count"
                          nameKey="faculty"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={({ faculty, count }) => `${faculty ? faculty.substring(0, 12) : "Other"}: ${count}`}
                        >
                          {(analytics.booksByFaculty || []).map((_, i) => (
                            <Cell key={i} fill={["#960000","#1a1a2e","#f59e0b","#16a34a","#3b82f6","#9333ea"][i % 6]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [v, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Users by Role */}
                  <div className="analytics-card">
                    <h3>👥 Users by Role</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analytics.usersByRole || []}>
                        <XAxis dataKey="role" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#1a1a2e" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* New Users per month */}
                  <div className="analytics-card">
                    <h3>📈 New Users (Last 6 Months)</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analytics.newUsers || []}>
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#3b82f6" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Book uploads per month */}
                  <div className="analytics-card">
                    <h3>📤 Book Uploads (Last 6 Months)</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analytics.bookUploads || []}>
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#16a34a" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Support tickets by category */}
                  {(analytics.ticketsByCategory || []).length > 0 && (
                    <div className="analytics-card">
                      <h3>🎫 Support Tickets by Category</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={analytics.ticketsByCategory}>
                          <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#f59e0b" radius={4} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Top Diploma Works */}
                  {(analytics.topDiplomas || []).length > 0 && (
                    <div className="analytics-card">
                      <h3>🎓 Top Viewed Diploma Works</h3>
                      <div>
                        {analytics.topDiplomas.map((d, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #e5e7eb", fontSize: 13 }}>
                            <span>{d.title}</span>
                            <span style={{ color: "#960000", fontWeight: 700 }}>{d.views} views</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Send broadcast notification */}
                <div className="analytics-card" style={{ marginTop: 20 }}>
                  <h3>📣 Send Broadcast Notification</h3>
                  <BroadcastNotification />
                </div>
              </>
            )}
          </div>
        )}

        {/* AUDIT LOG TAB */}
        {tab === "audit" && (
          <div>
            <h2>🔍 Audit Log</h2>
            <div className="audit-filter-row">
              <input
                placeholder="Filter by action..."
                value={auditFilter}
                onChange={e => setAuditFilter(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
              />
              <button
                onClick={async () => {
                  const res = await api.get(`/admin/audit-log?limit=100${auditFilter ? `&action=${auditFilter}` : ""}`).catch(() => ({ data: [] }));
                  setAuditLog(res.data || []);
                }}
                style={{ background: "#374151", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontWeight: 600 }}
              >
                Filter
              </button>
            </div>
            {auditLog.length === 0 ? (
              <p style={{ color: "#666" }}>No audit log entries yet</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>User</th>
                      <th>Role</th>
                      <th>Action</th>
                      <th>Target</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map(entry => (
                      <tr key={entry.id} className="audit-row">
                        <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{new Date(entry.created_at).toLocaleString()}</td>
                        <td>{entry.user_name || "—"}</td>
                        <td><span style={{ fontSize: 11, background: "#e5e7eb", borderRadius: 4, padding: "2px 6px" }}>{entry.user_role || "—"}</span></td>
                        <td><strong>{entry.action}</strong></td>
                        <td>{entry.target_type ? `${entry.target_type}${entry.target_id ? ` #${entry.target_id}` : ""}` : "—"}</td>
                        <td style={{ fontSize: 12, color: "#666" }}>{entry.details || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showRegister && (
        <AdminRegister
          onClose={() => setShowRegister(false)}
          onSuccess={() => fetchData()}
        />
      )}
    </>
  );
}

function BroadcastNotification() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");

  const send = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    try {
      const res = await api.post("/admin/notifications", { title, message, type });
      setResult(res.data.message || "Sent!");
      setTitle(""); setMessage("");
      setTimeout(() => setResult(""), 3000);
    } catch (err) {
      setResult("Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {result && <div className="success-message">{result}</div>}
      <input
        placeholder="Notification title..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
        required
      />
      <textarea
        placeholder="Notification message..."
        value={message}
        onChange={e => setMessage(e.target.value)}
        rows={3}
        style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, resize: "vertical" }}
        required
      />
      <select value={type} onChange={e => setType(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, width: 150 }}>
        <option value="info">ℹ️ Info</option>
        <option value="success">✅ Success</option>
        <option value="warning">⚠️ Warning</option>
        <option value="event">📅 Event</option>
        <option value="book">📚 Book</option>
      </select>
      <button type="submit" disabled={sending} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, padding: "10px 20px", fontWeight: 700, cursor: "pointer", width: "fit-content" }}>
        {sending ? "Sending..." : "📣 Broadcast to All Users"}
      </button>
    </form>
  );
}

export default AdminPanel;
