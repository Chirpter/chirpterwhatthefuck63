// ARCHITECTURAL NOTE:
// This application is configured to connect to the primary Firebase project.
// Any access to secondary, system-level data (like global bookmarks) should
// be proxied through a secure backend mechanism (e.g., Genkit Flow) rather
// than direct client-side initialization of a second Firebase app.

import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

// --- Primary Firebase Project Configuration (Project A) ---
const primaryFirebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// ✅ ENHANCED: Validate all required Firebase config fields
const requiredFields: Array<keyof FirebaseOptions> = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const missingField = requiredFields.find(field => !primaryFirebaseConfig[field]);

if (missingField) {
  throw new Error(`❌ Missing Firebase config: The environment variable for "${missingField}" is not set. Please check your .env.local file.`);
}

// Singleton pattern to initialize Firebase app
function initializePrimaryApp(): FirebaseApp {
  // Use getApps() to check if apps are already initialized.
  const apps = getApps();
  if (apps.length > 0) {
    return getApp(); // Return the default app if it exists
  }
  // Otherwise, initialize the default app.
  return initializeApp(primaryFirebaseConfig);
}


const primaryApp = initializePrimaryApp();

// Export services from the primary app
const db = getFirestore(primaryApp);
const storage = getStorage(primaryApp);
const auth = getAuth(primaryApp);
const functions = getFunctions(primaryApp);

// NOTE: The logic for setting the auth cookie via onIdTokenChanged has been removed.
// This is now handled by an API route that creates a secure, HTTP-only session cookie.
// This prevents the client-side token from being accessible to scripts and is a more secure pattern.

// DEVELOPER NOTE: If you encounter an "auth/unauthorized-domain" error,
// you need to add "localhost" to the list of authorized domains in the
// Firebase Console -> Authentication -> Settings -> Authorized domains.

export { 
  primaryApp as app, // The main app instance
  db,                // Firestore for the main app
  storage,           // Storage for the main app
  auth,              // Auth for the main app
  functions,         // Cloud Functions for the main app
};
