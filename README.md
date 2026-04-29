# 🏥 Smart Clinic — Appointment & Queue Management System

A **full-stack, production-ready web application** designed to streamline clinic operations with **real-time queue tracking, smart scheduling, and automated notifications**.

---

## 👨‍💻 Team Members

* **Piyush Nayak**
* **Vivek Kumar**
* **Diwanshu**


---

## ✨ Key Features

* 📅 **Online Appointment Booking**
* ⏱️ **Real-Time Queue Tracking (Socket.io)**
* 🔔 **Automated SMS & Push Notifications**
* 👨‍⚕️ **Doctor Dashboard for Queue Management**
* 🛠️ **Admin Panel with Analytics**
* 📊 **Live Status Updates & Smart Scheduling**
* 🔐 **Secure Authentication (JWT + Role-based access)**

---

## 🏗️ Tech Stack

**Frontend**

* HTML, CSS, JavaScript

**Backend**

* Node.js, Express.js

**Database**

* MongoDB

**Other Tools**

* Socket.io (Real-time updates)
* Twilio (SMS Notifications)
* Firebase (Push Notifications)

---

## 📁 Project Structure

```
clinic-system/
├── backend/        # Node.js + Express API
├── frontend/       # HTML, CSS, JS
```

---

## ⚙️ Setup Instructions

### 1️⃣ Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Server runs at:
👉 http://localhost:5000

---

### 2️⃣ Frontend Setup

```bash
npx serve frontend
```

Frontend runs at:
👉 http://localhost:3000

---

## 🔌 Core Functionalities

### 👤 Authentication

* Register / Login
* JWT-based user sessions

### 📅 Appointments

* Book / Cancel appointments
* View history

### 📊 Queue System

* Live queue updates
* Patient position tracking

### 🛠️ Admin Panel

* Analytics dashboard
* Manage doctors & slots
* Emergency patient handling

---

## 🔴 Real-Time System

* Uses **Socket.io**
* Live updates without refresh
* Fallback polling system

---

## 🔒 Security

* Password hashing (bcrypt)
* JWT authentication
* Role-based authorization
* Rate limiting & validation

---

## 🚀 Deployment

* Backend → Render 
* Frontend → Vercel
* Database → MongoDB Atlas

---

## 💡 Future Enhancements

* 💳 Online Payments (Stripe/Razorpay)
* 🌐 Multi-language Support
* 📱 Mobile App Integration
* 🤖 AI-based Wait Time Prediction

---

---

## 🎓 Technical Deep-Dive (Presentation Notes)

The sections below explain in detail how each major feature works —
from the browser all the way down to the database.

---

### 🔑 Login Page — How the JWT Token Works

#### What is a JWT?

A **JSON Web Token (JWT)** is a compact, URL-safe string that looks like:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9   ← Header  (algorithm + type)
.eyJ1c2VySWQiOiI2NjUuLi4iLCJpYXQiOjE3...  ← Payload (userId, iat, exp)
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQ   ← Signature (HMAC-SHA256)
```

The **payload** carries `{ userId, iat (issued-at), exp (expiry) }`.  
The **signature** is created with `JWT_SECRET` (server-only), so no one can tamper with it.

#### Step-by-step Login Flow

```
Browser (index.html)                Backend (routes/auth.js)          MongoDB
──────────────────────              ─────────────────────────         ───────
1. User fills email + password
2. POST /api/auth/login ────────────▶ Validate input fields
                                     Find user by email
                                     .select('+password')  ─────────▶ users collection
                                     bcrypt.compare(plain, hash) ◀── password hash
                                     Generate JWT:
                                       jwt.sign({userId}, SECRET, {expiresIn:'7d'})
3. ◀──────── { token, user } ───────  Save lastLogin timestamp ─────▶ users collection
4. Auth.setToken(token)   → localStorage.setItem('clinic_token', token)
   Auth.setUser(user)     → localStorage.setItem('clinic_user', JSON.stringify(user))
5. Redirect based on role:
     admin  → /admin.html
     doctor → /doctor-dashboard.html
     patient → /dashboard.html
```

#### How the Token is Used on Subsequent Requests

Every protected page sends the saved token in the HTTP header:

```
Authorization: Bearer eyJhbGci...
```

The `auth` middleware (`backend/middleware/auth.js`) runs on every protected route:

```
1. Read token from Authorization header
2. jwt.verify(token, JWT_SECRET)  → decodes { userId } OR throws if expired/tampered
3. User.findById(userId)          → fetch full user from MongoDB
4. Attach user to req.user        → route handler uses req.user.role, req.user._id …
```

#### Why JWT instead of Sessions?

| Feature | JWT (stateless) | Server Session |
|---|---|---|
| Server storage | ❌ Not needed | ✅ Store in Redis/DB |
| Scalability | ✅ Any server node can verify | ❌ Sticky sessions needed |
| Expiry | ✅ Built into token | ❌ Manual cleanup |
| Mobile / API ready | ✅ Send in header | ❌ Cookie-based |

---

### 👨‍⚕️ Doctor Dashboard — Token, Absent Marks & Call Next

#### How a Patient Gets a Token Number

When a patient books an appointment (`POST /api/appointments/book-slot`):

```
1. Check the slot is still free (atomic findOneAndUpdate prevents double-booking).
2. Query Appointments for the highest tokenNumber for that doctor + date:
     const lastAppt = await Appointment.findOne({ doctorId, date })
                        .sort({ tokenNumber: -1 });
     const tokenNumber = (lastAppt?.tokenNumber || 0) + 1;
   → First patient gets token #1, second gets #2, etc.
3. Save the Appointment document with that tokenNumber.
4. Emit Socket.io event → doctor's dashboard refreshes in real time.
```

Each appointment stored in MongoDB looks like:

```json
{
  "_id": "665abc...",
  "userId": "665def...",     // reference to the patient User
  "doctorId": "665ghi...",   // reference to the Doctor profile
  "date": "2025-01-15",
  "slotTime": "10:00",
  "tokenNumber": 3,          // ← queue position for the day
  "status": "booked",        // booked | in-progress | completed | missed | cancelled
  "symptoms": "Fever",
  "estimatedWaitMinutes": 30
}
```

#### Doctor Dashboard Queue Flow

```
Doctor clicks "▶ Start" → PUT /api/appointments/:id/update-status { status: "in-progress" }
  │
  ├── appointment.checkedInAt = new Date()           (save to MongoDB)
  ├── Doctor.currentTokenServing = tokenNumber       (save to MongoDB)
  ├── Notify next-in-queue patient via push/SMS
  └── io.emit("queue-updated") → all browsers refresh live

Doctor clicks "✅ Mark Completed" → status: "completed"
  │
  ├── appointment.completedAt = new Date()           (save to MongoDB)
  └── io.emit("queue-updated")

Doctor clicks "⏭ Mark Absent" → status: "missed"
  │
  ├── Patient did not arrive — appointment marked as missed in MongoDB
  └── io.emit("queue-updated") → queue board reflects the skip
```

Visual state machine:

```
  booked ──▶ Start ──▶ in-progress ──▶ Completed ──▶ completed
                              │
                              └──▶ Absent ──▶ missed
```

#### "Call Next Patient" Button

```javascript
// doctor-dashboard.html → callNext()
// 1. Query for the next 'booked' appointment sorted by tokenNumber
const data = await API.get(`/admin/appointments?doctorId=${doctorId}&date=${date}&status=booked&limit=1`);
const next  = data.appointments?.[0];
// 2. Move it to in-progress (same update-status endpoint)
await updateStatus(next._id, 'in-progress');
```

---

### 🗄️ Database Design — Why MongoDB?

#### Collections (Tables)

| Collection | Purpose |
|---|---|
| `users` | Stores patients, doctors, admins. Password hashed with bcrypt. |
| `doctors` | Doctor profile: specialization, working hours, slot duration, etc. Linked to `users` via `userId`. |
| `appointments` | One document per booking. Holds tokenNumber, status, slotTime, symptoms, notes. |
| `slots` | Pre-generated time slots for each doctor per day. Atomic `isBooked` flag prevents double booking. |

#### Relationships (References, not Joins)

```
users  ──(userId)──▶  doctors
users  ──(userId)──▶  appointments
doctors ──(doctorId)─▶ appointments
slots  ──(slotId)───▶  appointments
```

MongoDB uses **ObjectId references** (similar to foreign keys in SQL) and
the `populate()` method to resolve them in queries.

#### Why MongoDB over SQL (e.g., MySQL / PostgreSQL)?

| Reason | Explanation |
|---|---|
| **Flexible schema** | Appointment fields (symptoms, notes, qrCode) can be null or absent without migration. Adding a new field to appointments does not require ALTER TABLE. |
| **JSON-native** | Node.js works with JavaScript objects. MongoDB stores BSON (Binary JSON), so there is no object-relational mapping friction. |
| **Horizontal scaling** | MongoDB Atlas supports sharding for high patient volumes. |
| **Rich query API** | `$in`, `$gt`, `$sort`, `countDocuments()` cover all clinic query patterns without raw SQL. |
| **Aggregation pipeline** | Admin analytics (daily/weekly stats) use MongoDB's built-in aggregation — no extra analytics DB needed. |
| **Hosted Atlas** | Free-tier cluster on MongoDB Atlas with automatic backups, zero infrastructure management. |
| **Mongoose ODM** | Schema validation, middleware hooks (pre-save password hashing), and virtuals — without losing schema flexibility. |

#### Indexes for Performance

The Appointment model defines compound indexes so queries stay fast even
with thousands of records:

```javascript
appointmentSchema.index({ date: 1, doctorId: 1 });       // load queue for a day
appointmentSchema.index({ userId: 1, date: 1 });          // patient's appointment history
appointmentSchema.index({ status: 1, date: 1 });          // filter by status
appointmentSchema.index({ tokenNumber: 1, date: 1, doctorId: 1 }); // token lookup
```

---

### 🔄 Real-Time Updates (Socket.io)

Every status change emits an event to a date-specific room:

```javascript
io.to(`queue-${appointment.date}`).emit('queue-updated', { doctorId, date, type, tokenNumber, status });
```

The doctor's dashboard and the patient queue board both join this room on load
and call `loadQueue()` whenever an event arrives — giving live, push-based
updates without polling.

---

## 📌 Conclusion

This project demonstrates a **real-world scalable healthcare solution** with modern technologies, focusing on **efficiency, automation, and user experience**.

---

⭐ *If you like this project, consider giving it a star!*
