import React, { useState, useEffect, useCallback } from "react";
import api from "./api";
import "./courses.css";
import { useTranslation } from "react-i18next";
import i18n from "./i18n";

const displayCode = (code) =>
  i18n.language === "hy" ? code.replace(/HK/g, "ՀԿ").replace(/\bK12\b/g, "Կ12") : code;

const Courses = ({ user }) => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [semesters, setSemesters] = useState([]);
  const [showNewCourseModal, setShowNewCourseModal] = useState(false);
  const [enrolledIds, setEnrolledIds] = useState(new Set());
  const [enrollMsg, setEnrollMsg] = useState("");
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    semester: "",
    credit_hours: ""
  });

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/courses", {
        params: selectedSemester ? { semester: selectedSemester } : {}
      });
      setCourses(response.data);

      // Extract unique semesters
      const uniqueSemesters = [...new Set(response.data.map(c => c.semester))];
      setSemesters(uniqueSemesters);
      setError("");
    } catch (err) {
      setError("Failed to fetch courses");
    } finally {
      setLoading(false);
    }
  }, [selectedSemester]);

  // Fetch courses
  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Fetch enrolled courses for student
  useEffect(() => {
    if (user && user.role === "student") {
      api.get("/my-enrollments")
        .then(r => setEnrolledIds(new Set(r.data.map(e => e.course_id))))
        .catch(() => {});
    }
  }, [user]);

  // Fetch course details
  const handleCourseClick = async (course) => {
    try {
      const response = await api.get(`/courses/${course.id}`);
      setSelectedCourse(response.data);
    } catch (err) {
      setError("Failed to fetch course details");
    }
  };

  // Handle form change
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // Create new course
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      if (!user || (user.role !== "lecturer" && user.role !== "admin")) {
        setError("Only instructors can create courses");
        return;
      }

      await api.post("/courses", formData);
      setShowNewCourseModal(false);
      setFormData({
        code: "",
        name: "",
        description: "",
        semester: "",
        credit_hours: ""
      });
      fetchCourses();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create course");
    }
  };

  const { t } = useTranslation();
  const isInstructor = user && (user.role === "lecturer" || user.role === "admin");

  const handleEnroll = async (e, courseId) => {
    e.stopPropagation();
    const isEnrolled = enrolledIds.has(courseId);
    try {
      if (isEnrolled) {
        await api.delete(`/courses/${courseId}/enroll`);
        setEnrolledIds(prev => { const s = new Set(prev); s.delete(courseId); return s; });
        setEnrollMsg("Unenrolled successfully");
      } else {
        await api.post(`/courses/${courseId}/enroll`);
        setEnrolledIds(prev => new Set([...prev, courseId]));
        setEnrollMsg("Enrolled successfully! 🎉");
      }
      setTimeout(() => setEnrollMsg(""), 2500);
    } catch (err) {
      setEnrollMsg(err.response?.data?.error || "Action failed");
      setTimeout(() => setEnrollMsg(""), 2500);
    }
  };

  return (
    <div className="courses-container">
      <h1>📚 {t("courseMaterials")}</h1>

      {error && <div className="error-message">{error}</div>}
      {enrollMsg && <div className="success-message">{enrollMsg}</div>}

      {/* Header with Create Button */}
      <div className="courses-header">
        <div className="semester-filter">
          <label>{t("filterBySemester")}:</label>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="semester-select"
          >
            <option value="">{t("allSemesters")}</option>
            {semesters.map(sem => (
              <option key={sem} value={sem}>{sem}</option>
            ))}
          </select>
        </div>

        {isInstructor && (
          <button
            onClick={() => setShowNewCourseModal(true)}
            className="btn-primary"
          >
{t("newCourse")}
          </button>
        )}
      </div>

      <div className="courses-layout">
        {/* Courses List */}
        <div className="courses-list">
          <h2>📖 {t("availableCourses")} ({courses.length})</h2>

          {loading ? (
            <p className="loading">{t("loadingCourses")}</p>
          ) : courses.length === 0 ? (
            <p className="no-courses">{t("noCoursesFound")}</p>
          ) : (
            <div className="courses-grid">
              {courses.map(course => (
                <div
                  key={course.id}
                  className={`course-card ${selectedCourse?.id === course.id ? "active" : ""}`}
                  onClick={() => handleCourseClick(course)}
                >
                  <div className="course-header">
                    <h3>{displayCode(course.code)}</h3>
                    <span className="material-badge">{course.material_count || 0}</span>
                  </div>
                  <p className="course-name">{course.name}</p>
                  <p className="course-semester">{course.semester}</p>
                  {course.credit_hours && (
                    <p className="course-credits">{course.credit_hours} Credits</p>
                  )}
                  {course.instructor_name && (
                    <p className="course-instructor">👨‍🏫 {course.instructor_name}</p>
                  )}
                  {user?.role === "student" && (
                    <button
                      className={`enroll-btn${enrolledIds.has(course.id) ? " enrolled" : ""}`}
                      onClick={(e) => handleEnroll(e, course.id)}
                    >
                      {enrolledIds.has(course.id) ? "✓ Enrolled" : "Enroll"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Course Details Panel */}
        {selectedCourse && (
          <div className="course-details">
            <button
              className="close-btn"
              onClick={() => setSelectedCourse(null)}
            >
              ×
            </button>

            <div className="details-header">
              <h2>{displayCode(selectedCourse.code)}</h2>
              <span className="semester-badge">{selectedCourse.semester}</span>
            </div>

            <h3>{selectedCourse.name}</h3>

            {selectedCourse.description && (
              <div className="description">
                <h4>Description</h4>
                <p>{selectedCourse.description}</p>
              </div>
            )}

            {selectedCourse.instructor_name && (
              <div className="instructor-info">
                <h4>Instructor</h4>
                <p>👨‍🏫 {selectedCourse.instructor_name}</p>
              </div>
            )}

            {selectedCourse.credit_hours && (
              <div className="credits-info">
                <h4>Credit Hours</h4>
                <p>{selectedCourse.credit_hours}</p>
              </div>
            )}

            {/* Course Materials */}
            <div className="course-materials">
              <div className="materials-header">
                <h4>📑 Course Materials ({selectedCourse.materials?.length || 0})</h4>
              </div>

              {!selectedCourse.materials || selectedCourse.materials.length === 0 ? (
                <p className="no-materials">No materials added to this course yet</p>
              ) : (
                <div className="materials-list">
                  {selectedCourse.materials.map((material, idx) => (
                    <div key={idx} className="material-item">
                      <div className="material-icon">
                        {material.material_type === "book" ? "📚" : "📄"}
                      </div>
                      <div className="material-info">
                        <h5>{material.title || "Untitled"}</h5>
                        {material.author && (
                          <p className="author">by {material.author}</p>
                        )}
                      </div>
                      {material.is_required && (
                        <span className="required-badge">Required</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
              <button className="btn-secondary">
                📌 Save Course
              </button>
              <button className="btn-secondary">
                📧 Email Syllabus
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Course Modal */}
      {showNewCourseModal && (
        <div className="modal-overlay" onClick={() => setShowNewCourseModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowNewCourseModal(false)}
            >
              ×
            </button>
            <h2>Create New Course</h2>

            <form onSubmit={handleCreateCourse}>
              <div className="form-group">
                <label>Course Code *</label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleFormChange}
                  placeholder="e.g., WEB101"
                  required
                />
              </div>

              <div className="form-group">
                <label>Course Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="e.g., Web Development Basics"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Course description..."
                  rows="4"
                ></textarea>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Semester</label>
                  <input
                    type="text"
                    name="semester"
                    value={formData.semester}
                    onChange={handleFormChange}
                    placeholder="e.g., Spring 2024"
                  />
                </div>

                <div className="form-group">
                  <label>Credit Hours</label>
                  <input
                    type="number"
                    name="credit_hours"
                    value={formData.credit_hours}
                    onChange={handleFormChange}
                    placeholder="e.g., 3"
                    min="1"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  Create Course
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowNewCourseModal(false)}
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

export default Courses;
