const fs = require('fs');
const admin = require('firebase-admin');

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("FEHLER: Secret FIREBASE_SERVICE_ACCOUNT fehlt in den GitHub Actions Secrets!");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

function getTomorrowString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

async function run() {
  const tomorrow = getTomorrowString();
  console.log(`Morgiger Freitag: ${tomorrow}`);

  // 1. Termin prüfen
  const terminDoc = await db.collection('einstellungen').doc('termin').get();
  const savedDate = terminDoc.exists ? terminDoc.data().datum : null;
  console.log(`In Firebase gespeicherter Termin: ${savedDate}`);

  // Erlaube Ausführung, wenn Termin morgen ist ODER wenn manuell per Knopfdruck getestet wird
  const isTomorrow = (savedDate === tomorrow);
  const isManualRun = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';

  if (!isTomorrow && !isManualRun) {
    console.log("Kein Fisch-Freitag für morgen hinterlegt. Vorgang wird beendet.");
    return;
  }

  // Signal an GitHub Actions für Mail-Schritt geben
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, "shop_active=true\n");
  }

  // 2. Aktive Besteller ermitteln
  const ordersSnap = await db.collection('bestellungen').get();
  const activeUsers = new Set();

  ordersSnap.forEach(doc => {
    const data = doc.data();
    if (!data.archiviert && data.besteller) {
      activeUsers.add(data.besteller.trim().toLowerCase());
    }
  });

  console.log(`Bereits bestellt haben (${activeUsers.size} Personen):`, Array.from(activeUsers));

  // 3. Registrierte Push-Geräte filtern
  const tokensSnap = await db.collection('push_tokens').get();
  const recipientTokens = [];

  tokensSnap.forEach(doc => {
    const data = doc.data();
    const token = data.token;
    const name = (data.besteller || "").trim().toLowerCase();

    if (!token) return;

    if (activeUsers.has(name)) {
      console.log(`⏭️ Überspringe: ${data.besteller} (hat bereits bestellt)`);
    } else {
      console.log(`🔔 Empfänger ermittelt: ${data.besteller || 'Gerät ohne Namen'}`);
      recipientTokens.push(token);
    }
  });

  if (recipientTokens.length === 0) {
    console.log("Keine offenen Empfänger gefunden. Alle haben bestellt oder keine Tokens vorhanden.");
    return;
  }

  // 4. Gezielten Push absenden
  console.log(`Sende Push an ${recipientTokens.length} Gerät(e)...`);
  const message = {
    notification: {
      title: "🔔 Letzte Chance: Fischbrötchen!",
      body: "In 60 Minuten (12:00 Uhr) schließt das Bestellfenster. Jetzt noch schnell bestellen!"
    },
    tokens: recipientTokens
  };

  const response = await admin.messaging().sendEachForMulticast(message);
  console.log(`Ergebnis: ${response.successCount} erfolgreich, ${response.failureCount} fehlgeschlagen.`);
}

run().catch(err => {
  console.error("Ausführungsfehler:", err);
  process.exit(1);
});
