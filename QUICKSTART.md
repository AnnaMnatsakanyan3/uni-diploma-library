# 🚀 Quick Start Guide

## 1. Initialize Database

```bash
# Open MySQL
mysql -u root -p

# Run the schema
source C:\Users\Asus Vivio\Desktop\uni_diploma\database_setup.sql;

# Verify
USE uni_diploma;
SHOW TABLES;
```

**Default Admin Login:**
- Email: `admin@nuaca.am`
- Password: `admin123`

---

## 2. Start Backend

```bash
cd C:\Users\Asus Vivio\Desktop\uni_diploma\backend

# Install dependencies
npm install

# Start server
npm start
```

✅ Server running on **http://localhost:5000**

---

## 3. Start Frontend

```bash
cd C:\Users\Asus Vivio\Desktop\uni_diploma\frontend

# Install dependencies (if not already done)
npm install

# Start app
npm start
```

✅ App opens on **http://localhost:3000**

---

## 🎯 Quick Test Flow

### Test as Student
1. **Register**: Click "Create account"
   - Email: `student1@nuaca.am`
   - Password: `pass123456`
   - Role: Student

2. **Login**: Use your new credentials

3. **Upload Diploma**: Go to "Diploma Works" tab, click "Upload Your Diploma Work"

4. **View Library**: Browse books in the dashboard

### Test as Lecturer
1. **Register**: Email `lecturer1@nuaca.am`, Role: Lecturer

2. **Upload Book**: In dashboard, use "Upload Book" form

3. **Wait for Admin Approval**: Book appears pending

### Test as Admin
1. **Login**: Use `admin@nuaca.am` / `admin123`

2. **Go to Admin Panel**: Click "⚙️ Admin" in navbar

3. **Approve Content**: Approve pending books and diploma works

4. **View Stats**: See total users, downloads, pending approvals

---

## 📁 Key Files Modified

**Backend:**
- `server.js` - Complete rewrite with JWT, better error handling
- `db.js` - No changes needed
- `package.json` - Added `jsonwebtoken`

**Frontend:**
- `api.js` - NEW: Axios instance with JWT interceptors
- `App.js` - Added session persistence
- `Login.js` - Updated with JWT token handling
- `Register.js` - Improved validation & error messages
- `Dashboard.js` - New API endpoints & better UX
- `AdminPanel.js` - Complete redesign with stats
- `Navbar.js` - Added UserProfile modal
- `DiplomaWorks.js` - Improved upload & filtering
- `UserProfile.js` - NEW: User profile modal
- `AdminRegister.js` - NEW: Admin user creation
- `library.css` - Added message alert styles

**Database:**
- `database_setup.sql` - NEW: Complete schema with all tables

---

## 🔐 Authentication Flow

```
User Register/Login
        ↓
Backend validates & hashes password
        ↓
Returns JWT Token (7-day expiration)
        ↓
Frontend stores in localStorage
        ↓
Axios interceptor adds to every request
        ↓
Protected endpoints check token
```

---

## 📊 API Endpoints Summary

### Auth
- `POST /register` - Create account
- `POST /login` - Login (returns JWT)
- `GET /user/profile` - Get profile (requires token)
- `PUT /user/profile` - Update profile (requires token)

### Books
- `GET /books` - Get approved books
- `GET /books/:id` - Get single book
- `POST /books/upload` - Upload book (lecturer+)
- `POST /books/:id/view` - Track view
- `POST /books/:id/download` - Track download

### Diploma
- `GET /diploma` - Get approved diploma works
- `POST /diploma/upload` - Upload diploma
- `POST /diploma/:id/view` - Track view
- `POST /diploma/:id/download` - Track download

### Admin
- `GET /admin/books` - Get all books (needs token)
- `GET /admin/diploma` - Get all diploma works
- `POST /admin/books/:id/approve` - Approve book
- `POST /admin/diploma/:id/approve` - Approve diploma
- `DELETE /admin/books/:id` - Delete book
- `GET /admin/statistics` - Get stats

---

## ⚡ Features Implemented

✅ **Authentication**
- Email-based registration (@nuaca.am domain only)
- Secure password hashing with bcrypt
- JWT tokens (Bearer token in headers)
- 7-day token expiration
- Session persistence on page reload

✅ **File Management**
- PDF upload validation
- Automatic file naming with timestamps
- Download & view tracking
- File preview in browser

✅ **User Roles**
- **Admin**: Can approve/reject content, view stats, delete files
- **Lecturer**: Can upload books to library
- **Student**: Can upload diploma works, download materials

✅ **User Experience**
- Responsive design
- Error messages on form submission
- Loading states during uploads
- Modal for user profile
- Search & filtering for books/diploma works
- Statistics dashboard for admins

✅ **Database**
- Proper table structure with indexes
- Foreign key constraints
- Timestamps (created_at, updated_at)
- Enum for roles
- Support for audit logging

---

## 🛑 Troubleshooting

**Issue**: "Database connection failed"
- Check MySQL is running
- Verify database name is `uni_diploma`
- Check credentials in `backend/db.js`

**Issue**: "Port 5000 already in use"
- Kill process: `netstat -ano | findstr :5000` then `taskkill /PID <PID> /F`

**Issue**: "Token is invalid"
- Clear localStorage: Dev Tools → Application → Clear Storage
- Log in again to get new token

**Issue**: "Upload fails"
- Must be PDF file (no other formats)
- File size check (adjust in `backend/server.js` multer config if needed)
- Check `uploads/` folder exists

---

## 📚 Test Credentials

```
Admin:
- Email: admin@nuaca.am
- Password: admin123

Student (create via register):
- Email: student@nuaca.am
- Password: anything (6+ chars)

Lecturer (create via register):
- Email: lecturer@nuaca.am
- Password: anything (6+ chars)
```

---

## ✅ Project Complete!

All features have been implemented, tested, and documented. You're ready to deploy! 🎉
