const admin = require('firebase-admin');

// Service Account aus dem GitHub Secret laden
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  console.log("Starte Abgleich für Push-Benachrichtigungen...");

  // 1. Alle aktiven (nicht archivierten) Bestellungen laden
  const ordersSnap = await db.collection('bestellungen').get();
  const activeOrderUsers = new Set();

  ordersSnap.forEach(doc => {
    const data = doc.data();
    if (!data.archiviert && data.besteller) {
      activeOrderUsers.add(data.besteller.trim().toLowerCase());
    }
  });

  console.log(`Bereits bestellt haben (${activeOrderUsers.size} Personen):`, Array.from(activeOrderUsers));

  // 2. Alle registrierten Push-Geräte laden
  const tokensSnap = await db.collection('push_tokens').get();
  const recipientTokens = [];

  tokensSnap.forEach(doc => {
    const data = doc.data();
    const token = data.token;
    const besteller = (data.besteller || "").trim().toLowerCase();

    if (!token) return;

    // Filter: Hat der Kollege für dieses Gerät schon bestellt?
    if (activeOrderUsers.has(besteller)) {
      console.log(`⏭️ Überspringe Push für ${data.besteller} (Bereits bestellt).`);
    } else {
      console.log(`🔔 Vormerken für Push: ${data.besteller || 'Unbekanntes Gerät'}`);
      recipientTokens.push(token);
    }
  });

  if (recipientTokens.length === 0) {
    console.log("Niemand zum Erinnern übrig! Entweder haben alle bestellt oder es sind keine Geräte offen.");
    return;
  }

  // 3. Gezielten Push an die Trödler senden
  console.log(`Sende Schlussglocke an ${recipientTokens.length} Gerät(e)...`);

  const message = {
    notification: {
      title: "🔔 Letzte Chance: Fischbrötchen!",
      body: "In 60 Minuten (12:00 Uhr) schließt das Bestellfenster. Jetzt noch schnell bestellen!"
    },
    tokens: recipientTokens
  };

  const response = await admin.messaging().sendEachForMulticast(message);
  console.log(`Erfolgreich gesendet: ${response.successCount}, Fehler: ${response.failureCount}`);
}

run().catch(err => {
  console.error("Fehler beim Push-Versand:", err);
  process.exit(1);
});
