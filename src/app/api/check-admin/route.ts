'use server';

import { NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

/**
 * API endpoint to explicitly check if the Firebase Admin SDK can be initialized.
 * This is a diagnostic tool.
 */
export async function GET() {
  try {
    // Attempt to get the admin instance. This will trigger the initialization
    // logic within getAuthAdmin, which includes checking the environment variable.
    getAuthAdmin();
    
    // If no error is thrown, the SDK is configured correctly.
    return NextResponse.json({
      success: true,
      message: "Firebase Admin SDK initialized successfully. Service account key is valid.",
    });

  } catch (error: any) {
    // The error is thrown from our firebase-admin.ts file if the key is missing or invalid.
    // We catch it here and return it as a structured JSON response.
    console.error('[API /check-admin] Initialization failed:', error.message);
    return NextResponse.json(
        { 
            success: false, 
            message: error.message || "An unknown error occurred during Firebase Admin initialization."
        }, 
        { status: 500 }
    );
  }
}
