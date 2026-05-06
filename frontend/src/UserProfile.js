import api from "./api";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

function UserProfile({ user, onClose }) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState(user);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get("/user/profile");
      setProfile(res.data);
      setName(res.data.name);
      setBio(res.data.bio || "");
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");

    if (!name) {
      setError(t("nameRequired"));
      return;
    }

    try {
      await api.put("/user/profile", { name, bio });
      setSuccess("✅ Profile updated successfully");
      setEditing(false);
      fetchProfile();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error || "Update failed");
    }
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: "center" }}>{t("loadingProfile")}</div>;
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
        background: "white",
        borderRadius: 8,
        padding: 30,
        maxWidth: 500,
        width: "90%",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>{t("userProfile")}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer" }}>×</button>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {!editing ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>{t("name")}</label>
              <p style={{ margin: "4px 0 0 0", fontSize: 16 }}>{profile.name}</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>{t("email")}</label>
              <p style={{ margin: "4px 0 0 0", fontSize: 16 }}>{profile.email}</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>{t("role")}</label>
              <p style={{ margin: "4px 0 0 0", fontSize: 16, textTransform: "capitalize" }}>{profile.role}</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>{t("bio")}</label>
              <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#666" }}>{profile.bio || t("noBio")}</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>{t("memberSince")}</label>
              <p style={{ margin: "4px 0 0 0", fontSize: 14 }}>
                {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>

            <button onClick={() => setEditing(true)} style={{ marginTop: 10 }}>
              {t("editProfile")}
            </button>
          </div>
        ) : (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>{t("name")}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ marginBottom: 16 }}
            />

            <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>{t("bio")}</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder={t("bioPlaceholder")}
              style={{ marginBottom: 16, minHeight: 80 }}
            ></textarea>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSave}>{t("saveChanges")}</button>
              <button onClick={() => setEditing(false)} style={{ background: "#6b7280" }}>{t("cancel")}</button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20, textAlign: "right" }}>
          <button onClick={onClose} style={{ background: "#000", color: "#fff", border: "1px solid #960000", padding: "8px 12px", borderRadius: 6 }}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserProfile;
