import axios from "axios";
import { useEffect, useState } from "react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { useTranslation } from "react-i18next";

function Dashboard({ user }) {
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const { t, i18n } = useTranslation();
  const [previewFile, setPreviewFile] = useState(null);

  // ===== LOAD BOOKS =====
  useEffect(() => {
    axios.get("http://localhost:5000/books")
      .then(res => setBooks(res.data))
      .catch(() => alert("Failed to load books"));
  }, []);

  // ===== FILTER =====
  const filtered = books.filter(b => {
    const matchSearch =
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase());

    const matchCategory =
      category === "All" || b.category === category;

    return matchSearch && matchCategory;
  });

  return (
    <div className="container layout">

      {/* ===== SIDEBAR ===== */}
      <div className="sidebar">
        <div className="side-title">Categories</div>

        {["All","Math","Design","Architecture","IT","General"].map(c => (
          <button
            key={c}
            className={category === c ? "side-active" : ""}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* ===== MAIN ===== */}
      <div className="main">

        <h2>Welcome {user.name}</h2>

        {/* ===== UPLOAD ===== */}
        {user.role === "lecturer" && (
          <>
            <div className="section-title">Upload Book</div>

            <form onSubmit={e => {
              e.preventDefault();
              const data = new FormData(e.target);
              data.append("uploaded_by", user.id);

              axios.post("http://localhost:5000/upload", data)
                .then(() => window.location.reload())
                .catch(() => alert("Upload failed"));
            }}>

              <input name="title" placeholder="Title" required />
              <input name="author" placeholder="Author" required />
              <input name="supervisor" placeholder="Supervisor" />
              <input name="year" placeholder="Year" />
              <input name="department" placeholder="Department" />
              

              <select name="category" required>
                <option>Math</option>
                <option>Design</option>
                <option>Architecture</option>
                <option>IT</option>
                <option>General</option>
              </select>

              <input type="file" name="file" required />
              <button>Upload</button>
            </form>
          </>
        )}

        {/* ===== LIBRARY ===== */}
        <div className="section-title">Library</div>

        <input
          placeholder="Search by title or author..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* ===== FILE GRID ===== */}
        <div className="file-grid">
          {filtered.map(b => (
            <div key={b.id} className="file-card">

              <div className="file-icon">📄</div>

              <div className="file-info">
                <h4>{b.title}</h4>
                <p>{b.author}</p>
                <span className="file-cat">{b.category}</span>
                <div className="file-stats">
                  Downloads: {b.downloads}
                </div>

              </div>

              <div className="file-actions">

                <button
  onClick={() =>
    setPreviewFile(`http://localhost:5000/uploads/${b.filename}`)
  }
>
  Preview
</button>


                <a
                  href={`http://localhost:5000/uploads/${b.filename}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>

                <a
                  href={`http://localhost:5000/uploads/${b.filename}`}
                  download
                  onClick={() => {
                    axios.post(`http://localhost:5000/download/${b.id}`);
                  }}
                >
                  {t("Download")}
                </a>

              </div>

            </div>
          ))}
        </div>

        {/* ===== PDF PREVIEW ===== */}
        {previewFile && (
          <div className="pdf-preview">

            <div className="pdf-header">
              <span>PDF Preview</span>
              <button onClick={() => setPreviewFile(null)}>
                Close
              </button>
            </div>


            <iframe
              src={previewFile}
              width="100%"
              height="600px"
              title="PDF Preview"
            />

          </div>
        )}

      </div>
    </div>
  );
}

export default Dashboard;
