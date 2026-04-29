const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * JWT Authentication Middleware
 * ─────────────────────────────
 * Every protected route (appointments, queue, doctor dashboard, etc.)
 * runs this middleware BEFORE the route handler.
 *
 * Flow:
 *  1. Extract the token from the "Authorization: Bearer <token>" header.
 *  2. Verify the token signature using JWT_SECRET (set in .env).
 *     - jwt.verify() also checks the expiry claim (exp) embedded in the token.
 *  3. Decode the payload to get { userId }.
 *  4. Look up the user in MongoDB by that userId.
 *  5. Attach the user document to req.user so route handlers can use it.
 *
 * Why JWT?
 *  - Stateless: the server does NOT need to store session data in the DB.
 *  - The token itself carries the userId and an expiry timestamp, signed
 *    with a secret so it cannot be tampered with.
 *  - Any service (or microservice) that knows JWT_SECRET can verify it.
 */
const auth = async (req, res, next) => {
  try {
    // Step 1 – Read the raw token from the Authorization header.
    //   Frontend sends: Authorization: Bearer eyJhbGci...
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token, authorization denied.' });

    // Step 2 – Verify & decode the token.
    //   jwt.verify() throws if the signature is wrong OR if the token has expired.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Step 3 – Load the user from MongoDB using the userId embedded in the token.
    //   The password field is excluded (-password) so it never leaks to route handlers.
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) return res.status(401).json({ error: 'User not found.' });
    if (!user.isActive) return res.status(401).json({ error: 'Account is deactivated.' });

    // Step 4 – Attach the Mongoose user document to the request object.
    //   Subsequent middleware and route handlers access it via req.user.
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

/**
 * Role-Based Authorization Middleware Factory
 * ────────────────────────────────────────────
 * Usage: requireRole('admin', 'doctor')
 *
 * Returns a middleware that ensures req.user.role is one of the
 * allowed roles. Must be used AFTER the `auth` middleware so that
 * req.user is already populated.
 *
 * Roles in this system:
 *  - patient : can book / cancel their own appointments
 *  - doctor  : can view their queue, mark statuses (in-progress / completed / missed)
 *  - admin   : full access to all routes including analytics and user management
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    console.log(`🛡️  Role Check: Need [${roles.join(', ')}] - User has [${req.user?.role || 'NONE'}]`);
    
    if (!req.user || !req.user.role) {
      console.error('💥 AUTH CRASH: req.user or role is missing!');
      return res.status(401).json({ error: 'Authentication data missing.' });
    }

    if (!roles.includes(req.user.role)) {
      console.warn(`⛔ Access Denied: User ${req.user.email} is ${req.user.role}, not ${roles.join(' or ')}`);
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
};

module.exports = { auth, requireRole };
