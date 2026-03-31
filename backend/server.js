const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
const queueRoutes = require('./routes/queue');
const adminRoutes = require('./routes/admin');
const doctorRoutes = require('./routes/doctors');
const slotRoutes = require('./routes/slots');

const app = express();
const server = http.createServer(app);

const frontendPath = path.join(__dirname, '../frontend');

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Make io accessible to routes
app.set('io', io);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
});

// Middleware — CORS must allow any origin for local dev (frontend may be on different port)
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger for debugging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`HTTP  ${new Date().toLocaleString()} ${req.ip} ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Rate limit only API routes
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes — these MUST come before static file serving and catch-all
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/slots', slotRoutes);

// Serve static files from frontend AFTER API routes
app.use(express.static(frontendPath));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join-queue-room', (date) => {
    socket.join(`queue-${date}`);
  });

  socket.on('join-doctor-room', (doctorId) => {
    socket.join(`doctor-${doctorId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Serve frontend for any non-API GET request (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 404 handler — for non-GET or unmatched API routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler (must have 4 params to be recognized as error handler)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic_db')
  .then(() => {
    console.log('✅ Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Open http://localhost:${PORT} in your browser`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    // Start the server anyway so the user can see the frontend
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} (WITHOUT MongoDB)`);
    });
  });

module.exports = { app, io };
