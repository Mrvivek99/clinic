// Firebase Cloud Messaging Service Worker
// This runs in the background and shows push notifications even when the app is closed

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ⚠️ Replace with your Firebase web config
firebase.initializeApp({
  apiKey: "AIzaSyDiLME602tfHakACW2u1RKxPvu57KgOLIs",
  authDomain: "clinic-34504.firebaseapp.com",
  projectId: "clinic-34504",
  storageBucket: "clinic-34504.firebasestorage.app",
  messagingSenderId: "205865028471",
  appId: "1:205865028471:web:a3a7c06284a498f7342f72",
  measurementId: "G-GXSZV8TT17"
});

const messaging = firebase.messaging();

// Handle background messages (when app is not in focus)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const title = payload.notification?.title || 'Smart Clinic';
  const options = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    data: payload.data,
    actions: [
      { action: 'open', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  self.registration.showNotification(title, options);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Open the app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/dashboard.html');
    })
  );
});
