/**
 * Firebase Push Notification Client
 * Handles permission requests, FCM token registration, and foreground notifications
 */

// ⚠️ Replace with your Firebase web config from Firebase Console
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDiLME602tfHakACW2u1RKxPvu57KgOLIs",
  authDomain: "clinic-34504.firebaseapp.com",
  projectId: "clinic-34504",
  storageBucket: "clinic-34504.firebasestorage.app",
  messagingSenderId: "205865028471",
  appId: "1:205865028471:web:a3a7c06284a498f7342f72",
  measurementId: "G-GXSZV8TT17"
};

let firebaseMessaging = null;

/**
 * Initialize Firebase and request notification permission
 */
async function initFirebaseMessaging() {
  // Only run if user is logged in
  if (!Auth.isLoggedIn()) return;

  // Check browser support
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported in this browser.');
    return;
  }

  try {
    // Dynamically load Firebase SDK
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

    // Initialize Firebase
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    firebaseMessaging = firebase.messaging();

    // Register the service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ Service Worker registered');

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied.');
      return;
    }

    // Get FCM token
    const fcmToken = await firebaseMessaging.getToken({
      vapidKey: 'BJxU8LZKwXfKUX9SLt-39FqreHqEZYX438fFbx_Bi-oBaTV7kZN85_yro7d6hOlE_ceY73aTrMDggbFuV8_Yuro',
      serviceWorkerRegistration: registration,
    });

    if (fcmToken) {
      console.log('✅ FCM Token obtained');
      // Send token to backend
      await sendFCMTokenToBackend(fcmToken);
    }

    // Handle foreground messages (when app is open)
    firebaseMessaging.onMessage((payload) => {
      console.log('📩 Foreground message:', payload);
      const title = payload.notification?.title || 'Smart Clinic';
      const body = payload.notification?.body || 'New notification';
      showToast(`${title}: ${body}`, 'info');

      // Also show a browser notification
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body: body,
          icon: '/assets/icon-192.png',
        });
      }
    });

  } catch (err) {
    console.error('Firebase messaging init error:', err);
  }
}

/**
 * Send FCM token to backend to save on user profile
 */
async function sendFCMTokenToBackend(token) {
  try {
    await API.put('/auth/update-fcm-token', { fcmToken: token });
    console.log('✅ FCM token saved to backend');
  } catch (err) {
    console.error('Failed to save FCM token:', err);
  }
}

/**
 * Helper: dynamically load a script
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    // Skip if already loaded
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Auto-initialize when the page loads (on any authenticated page)
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to let the page load first
  setTimeout(initFirebaseMessaging, 2000);
});
