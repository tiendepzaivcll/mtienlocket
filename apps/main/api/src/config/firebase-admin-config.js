const admin = require("firebase-admin");

// Khởi tạo Firebase Admin (Bắt buộc phải có trong .env)
let db = null;

try {
  if (!admin.apps.length) {
    const config = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"), 
    };

    // Validate environment variables
    if (!config.projectId || !config.clientEmail || !config.privateKey) {
      console.error(
        "❌ Missing Firebase credentials. Check environment variables:"
      );
      console.error("- FIREBASE_PROJECT_ID:", !!config.projectId);
      console.error("- FIREBASE_CLIENT_EMAIL:", !!config.clientEmail);
      console.error("- FIREBASE_PRIVATE_KEY:", !!config.privateKey);
      throw new Error("Missing Firebase configuration in environment variables");
    }

    admin.initializeApp({
      credential: admin.credential.cert(config),
    });

    db = admin.firestore();
    console.log("✅ Firebase Admin initialized successfully");
  } else {
    db = admin.firestore();
  }
} catch (error) {
  console.error("❌ Firebase initialization error:", error.message);
  // Don't re-throw - allow app to start anyway
  // VIP check will fail gracefully if db is null
}

module.exports = { admin, db };
