// API Configuration
// For production, use your actual Render URL
const PROD_URL = 'https://clinic-1-kl52.onrender.com';
const API_BASE = window.API_BASE || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `http://localhost:5000/api`
  : `${PROD_URL}/api`);

// Token management
const Auth = {
  getToken: () => localStorage.getItem('clinic_token'),
  setToken: (token) => localStorage.setItem('clinic_token', token),
  removeToken: () => localStorage.removeItem('clinic_token'),
  getUser: () => {
    const u = localStorage.getItem('clinic_user');
    return u ? JSON.parse(u) : null;
  },
  setUser: (user) => localStorage.setItem('clinic_user', JSON.stringify(user)),
  removeUser: () => localStorage.removeItem('clinic_user'),
  isLoggedIn: () => !!localStorage.getItem('clinic_token'),
  logout: () => {
    localStorage.removeItem('clinic_token');
    localStorage.removeItem('clinic_user');
    window.location.href = '/index.html';
  },
};

// HTTP client
const API = {
  async request(method, endpoint, body = null, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && Auth.getToken()) {
      headers['Authorization'] = `Bearer ${Auth.getToken()}`;
    }

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await res.json();

    if (res.status === 401) {
      Auth.logout();
      return;
    }

    if (!res.ok) throw { status: res.status, ...data };
    return data;
  },

  get: (endpoint, auth = true) => API.request('GET', endpoint, null, auth),
  post: (endpoint, body, auth = true) => API.request('POST', endpoint, body, auth),
  put: (endpoint, body, auth = true) => API.request('PUT', endpoint, body, auth),
  delete: (endpoint, auth = true) => API.request('DELETE', endpoint, null, auth),
};

// Toast notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function createToastContainer() {
  const el = document.createElement('div');
  el.id = 'toast-container';
  document.body.appendChild(el);
  return el;
}

// Format helpers
function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(t) {
  if (!t || t === 'EMERGENCY') return t;
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr > 12 ? hr - 12 : hr}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}
function timeAgo(date) {
  const diff = Date.now() - new Date(date);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// Guard: redirect if not logged in
function requireAuth() {
  if (!Auth.isLoggedIn()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

// Guard: redirect if already logged in
function redirectIfLoggedIn(dest = '/dashboard.html') {
  if (Auth.isLoggedIn()) window.location.href = dest;
}
