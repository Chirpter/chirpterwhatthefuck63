
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/ui/Logo';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LandingPage() {
  const [checkResult, setCheckResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckConnection = async () => {
    setIsChecking(true);
    setCheckResult(null);
    try {
      const response = await fetch('/api/check-admin');
      const data = await response.json();
      setCheckResult(data);
    } catch (error) {
      setCheckResult({
        success: false,
        message: 'Failed to fetch from API. Check browser console for network errors.',
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-blue-100 dark:from-background dark:to-blue-900/30">
      <header className="container mx-auto py-6 px-4 md:px-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-headline font-bold text-primary">Chirpter</h1>
          </div>
          <nav className="space-x-4">
            <Button variant="ghost" asChild className="font-body">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild className="font-body bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/login">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>
      
      {/* --- DEBUG SECTION --- */}
      <section className="container mx-auto my-4 p-4 border-2 border-dashed rounded-lg">
          <h3 className="font-bold text-center mb-2">Debug Section</h3>
          <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground">
                  Use this button to check if the server can connect to Firebase using your Service Account Key.
              </p>
              <Button onClick={handleCheckConnection} disabled={isChecking}>
                  {isChecking ? <Icon name="Loader2" className="animate-spin mr-2"/> : <Icon name="Shield" className="mr-2" />}
                  Check Server Connection
              </Button>
              {checkResult && (
                  <Alert variant={checkResult.success ? 'default' : 'destructive'} className="w-full max-w-2xl">
                      <AlertDescription className="font-mono text-xs break-words">
                          <p className="font-bold mb-1">Result:</p>
                          {checkResult.message}
                      </AlertDescription>
                  </Alert>
              )}
          </div>
      </section>
      {/* --- END DEBUG SECTION --- */}


      <main className="flex-grow container mx-auto px-4 md:px-0 flex flex-col items-center justify-center text-center py-12 md:py-24">
        <Icon name="Sparkles" className="h-20 w-20 text-accent mb-6" />
        <h2 className="text-5xl md:text-6xl font-headline font-bold mb-6">
          Unlock Your Creativity with AI-Powered Book Creation
        </h2>
        <p className="text-lg md:text-xl text-foreground/80 max-w-3xl mb-10 font-body">
          Chirpter helps you generate, manage, and read books and lessons seamlessly. Leverage AI for content, translations, and more.
          Dive into your personal library and bring your stories to life.
        </p>
        <Button size="lg" asChild className="font-body text-lg py-7 px-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transform hover:scale-105 transition-transform duration-300">
          <Link href="/login">Explore Your Library <Icon name="ChevronRight" className="ml-2 h-5 w-5" /></Link>
        </Button>
      </main>

      <section className="py-16 bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 md:px-0">
          <h3 className="text-3xl font-headline font-semibold text-center mb-12">Features at a Glance</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="items-center text-center">
                <Icon name="Wand2" className="h-12 w-12 text-primary mb-3" />
                <CardTitle className="font-headline text-2xl">AI Content Generation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center font-body">Effortlessly generate book ideas, outlines, and even full chapters with our advanced AI.</p>
              </CardContent>
            </Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="items-center text-center">
                <Icon name="Library" className="h-12 w-12 text-primary mb-3" />
                <CardTitle className="font-headline text-2xl">Library Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center font-body">Organize your creations, track progress, and access your personal collection anytime, anywhere.</p>
              </CardContent>
            </Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="items-center text-center">
                <Icon name="Languages" className="h-12 w-12 text-primary mb-3" />
                <CardTitle className="font-headline text-2xl">Multilingual Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center font-body">Read and create content in multiple languages with built-in translation and pronunciation tools.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      <section className="py-16">
        <div className="container mx-auto px-4 md:px-0 flex flex-col md:flex-row items-center gap-12">
          <div className="md:w-1/2">
            <Image 
              src="https://images.unsplash.com/photo-1544716278-e513176f20b5?q=80&w=600&auto=format&fit=crop"
              alt="Chirpter Interface" 
              width={600} 
              height={400} 
              className="rounded-lg shadow-2xl"
              priority
            />
          </div>
          <div className="md:w-1/2 text-center md:text-left">
            <h3 className="text-3xl font-headline font-semibold mb-6">Your Personal Writing Studio</h3>
            <p className="text-lg text-foreground/80 mb-8 font-body">
              From drafting your first chapter to managing a complete series, Chirpter provides the tools you need.
              Focus on your creativity while our AI handles the heavy lifting.
            </p>
            <Button size="lg" asChild className="font-body bg-accent hover:bg-accent/90 text-accent-foreground shadow-md">
              <Link href="/login">Start Creating Now</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="container mx-auto py-8 text-center text-muted-foreground font-body">
        <p>&copy; {new Date().getFullYear()} Chirpter. All rights reserved.</p>
      </footer>
    </div>
  );
}
