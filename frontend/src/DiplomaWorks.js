import api from "./api";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

function DiplomaWorks({ user }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [department, setDepartment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const fetchDiplomaWorks = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (year) params.year = year;
      if (department) params.department = department;

      const res = await api.get("/diploma", { params });
      setItems(res.data || []);
    } catch (err) {
      console.error("Failed to load diploma works:", err);
    }
  }, [search, year, department]);

  useEffect(() => {
    fetchDiplomaWorks();
  }, [fetchDiplomaWorks]);

  const handleUpload = async (e) => {
    e.preventDefault();
    setUploadError("");
    setUploadSuccess("");
    setUploading(true);

    const data = new FormData(e.target);

    try {
      await api.post("/diploma/upload", data, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setUploadSuccess("✅ Diploma work uploaded successfully! Awaiting admin approval.");
      e.target.reset();
      setTimeout(() => {
        setUploadSuccess("");
        fetchDiplomaWorks();
      }, 2000);
    } catch (err) {
      setUploadError(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container layout">
      <div className="main">
        <h2>{t("diplomaWorksRepo")}</h2>

        {/* ===== UPLOAD (STUDENTS ONLY) ===== */}
        {user.role === "student" && (
          <>
            <div className="section-title">{t("uploadDiplomaWork")}</div>

            {uploadError && <div className="error-message">{uploadError}</div>}
            {uploadSuccess && <div className="success-message">{uploadSuccess}</div>}

            <form onSubmit={handleUpload} encType="multipart/form-data" style={{ marginBottom: 30 }}>
              <input name="title" placeholder={t("diplomaTitle")} required />
              <input name="student" placeholder={t("yourFullName")} required />
              <input name="supervisor" placeholder={t("supervisorName")} required />
              <input name="department" placeholder={t("department")} />
              <input name="year" type="number" placeholder={t("year")} defaultValue={new Date().getFullYear()} />
              <textarea
                name="description"
                placeholder="Description (optional)"
                style={{ width: "100%", minHeight: 80, padding: 10 }}
              ></textarea>
              <input type="file" name="file" accept=".pdf" required />
              <button type="submit" disabled={uploading}>
                {uploading ? t("uploading") : t("uploadDiploma")}
              </button>
            </form>
          </>
        )}

        {/* ===== SEARCH & FILTERS ===== */}
        <div className="section-title">{t("searchAndFilter")}</div>

        <input
          placeholder={t("searchByTitleOrStudent")}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 10 }}
        />

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <input
            placeholder={t("filterByYear")}
            value={year}
            onChange={e => setYear(e.target.value)}
            style={{ flex: 1 }}
          />

          <input
            placeholder={t("filterByDept")}
            value={department}
            onChange={e => setDepartment(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        {/* ===== DIPLOMA WORKS GRID ===== */}
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p>{t("noDiplomaWorks")}</p>
          </div>
        ) : (
          <div className="file-grid">
            {items.map(d => (
              <div key={d.id} className="file-card">
                <div className="file-icon">🎓</div>

                <div className="file-info">
                  <h4>{d.title}</h4>
                  <p><strong>{t("student")}:</strong> {d.student}</p>
                  <p><strong>{t("supervisor")}:</strong> {d.supervisor}</p>
                  <p><strong>{t("dept")}:</strong> {d.department || "N/A"}</p>
                  <p><strong>{t("year")}:</strong> {d.year}</p>
                  <div className="file-stats">
                    📥 {d.downloads} | 👁️ {d.views}
                  </div>
                </div>

                <div className="file-actions">
                  <a
                    href={`http://localhost:5000/uploads/${d.filename}`}
                    download
                    onClick={() => api.post(`/diploma/${d.id}/download`).catch(err => console.error(err))}
                  >
                    {t("download")}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DiplomaWorks;