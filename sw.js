importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBcoYOQDqx9Coj5cbJfhbUMMPd-Qy0T06I",
  authDomain: "fischbroetchen-65239.firebaseapp.com",
  projectId: "fischbroetchen-65239",
  storageBucket: "fischbroetchen-65239.firebasestorage.app",
  messagingSenderId: "179788959848",
  appId: "1:179788959848:web:8ac9f3d25eaaf6e3e82bdd"
});

const messaging = firebase.messaging();

// Wenn die Push-Nachricht im Hintergrund / bei gesperrtem Bildschirm ankommt
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title || "Fridays for Fischbrötchen";
  const notificationOptions = {
    body: payload.notification.body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
