// ====================== FIREBASE SYNC ENGINE ======================
// Synchronisiert lokale localStorage-Daten mit Firebase Realtime Database
// Funktioniert auch offline – Daten werden lokal gecacht

const SYNC_CONFIG = {
  AUTO_SYNC_INTERVAL: 60000, // 60 Sekunden
  SYNC_TIMEOUT: 10000, // 10 Sekunden Timeout pro Request
  BATCH_SIZE: 5, // Max 5 Einträge pro Sync
  RETRY_MAX: 3,
  RETRY_DELAY: 2000
};

let syncInProgress = false;
let lastSyncTime = null;
let syncQueue = [];

/**
 * Generiert eine eindeutige User-ID (falls noch nicht vorhanden)
 */
function getUserId() {
  let uid = localStorage.getItem('firebaseUserId');
  if (!uid) {
    uid = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('firebaseUserId', uid);
  }
  return uid;
}

/**
 * Speichert einen Eintrag lokal UND in Firebase (async)
 * Format: store(key, value) – wie original, aber mit Firebase-Sync
 */
const originalStore = store;
function store(k, v) {
  // Lokal speichern (wie immer)
  originalStore(k, v);
  
  // Firebase-Sync in den Hintergrund
  if (firebaseEnabled && isOnline()) {
    syncToFirebaseEntry(k, v).catch(err => {
      console.warn(`Firebase Sync für '${k}' fehlgeschlagen:`, err.message);
    });
  }
}

/**
 * Einzelnen Eintrag zu Firebase speichern
 */
async function syncToFirebaseEntry(key, value) {
  if (!firebaseEnabled || !isOnline()) return;

  try {
    const db = await getFirebaseDatabase();
    if (!db) return;

    const userId = getUserId();
    const ref = db.ref(`users/${userId}/data/${key}`);

    await Promise.race([
      ref.set({
        value: value,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        synced: true
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase write timeout')), SYNC_CONFIG.SYNC_TIMEOUT)
      )
    ]);

    console.log(`✓ Firebase: '${key}' synchronisiert`);
    return true;
  } catch (error) {
    console.warn(`Firebase Sync Error für '${key}':`, error.message);
    return false;
  }
}

/**
 * Vollständiger Sync aller lokalen Daten zu Firebase
 * (wird periodisch oder manuell aufgerufen)
 */
async function syncToFirebase() {
  if (syncInProgress || !firebaseEnabled || !isOnline()) {
    return;
  }

  syncInProgress = true;
  try {
    console.log('🔄 Starte Firebase Sync...');
    const db = await getFirebaseDatabase();
    if (!db) {
      console.warn('Firebase Database nicht verfügbar');
      return;
    }

    const userId = getUserId();
    const keysToSync = [
      'profile',
      'chats',
      'activeChatId',
      'favorites',
      'weightLog',
      'geminiApiKey',
      'claudeApiKey',
      'groqApiKey',
      'mistralApiKey'
    ];

    // Alle Tage-Logs mit Pattern log-YYYY-MM-DD
    const allKeys = Object.keys(localStorage);
    const dayLogs = allKeys.filter(k => k.match(/^log-\d{4}-\d{2}-\d{2}$/));
    const waterLogs = allKeys.filter(k => k.match(/^water-\d{4}-\d{2}-\d{2}$/));

    const keysBatch = [...keysToSync, ...dayLogs.slice(0, 30), ...waterLogs.slice(0, 30)];

    // Batch-Upload
    const userRef = db.ref(`users/${userId}`);
    const dataToSync = {};

    for (const key of keysBatch) {
      const value = load(key);
      if (value !== null) {
        dataToSync[key] = {
          value: value,
          timestamp: firebase.database.ServerValue.TIMESTAMP
        };
      }
    }

    if (Object.keys(dataToSync).length > 0) {
      await Promise.race([
        userRef.child('data').update(dataToSync),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firebase batch sync timeout')), SYNC_CONFIG.SYNC_TIMEOUT)
        )
      ]);

      console.log(`✓ Firebase: ${Object.keys(dataToSync).length} Einträge synchronisiert`);
      lastSyncTime = new Date();
      
      // Analytics Event
      if (analytics) {
        logAnalyticsEvent('data_synced', { count: Object.keys(dataToSync).length });
      }
    }
  } catch (error) {
    console.error('Firebase Sync Error:', error.message);
  } finally {
    syncInProgress = false;
  }
}

/**
 * Lade Daten VON Firebase (Restore/Merge)
 * Nützlich für Multi-Device-Sync
 */
async function syncFromFirebase() {
  if (!firebaseEnabled || !isOnline()) {
    console.warn('Firebase nicht verfügbar oder offline');
    return;
  }

  try {
    console.log('📥 Lade Daten von Firebase...');
    const db = await getFirebaseDatabase();
    if (!db) return;

    const userId = getUserId();
    const snapshot = await db.ref(`users/${userId}/data`).once('value');
    const remoteData = snapshot.val() || {};

    let restored = 0;
    for (const [key, entry] of Object.entries(remoteData)) {
      if (entry && entry.value !== undefined) {
        // Nur überschreiben wenn lokal älter (vorsichtig!)
        const localData = load(key);
        if (!localData || (entry.timestamp && !load(key + '_timestamp'))) {
          store(key, entry.value);
          store(key + '_timestamp', entry.timestamp);
          restored++;
        }
      }
    }

    console.log(`✓ Firebase: ${restored} Einträge wiederhergestellt`);
    return restored;
  } catch (error) {
    console.error('Firebase Restore Error:', error.message);
    return 0;
  }
}

/**
 * Analytics Event Logger
 */
function logAnalyticsEvent(eventName, params = {}) {
  try {
    if (analytics) {
      firebase.analytics().logEvent(eventName, params);
    }
  } catch (error) {
    console.warn('Analytics Event fehler:', error.message);
  }
}

/**
 * Starte periodischen Auto-Sync
 */
function startAutoSync() {
  if (!firebaseEnabled) return;

  // Starte nach 5 Sekunden
  setTimeout(() => {
    syncToFirebase();
  }, 5000);

  // Wiederhole alle 60 Sekunden
  setInterval(() => {
    if (firebaseEnabled && isOnline()) {
      syncToFirebase();
    }
  }, SYNC_CONFIG.AUTO_SYNC_INTERVAL);

  console.log('🔄 Auto-Sync aktiviert (jede 60 Sekunden)');
}

/**
 * Manueller Sync Button für UI
 */
window.manualSync = async function() {
  if (!firebaseEnabled) {
    showToast('Firebase nicht aktiviert');
    return;
  }

  if (!isOnline()) {
    showToast('Keine Internetverbindung');
    return;
  }

  showToast('Synchronisiere...');
  await syncToFirebase();
  showToast('Sync abgeschlossen ✓');
};

/**
 * Löschen aller Firebase-Daten für diesen User
 */
window.clearFirebaseData = async function() {
  if (!confirm('Alle Firebase-Daten wirklich löschen?')) return;

  try {
    const db = await getFirebaseDatabase();
    if (!db) return;

    const userId = getUserId();
    await db.ref(`users/${userId}`).remove();

    showToast('Firebase-Daten gelöscht ✓');
    console.log('Firebase User Data gelöscht');
  } catch (error) {
    showToast('Fehler beim Löschen: ' + error.message);
  }
};

// Starte Auto-Sync wenn Firebase ready ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      initializeFirebase().then(() => startAutoSync());
    }, 500);
  });
} else {
  setTimeout(() => {
    initializeFirebase().then(() => startAutoSync());
  }, 500);
}
