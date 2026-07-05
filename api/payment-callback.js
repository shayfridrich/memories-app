// api/payment-callback.js
// Vercel Serverless Function — מקבלת Webhook מ-Invoice4U (CallBackUrl) לאחר ניסיון תשלום, אם וכאשר הוא מגיע.
// ומעדכנת את ההזמנה המתאימה ב-Firestore.
//
// ⚠️ הערה חשובה מהבדיקות שביצענו: בסביבת הטסטים (QA) של Invoice4U, ה-Webhook הזה
// לא הגיע בפועל תוך זמן סביר בבדיקה שערכנו. לכן אין להסתמך על הקובץ הזה בלבד -
// יש גם מנגנון אימות אקטיבי מקביל בקובץ check-payment-status.js שהלקוח מפעיל
// כשהוא חוזר מדף התשלום. ייתכן שב-production ה-Webhook יתפקד באופן אמין יותר -
// כדאי לבדוק זאת מחדש כשעוברים לשם.
//
// משתני סביבה נדרשים ב-Vercel:
//   FIREBASE_SERVICE_ACCOUNT_KEY - תוכן קובץ ה-JSON של Firebase Service Account (כמחרוזת אחת)

import { db, FieldValue } from "./_firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    // תיעוד מלא של כל מה שהתקבל - חיוני לצורך אבחון בפעם הראשונה שמתקבל webhook אמיתי
    console.log("=== Invoice4U payment callback received ===");
    console.log(JSON.stringify(req.body));

    const body = req.body || {};

    const orderId =
      body.OrderIdClientUsage ||
      body.orderIdClientUsage ||
      body.OrderId ||
      body?.d?.OrderIdClientUsage;

    const rawSuccess =
      body.IsSuccess ?? body.Success ?? body.isSuccess ?? body?.d?.IsSuccess;
    const isSuccess = rawSuccess === true || rawSuccess === "true";

    if (!orderId) {
      console.error("לא נמצא מזהה הזמנה בתוך ה-callback - יש לבדוק את מבנה הנתונים בלוג למעלה");
      return res.status(400).json({ error: "Missing order id", received: body });
    }

    const ordersRef = db.collection("orders");
    const snapshot = await ordersRef.where("orderId", "==", orderId).limit(1).get();

    if (snapshot.empty) {
      console.error("לא נמצאה הזמנה תואמת ל-orderId:", orderId);
      return res.status(404).json({ error: "Order not found" });
    }

    const doc = snapshot.docs[0];
    await doc.ref.update({
      paymentStatus: isSuccess ? "שולם" : "נכשל",
      paymentCallbackRaw: body,
      paymentUpdatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`הזמנה ${orderId} עודכנה לסטטוס: ${isSuccess ? "שולם" : "נכשל"}`);

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("payment-callback error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
