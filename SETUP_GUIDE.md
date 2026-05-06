# University Digital Library - Setup Guide

## 📋 Project Overview

This is a complete university digital library system with:
- **Role-based authentication** (Admin, Lecturer, Student)
- **JWT token-based security**
- **File upload system** for books and diploma works
- **Admin approval workflow**
- **User profiles**
- **Statistics dashboard**
- **PDF preview and download tracking**

---

## 🛠 Prerequisites

- **Node.js** (v14+)
- **MySQL** (v5.7+)
- **npm** or **yarn**
- **Git** (optional)

---

## 📦 Installation

### 1. Database Setup

Run the SQL schema to create database tables:

```bash
mysql -u root -p < database_setup.sql
```

**Or copy-paste in MySQL Workbench:**
```sql
source /path/to/database_setup.sql
```

Default admin credentials (from database_setup.sql):
- **Email:** `admin@nuaca.am`
- **Password:** `admin123`

---

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file (optional, for production)
echo "JWT_SECRET=your_production_secret_key" > .env
echo "PORT=5000" >> .env

# Start server
npm start
# Server runs on http://localhost:5000
```

**API Documentation:**
- `POST /register` - User registration
- `POST /login` - User login (returns JWT token)
- `GET /books` - Get approved books
- `POST /books/upload` - Upload book (lecturer only)
- `POST /admin/books/:id/approve` - Approve book (admin only)
- `GET /admin/statistics` - Get admin stats
- See `backend/server.js` for complete endpoint list

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
# Opens on http://localhost:3000
```

---

## 🔐 JWT Token Management

Tokens are **automatically handled** by the frontend:

1. **Login** → Backend returns JWT token
2. **Token stored** in `localStorage`
3. **Axios interceptor** adds token to every request header
4. **Token expires** after 7 days
5. **Logout** clears token from localStorage

**Token in Header:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## 👥 User Roles

### Admin
- ✅ Approve/reject books and diploma works
- ✅ View statistics dashboard
- ✅ Delete inappropriate content
- ✅ Create new users

### Lecturer
- ✅ Upload books to library
- ✅ View all approved books
- ✅ Download materials

### Student
- ✅ Upload diploma works
- ✅ View and download books & diploma works
- ✅ Manage personal profile

---

## 📁 Project Structure

```
uni_diploma/
├── backend/
│   ├── server.js           # Express API server
│   ├── db.js              # MySQL connection
│   ├── package.json       # Dependencies
│   └── uploads/           # Uploaded PDFs
│
├── frontend/
│   ├── src/
│   │   ├── App.js         # Main component
│   │   ├── Login.js       # Login form
│   │   ├── Register.js    # Registration form
│   │   ├── Dashboard.js   # Books library
│   │   ├── DiplomaWorks.js # Diploma repository
│   │   ├── AdminPanel.js  # Admin dashboard
│   │   ├── UserProfile.js # User profile modal
│   │   ├── AdminRegister.js # Admin user creation
│   │   ├── Navbar.js      # Navigation bar
│   │   ├── api.js         # Axios instance with JWT
│   │   └── library.css    # Styling
│   └── package.json
│
└── database_setup.sql     # Database schema
```

---

## 🚀 Deployment

### Environment Variables (Production)

Create `.env` in backend:
```
JWT_SECRET=strong_random_secret_key_here
PORT=5000
NODE_ENV=production
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=uni_diploma
```

### Database Backup

```bash
mysqldump -u root -p uni_diploma > backup.sql
```

### Running on Server

```bash
# Backend with PM2
npm install -g pm2
pm2 start backend/server.js --name "uni_library"
pm2 save

# Frontend build
cd frontend
npm run build
# Serve with: serve -s build
```

---

## 🔧 Common Issues

### Port 5000 Already in Use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:5000 | xargs kill -9
```

### MySQL Connection Error
```
Error: connect EACCES
```
**Solution:**
- Check MySQL is running: `mysql -u root -p`
- Verify credentials in `backend/db.js`

### CORS Errors
- Backend already has CORS enabled
- Make sure frontend calls `http://localhost:5000`

### JWT Token Expired
- Tokens expire after 7 days
- User will be redirected to login
- Generated new token on re-login

---

## 📊 Statistics Available

Admin dashboard shows:
- Total registered users
- Total books in library
- Approved vs pending book approvals
- Total downloads across all materials

---

## 🔒 Security Features

- ✅ **Password Hashing**: bcrypt (10 salt rounds)
- ✅ **JWT Authentication**: 7-day expiration
- ✅ **File Validation**: PDF only
- ✅ **SQL Injection Prevention**: Parameterized queries
- ✅ **CORS Protection**: Configured endpoints
- ✅ **Role-based Access**: Middleware authorization

---

## 📝 API Examples

### Login
```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@nuaca.am",
    "password": "password123"
  }'

# Response:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "student@nuaca.am",
    "role": "student"
  }
}
```

### Upload Book (with JWT)
```bash
curl -X POST http://localhost:5000/books/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Advanced Database Design" \
  -F "author=Dr. Smith" \
  -F "category=IT" \
  -F "file=@book.pdf"
```

### Admin Approve
```bash
curl -X POST http://localhost:5000/admin/books/5/approve \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## 📞 Support & Documentation

- **MySQL Setup**: https://dev.mysql.com/doc/
- **Express.js**: https://expressjs.com
- **React**: https://react.dev
- **JWT**: https://jwt.io
- **Bcrypt**: https://github.com/kelektiv/node.bcrypt.js

---

## 📄 License

This project is created for educational purposes as a diploma project.

---

**Last Updated:** March 28, 2026
**Version:** 1.0.0
