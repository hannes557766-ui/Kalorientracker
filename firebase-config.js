// ====================== FIREBASE CONFIGURATION ======================
// Diese Datei enthält die Firebase-Konfiguration und Initialisierung
// Firebase ist OPTIONAL – die App funktioniert auch offline mit localStorage

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDY2pI1Mg03uGi_N9Oa1ns7CdX2TSwmX5U",
  authDomain: "kalorientracker-4faa8.firebaseapp.com",
  databaseURL: "https://kalorientracker-4faa8-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "kalorientracker-4faa8",
  storageBucket: "kalorientracker-4faa8.firebasestorage.app",
  messagingSenderId: "377409729605",
  appId: "1:377409729605:web:2a9b4b6245166d69599f2c",
  measurementId: "G-5HX8L42DKF"
};

// Globale Firebase-Instanzen (werden async initialisiert)
let firebaseApp = null;
let database = null;
let analytics = null;
let firebaseReady = false;
let firebaseEnabled = false; // Kann manuell deaktiviert werden

/**
 * Firebase asynchron laden und initialisieren
 * Fehler werden geloggt, aber nicht geworfen – App läuft weiter offline
 */
async function initializeFirebase() {
  try {
    // Prüfe ob Firebase bereits initialisiert
    if (firebaseReady) return true;

    // Dynamisch Firebase SDK laden (falls nicht bereits im HTML)
    if (typeof firebase === 'undefined' && !window.__firebaseModules) {
      console.log('Firebase SDK lädt...');
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    // Firebase App initialisieren
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
      firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
      console.log('Firebase App initialisiert ✓');
    } else if (window.__firebaseModules) {
      console.log('Firebase-Module direkt verfügbar');
    }

    firebaseReady = true;
    firebaseEnabled = true;
    return true;
  } catch (error) {
    console.warn('Firebase Initialisierung fehlgeschlagen (App läuft offline weiter):', error.message);
    firebaseReady = true;
    firebaseEnabled = false;
    return false;
  }
}

/**
 * Firebase Realtime Database Zugriff
 * Lazy-Loading bei Bedarf
 */
async function getFirebaseDatabase() {
  if (!firebaseReady) {
    await initializeFirebase();
  }

  if (!firebaseEnabled || !window.firebase) {
    console.warn('Firebase nicht verfügbar');
    return null;
  }

  if (!database && typeof firebase !== 'undefined') {
    try {
      database = firebase.database();
      console.log('Firebase Database verbunden ✓');
    } catch (error) {
      console.warn('Firebase Database Verbindung fehlgeschlagen:', error.message);
      firebaseEnabled = false;
      return null;
    }
  }

  return database;
}

/**
 * Firebase Analytics Zugriff
 * Optional für Tracking
 */
async function getFirebaseAnalytics() {
  if (!firebaseReady) {
    await initializeFirebase();
  }

  if (!firebaseEnabled || !window.firebase) {
    return null;
  }

  if (!analytics && typeof firebase !== 'undefined' && firebase.analytics) {
    try {
      analytics = firebase.analytics();
      console.log('Firebase Analytics aktiviert ✓');
    } catch (error) {
      console.warn('Firebase Analytics fehlgeschlagen:', error.message);
      return null;
    }
  }

  return analytics;
}

/**
 * Prüfe Internetverbindung
 */
function isOnline() {
  return navigator.onLine;
}

/**
 * Höre auf Verbindungsänderungen
 */
window.addEventListener('online', () => {
  console.log('Internet wiederhergestellt - starte Sync...');
  if (firebaseEnabled) {
    syncToFirebase();
  }
});

window.addEventListener('offline', () => {
  console.log('Internet unterbrochen - arbeite offline weiter');
});

// Auto-Initialisierung starten (nicht blockierend)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => initializeFirebase(), 100);
  });
} else {
  setTimeout(() => initializeFirebase(), 100);
}
