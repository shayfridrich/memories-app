// api/_firebaseAdmin.js
// מודול משותף - מאתחל את Firebase Admin פעם אחת ומספק גישה ל-Firestore.
//
// שימוש ב-API המודולרי החדש של firebase-admin (submodules נפרדים: "firebase-admin/app",
// "firebase-admin/firestore") במקום האובייקט הישן "require('firebase-admin')" כמכלול -
// זה הפתרון הרשמי המומלץ בגרסאות חדשות, ומונע בעיית "admin is undefined" שנתקלנו בה
// עם הגישה הישנה בסביבת Vercel.
//
// נכתב באופן "מוגן": אם משהו נכשל באתחול, לא קורס בטעינה - initError נשמר ונבדק
// בכל פונקציה שמשתמשת ב-db.

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

let db = null;
let initError = null;

try {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY לא מוגדר ב-Environment Variables");
    }
    const serviceAccount = JSON.parse(raw);
    initializeApp({ credential: cert(serviceAccount) });
  }
  db = getFirestore();
} catch (e) {
  console.error("שגיאה באתחול Firebase Admin:", e.message);
  initError = e.message;
}

module.exports = { db, initError, FieldValue };
