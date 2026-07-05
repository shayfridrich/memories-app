// api/_firebaseAdmin.js
// מודול משותף - מאתחל את Firebase Admin פעם אחת ומספק גישה ל-Firestore
// לכל שאר קבצי ה-api (מונע אתחול כפול בכל פונקציה בנפרד)
//
// נכתב ב-CommonJS (require/module.exports) בכוונה, כי הפרויקט הוא Create React App
// רגיל בלי "type": "module" ב-package.json - כך שהפונקציות של Vercel רצות כ-CommonJS.

const admin = require("firebase-admin");

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e) {
    console.error("שגיאה באתחול Firebase Admin:", e);
  }
}

module.exports = {
  db: admin.firestore(),
  FieldValue: admin.firestore.FieldValue,
};
