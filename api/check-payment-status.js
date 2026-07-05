// api/check-payment-status.js
// Vercel Serverless Function — בדיקה אקטיבית של סטטוס תשלום מול Invoice4U
//
// למה זה קיים: גילינו ש-Cardcom/Invoice4U לא שולחים Webhook (CallBackUrl) באופן אמין
// בסביבת הטסטים, וגם "דורסים" את פרמטרי ה-ReturnUrl שלנו. לכן, כשהלקוח חוזר מהתשלום,
// האתר קורא לפונקציה הזו עם ה-lowProfileCode שכן חוזר תמיד בתוך פרמטרי הדף, ומאתרים
// לפי זה את ההזמנה שנשמרה מראש ב-Firestore (ב-create-payment.js), ואז שואלים את
// Invoice4U ישירות האם התשלום הצליח.
//
// משתני סביבה נדרשים:
//   INVOICE4U_API_KEY, INVOICE4U_API_BASE, FIREBASE_SERVICE_ACCOUNT_KEY (כמו create-payment.js)

const { db, FieldValue } = require("./_firebaseAdmin.js");

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const lowProfileCode = req.method === "GET" ? req.query.lowProfileCode : req.body?.lowProfileCode;

    if (!lowProfileCode) {
      return res.status(400).json({ error: "חסר lowProfileCode" });
    }

    const ordersRef = db.collection("orders");
    const snapshot = await ordersRef.where("lowProfileCode", "==", lowProfileCode).limit(1).get();

    if (snapshot.empty) {
      console.error("לא נמצאה הזמנה עם lowProfileCode:", lowProfileCode);
      return res.status(404).json({ error: "הזמנה לא נמצאה" });
    }

    const doc = snapshot.docs[0];
    const order = doc.data();

    if (!order.clearingLogId) {
      return res.status(400).json({ error: "להזמנה זו אין מזהה סליקה שמור" });
    }

    const apiBase = process.env.INVOICE4U_API_BASE || "https://apiqa.invoice4u.co.il/Services/ApiService.svc";
    const token = process.env.INVOICE4U_API_KEY;

    const response = await fetch(`${apiBase}/GetClearingLogById`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clearingLogId: String(order.clearingLogId),
        token: token,
      }),
    });

    const data = await response.json();
    const log = data?.d;

    if (!log) {
      console.error("תשובה לא תקינה מ-GetClearingLogById:", JSON.stringify(data));
      return res.status(502).json({ error: "לא ניתן היה לאמת את התשלום מול הספק" });
    }

    const isSuccess = log.IsSuccess === true;

    await doc.ref.update({
      paymentStatus: isSuccess ? "שולם" : "נכשל",
      paymentVerifiedAt: FieldValue.serverTimestamp(),
      paymentVerificationRaw: log,
    });

    return res.status(200).json({
      success: isSuccess,
      orderId: order.orderId,
      firstName: order.firstName || null,
      packageName: order.package || null,
      packagePrice: order.packagePrice || null,
    });
  } catch (err) {
    console.error("check-payment-status error:", err);
    return res.status(500).json({ error: "שגיאת שרת באימות תשלום" });
  }
};
