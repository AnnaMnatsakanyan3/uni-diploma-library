import { useState, useEffect, useMemo } from "react";
import api from "./api";
import { useTranslation } from "react-i18next";

const initialLecturers = [
  // Faculty of Architecture
  { id: 1, name: "Prof. Lilit Hakobyan", faculty: "Architecture", office: "A-210", email: "lilit.hakobyan@nuaca.am", days: "Mon–Fri", timeFrom: "11:00", timeTo: "14:00", location: "Office + Zoom" },
  { id: 2, name: "Dr. Armen Sahakyan", faculty: "Architecture", office: "A-115", email: "armen.sahakyan@nuaca.am", days: "Mon–Wed", timeFrom: "09:00", timeTo: "11:30", location: "Office" },
  { id: 3, name: "Assoc. Prof. Gayane Karapetyan", faculty: "Architecture", office: "A-308", email: "gayane.karapetyan@nuaca.am", days: "Mon–Fri", timeFrom: "13:00", timeTo: "16:00", location: "Office + Teams" },
  { id: 4, name: "Prof. Hovhannes Manukyan", faculty: "Architecture", office: "A-402", email: "hovhannes.manukyan@nuaca.am", days: "Mon–Fri", timeFrom: "10:00", timeTo: "13:00", location: "Office" },

  // Faculty of Design
  { id: 5, name: "Dr. Anahit Simonyan", faculty: "Design", office: "A-405", email: "anahit.simonyan@nuaca.am", days: "Tue–Thu", timeFrom: "14:00", timeTo: "16:30", location: "Office + Zoom" },
  { id: 6, name: "Assoc. Prof. Narine Davtyan", faculty: "Design", office: "B-312", email: "narine.davtyan@nuaca.am", days: "Tue–Fri", timeFrom: "14:00", timeTo: "17:00", location: "Office + Zoom" },
  { id: 7, name: "Lect. Anna Hovhannisyan", faculty: "Design", office: "B-210", email: "anna.hovhannisyan@nuaca.am", days: "Wed–Fri", timeFrom: "11:00", timeTo: "14:00", location: "Online only" },

  // Faculty of Construction
  { id: 8, name: "Dr. Aram Grigoryan", faculty: "Construction", office: "Bldg B - 304", email: "aram.grigoryan@nuaca.am", days: "Mon–Fri", timeFrom: "09:00", timeTo: "12:00", location: "Office + Teams" },
  { id: 9, name: "Prof. Suren Martirosyan", faculty: "Construction", office: "Bldg B - 210", email: "suren.martirosyan@nuaca.am", days: "Mon–Thu", timeFrom: "10:00", timeTo: "13:00", location: "Office" },
  { id: 10, name: "Prof. Gagik Asatryan", faculty: "Construction", office: "D-101", email: "gagik.asatryan@nuaca.am", days: "Mon–Fri", timeFrom: "09:30", timeTo: "12:30", location: "Office" },
  { id: 11, name: "Assoc. Prof. Vardan Harutyunyan", faculty: "Construction", office: "D-203", email: "vardan.harutyunyan@nuaca.am", days: "Mon–Fri", timeFrom: "10:00", timeTo: "13:00", location: "Office" },

  // Faculty of Urban Economy and Ecology
  { id: 12, name: "Prof. Ruzanna Mkrtchyan", faculty: "Urban Economy and Ecology", office: "E-110", email: "ruzanna.mkrtchyan@nuaca.am", days: "Mon–Thu", timeFrom: "09:00", timeTo: "11:00", location: "Office" },
  { id: 13, name: "Dr. Hayk Abrahamyan", faculty: "Urban Economy and Ecology", office: "E-205", email: "hayk.abrahamyan@nuaca.am", days: "Mon–Fri", timeFrom: "14:00", timeTo: "17:00", location: "Office + Teams" },
  { id: 14, name: "Dr. Marine Ghazaryan", faculty: "Urban Economy and Ecology", office: "D-108", email: "marine.ghazaryan@nuaca.am", days: "Mon–Wed", timeFrom: "13:00", timeTo: "15:30", location: "Office + Zoom" },

  // Faculty of Management and Technology
  { id: 15, name: "Prof. Lusine Ter-Petrosyan", faculty: "Management and Technology", office: "F-301", email: "lusine.terpetrosyan@nuaca.am", days: "Tue–Fri", timeFrom: "10:00", timeTo: "13:00", location: "Office" },
  { id: 16, name: "Dr. Karen Poghosyan", faculty: "Management and Technology", office: "F-205", email: "karen.poghosyan@nuaca.am", days: "Mon–Fri", timeFrom: "13:30", timeTo: "16:00", location: "Office + Zoom" },
  { id: 17, name: "Assoc. Prof. Mher Petrosyan", faculty: "Management and Technology", office: "C-118", email: "mher.petrosyan@nuaca.am", days: "Mon–Fri", timeFrom: "13:30", timeTo: "17:00", location: "Office + Discord" },
  { id: 18, name: "Dr. Tigran Vardanyan", faculty: "Management and Technology", office: "C-205", email: "tigran.vardanyan@nuaca.am", days: "Mon–Thu", timeFrom: "09:00", timeTo: "12:00", location: "Office + Teams" },
];

function LecturerSchedule({ user }) {
  const { t } = useTranslation();
  const [schedule, setSchedule] = useState(initialLecturers);
  const [search, setSearch] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("All");
  const [msgTarget, setMsgTarget] = useState(null);
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgSuccess, setMsgSuccess] = useState("");
  const [msgError, setMsgError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    const stored = localStorage.getItem("lecturer_schedule");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.length >= initialLecturers.length) {
          setSchedule(parsed);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("lecturer_schedule", JSON.stringify(schedule));
  }, [schedule]);

  const faculties = useMemo(() => {
    const set = new Set(schedule.map(l => l.faculty));
    return ["All", ...Array.from(set).sort()];
  }, [schedule]);

  const filtered = useMemo(() => {
    return schedule.filter(l => {
      const matchesFaculty = selectedFaculty === "All" || l.faculty === selectedFaculty;
      const matchesSearch = !search || 
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.email.toLowerCase().includes(search.toLowerCase()) ||
        l.faculty.toLowerCase().includes(search.toLowerCase()) ||
        l.office.toLowerCase().includes(search.toLowerCase());
      return matchesFaculty && matchesSearch;
    });
  }, [schedule, search, selectedFaculty]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(l => {
      if (!groups[l.faculty]) groups[l.faculty] = [];
      groups[l.faculty].push(l);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const startEdit = (lecturer) => {
    setEditingId(lecturer.id);
    setEditData({ ...lecturer });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = () => {
    setSchedule(prev => prev.map(l => l.id === editingId ? { ...editData } : l));
    setEditingId(null);
    setEditData({});
  };

  const handleEditField = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const openMessageModal = (lecturer) => {
    setMsgTarget(lecturer);
    setMsgSubject("");
    setMsgBody("");
    setMsgSuccess("");
    setMsgError("");
  };

  const closeMessageModal = () => {
    setMsgTarget(null);
    setMsgSubject("");
    setMsgBody("");
    setMsgSuccess("");
    setMsgError("");
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!msgSubject.trim() || !msgBody.trim()) {
      setMsgError("Please fill in both subject and message.");
      return;
    }
    setMsgSending(true);
    setMsgError("");
    try {
      const res = await api.post("/messages", {
        recipient_email: msgTarget.email,
        subject: msgSubject.trim(),
        body: msgBody.trim()
      });
      setMsgSuccess(res.data.emailSent
        ? "Message sent and email notification delivered!"
        : "Message sent successfully! (Email notification not configured)");
      setMsgSubject("");
      setMsgBody("");
    } catch (err) {
      setMsgError(err.response?.data?.error || "Failed to send message.");
    } finally {
      setMsgSending(false);
    }
  };

  return (
    <div className="container">
      <h2>{t("lecturerSchedule")}</h2>
      <p>{t("searchLecturers")}</p>

      <div className="faculty-controls">
        <div className="faculty-tabs">
          {faculties.map(f => (
            <button
              key={f}
              className={selectedFaculty === f ? "faculty-tab active" : "faculty-tab"}
              onClick={() => setSelectedFaculty(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 && (
        <p style={{ textAlign: "center", color: "#888", marginTop: 30 }}>{t("noLecturers")}</p>
      )}

      {grouped.map(([faculty, lecturers]) => (
        <div key={faculty} className="faculty-group">
          <h3 className="faculty-group-title">{faculty} <span className="faculty-count">({lecturers.length})</span></h3>
          <div className="lecturer-grid">
            {lecturers.map(lecturer => (
              <div key={lecturer.id} className="lecturer-card">
                {editingId === lecturer.id ? (
                  <div className="lecturer-edit-form">
                    <label>Name:</label>
                    <input value={editData.name} onChange={e => handleEditField("name", e.target.value)} />
                    <label>Office:</label>
                    <input value={editData.office} onChange={e => handleEditField("office", e.target.value)} />
                    <label>Days:</label>
                    <select value={editData.days} onChange={e => handleEditField("days", e.target.value)}>
                      <option value="Mon–Fri">Mon–Fri</option>
                      <option value="Mon–Thu">Mon–Thu</option>
                      <option value="Mon–Wed">Mon–Wed</option>
                      <option value="Tue–Fri">Tue–Fri</option>
                      <option value="Tue–Thu">Tue–Thu</option>
                      <option value="Wed–Fri">Wed–Fri</option>
                      <option value="Mon, Wed, Fri">Mon, Wed, Fri</option>
                      <option value="Tue, Thu">Tue, Thu</option>
                    </select>
                    <label>From:</label>
                    <input type="time" value={editData.timeFrom} onChange={e => handleEditField("timeFrom", e.target.value)} />
                    <label>To:</label>
                    <input type="time" value={editData.timeTo} onChange={e => handleEditField("timeTo", e.target.value)} />
                    <label>Location:</label>
                    <input value={editData.location} onChange={e => handleEditField("location", e.target.value)} />
                    <div className="edit-actions">
                    <button className="save-btn" onClick={saveEdit}>{t("saveChanges")}</button>
                    <button className="cancel-btn" onClick={cancelEdit}>{t("cancelBtn")}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3>{lecturer.name}</h3>
                    <p><strong>Faculty:</strong> {lecturer.faculty}</p>
                    <p><strong>{t("office")}:</strong> {lecturer.office}</p>
                    <p><strong>Email:</strong> <a href={`mailto:${lecturer.email}`}>{lecturer.email}</a></p>
                    <p><strong>Where:</strong> {lecturer.location}</p>
                    <div className="lecturer-schedule-badge">
                      <span className="schedule-days">{lecturer.days}</span>
                      <span className="schedule-time">{lecturer.timeFrom} – {lecturer.timeTo}</span>
                    </div>
                    {user && user.role === "student" && (
                      <button className="msg-btn" onClick={() => openMessageModal(lecturer)}>
                        ✉ {t("sendMessage")}
                      </button>
                    )}
                    {user?.role === "lecturer" && user.email === lecturer.email && (
                      <button className="msg-btn" style={{ background: "#2563eb" }} onClick={() => startEdit(lecturer)}>
                        ✏️ {t("editSchedule")}
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {msgTarget && (
        <div className="modal-overlay" onClick={closeMessageModal}>
          <div className="modal-content msg-modal" onClick={e => e.stopPropagation()}>
            <button onClick={closeMessageModal} className="msg-close-btn" aria-label="Close">×</button>
            <h3>{t("messageTo")} {msgTarget.name}</h3>
            <p style={{ color: "#666", fontSize: 14 }}>{msgTarget.email} — {msgTarget.faculty}</p>

            {msgSuccess && <div className="success-message">{msgSuccess}</div>}
            {msgError && <div className="error-message">{msgError}</div>}

            {!msgSuccess && (
              <form onSubmit={sendMessage}>
                <input
                  type="text"
                  placeholder={t("subject")}
                  value={msgSubject}
                  onChange={e => setMsgSubject(e.target.value)}
                  maxLength={255}
                  required
                  className="msg-input"
                />
                <textarea
                  placeholder="Write your message..."
                  value={msgBody}
                  onChange={e => setMsgBody(e.target.value)}
                  rows={5}
                  required
                  className="msg-textarea"
                />
                <button type="submit" disabled={msgSending} className="msg-send-btn">
                  {msgSending ? t("sending") : t("send")}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LecturerSchedule;
