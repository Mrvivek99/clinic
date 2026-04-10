require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
const queueRoutes = require('./routes/queue');
const adminRoutes = require('./routes/admin');
const doctorRoutes = require('./routes/doctors');
const slotRoutes = require('./routes/slots');

// Import scheduler
const { initScheduler } = require('./utils/scheduler');

const app = express();
const server = http.createServer(app);

const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  },
});

// Make io accessible to routes
app.set('io', io);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});

// Middleware
app.use(cors({
  origin: true, // Allow all origins (Vercel frontend -> Render backend)
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// System Status Check (Temporary for verification)
app.get('/api/status', (req, res) => {
  const { twilioClient, firebaseAdmin } = require('./utils/notifications');
  res.json({
    twilio: !!twilioClient ? '✅ Connected' : '❌ Not Configured',
    firebase: !!firebaseAdmin ? '✅ Connected' : '❌ Not Configured',
    env: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/slots', slotRoutes);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Join a specific date room
  socket.on('join-queue', ({ doctorId, date }) => {
    socket.join(`queue-${date}`);
    if (doctorId) socket.join(`doctor-${doctorId}`);
    console.log(`Socket ${socket.id} joined rooms: queue-${date}, doctor-${doctorId}`);
  });

  socket.on('join-queue-room', (date) => {
    socket.join(`queue-${date}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('💥 GLOBAL ERROR:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || '💥 GLOBAL SERVER ERROR 💥',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Serve frontend for any non-API GET request
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/health')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic_db')
  .then(() => {
    console.log('✅ Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      // Initialize cron scheduler for reminders
      initScheduler(io);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = { app, io };
