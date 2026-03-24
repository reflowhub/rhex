import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase Admin environment variables:', {
      hasProjectId: !!projectId,
      hasClientEmail: !!clientEmail,
      hasPrivateKey: !!privateKey,
    });
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('Firebase Admin initialized successfully');
    } catch (error) {
      console.error('Firebase admin initialization error:', error);
    }
  }
}

// Export admin services - these will throw if not initialized, which is what we want
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export default admin;