-- University Digital Library Database Schema
-- Run this file to set up the database

CREATE DATABASE IF NOT EXISTS uni_diploma;
USE uni_diploma;

-- ============================
-- USERS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'student', 'lecturer') NOT NULL DEFAULT 'student',
  course_code VARCHAR(30),
  avatar VARCHAR(255),
  bio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_course_code (course_code)
);

-- ============================
-- BOOKS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(100) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  faculty VARCHAR(100),
  description TEXT,
  approved TINYINT(1) DEFAULT 0,
  views INT DEFAULT 0,
  downloads INT DEFAULT 0,
  uploaded_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  book_type ENUM('online', 'physical', 'both') NOT NULL DEFAULT 'online',
  total_copies INT DEFAULT 0,
  available_copies INT DEFAULT 0,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_approved (approved),
  INDEX idx_category (category),
  INDEX idx_uploaded_by (uploaded_by)
);

-- ============================
-- BOOK RESERVATIONS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS book_reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  status ENUM('reserved', 'borrowed', 'returned', 'overdue', 'cancelled') NOT NULL DEFAULT 'reserved',
  reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  borrowed_at DATETIME DEFAULT NULL,
  due_date DATETIME DEFAULT NULL,
  returned_at DATETIME DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_book (book_id),
  INDEX idx_status (status)
);

-- ============================
-- DIPLOMA_WORKS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS diploma_works (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  student VARCHAR(100) NOT NULL,
  supervisor VARCHAR(100) NOT NULL,
  department VARCHAR(100),
  year INT,
  filename VARCHAR(255) NOT NULL,
  description TEXT,
  approved TINYINT(1) DEFAULT 0,
  views INT DEFAULT 0,
  downloads INT DEFAULT 0,
  uploaded_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_approved (approved),
  INDEX idx_year (year),
  INDEX idx_department (department)
);

-- ============================
-- AUDIT_LOG TABLE (for tracking actions)
-- ============================
CREATE TABLE IF NOT EXISTS audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id INT,
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action)
);

-- ============================
-- CALENDAR_EVENTS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS calendar_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  color VARCHAR(7) DEFAULT '#3498db',
  location VARCHAR(255),
  target_group VARCHAR(80) NOT NULL DEFAULT 'all',
  created_by INT NOT NULL,
  send_reminders TINYINT(1) DEFAULT 1,
  reminder_days INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_start_date (start_date),
  INDEX idx_category (category),
  INDEX idx_target_group (target_group),
  INDEX idx_created_by (created_by)
);

-- ============================
-- EVENT_RSVP TABLE (for attendance tracking)
-- ============================
CREATE TABLE IF NOT EXISTS event_rsvp (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('pending', 'going', 'not_going', 'maybe') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_rsvp (event_id, user_id),
  INDEX idx_event_id (event_id),
  INDEX idx_user_id (user_id)
);

-- ============================
-- COURSES TABLE
-- ============================
CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  semester VARCHAR(20),
  credits INT DEFAULT 3,
  instructor_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_code (code)
);

-- ============================
-- COURSE_MATERIALS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS course_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  material_id INT NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES books(id) ON DELETE CASCADE,
  UNIQUE KEY unique_course_material (course_id, material_id)
);

-- ============================
-- MESSAGES TABLE (student -> lecturer)
-- ============================
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  recipient_email VARCHAR(100) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sender (sender_id),
  INDEX idx_recipient (recipient_email),
  INDEX idx_read (is_read)
);

-- ============================
-- INSERT DEFAULT ADMIN USER
-- ============================
-- Password: admin123 (bcrypt hash)
-- Use this to create admin first, then delete this
INSERT INTO users (name, email, password, role) VALUES 
('Admin User', 'admin@nuaca.am', '$2b$10$YIjlrIPM5v6YvHHaI9p.UeSLYHhT3BH7DiYPRVPHECvkc.JQ6EEt2', 'admin')
ON DUPLICATE KEY UPDATE id=id;
