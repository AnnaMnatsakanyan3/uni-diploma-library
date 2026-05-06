import React, { useState, useEffect, useCallback } from "react";
import api from "./api";
import "./calendar.css";

const Calendar = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(user?.course_code || "all");
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    category: "general",
    color: "#3498db",
    target_group: "all",
    location: "",
    send_reminders: true,
    reminder_days: 1
  });
  const [userRsvp, setUserRsvp] = useState(null);

  const categories = ["general", "exam"];
  const colors = ["#3498db", "#e74c3c", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"];
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const isAdmin = user?.role === "admin";
  const userCourse = user?.course_code || "all";

  const categoryLabel = (cat) => {
    if (!cat) return "General";
    if (cat === "general") return "Event";
    if (cat === "exam") return "Exam";
    return cat.replaceAll("_", " ").replace(/\b\w/g, (s) => s.toUpperCase());
  };

  const formatDateForInput = (date, hours = 10, minutes = 0) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    local.setHours(hours, minutes, 0, 0);
    return local.toISOString().slice(0, 16);
  };

  const isEventOnDay = (event, dayDate) => {
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);
    return start <= dayEnd && end >= dayStart;
  };

  const formatTimeRange = (event) => {
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const fetchGroups = useCallback(async () => {
    try {
      const response = await api.get("/events/groups");
      setAvailableGroups(response.data || []);
    } catch (err) {
      setAvailableGroups([]);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const effectiveGroup = !isAdmin ? userCourse : selectedGroup;
      const response = await api.get("/events", {
        params: {
          month: selectedMonth,
          year: selectedYear,
          category: selectedCategory || undefined,
          group: effectiveGroup === "all" ? undefined : effectiveGroup
        }
      });
      setEvents(response.data);
      setError("");
    } catch (err) {
      setError("Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, selectedCategory, selectedGroup, isAdmin, userCourse]);

  useEffect(() => {
    if (!isAdmin) {
      setSelectedGroup(userCourse);
    }
  }, [isAdmin, userCourse]);

  // Fetch events
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Handle event click
  const handleEventClick = async (event) => {
    setSelectedEvent(event);
    try {
      const response = await api.get(`/events/${event.id}/my-rsvp`);
      setUserRsvp(response.data.rsvp);
    } catch (err) {
      setUserRsvp(null);
    }
  };

  // Handle RSVP
  const handleRsvp = async (status) => {
    try {
      if (!selectedEvent) return;
      await api.post(`/events/${selectedEvent.id}/rsvp`, { status });
      setUserRsvp(status);
      fetchEvents(); // Refresh to show updated counts
    } catch (err) {
      setError("Failed to update RSVP");
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

  // Handle create/update event
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      setError("Only admins can add or edit events");
      return;
    }
    try {
      if (selectedEvent?.id) {
        // Update
        await api.put(`/events/${selectedEvent.id}`, formData);
      } else {
        // Create
        await api.post("/events", formData);
      }
      setShowModal(false);
      setFormData({
        title: "",
        description: "",
        start_date: "",
        end_date: "",
        category: "general",
        color: "#3498db",
        target_group: "all",
        location: "",
        send_reminders: true,
        reminder_days: 1
      });
      setSelectedEvent(null);
      fetchEvents();
      fetchGroups();
    } catch (err) {
      setError("Failed to save event");
    }
  };

  // Handle delete event
  const handleDelete = async () => {
    if (!isAdmin) {
      setError("Only admins can delete events");
      return;
    }
    if (!selectedEvent?.id) return;
    if (!window.confirm("Are you sure you want to delete this event?")) return;

    try {
      await api.delete(`/events/${selectedEvent.id}`);
      setSelectedEvent(null);
      setShowModal(false);
      fetchEvents();
    } catch (err) {
      setError("Failed to delete event");
    }
  };

  // Open new event modal
  const openNewEventModal = (prefillDate = null) => {
    if (!isAdmin) {
      setError("Only admins can add events");
      return;
    }
    const startDate = prefillDate ? formatDateForInput(prefillDate, 10, 0) : "";
    const endDate = prefillDate ? formatDateForInput(prefillDate, 11, 0) : "";
    setSelectedEvent(null);
    setFormData({
      title: "",
      description: "",
      start_date: startDate,
      end_date: endDate,
      category: "general",
      color: "#3498db",
      target_group: "all",
      location: "",
      send_reminders: true,
      reminder_days: 1
    });
    setShowModal(true);
  };

  // Open edit event modal
  const openEditEventModal = () => {
    if (!isAdmin) {
      setError("Only admins can edit events");
      return;
    }
    setFormData({
      title: selectedEvent.title,
      description: selectedEvent.description,
      start_date: selectedEvent.start_date.slice(0, 16),
      end_date: selectedEvent.end_date.slice(0, 16),
      category: selectedEvent.category,
      color: selectedEvent.color,
      target_group: selectedEvent.target_group || "all",
      location: selectedEvent.location,
      send_reminders: selectedEvent.send_reminders,
      reminder_days: selectedEvent.reminder_days
    });
    setShowModal(true);
  };

  const getDaysInMonth = (month, year) => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month - 1, 1).getDay();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const firstDay = getFirstDayOfMonth(selectedMonth, selectedYear);
    const days = [];
    const today = new Date();
    const isCurrentMonth = today.getMonth() + 1 === selectedMonth && today.getFullYear() === selectedYear;

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(selectedYear, selectedMonth - 1, day);
      const dayEvents = events.filter((event) => isEventOnDay(event, dayDate));
      const visibleEvents = dayEvents.slice(0, 2);
      const isToday = isCurrentMonth && day === today.getDate();

      days.push(
        <div
          key={day}
          className={`calendar-day${isToday ? " today" : ""}`}
          onClick={() => user?.role === "admin" && openNewEventModal(dayDate)}
        >
          <div className="day-number">{day}</div>
          <div className="day-events">
            {visibleEvents.map(event => (
              <div
                key={event.id}
                className="day-event-item"
                style={{ borderLeftColor: event.color }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEventClick(event);
                }}
                title={`${event.title} (${categoryLabel(event.category)})`}
              >
                <span className="day-event-title">{event.title}</span>
                <span className="day-event-time">{formatTimeRange(event)}</span>
              </div>
            ))}
            {dayEvents.length > 2 && <div className="day-event-more">+{dayEvents.length - 2} more</div>}
          </div>
        </div>
      );
    }

    return days;
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="calendar-container">
      <h1>📅 Events & Calendar</h1>

      {error && <div className="error-message">{error}</div>}

      {/* Calendar Header */}
      <div className="calendar-header">
        <button onClick={() => setSelectedYear(selectedYear - 1)}>◀ Year</button>
        <span className="calendar-title">
          {monthNames[selectedMonth - 1]} {selectedYear}
        </span>
        <button onClick={() => setSelectedYear(selectedYear + 1)}>Year ▶</button>
      </div>

      {/* Month Navigation */}
      <div className="month-nav">
        <button
          onClick={() => {
            setSelectedMonth(selectedMonth === 1 ? 12 : selectedMonth - 1);
            if (selectedMonth === 1) setSelectedYear(selectedYear - 1);
          }}
        >
          ◀ Previous
        </button>
        <div className="month-selector">
          {monthNames.map((month, idx) => (
            <button
              key={idx}
              className={selectedMonth === idx + 1 ? "active" : ""}
              onClick={() => setSelectedMonth(idx + 1)}
            >
              {month.slice(0, 3)}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setSelectedMonth(selectedMonth === 12 ? 1 : selectedMonth + 1);
            if (selectedMonth === 12) setSelectedYear(selectedYear + 1);
          }}
        >
          Next ▶
        </button>
      </div>

      {/* Category Filter */}
      <div className="calendar-filters">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="filter-select"
        >
          <option value="">All Events</option>
          <option value="exam">Exams</option>
        </select>

        {user?.role === "admin" && (
          <button onClick={openNewEventModal} className="btn-primary">
            + New Event
          </button>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="calendar-wrapper">
        <div className="weekday-header">
          {weekdays.map((weekday) => (
            <div key={weekday}>{weekday}</div>
          ))}
        </div>
        <div className="calendar-grid">
          {loading ? <p>Loading...</p> : renderCalendar()}
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedEvent(null)}>×</button>
            <h2>{selectedEvent.title}</h2>
            <p><strong>Type:</strong> {categoryLabel(selectedEvent.category)}</p>
            <p><strong>Group:</strong> {selectedEvent.target_group || "all"}</p>
            <p><strong>Date:</strong> {new Date(selectedEvent.start_date).toLocaleString()} to {new Date(selectedEvent.end_date).toLocaleString()}</p>
            {selectedEvent.location && <p><strong>Location:</strong> {selectedEvent.location}</p>}
            {selectedEvent.description && <p><strong>Description:</strong> {selectedEvent.description}</p>}
            <p><strong>Creator:</strong> {selectedEvent.creator_name}</p>

            {/* RSVP Section */}
            <div className="rsvp-section">
              <h3>Your RSVP</h3>
              <div className="rsvp-buttons">
                <button
                  className={`rsvp-btn ${userRsvp === "going" ? "active" : ""}`}
                  onClick={() => handleRsvp("going")}
                >
                  ✓ Going
                </button>
                <button
                  className={`rsvp-btn ${userRsvp === "maybe" ? "active" : ""}`}
                  onClick={() => handleRsvp("maybe")}
                >
                  ◯ Maybe
                </button>
                <button
                  className={`rsvp-btn ${userRsvp === "not_going" ? "active" : ""}`}
                  onClick={() => handleRsvp("not_going")}
                >
                  ✗ Not Going
                </button>
              </div>
            </div>

            {/* Admin Actions */}
            {user?.role === "admin" && (
              <div className="admin-actions">
                <button className="btn-secondary" onClick={openEditEventModal}>
                  ✎ Edit Event
                </button>
                <button className="btn-danger" onClick={handleDelete}>
                  🗑 Delete Event
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Event Form Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            <h2>{selectedEvent ? "Edit Event" : "Create New Event"}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Item Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  rows="3"
                ></textarea>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Date & Time *</label>
                  <input
                    type="datetime-local"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleFormChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select name="category" value={formData.category} onChange={handleFormChange}>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {categoryLabel(cat)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <div className="color-picker">
                    {colors.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`color-option ${formData.color === color ? "selected" : ""}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      ></button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Target Group (use "all" for everyone)</label>
                <input
                  list="event-group-options"
                  type="text"
                  name="target_group"
                  value={formData.target_group}
                  onChange={handleFormChange}
                  placeholder="e.g. Arch-2, CS-1, all"
                />
                <datalist id="event-group-options">
                  <option value="all" />
                  {availableGroups.map((groupCode) => (
                    <option key={groupCode} value={groupCode} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleFormChange}
                />
              </div>

              <div className="form-row">
                <div className="form-group checkbox">
                  <input
                    type="checkbox"
                    name="send_reminders"
                    checked={formData.send_reminders}
                    onChange={handleFormChange}
                  />
                  <label>Send Email Reminders</label>
                </div>
                {formData.send_reminders && (
                  <div className="form-group">
                    <label>Days Before Reminder</label>
                    <input
                      type="number"
                      name="reminder_days"
                      value={formData.reminder_days}
                      onChange={handleFormChange}
                      min="1"
                    />
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {selectedEvent ? "Update Item" : "Create Item"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
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

export default Calendar;
