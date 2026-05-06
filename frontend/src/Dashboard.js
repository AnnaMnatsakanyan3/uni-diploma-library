import api from "./api";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const API_BASE = "http://localhost:5000";

function Dashboard({ user, setPage }) {
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState("");
  const [faculty, setFaculty] = useState("All");
  const { t } = useTranslation();
  const [previewFile, setPreviewFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [quizData, setQuizData] = useState(null);
  const [quizBook, setQuizBook] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false); 
  const [quizError, setQuizError] = useState("");
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [orderMsg, setOrderMsg] = useState("");
  const [orderError, setOrderError] = useState("");
  const [reservations, setReservations] = useState([]);
  const [showReservations, setShowReservations] = useState(false);
  const [waitlist, setWaitlist] = useState([]);
  const [bookTypeFilter, setBookTypeFilter] = useState("all");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [materialCategoryFilter, setMaterialCategoryFilter] = useState("all");
  const [uploadCategory, setUploadCategory] = useState("book");
  const [showLibraryCounts, setShowLibraryCounts] = useState(false);

  // ===== GLOBAL SEARCH =====
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalType, setGlobalType] = useState("all");
  const [globalResults, setGlobalResults] = useState(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const fetchBooks = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (faculty && faculty !== "All") params.faculty = faculty;

      const res = await api.get("/books", { params });
      setBooks(res.data || []);
    } catch (err) {
      console.error("Failed to load books:", err);
    }
  }, [search, faculty]);

  // ===== LOAD BOOKS =====
  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    fetchReservations();
    fetchWaitlist();
  }, []);

  const facultyOptions = [
    { key: "All", label: t("allFaculties") },
    { key: "Architecture", label: t("facArchitecture") },
    { key: "Design", label: t("facDesign") },
    { key: "Construction", label: t("facConstruction") },
    { key: "Urban Economy and Ecology", label: t("facUrbanEconomy") },
    { key: "Management and Technology", label: t("facManagementTech") }
  ];

  // ===== FILTER =====
  const getMaterialLabel = (category) => {
    if (category === "exam_questions") return t("examQuestions");
    if (category === "lesson_material") return t("lessonMaterial");
    return "Գիրք";
  };

  const filtered = books.filter((book) => {
    const matchesType = bookTypeFilter === "all" || book.book_type === bookTypeFilter;
    const matchesCategory = materialCategoryFilter === "all" || (book.category || "book") === materialCategoryFilter;
    return matchesType && matchesCategory;
  });
  const activeReservations = reservations.filter(r => r.status === "reserved" || r.status === "borrowed").length;
  const selectedFacultyLabel = facultyOptions.find((item) => item.key === faculty)?.label || t("allFaculties");

  const countByType = {
    all: books.length,
    online: books.filter((b) => b.book_type === "online").length,
    physical: books.filter((b) => b.book_type === "physical").length,
    both: books.filter((b) => b.book_type === "both").length
  };

  const countByCategory = {
    all: books.length,
    book: books.filter((b) => (b.category || "book") === "book").length,
    exam_questions: books.filter((b) => b.category === "exam_questions").length,
    lesson_material: books.filter((b) => b.category === "lesson_material").length
  };

  const activeCategoryLabel = materialCategoryFilter === "all"
    ? t("allFaculties")
    : materialCategoryFilter === "book"
      ? t("books")
      : materialCategoryFilter === "exam_questions"
        ? t("examQuestions")
        : t("lessonMaterial");

  const activeCategoryCount = countByCategory[materialCategoryFilter] ?? books.length;

  // ===== HANDLE UPLOAD =====
  const handleUpload = async (e) => {
    e.preventDefault();
    setUploadError("");
    setUploadSuccess("");
    setUploading(true);

    const data = new FormData(e.target);

    try {
      await api.post("/books/upload", data, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setUploadSuccess(t("uploadSuccess"));
      e.target.reset();
      setUploadCategory("book");
      setTimeout(() => {
        setUploadSuccess("");
        fetchBooks();
      }, 2000);
    } catch (err) {
      setUploadError(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleOrder = async (bookId, orderType) => {
    setOrderMsg("");
    setOrderError("");
    try {
      const res = await api.post(`/books/${bookId}/order`, { order_type: orderType });
      setOrderMsg(res.data.message);
      setTimeout(() => setOrderMsg(""), 3000);
    } catch (err) {
      setOrderError(err.response?.data?.error || "Order failed");
      setTimeout(() => setOrderError(""), 3000);
    }
  };

  const fetchReservations = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/my-reservations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReservations(res.data || []);
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error("Failed to fetch reservations:", err);
      }
    }
  };

  const fetchWaitlist = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/my-waitlist`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWaitlist(res.data || []);
    } catch {}
  };

  const handleJoinWaitlist = async (bookId) => {
    setOrderMsg("");
    setOrderError("");
    try {
      const res = await api.post(`/books/${bookId}/waitlist`);
      setOrderMsg(res.data.message);
      fetchWaitlist();
      setTimeout(() => setOrderMsg(""), 4000);
    } catch (err) {
      setOrderError(err.response?.data?.error || "Failed to join waitlist");
      setTimeout(() => setOrderError(""), 3000);
    }
  };

  const handleLeaveWaitlist = async (bookId) => {
    try {
      await api.delete(`/books/${bookId}/waitlist`);
      fetchWaitlist();
      fetchBooks();
    } catch {}
  };

  const getDueDateCountdown = (due_date) => {
    if (!due_date) return null;
    const now = new Date();
    const due = new Date(due_date);
    const diffMs = due - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, overdue: true };
    if (diffDays === 0) return { label: "Due today!", overdue: true };
    if (diffDays <= 3) return { label: `${diffDays}d left`, urgent: true };
    return { label: `${diffDays}d left`, overdue: false, urgent: false };
  };

  const handleReserve = async (bookId) => {
    setOrderMsg("");
    setOrderError("");
    try {
      const res = await api.post(`/books/${bookId}/reserve`);
      setOrderMsg(res.data.message);
      fetchBooks();
      fetchReservations();
      setTimeout(() => setOrderMsg(""), 3000);
    } catch (err) {
      setOrderError(err.response?.data?.error || "Reservation failed");
      setTimeout(() => setOrderError(""), 3000);
    }
  };

  const cancelReservation = async (resId) => {
    try {
      await api.put(`/reservations/${resId}/cancel`);
      setOrderMsg(t("reservationCancelled"));
      fetchBooks();
      fetchReservations();
      setTimeout(() => setOrderMsg(""), 3000);
    } catch (err) {
      setOrderError(err.response?.data?.error || "Cancel failed");
      setTimeout(() => setOrderError(""), 3000);
    }
  };

  const handleGlobalSearch = async (e) => {
    e.preventDefault();
    if (!globalQuery.trim()) return;
    setGlobalLoading(true);
    setGlobalError("");
    setGlobalResults(null);
    try {
      const params = new URLSearchParams();
      params.append("query", globalQuery.trim());
      params.append("type", globalType);
      const res = await axios.get(`${API_BASE}/search?${params}`);
      setGlobalResults(res.data.results || res.data);
    } catch (err) {
      setGlobalError(err.response?.data?.error || err.message);
    } finally {
      setGlobalLoading(false);
    }
  };

  const clearGlobalSearch = () => {
    setGlobalQuery("");
    setGlobalResults(null);
    setGlobalError("");
  };

  const generateQuiz = async (book) => {
    setQuizLoading(true);
    setQuizError("");
    setQuizData(null);
    setQuizBook(book);
    setQuizAnswers({});
    setQuizSubmitted(false);
    try {
      const res = await api.post(`/books/${book.id}/quiz`);
      setQuizData(res.data);
    } catch (err) {
      setQuizError(err.response?.data?.error || "Failed to generate quiz");
    } finally {
      setQuizLoading(false);
    }
  };

  const selectAnswer = (qIndex, option) => {
    if (quizSubmitted) return;
    setQuizAnswers(prev => ({ ...prev, [qIndex]: option }));
  };

  const submitQuiz = () => {
    setQuizSubmitted(true);
  };

  const getScore = () => {
    if (!quizData) return 0;
    let correct = 0;
    quizData.questions.forEach((q, i) => {
      if (quizAnswers[i] === q.correct) correct++;
    });
    return correct;
  };

  const closeQuiz = () => {
    setQuizData(null);
    setQuizBook(null);
    setQuizError("");
    setQuizAnswers({});
    setQuizSubmitted(false);
  };

  return (
    <div className="container layout">
      {/* ===== SIDEBAR ===== */}
      <div className="sidebar">
        <div className="side-title">{t("faculty")}</div>
        <div className="sidebar-current-filter">{selectedFacultyLabel}</div>

        {facultyOptions.map(f => (
          <button
            key={f.key}
            className={faculty === f.key ? "side-active" : ""}
            onClick={() => setFaculty(f.key)}
          >
            {f.label}
          </button>
        ))}

        <button onClick={() => setPage("diploma")}>
          🎓 {t("diplomaWorks")}
        </button>
      </div>

      {/* ===== MAIN ===== */}
      <div className="main">
        <div className="dashboard-overview">
          <div>
            <div className="dashboard-kicker">{t("digitalLibrary")}</div>
            <h2>{t("welcome")} {user.name}</h2>
            <p className="dashboard-subtitle">{t("searchAcross")}</p>
          </div>

        </div>
        {/* ===== UPLOAD (LECTURER / ADMIN) ===== */}
        {(user.role === "lecturer" || user.role === "admin") && (
          <>
            <button
              type="button"
              className="secondary-btn"
              style={{ marginBottom: 12 }}
              onClick={() => setShowUploadForm(v => !v)}
            >
              {showUploadForm ? "✕ " + t("close") : "➕ " + t("uploadBook")}
            </button>

            {showUploadForm && (
              <>
                <div className="section-title">{t("uploadBook")}</div>

                {uploadError && <div className="error-message">{uploadError}</div>}
                {uploadSuccess && <div className="success-message">{uploadSuccess}</div>}

            <form onSubmit={handleUpload} encType="multipart/form-data" className="upload-form-grid">
              <label className="field-block">
                <span>{t("title")}</span>
                <input name="title" placeholder={t("title")} required />
              </label>

              <label className="field-block">
                <span>{t("author")}</span>
                <input name="author" placeholder={t("author")} required />
              </label>

              <label className="field-block">
                <span>Material Type</span>
                <select name="category" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                  <option value="book">📚 Book</option>
                  <option value="exam_questions">📝 {t("examQuestions")}</option>
                  <option value="lesson_material">🎓 {t("lessonMaterial")}</option>
                </select>
              </label>

              <label className="field-block field-block-wide">
                <span>{t("description")}</span>
                <textarea name="description" placeholder={t("description")} rows="3" />
              </label>

              <label className="field-block">
                <span>{t("faculty")}</span>
                <select name="faculty">
                  <option value="">{t("selectFaculty")}</option>
                  <option value="Architecture">{t("facArchitecture")}</option>
                  <option value="Design">{t("facDesign")}</option>
                  <option value="Construction">{t("facConstruction")}</option>
                  <option value="Urban Economy and Ecology">{t("facUrbanEconomy")}</option>
                  <option value="Management and Technology">{t("facManagementTech")}</option>
                </select>
              </label>

              <label className="field-block">
                <span>{t("library")}</span>
                <select name="book_type" value={uploadCategory === "exam_questions" ? "online" : undefined} defaultValue="online" disabled={uploadCategory === "exam_questions"}>
                  <option value="online">📱 {t("onlineOnly")}</option>
                  <option value="physical">📚 {t("physicalLib")}</option>
                  <option value="both">📱📚 {t("bothOnlinePhysical")}</option>
                </select>
              </label>

              <label className="field-block field-block-wide">
                <span>PDF / Word / PowerPoint</span>
                <input type="file" name="file" accept=".pdf,.doc,.docx,.ppt,.pptx" required />
              </label>

              {uploadCategory !== "exam_questions" && uploadCategory !== "lesson_material" && (
                <>
                  <label className="field-block">
                    <span>{t("copiesAvailable")}</span>
                    <input name="total_copies" type="number" min="0" placeholder={t("copiesPlaceholder")} />
                  </label>

                  <label className="field-block">
                    <span>{t("buy")}</span>
                    <input name="price" type="number" step="0.01" min="0" placeholder={t("pricePlaceholder")} />
                  </label>

                  <label className="field-block field-block-wide">
                    <span>{t("availableInUni")}</span>
                    <select name="is_available">
                      <option value="1">{t("availableInUni")}</option>
                      <option value="0">{t("notAvailable")}</option>
                    </select>
                  </label>
                </>
              )}

              <button type="submit" disabled={uploading} className="upload-submit-btn">
                {uploading ? t("uploading") : t("uploadBookBtn")}
              </button>
            </form>
            </>
            )}
          </>
        )}

        {/* ===== SEARCH & LIBRARY ===== */}
        <div className="section-title">{t("digitalLibrary")}</div>
        <button
          type="button"
          className={`library-count-pill ${showLibraryCounts ? "active" : ""}`}
          onClick={() => setShowLibraryCounts((v) => !v)}
        >
          📚 {activeCategoryLabel}: {activeCategoryCount}
        </button>

        {showLibraryCounts && (
          <div className="library-count-breakdown">
            <div className="count-group">
              <span className="count-chip">📖 {t("allBooks")}: {countByType.all}</span>
              <span className="count-chip">📱 {t("online")}: {countByType.online}</span>
              <span className="count-chip">📚 {t("physical")}: {countByType.physical}</span>
              <span className="count-chip">📱📚 {t("both")}: {countByType.both}</span>
            </div>
            <div className="count-group">
              <span className="count-chip">All Materials: {countByCategory.all}</span>
              <span className="count-chip">📚 {t("books")}: {countByCategory.book}</span>
              <span className="count-chip">📝 {t("examQuestions")}: {countByCategory.exam_questions}</span>
              <span className="count-chip">🎓 {t("lessonMaterial")}: {countByCategory.lesson_material}</span>
            </div>
          </div>
        )}

        {orderMsg && <div className="success-message">{orderMsg}</div>}
        {orderError && <div className="error-message">{orderError}</div>}

        <div className="library-controls">
          <input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <div className="book-type-filters">
            {[
              { val: "all", label: "📖 " + t("allBooks") },
              { val: "online", label: "📱 " + t("online") },
              { val: "physical", label: "📚 " + t("physical") },
              { val: "both", label: "📱📚 " + t("both") }
            ].map(f => (
              <button
                key={f.val}
                className={`type-filter-btn ${bookTypeFilter === f.val ? "active" : ""}`}
                onClick={() => setBookTypeFilter(f.val)}
              >
                {f.label}
              </button>
            ))}

            {[
              { val: "all", label: "All Materials" },
              { val: "book", label: `📚 ${t("books")}` },
              { val: "exam_questions", label: `📝 ${t("examQuestions")}` },
              { val: "lesson_material", label: `🎓 ${t("lessonMaterial")}` }
            ].map((item) => (
              <button
                key={item.val}
                className={`type-filter-btn ${materialCategoryFilter === item.val ? "active" : ""}`}
                onClick={() => setMaterialCategoryFilter(item.val)}
              >
                {item.label}
              </button>
            ))}

            <button
              className="my-reservations-btn"
              onClick={() => { setShowReservations(!showReservations); fetchReservations(); }}
            >
              📋 {t("myReservations")} ({activeReservations})
            </button>
          </div>
        </div>

        {/* ===== MY RESERVATIONS ===== */}
        {showReservations && (
          <div className="reservations-section">
            <h3>📋 {t("bookReservations")}</h3>
            {reservations.length === 0 ? (
              <p style={{ color: "#666" }}>{t("noReservations")}</p>
            ) : (
              <div className="reservations-list">
                {reservations.map(r => (
                  <div key={r.id} className={`reservation-card status-${r.status}`}>
                    <div className="res-info">
                      <h4>{r.title}</h4>
                      <p>{t("by")} {r.author}</p>
                      <span className={`res-status ${r.status}`}>
                        {r.status === "reserved" && `📌 ${t("reserved")}`}
                        {r.status === "borrowed" && `📖 ${t("borrowed")}`}
                        {r.status === "returned" && `✅ ${t("returned")}`}
                        {r.status === "overdue" && `⚠️ ${t("overdue")}`}
                        {r.status === "cancelled" && `❌ ${t("cancelled")}`}
                      </span>
                      {r.status === "borrowed" && (() => {
                        const countdown = getDueDateCountdown(r.due_date);
                        return (
                          <div className="days-counter">
                            <span className={r.is_overdue ? "overdue" : ""}>
                              📅 {r.days_held} {t("daysHeld")}
                            </span>
                            {countdown && (
                              <span
                                className="due-date"
                                style={{
                                  fontWeight: 700,
                                  color: countdown.overdue ? "#dc2626" : countdown.urgent ? "#d97706" : "#16a34a"
                                }}
                              >
                                ⏰ {countdown.label}
                              </span>
                            )}
                            {r.is_overdue === 1 && <span className="overdue-badge">OVERDUE!</span>}
                          </div>
                        );
                      })()}
                      {r.status === "returned" && r.days_held > 0 && (
                        <span className="days-info">{r.days_held} {t("daysHeld")}</span>
                      )}
                      <span className="res-date">
                        Reserved: {new Date(r.reserved_at).toLocaleDateString()}
                      </span>
                    </div>
                    {r.status === "reserved" && (
                      <button className="cancel-res-btn" onClick={() => cancelReservation(r.id)}>
                        {t("cancel")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== FILE GRID ===== */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p>{t("noBooks")}</p>
          </div>
        ) : (
          <div className="file-grid">
            {filtered.map(b => (
              <div key={b.id} className="file-card">
                <div className="file-icon">
                  {b.category === "exam_questions" ? "📝" : b.category === "lesson_material" ? "🎓" : b.book_type === "online" ? "📱" : b.book_type === "physical" ? "📚" : "📱📚"}
                </div>

                <div className="file-info">
                  <h4>{b.title}</h4>
                  <p>{b.author}</p>
                  {b.faculty && <span className="file-cat">{b.faculty}</span>}
                  <span className="file-cat">{getMaterialLabel(b.category)}</span>
                  <span className={`file-cat book-type-badge ${b.book_type}`}>
                    {b.book_type === "online" ? t("online") : b.book_type === "physical" ? t("physical") : t("onlineAndPhysical")}
                  </span>
                  {b.category !== "exam_questions" && b.category !== "lesson_material" && (b.book_type === "physical" || b.book_type === "both") && (
                    <span className={`file-cat copies-badge ${b.available_copies > 0 ? "available" : "unavailable"}`}>
                      {b.available_copies}/{b.total_copies} {t("copiesAvailable")}
                    </span>
                  )}
                  {b.category !== "exam_questions" && b.category !== "lesson_material" && b.price > 0 && <span className="file-cat" style={{ background: "#960000", color: "#fff" }}>💰 {b.price} AMD</span>}
                  <div className="file-stats">
                    📥 {b.downloads} | 👁️ {b.views}
                  </div>
                </div>

                <div className="file-actions">
                  {(b.book_type === "online" || b.book_type === "both" || b.category === "exam_questions" || b.category === "lesson_material") && (
                    <>
                      <a
                        href={`http://localhost:5000/uploads/${b.filename}`}
                        download
                        onClick={() => api.post(`/books/${b.id}/download`).catch(err => console.error(err))}
                      >
                        {t("download")}
                      </a>
                    </>
                  )}

                  {b.filename && b.category !== "exam_questions" && <button
                    onClick={() => generateQuiz(b)}
                    className="quiz-btn"
                  >
                    🧠 {t("quiz")}
                  </button>}

                  {b.category !== "exam_questions" && (b.book_type === "physical" || b.book_type === "both") && b.available_copies > 0 && (
                    <button
                      onClick={() => handleReserve(b.id)}
                      className="reserve-btn"
                    >
                      📌 {t("reserve")}
                    </button>
                  )}

                  {b.category !== "exam_questions" && (b.book_type === "physical" || b.book_type === "both") && b.available_copies <= 0 && (
                    waitlist.some((w) => w.book_id === b.id)
                      ? <button onClick={() => handleLeaveWaitlist(b.id)} className="no-copies-label" style={{ cursor: "pointer", background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 6, padding: "4px 10px", fontWeight: 600 }}>⏳ On Waitlist — Leave</button>
                      : <button onClick={() => handleJoinWaitlist(b.id)} className="reserve-btn" style={{ background: "#6b7280" }}>🔔 Notify Me</button>
                  )}

                  {b.category !== "exam_questions" && b.price > 0 && (
                    <button
                      onClick={() => handleOrder(b.id, "purchase")}
                      className="pay-btn"
                    >
                      💳 {t("buy")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== PDF PREVIEW ===== */}
        {previewFile && (
          <div className="pdf-preview">
            <div className="pdf-header">
              <span>{t("pdfPreview")}</span>
              <button onClick={() => setPreviewFile(null)}>{t("close")}</button>
            </div>

            <iframe
              src={previewFile}
              width="100%"
              height="600px"
              title="PDF Preview"
            />
          </div>
        )}

        {/* ===== QUIZ MODAL ===== */}
        {(quizLoading || quizData || quizError) && (
          <div className="modal-overlay" onClick={closeQuiz}>
            <div className="modal-content quiz-modal" onClick={e => e.stopPropagation()}>
              <button onClick={closeQuiz} className="msg-close-btn" aria-label="Close">×</button>

              {quizLoading && (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <h3>🧠 {t("generatingQuiz")}</h3>
                  {quizBook?.title && <p><strong>{quizBook.title}</strong></p>}
                  <p>{t("quizAnalyzing")}</p>
                  <div className="quiz-spinner"></div>
                </div>
              )}

              {quizError && (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <h3>{t("quizError")}</h3>
                  <div className="error-message">{quizError}</div>
                </div>
              )}

              {quizData && (
                <div className="quiz-content">
                  <h3>📝 {t("examPrepQuiz")}: {quizData.bookTitle}</h3>
                  <p style={{ marginTop: -6, color: "#6b7280" }}>
                    {quizData.source === "fallback"
                      ? "Practice quiz generated from the document text."
                      : "AI-generated study quiz based on this book."}
                  </p>

                  {quizSubmitted && (
                    <div className={`quiz-result ${getScore() >= Math.ceil(quizData.questions.length * 0.7) ? "quiz-pass" : "quiz-fail"}`}>
                      {t("yourScore")}: {getScore()} / {quizData.questions.length}
                      {getScore() >= Math.ceil(quizData.questions.length * 0.7) ? ` — ${t("greatJob")} 🎉` : ` — ${t("keepStudying")} 📚`}
                    </div>
                  )}

                  {quizData.questions.map((q, i) => (
                    <div key={i} className="quiz-question">
                      <p className="quiz-q-text"><strong>{i + 1}.</strong> {q.question}</p>
                      <div className="quiz-options">
                        {Object.entries(q.options).map(([key, val]) => {
                          let cls = "quiz-option";
                          if (quizSubmitted) {
                            if (key === q.correct) cls += " quiz-correct";
                            else if (quizAnswers[i] === key) cls += " quiz-wrong";
                          } else if (quizAnswers[i] === key) {
                            cls += " quiz-selected";
                          }
                          return (
                            <button
                              key={key}
                              className={cls}
                              onClick={() => selectAnswer(i, key)}
                            >
                              <strong>{key}.</strong> {val}
                            </button>
                          );
                        })}
                      </div>
                      {quizSubmitted && q.explanation && (
                        <p style={{ marginTop: 10, fontSize: 13, color: "#4b5563" }}>
                          <strong>Why:</strong> {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}

                  {!quizSubmitted && (
                    <button
                      className="msg-send-btn"
                      onClick={submitQuiz}
                      disabled={Object.keys(quizAnswers).length < quizData.questions.length}
                      style={{ marginTop: 16 }}
                    >
                      {t("submitAnswers")} ({Object.keys(quizAnswers).length}/{quizData.questions.length})
                    </button>
                  )}

                  {quizSubmitted && (
                    <button className="msg-send-btn" onClick={closeQuiz} style={{ marginTop: 16 }}>
                      {t("close")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
