import * as admin from 'firebase-admin';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';

// This file is for SERVER-SIDE execution only.

/**
 * Initializes a new Firebase Admin App. This function contains the core
 * logic for parsing the service account key and calling `admin.initializeApp`.
 * It should only be called when no default app exists.
 */
const initializeNewApp = (): admin.app.App => {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey || serviceAccountKey.trim() === '') {
    const errorMessage = "Could not initialize Firebase Admin SDK. The FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set or is empty.";
    console.error(`❌ ${errorMessage}`);
    throw new Error(errorMessage);
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error("Parsed service account key is missing required fields (project_id, private_key, client_email).");
    }

    console.log("🚀 [Firebase Admin] Initializing new Firebase Admin SDK app...");
    const newApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    console.log("✅ [Firebase Admin] New app initialized successfully.");
    return newApp;

  } catch (error: any) {
    let errorMessage: string;
    if (error instanceof SyntaxError) {
      errorMessage = "Could not parse FIREBASE_SERVICE_ACCOUNT_KEY. It is malformed JSON.";
    } else {
      errorMessage = `Firebase Admin SDK initialization failed: ${error.message}`;
    }
    console.error("❌ [Firebase Admin] Initialization error:", errorMessage);
    throw new Error(errorMessage);
  }
};

/**
 * Robustly gets the existing default Firebase Admin App or initializes a new one.
 * Includes detailed logging for debugging initialization behavior.
 */
const getOrInitializeApp = (): admin.app.App => {
  // The admin SDK is designed to be a singleton.
  // We check if it's already initialized to prevent errors in environments
  // where modules can be re-evaluated (like during Next.js hot-reloading).
  if (admin.apps.length > 0 && admin.apps[0]) {
    // Return the already initialized default app
    return admin.apps[0];
  }

  // If no app is initialized, create a new one.
  return initializeNewApp();
};


// --- LAZY GETTER FUNCTIONS ---
// These ensure the app is initialized only when a service is first requested.

function getAuthAdmin(): Auth {
  return getOrInitializeApp().auth();
}

function getAdminDb(): Firestore {
  return getOrInitializeApp().firestore();
}

function getStorageAdmin(): Storage {
  return getOrInitializeApp().storage();
}

export { getAuthAdmin, getAdminDb, getStorageAdmin };
export const FieldValue = admin.firestore.FieldValue;
