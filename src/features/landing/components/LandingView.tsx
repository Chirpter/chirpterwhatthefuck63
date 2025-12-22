// src/features/landing/components/LandingView.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import YouTube from 'react-youtube';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/Logo';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// --- Reusable Feature Card Component ---
const FeatureCard = ({ icon, title, description, gradient }: { icon: any, title: string, description: string, gradient: string }) => {
  const IconComponent = icon;
  return (
    <div className="group relative bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 hover:border-slate-700 transition-all duration-300 cursor-pointer overflow-hidden">
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300", gradient)}></div>
      <div className="relative space-y-4">
        <div className={cn("w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300", gradient)}>
          <IconComponent className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-headline-2">{title}</h3>
        <p className="text-body-sm leading-relaxed">{description}</p>
        <div className="flex items-center gap-2 text-sm text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity">
          Learn more
          <Icon name="ArrowRight" className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
};


export default function LandingPageV2() {
  const [showVideo, setShowVideo] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    { icon: Icon, props: {name: 'Sparkles'}, title: "AI Content Engine", description: "Generate ideas, outlines, and complete chapters. Overcome writer's block forever.", gradient: "from-red-500 to-yellow-500" },
    { icon: Icon, props: {name: 'Languages'}, title: "Bilingual Creation", description: "Create bilingual books and learn languages with AI-powered translation and audio.", gradient: "from-blue-500 to-cyan-500" },
    { icon: Icon, props: {name: 'BookOpen'}, title: "Interactive Reading", description: "Look up words, get translations, and hear pronunciations directly within your stories.", gradient: "from-green-500 to-emerald-500" },
    { icon: Icon, props: {name: 'Library'}, title: "Personal Library", description: "Organize your projects, track your reading progress, and access your collection anywhere.", gradient: "from-orange-500 to-red-500" },
    { icon: Icon, props: {name: 'BrainCircuit'}, title: "SRS Flashcards", description: "Master vocabulary with a spaced repetition system designed to enhance long-term memory.", gradient: "from-indigo-500 to-purple-500" },
    { icon: Icon, props: {name: 'Trophy'}, title: "Achievements & Rewards", description: "Stay motivated by completing daily tasks and milestones to earn credits and unlock new features.", gradient: "from-yellow-500 to-orange-500" }
  ];

  const stats = [
    { number: "50K+", label: "Active Users" },
    { number: "100K+", label: "Stories Created" },
    { number: "25+", label: "Languages" },
    { number: "4.9★", label: "User Rating" }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 transition-all duration-300" style={{ backgroundColor: scrollY > 50 ? 'rgba(2, 6, 23, 0.95)' : 'transparent', backdropFilter: scrollY > 50 ? 'blur(10px)' : 'none' }}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center gap-3 group cursor-pointer">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-yellow-500 rounded-xl flex items-center justify-center transform group-hover:rotate-12 transition-transform">
                <Logo className="w-6 h-6" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-red-400 to-yellow-400 bg-clip-text text-transparent">Chirpter</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm hover:text-white transition-colors">Features</a>
              <a href="#demo" className="text-sm hover:text-white transition-colors">Demo</a>
              <Button variant="link" asChild><Link href="/login" className="text-sm hover:text-white">Login</Link></Button>
              <Button asChild className="px-6 py-2 bg-gradient-to-r from-red-600 to-yellow-600 hover:from-red-700 hover:to-yellow-700 rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg shadow-red-500/50 text-white text-sm"><Link href="/login">Get Started Free</Link></Button>
            </nav>

            {/* Mobile Menu Button */}
            <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <Icon name="X" /> : <Icon name="Menu" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900/95 backdrop-blur-lg border-t border-slate-800">
            <nav className="container mx-auto px-6 py-6 flex flex-col gap-4">
              <a href="#features" className="text-base hover:text-white transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#demo" className="text-base hover:text-white transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Demo</a>
              <Button variant="ghost" asChild><Link href="/login" className="text-base hover:text-white text-left justify-start">Login</Link></Button>
              <Button asChild className="px-6 py-3 bg-gradient-to-r from-red-600 to-yellow-600 rounded-lg font-semibold text-white text-lg"><Link href="/login">Get Started Free</Link></Button>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full text-sm text-red-300">
                <Icon name="Sparkles" className="w-4 h-4" />
                <span className="text-sm !text-red-300">AI-Powered Storytelling Platform</span>
              </div>
              <h1 className="text-display leading-tight">Your Ideas,<br /><span className="bg-gradient-to-r from-red-500 via-yellow-400 to-fuchsia-500 bg-clip-text text-transparent animate-gradient">Amplified by AI</span></h1>
              <p className="text-body-lg text-gray-400 leading-relaxed max-w-xl">Create captivating bilingual books, master new languages through interactive stories, and bring your imagination to life with AI-powered tools.</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="group px-8 py-4 bg-gradient-to-r from-red-600 to-yellow-600 hover:from-red-700 hover:to-yellow-700 rounded-xl font-semibold transition-all transform hover:scale-105 shadow-2xl shadow-red-500/50 text-white text-base h-auto"><Link href="/login">Start Creating Now <Icon name="ArrowRight" className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></Link></Button>
                <Button size="lg" variant="outline" className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-semibold transition-all backdrop-blur-sm text-white text-base h-auto"><Icon name="Play" className="w-5 h-5" />Watch Demo</Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-8">
                {stats.map((stat, idx) => (
                  <div key={idx} className="text-center">
                    <div className="text-2xl font-bold bg-gradient-to-r from-red-400 to-yellow-400 bg-clip-text text-transparent">{stat.number}</div>
                    <div className="text-caption mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3D Book Animation */}
            <div className="relative h-[500px] hidden md:block">
              <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-80 h-96 transform-gpu hover:scale-110 transition-transform duration-500" style={{ transformStyle: 'preserve-3d', transform: 'rotateY(-15deg) rotateX(5deg)' }}>
                      <Card className="absolute inset-0 bg-gradient-to-br from-red-600 via-yellow-600 to-fuchsia-600 rounded-2xl shadow-2xl shadow-red-500/50 p-8 flex flex-col justify-between">
                          <div>
                              <h3 className="text-headline-1">The Alchemist</h3>
                              <p className="text-body-sm opacity-80">Paulo Coelho</p>
                          </div>
                          <div className="flex items-center gap-2 text-caption opacity-60">
                              <Icon name="Languages" className="w-4 h-4" />
                              <span>English • Tiếng Việt</span>
                          </div>
                      </Card>
                      <div className="absolute -right-8 top-20 w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center shadow-xl animate-bounce" style={{ animationDuration: '3s' }}>
                          <Icon name="Trophy" className="w-8 h-8 text-yellow-900" />
                      </div>
                      <div className="absolute -left-8 bottom-20 w-16 h-16 bg-blue-400 rounded-full flex items-center justify-center shadow-xl animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
                          <Icon name="BrainCircuit" className="w-8 h-8 text-blue-900" />
                      </div>
                  </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section id="demo" className="py-24 px-6 relative">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-5xl font-bold">Learn with <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Context</span></h2>
            <p className="text-body-lg text-gray-400 max-w-2xl mx-auto">Click on a vocabulary card to see it used in a real video clip. Understand words in their natural environment.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">
            <div className="md:col-span-2 relative">
              <div className="aspect-video bg-black rounded-3xl shadow-2xl shadow-blue-500/20 overflow-hidden border-4 border-slate-800 relative">
                <div className="absolute top-4 left-4 flex gap-2 z-10">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                {showVideo ? (
                  <YouTube videoId="J1ze549a-OA" opts={{ height: '100%', width: '100%', playerVars: { autoplay: 1, start: 1, end: 4, controls: 0, iv_load_policy: 3 } }} className="w-full h-full" onEnd={() => setShowVideo(false)} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                    <Icon name="Youtube" className="w-20 h-20 text-red-500 mb-4" />
                    <p className="text-body-base text-gray-400">Video will play here</p>
                  </div>
                )}
              </div>
            </div>
            <div onClick={() => setShowVideo(true)} className="group cursor-pointer">
              <div className="relative bg-gradient-to-br from-blue-600 to-cyan-600 rounded-3xl p-8 shadow-2xl shadow-blue-500/30 transform group-hover:scale-105 transition-all duration-300">
                <div className="absolute inset-0 bg-white/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs"><Icon name="Play" className="w-3 h-3" /><span>Click to play</span></div>
                  <h3 className="text-6xl font-bold">Hello</h3>
                  <p className="text-xl text-blue-100">/həˈloʊ/</p>
                  <div className="pt-4 border-t border-white/20"><p className="text-caption text-blue-100">See this word in action from real conversations!</p></div>
                </div>
                <div className="absolute -bottom-2 -right-2 w-24 h-24 bg-yellow-400 rounded-full opacity-20 blur-2xl"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 relative">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-5xl font-bold">The Future of <span className="bg-gradient-to-r from-red-400 to-yellow-400 bg-clip-text text-transparent">Storytelling & Learning</span></h2>
            <p className="text-body-lg text-gray-400 max-w-2xl mx-auto">From a single idea to mastering a new language, Chirpter streamlines your creative and educational journey.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {features.map((feature, idx) => (
              <FeatureCard key={idx} icon={feature.icon} title={feature.title} description={feature.description} gradient={feature.gradient} />
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-24 px-6 relative">
        <div className="container mx-auto">
          <div className="relative bg-gradient-to-br from-red-600 via-yellow-600 to-fuchsia-600 rounded-3xl p-12 md:p-20 overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30"></div>
            <div className="relative text-center space-y-8 max-w-3xl mx-auto">
              <h2 className="text-5xl md:text-6xl font-bold">Ready to Create?</h2>
              <p className="text-xl text-white/80">Join thousands of creators and start your next masterpiece today. It's free to get started.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button size="lg" asChild className="group px-8 py-4 bg-white text-red-600 hover:bg-gray-100 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-2xl h-auto text-base"><Link href="/login">Sign Up for Free <Icon name="Check" className="w-5 h-5 group-hover:scale-110 transition-transform" /></Link></Button>
                <Button size="lg" variant="outline" className="px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl font-bold text-lg transition-all text-white h-auto text-base">Contact Sales</Button>
              </div>
              <p className="text-caption text-white/60 pt-4">✓ No credit card required  ✓ Free forever plan  ✓ Cancel anytime</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 px-6">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-yellow-500 rounded-xl flex items-center justify-center">
                  <Logo className="w-6 h-6" />
                </div>
                <span className="text-xl font-bold">Chirpter</span>
              </div>
              <p className="text-sm">Your AI co-pilot for creation and learning.</p>
            </div>
            <div>
              <h4 className="font-semibold text-base">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#roadmap" className="hover:text-white transition-colors">Roadmap</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-base">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#blog" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-base">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/privacy" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#terms" className="hover:text-white transition-colors">Terms</a></li>
                <li><a href="#cookies" className="hover:text-white transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-12 pt-8 text-center text-caption">
            <p>&copy; {new Date().getFullYear()} Chirpter. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
}
