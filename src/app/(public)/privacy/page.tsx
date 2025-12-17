// src/app/(public)/privacy/page.tsx

import React from 'react';
import { Logo } from '@/components/ui/Logo';
import Link from 'next/link';
import { Button } from '@/components/ui/button'; // ✅ IMPORTED shared button

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="py-4 px-6 md:px-10 border-b">
        <div className="container mx-auto flex justify-between items-center">
           <Link href="/" className="flex items-center gap-3 group cursor-pointer">
              <Logo className="w-10 h-10 text-primary" />
              <span className="text-2xl font-bold font-headline text-primary">Chirpter</span>
            </Link>
             <Button variant="outline" asChild>
                <Link href="/login">Back to App</Link>
            </Button>
        </div>
      </header>
      <main className="container mx-auto px-6 md:px-10 py-12">
        <article className="prose dark:prose-invert max-w-4xl mx-auto">
          <h1>Privacy Policy</h1>
          <p className="lead">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          <p>Welcome to Chirpter. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information about you when you use our application.</p>

          <h2>1. Information We Collect</h2>
          <p>We collect information in the following ways:</p>
          <ul>
            <li><strong>Information you provide us:</strong> This includes information you provide when you create an account, such as your name, email address, and profile picture.</li>
            <li><strong>Information from your use of our services:</strong> We collect information about the content you create, such as books, pieces, and vocabulary lists.</li>
            <li><strong>Information collected automatically:</strong> We use cookies and local storage to operate and provide our services.</li>
          </ul>

          <h2>2. How We Use Cookies and Local Storage</h2>
          <p>We use cookies and similar technologies for essential purposes to provide a functional and secure experience. Here’s a breakdown:</p>
          
          <h4>Essential Cookies</h4>
          <ul>
            <li><strong>`__session`:</strong> This is a secure, httpOnly cookie used to manage your authentication session. It is strictly necessary to keep you logged in and ensure your account is secure.</li>
          </ul>

          <h4>Preferences & Functionality (Local Storage)</h4>
          <ul>
            <li><strong>`i18nextLng`:</strong> We use local storage to remember your preferred language so you don’t have to select it every time you visit.</li>
            <li><strong>`theme`:</strong> We use local storage to remember your preferred theme (light or dark mode) to provide a consistent visual experience.</li>
            <li><strong>`chirpter_*`:</strong> We use local storage for other settings like editor preferences and audio progress to enhance your user experience.</li>
          </ul>
          
          <p>We do not use cookies for advertising or non-essential third-party tracking.</p>

          <h2>3. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve our services.</li>
            <li>Personalize your experience.</li>
            <li>Communicate with you about your account and our services.</li>
            <li>Ensure the security of our platform.</li>
          </ul>
          
          <h2>4. Data Security</h2>
          <p>We take reasonable measures to protect your information from loss, theft, misuse, and unauthorized access. Your account is protected by your password, and we encourage you to use a strong password.</p>

          <h2>5. Your Choices</h2>
          <p>You can manage your account information through your profile settings. You can also clear cookies and site data through your browser settings, though this will log you out and reset your preferences.</p>

          <h2>6. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page. We encourage you to review this Privacy Policy periodically for any changes.</p>

          <h2>7. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at support@chirpter.com.</p>
        </article>
      </main>
    </div>
  );
}

// ✅ REMOVED redundant Button component definition
