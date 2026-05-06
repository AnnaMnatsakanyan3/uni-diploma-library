import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import "./search.css";

const API_BASE = "http://localhost:5000";

const fieldTopicSuggestions = {
  informatics: ["AI", "Databases", "Web Development", "Algorithms", "Cybersecurity"],
  mathematics: ["Calculus", "Algebra", "Statistics", "Discrete Math", "Optimization"]
};

const Search = ({ user }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("books"); // books, diploma, courses
  const [author, setAuthor] = useState("");
  const [course, setCourse] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // newest, popular, title
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authorSuggestions, setAuthorSuggestions] = useState([]);
  const [courseSuggestions, setCourseSuggestions] = useState([]);
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);

  // External library state
  const [externalResults, setExternalResults] = useState(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState("");
  const [externalSource, setExternalSource] = useState("all");
  const [fieldFocus, setFieldFocus] = useState("none");
  const [showExternal, setShowExternal] = useState(false);
  const [connectedLibraries, setConnectedLibraries] = useState([]);
  const [autoExternalFallback, setAutoExternalFallback] = useState(true);
  const [fallbackTriggered, setFallbackTriggered] = useState(false);

  const topicSuggestions = fieldTopicSuggestions[fieldFocus] || [];

  // Fetch connected libraries on mount
  useEffect(() => {
    axios.get(`${API_BASE}/external-libraries`)
      .then(res => setConnectedLibraries(res.data))
      .catch(() => {});
  }, []);

  // Fetch author suggestions
  useEffect(() => {
    if (author.length > 1) {
      axios
        .get(`${API_BASE}/search/suggestions/author?q=${author}`)
        .then(res => setAuthorSuggestions(res.data))
        .catch(() => setAuthorSuggestions([]));
    } else {
      setAuthorSuggestions([]);
    }
  }, [author]);

  // Fetch course suggestions
  useEffect(() => {
    if (course.length > 1) {
      axios
        .get(`${API_BASE}/search/suggestions/course?q=${course}`)
        .then(res => setCourseSuggestions(res.data))
        .catch(() => setCourseSuggestions([]));
    } else {
      setCourseSuggestions([]);
    }
  }, [course]);

  const countInternalResults = (searchResults) => {
    if (!searchResults) return 0;
    return (
      (searchResults.books?.length || 0) +
      (searchResults.diploma?.length || 0) +
      (searchResults.courses?.length || 0)
    );
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResults(null);
    setShowExternal(false);
    setExternalResults(null);
    setExternalError("");
    setFallbackTriggered(false);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("query", searchQuery);
      params.append("type", searchType);
      if (author) params.append("author", author);
      if (course) params.append("course", course);
      if (yearFrom) params.append("year_from", yearFrom);
      if (yearTo) params.append("year_to", yearTo);
      params.append("sort_by", sortBy);

      const response = await axios.get(`${API_BASE}/search?${params}`);
      const searchResults = response.data.results;
      setResults(searchResults);

      if (autoExternalFallback && countInternalResults(searchResults) === 0) {
        setFallbackTriggered(true);
        await searchExternalLibraries(searchQuery);
      }
    } catch (err) {
      setError("Search failed: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const getTotalResults = () => {
    if (!results) return 0;
    return (
      (results.books?.length || 0) +
      (results.diploma?.length || 0) +
      (results.courses?.length || 0)
    );
  };

  const searchExternalLibraries = async (queryValue = searchQuery) => {
    const normalizedQuery = typeof queryValue === "string"
      ? queryValue.trim()
      : String(searchQuery || "").trim();

    if (!normalizedQuery || normalizedQuery.length < 2) return;
    setExternalLoading(true);
    setExternalError("");
    setExternalResults(null);

    try {
      const params = new URLSearchParams();
      params.append("query", normalizedQuery);
      if (externalSource !== "all") params.append("source", externalSource);
      if (fieldFocus !== "none") params.append("field", fieldFocus);
      params.append("limit", "10");

      const response = await axios.get(`${API_BASE}/external-search?${params}`);
      setExternalResults(response.data.results);
      setShowExternal(true);
    } catch (err) {
      setExternalError(err.response?.data?.error || err.message);
    } finally {
      setExternalLoading(false);
    }
  };

  const getExternalTotal = () => {
    if (!externalResults) return 0;
    return (
      (externalResults.openlibrary?.length || 0) +
      (externalResults.crossref?.length || 0) +
      (externalResults.google_books?.length || 0) +
      (externalResults.armunicat?.length || 0) +
      (externalResults.nla_armenia?.length || 0) +
      (externalResults.fsl_nas?.length || 0) +
      (externalResults.arch_library?.length || 0)
    );
  };

  const downloadItem = (filename, type) => {
    const endpoint =
      type === "books"
        ? `/books/${filename}/download`
        : type === "diploma"
        ? `/diploma/${filename}/download`
        : null;

    if (endpoint) {
      window.location.href = `${API_BASE}${endpoint}`;
    }
  };

  const applyTopicSuggestion = (topic) => {
    setSearchQuery((currentQuery) => {
      const normalizedQuery = currentQuery.trim();
      if (!normalizedQuery) {
        return topic;
      }
      if (normalizedQuery.toLowerCase().includes(topic.toLowerCase())) {
        return currentQuery;
      }
      return `${normalizedQuery} ${topic}`;
    });
  };

  return (
    <div className="search-container">
      <div className="search-header">
        <h1>🔍 {t("advancedSearch")}</h1>
        <p>{t("searchAcross")}</p>
      </div>

      <form onSubmit={handleSearch} className="search-form">
        {/* Main search input */}
        <div className="search-main">
          <div className="form-group">
            <input
              type="text"
              placeholder={t("searchTypePlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <button type="submit" className="search-btn" disabled={loading}>
            {loading ? t("searching") : t("search")}
          </button>
        </div>

        {/* Filters */}
        <div className="filters-grid">
          <div className="form-group">
            <label>{t("searchType")}</label>
            <select value={searchType} onChange={(e) => setSearchType(e.target.value)}>
              <option value="books">📚 {t("booksOnly")}</option>
              <option value="diploma">🎓 {t("diplomaOnly")}</option>
              <option value="courses">📖 {t("coursesOnly")}</option>
            </select>
          </div>

          <div className="form-group">
            <label>{t("authorStudent")}</label>
            <div className="autocomplete-wrapper">
              <input
                type="text"
                placeholder={t("filterByAuthor")}
                value={author}
                onChange={(e) => {
                  setAuthor(e.target.value);
                  setShowAuthorDropdown(true);
                }}
                onFocus={() => setShowAuthorDropdown(true)}
                onBlur={() => setTimeout(() => setShowAuthorDropdown(false), 200)}
              />
              {showAuthorDropdown && authorSuggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {authorSuggestions.map((s, i) => (
                    <div
                      key={i}
                      className="suggestion-item"
                      onClick={() => {
                        setAuthor(s.label);
                        setShowAuthorDropdown(false);
                      }}
                    >
                      {s.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>{t("course")}</label>
            <div className="autocomplete-wrapper">
              <input
                type="text"
                placeholder={t("filterByCourse")}
                value={course}
                onChange={(e) => {
                  setCourse(e.target.value);
                  setShowCourseDropdown(true);
                }}
                onFocus={() => setShowCourseDropdown(true)}
                onBlur={() => setTimeout(() => setShowCourseDropdown(false), 200)}
              />
              {showCourseDropdown && courseSuggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {courseSuggestions.map((s, i) => (
                    <div
                      key={i}
                      className="suggestion-item"
                      onClick={() => {
                        setCourse(s.label);
                        setShowCourseDropdown(false);
                      }}
                    >
                      <strong>{s.label}</strong>
                      {s.description && <span> - {s.description}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>{t("yearFrom")}</label>
            <input
              type="number"
              placeholder="e.g., 2020"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>{t("yearTo")}</label>
            <input
              type="number"
              placeholder="e.g., 2024"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>{t("sortBy")}</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">{t("newest")}</option>
              <option value="popular">{t("popular")}</option>
              <option value="title">{t("byTitle")}</option>
            </select>
          </div>
        </div>

        <div className="fallback-toggle-row">
          <label className="fallback-toggle-label">
            <input
              type="checkbox"
              checked={autoExternalFallback}
              onChange={(e) => setAutoExternalFallback(e.target.checked)}
            />
            Ավտոմատ որոնում արտաքին գրադարաններում, երբ չի գտնվել արդյուն ներքինում
          </label>
        </div>
      </form>

      {error && <div className="error-message">{error}</div>}

      {/* Results */}
      {results && (
        <div className="results-section">
          <div className="results-header">
            <h2>Results ({getTotalResults()})</h2>
            <p className="query-display">
              Query: {searchQuery || "(all)"}
              {author && ` | Author: ${author}`}
              {course && ` | Course: ${course}`}
              {yearFrom && ` | From: ${yearFrom}`}
              {yearTo && ` | To: ${yearTo}`}
            </p>
          </div>

          {getTotalResults() === 0 && (
            <div className="empty-results">
              <p>{t("noResults")}</p>
              <div className="no-results-actions">
                <button
                  type="button"
                  className="ext-search-btn"
                  onClick={() => searchExternalLibraries(searchQuery)}
                  disabled={externalLoading || !searchQuery || searchQuery.trim().length < 2}
                >
                  {externalLoading ? t("searching") : `🌐 ${t("searchExternal")}`}
                </button>
              </div>
              {fallbackTriggered && (
                <p className="fallback-note">Running automatic fallback in external libraries...</p>
              )}
            </div>
          )}

          {/* Books Results */}
          {results.books && results.books.length > 0 && (
            <div className="results-category">
              <h3>📚 Books ({results.books.length})</h3>
              <div className="results-grid">
                {results.books.map((book) => (
                  <div key={book.id} className="result-card book-card">
                    <div className="card-header">
                      <h4>{book.title}</h4>
                      <span className="badge approved">Approved</span>
                    </div>
                    <p className="author">by {book.author}</p>
                    <p className="description">{book.description}</p>
                    <div className="card-stats">
                      <span>👁 {book.views} views</span>
                      <span>⬇ {book.downloads} downloads</span>
                    </div>
                    <button
                      className="download-btn"
                      onClick={() => downloadItem(book.id, "books")}
                    >
                      📥 View PDF
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diploma Results */}
          {results.diploma && results.diploma.length > 0 && (
            <div className="results-category">
              <h3>🎓 Diploma Works ({results.diploma.length})</h3>
              <div className="results-grid">
                {results.diploma.map((diploma) => (
                  <div key={diploma.id} className="result-card diploma-card">
                    <div className="card-header">
                      <h4>{diploma.title}</h4>
                      <span className="badge approved">Approved</span>
                    </div>
                    <p className="student">👤 {diploma.student}</p>
                    <p className="supervisor">👨‍🏫 Supervisor: {diploma.supervisor}</p>
                    <p className="department">🏢 {diploma.department} ({diploma.year})</p>
                    <p className="description">{diploma.description}</p>
                    <div className="card-stats">
                      <span>👁 {diploma.views} views</span>
                      <span>⬇ {diploma.downloads} downloads</span>
                    </div>
                    <button
                      className="download-btn"
                      onClick={() => downloadItem(diploma.id, "diploma")}
                    >
                      📥 View PDF
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Courses Results */}
          {results.courses && results.courses.length > 0 && (
            <div className="results-category">
              <h3>📖 Courses ({results.courses.length})</h3>
              <div className="results-grid">
                {results.courses.map((courseItem) => (
                  <div key={courseItem.id} className="result-card course-card">
                    <div className="card-header">
                      <h4>
                        <span className="course-code">{courseItem.code}</span>{" "}
                        {courseItem.name}
                      </h4>
                    </div>
                    <p className="course-info">
                      📚 Semester: {courseItem.semester} | Credits: {courseItem.credit_hours}
                    </p>
                    <p className="description">{courseItem.description}</p>
                    <div className="course-footer">
                      <button type="button" className="view-materials-link">
                        View Materials →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* External Libraries Section */}
      <div className="external-libraries-section">
        <div className="ext-header">
          <h2>🌐 {t("externalLibraries")}</h2>
          <p>{t("externalLibrariesDesc")}</p>
        </div>

        {/* Connected Libraries */}
        {connectedLibraries.length > 0 && (
          <div className="connected-libs">
            {connectedLibraries.map(lib => (
              <div key={lib.id} className="connected-lib-card">
                <div className="lib-info">
                  <h4>{lib.name}</h4>
                  <p>{lib.description}</p>
                </div>
                <div className="lib-meta">
                  <span className="lib-protocol">{lib.protocol}</span>
                  <span className="lib-type">{lib.type}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* External Search Controls */}
        <div className="ext-search-controls">
          <div className="ext-field-focus">
            <label htmlFor="field-focus">Field Focus</label>
            <select
              id="field-focus"
              value={fieldFocus}
              onChange={(e) => setFieldFocus(e.target.value)}
            >
              <option value="none">All Fields</option>
              <option value="informatics">Informatics</option>
              <option value="mathematics">Mathematics</option>
              <option value="architecture">Architecture</option>
              <option value="design">Design</option>
              <option value="construction">Construction</option>
              <option value="urban_economy">Urban Economy & Ecology</option>
              <option value="management_technology">Management & Technology</option>
            </select>
          </div>

          {topicSuggestions.length > 0 && (
            <div className="topic-suggestions">
              <span className="topic-suggestions-label">Quick Topics</span>
              <div className="topic-suggestions-list">
                {topicSuggestions.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    className="topic-chip"
                    onClick={() => applyTopicSuggestion(topic)}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="ext-source-filters">
            {[
              { val: "all", label: t("allSources") },
              { val: "armunicat", label: "Armunicat" },
              { val: "nla_armenia", label: "Ազգային գրադարան" },
              { val: "fsl_nas", label: "ՀՀ ԳԱԱ Գրադարան" },
              { val: "arch_library", label: "Library for Architecture" },
              { val: "openlibrary", label: "Open Library" },
              { val: "crossref", label: "CrossRef (DOI)" },
              { val: "google_books", label: "Google Books" }
            ].map(s => (
              <button
                key={s.val}
                className={`type-filter-btn ${externalSource === s.val ? "active" : ""}`}
                onClick={() => setExternalSource(s.val)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            className="ext-search-btn"
            onClick={searchExternalLibraries}
            disabled={externalLoading || !searchQuery || searchQuery.trim().length < 2}
          >
            {externalLoading ? t("searching") : `🌐 ${t("searchExternal")}`}
          </button>
        </div>

        {externalError && <div className="error-message">{externalError}</div>}

        {/* External Results */}
        {showExternal && externalResults && (
          <div className="ext-results">
            <div className="results-header">
              <h3>{t("externalResults")} ({getExternalTotal()})</h3>
              <p className="ext-notice">
                🔗 {t("externalNotice")}
              </p>
            </div>

            {getExternalTotal() === 0 && (
              <div className="empty-results">
                <p>{t("noExternalResults")}</p>
              </div>
            )}

            {/* Open Library Results */}
            {externalResults.openlibrary && externalResults.openlibrary.length > 0 && (
              <div className="results-category">
                <h3>📚 Open Library ({externalResults.openlibrary.length})</h3>
                <div className="results-grid">
                  {externalResults.openlibrary.map((item, idx) => (
                    <div key={`ol-${idx}`} className="result-card ext-card">
                      <div className="ext-card-top">
                        {item.cover_url && (
                          <img src={item.cover_url} alt="" className="ext-cover" />
                        )}
                        <div className="ext-card-info">
                          <div className="card-header">
                            <h4>{item.title}</h4>
                            <span className="badge ext-badge">Open Library</span>
                          </div>
                          {item.authors.length > 0 && (
                            <p className="author">{t("by")} {item.authors.join(", ")}</p>
                          )}
                          {item.year && <p className="department">{item.year}</p>}
                          {item.publisher && <p className="category">{item.publisher}</p>}
                          {item.isbn && <p className="category">ISBN: {item.isbn}</p>}
                        </div>
                      </div>
                      {item.subjects.length > 0 && (
                        <div className="ext-subjects">
                          {item.subjects.map((s, i) => (
                            <span key={i} className="ext-subject-tag">{s}</span>
                          ))}
                        </div>
                      )}
                      <a
                        href={item.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ext-link-btn"
                      >
                        🔗 {t("viewOnSource")}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CrossRef Results (DOI links) */}
            {externalResults.crossref && externalResults.crossref.length > 0 && (
              <div className="results-category">
                <h3>📄 CrossRef — DOI ({externalResults.crossref.length})</h3>
                <div className="results-grid">
                  {externalResults.crossref.map((item, idx) => (
                    <div key={`cr-${idx}`} className="result-card ext-card">
                      <div className="card-header">
                        <h4>{item.title}</h4>
                        <span className="badge ext-badge">DOI</span>
                      </div>
                      {item.authors.length > 0 && (
                        <p className="author">{t("by")} {item.authors.slice(0, 3).join(", ")}{item.authors.length > 3 ? " et al." : ""}</p>
                      )}
                      {item.journal && <p className="category">{item.journal}</p>}
                      {item.year && <p className="department">{item.year} • {item.type}</p>}
                      {item.publisher && <p className="category">{item.publisher}</p>}
                      {item.doi && <p className="ext-doi">DOI: {item.doi}</p>}
                      <a
                        href={item.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ext-link-btn"
                      >
                        🔗 {t("viewViaDOI")}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Google Books Results */}
            {externalResults.google_books && externalResults.google_books.length > 0 && (
              <div className="results-category">
                <h3>📖 Google Books ({externalResults.google_books.length})</h3>
                <div className="results-grid">
                  {externalResults.google_books.map((item, idx) => (
                    <div key={`gb-${idx}`} className="result-card ext-card">
                      <div className="ext-card-top">
                        {item.cover_url && (
                          <img src={item.cover_url} alt="" className="ext-cover" />
                        )}
                        <div className="ext-card-info">
                          <div className="card-header">
                            <h4>{item.title}</h4>
                            <span className="badge ext-badge">Google Books</span>
                          </div>
                          {item.authors.length > 0 && (
                            <p className="author">{t("by")} {item.authors.join(", ")}</p>
                          )}
                          {item.year && <p className="department">{item.year}</p>}
                          {item.publisher && <p className="category">{item.publisher}</p>}
                          {item.page_count && <p className="category">{item.page_count} pages</p>}
                        </div>
                      </div>
                      {item.description && <p className="description">{item.description}</p>}
                      <div className="ext-card-actions">
                        <a
                          href={item.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ext-link-btn"
                        >
                          🔗 {t("viewOnSource")}
                        </a>
                        {item.preview_url && (
                          <a
                            href={item.preview_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ext-preview-btn"
                          >
                            👁 {t("preview")}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Armenian Books Results */}
            {/* Armenian Library Portal Results */}
            {["armunicat", "nla_armenia", "fsl_nas", "arch_library"].map(srcId => {
              const items = externalResults[srcId];
              if (!items || items.length === 0) return null;
              const icons = { armunicat: "🏛", nla_armenia: "📖", fsl_nas: "🔬", arch_library: "🏗" };
              return (
                <div key={srcId} className="results-category">
                  <h3>{icons[srcId]} {items[0].source}</h3>
                  <div className="results-grid">
                    {items.map((item, idx) => (
                      <div key={`${srcId}-${idx}`} className="result-card ext-card hy-card">
                        <div className="card-header">
                          <h4>{item.title}</h4>
                          <span className="badge ext-badge">🇦🇲</span>
                        </div>
                        <p className="description">{item.description}</p>
                        <a
                          href={item.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ext-link-btn"
                        >
                          🔗 Բացել գրադարանում
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
