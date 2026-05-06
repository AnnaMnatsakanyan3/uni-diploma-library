import React, { useState, useEffect } from "react";
import api from "./api";
import "./bookmarks.css";
import { useTranslation } from "react-i18next";

const Bookmarks = ({ user }) => {
  const { t } = useTranslation();
  const [readingLists, setReadingLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_public: false
  });

  // Fetch reading lists
  useEffect(() => {
    fetchReadingLists();
  }, []);

  const fetchReadingLists = async () => {
    try {
      setLoading(true);
      const response = await api.get("/reading-lists");
      setReadingLists(response.data);
      setError("");
    } catch (err) {
      setError("Failed to fetch reading lists");
    } finally {
      setLoading(false);
    }
  };

  // Fetch list details
  const handleListClick = async (list) => {
    try {
      const response = await api.get(`/reading-lists/${list.id}`);
      setSelectedList(response.data);
    } catch (err) {
      setError("Failed to fetch list details");
    }
  };

  // Handle form change
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value
    });
  };

  // Create new list
  const handleCreateList = async (e) => {
    e.preventDefault();
    try {
      await api.post("/reading-lists", formData);
      setShowNewListModal(false);
      setFormData({
        name: "",
        description: "",
        is_public: false
      });
      fetchReadingLists();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create reading list");
    }
  };

  // Update item status
  const handleUpdateItemStatus = async (itemId, status) => {
    try {
      await api.put(`/bookmark-items/${itemId}`, { status });
      if (selectedList) {
        const updatedItems = selectedList.items.map(item =>
          item.id === itemId ? { ...item, status } : item
        );
        setSelectedList({ ...selectedList, items: updatedItems });
      }
    } catch (err) {
      setError("Failed to update item status");
    }
  };

  // Update item progress
  const handleUpdateProgress = async (itemId, progress) => {
    try {
      await api.put(`/bookmark-items/${itemId}`, { progress });
      if (selectedList) {
        const updatedItems = selectedList.items.map(item =>
          item.id === itemId ? { ...item, progress } : item
        );
        setSelectedList({ ...selectedList, items: updatedItems });
      }
    } catch (err) {
      setError("Failed to update progress");
    }
  };

  // Remove item from list
  const handleRemoveItem = async (itemId) => {
    try {
      if (!window.confirm("Remove this item from the list?")) return;
      
      await api.delete(`/reading-lists/${selectedList.id}/items/${itemId}`);
      const updatedItems = selectedList.items.filter(item => item.id !== itemId);
      setSelectedList({ ...selectedList, items: updatedItems });
      fetchReadingLists();
    } catch (err) {
      setError("Failed to remove item");
    }
  };

  // Delete list
  const handleDeleteList = async (listId) => {
    try {
      if (!window.confirm("Delete this reading list? This cannot be undone.")) return;
      
      await api.delete(`/reading-lists/${listId}`);
      setSelectedList(null);
      fetchReadingLists();
    } catch (err) {
      setError("Failed to delete reading list");
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case "to_read": return "#3498db";
      case "reading": return "#f39c12";
      case "completed": return "#2ecc71";
      default: return "#95a5a6";
    }
  };

  const getStatusLabel = (status) => {
    return status.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  return (
    <div className="bookmarks-container">
      <h1>🔖 {t("myReadingLists")}</h1>

      {error && <div className="error-message">{error}</div>}

      <div className="bookmarks-layout">
        {/* Lists Sidebar */}
        <div className="lists-sidebar">
          <div className="sidebar-header">
            <h2>📚 Your Lists</h2>
            <button
              onClick={() => setShowNewListModal(true)}
              className="btn-small-primary"
            >
{t("newList")}
            </button>
          </div>

          {loading ? (
            <p className="loading">Loading...</p>
          ) : readingLists.length === 0 ? (
            <p className="no-lists">{t("noReadingLists")}</p>
          ) : (
            <div className="lists-grid">
              {readingLists.map(list => (
                <div
                  key={list.id}
                  className={`list-card ${selectedList?.id === list.id ? "active" : ""}`}
                  onClick={() => handleListClick(list)}
                >
                  <h3>{list.name}</h3>
                  <p className="item-count">
                    <span className="badge">{list.item_count || 0}</span> {t("items")}
                  </p>
                  {list.is_public && (
                    <span className="public-badge">🌐 Public</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* List Details */}
        {selectedList ? (
          <div className="list-details">
            <div className="details-header">
              <div>
                <h2>{selectedList.name}</h2>
                {selectedList.description && (
                  <p className="description">{selectedList.description}</p>
                )}
              </div>
              <button
                className="delete-btn"
                onClick={() => handleDeleteList(selectedList.id)}
              >
                🗑 Delete List
              </button>
            </div>

            {/* Statistics */}
            <div className="list-stats">
              <div className="stat">
                <span className="stat-value">{selectedList.items?.length || 0}</span>
                <span className="stat-label">Total Items</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {selectedList.items?.filter(i => i.status === "completed").length || 0}
                </span>
                <span className="stat-label">Completed</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {selectedList.items?.filter(i => i.status === "reading").length || 0}
                </span>
                <span className="stat-label">Reading</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {selectedList.items?.filter(i => i.status === "to_read").length || 0}
                </span>
                <span className="stat-label">To Read</span>
              </div>
            </div>

            {/* Items */}
            <div className="list-items">
              {(!selectedList.items || selectedList.items.length === 0) ? (
                <div className="empty-list">
                  <p>📭 No items in this reading list</p>
                  <p className="hint">Add books or diploma works from the library</p>
                </div>
              ) : (
                <div className="items-container">
                  {selectedList.items.map(item => (
                    <div key={item.id} className="item-card">
                      <div className="item-header">
                        <div className="item-title">
                          <h4>{item.title || item.diploma_title}</h4>
                          {item.author && (
                            <p className="author">by {item.author}</p>
                          )}
                        </div>
                        <button
                          className="remove-btn"
                          onClick={() => handleRemoveItem(item.id)}
                          title="Remove from list"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Status Selector */}
                      <div className="status-selector">
                        <label>Status:</label>
                        <div className="status-buttons">
                          {["to_read", "reading", "completed"].map(status => (
                            <button
                              key={status}
                              className={`status-btn ${item.status === status ? "active" : ""}`}
                              style={item.status === status ? { backgroundColor: getStatusColor(status), color: "white" } : {}}
                              onClick={() => handleUpdateItemStatus(item.id, status)}
                            >
                              {getStatusLabel(status)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {item.status === "reading" && (
                        <div className="progress-section">
                          <label>Progress: {item.progress || 0}%</label>
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{ width: `${item.progress || 0}%` }}
                            ></div>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={item.progress || 0}
                            onChange={(e) => handleUpdateProgress(item.id, parseInt(e.target.value))}
                            className="progress-slider"
                          />
                        </div>
                      )}

                      {/* Notes */}
                      {item.notes && (
                        <div className="notes-section">
                          <p className="notes-label">📝 Notes:</p>
                          <p className="notes-text">{item.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <h2>📖 Select a Reading List</h2>
            <p>Create your first reading list or select an existing one to view items.</p>
          </div>
        )}
      </div>

      {/* New List Modal */}
      {showNewListModal && (
        <div className="modal-overlay" onClick={() => setShowNewListModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowNewListModal(false)}
            >
              ×
            </button>
            <h2>Create New Reading List</h2>

            <form onSubmit={handleCreateList}>
              <div className="form-group">
                <label>List Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="e.g., Spring 2024 Reading"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Add a description for this reading list..."
                  rows="4"
                ></textarea>
              </div>

              <div className="form-group checkbox">
                <input
                  type="checkbox"
                  name="is_public"
                  checked={formData.is_public}
                  onChange={handleFormChange}
                  id="is_public"
                />
                <label htmlFor="is_public">Make this list public (shareable with others)</label>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  Create List
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowNewListModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookmarks;
