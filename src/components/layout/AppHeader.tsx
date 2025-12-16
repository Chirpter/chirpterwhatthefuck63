
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { UI_LANGUAGES } from '@/lib/constants';
import { TopbarNav } from '@/components/layout/TopbarNav';
import { MobileNav } from '@/components/layout/MobileNav';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/auth-context';
import { useUser } from '@/contexts/user-context';
import { cn, getLevelStyles } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Logo } from '../ui/Logo';
import { CreditIcon } from '../ui/CreditIcon';
import { useTheme } from '@/hooks/useTheme';

export default function AppHeader() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { t, i18n } = useTranslation(['common', 'userMenu', 'playlist', 'settingsPage']);
  const { authUser, logout } = useAuth();
  const { user } = useUser();
  const { isDarkMode, toggleDarkMode } = useTheme();

  // Set language attribute on body for potential CSS targeting
  useEffect(() => {
    if (i18n.language) {
      document.documentElement.lang = i18n.language;
      document.body.classList.remove('lang-en', 'lang-vi', 'lang-zh', 'lang-fr', 'lang-ja', 'lang-ko', 'lang-es');
      document.body.classList.add(`lang-${i18n.language}`);
    }
  }, [i18n.language]);

  const setLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };
  
  if (!authUser || !user) return null;
  
  const creditsToShow = Number(user.credits) || 0;
  const levelToShow = Number(user.level) || 0;
  const levelStyles = getLevelStyles(user.level, user.plan);

  return (
    <header className="sticky top-0 z-40 flex h-14 md:h-16 items-center justify-between border-b bg-background/80 px-2 sm:px-6 backdrop-blur-md">
      <div className="flex items-center gap-1">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
              <Icon name="Menu" className="h-5 w-5" />
              <span className="sr-only">Open navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetDescription className="sr-only">Mobile Navigation Menu</SheetDescription>
            <div className="p-4 border-b">
              <Link
                href="/library/book"
                className="flex items-center"
                onClick={() => setMobileNavOpen(false)}
              >
                <Logo className="h-10 w-10 text-primary" />
                <SheetTitle asChild>
                  <h1 className="text-xl font-headline font-semibold text-primary">{t('chirpter')}</h1>
                </SheetTitle>
              </Link>
            </div>
            <div className="p-4">
              <MobileNav onLinkClick={() => setMobileNavOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <Link href="/library/book" className="flex items-center gap-1">
          <Logo className="h-9 w-9 md:h-10 md:w-10 text-primary" />
          <h1 className="text-xl font-headline font-bold text-primary hidden md:block">
            {t('chirpter')}
          </h1>
        </Link>
      </div>

      <nav className="hidden md:flex items-center gap-1">
        <TopbarNav />
      </nav>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="flex items-center gap-2 text-xs md:text-sm font-medium p-1.5 md:p-2 rounded-lg bg-secondary/50">
          <CreditIcon className="h-4 w-4 text-primary" />
          <span>{creditsToShow}</span>
          <span className="hidden sm:inline">{t('credits', {ns: 'userMenu'})}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
             <div className="relative cursor-pointer">
                <div className={cn("rounded-full", levelStyles.frameClasses)}>
                    <Avatar className="h-9 w-9 md:h-10 md:w-10">
                        <AvatarImage 
                        src={authUser?.photoURL || `https://placehold.co/100x100.png`} 
                        alt={authUser?.displayName || "User Avatar"} 
                        />
                        <AvatarFallback>{authUser?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                </div>
                <div className={cn("streaktag absolute -bottom-1 left-1/2 -translate-x-1/2 h-4 rounded-sm px-1.5 text-[10px] md:text-xs font-bold flex items-center justify-center", levelStyles.badgeClasses)}>
                    {levelToShow}
                </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60 font-body" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className={cn("text-sm font-medium leading-none", user?.plan === 'pro' && 'text-level-gold')}>{authUser?.displayName || 'User'}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {authUser?.email || ''}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="sm:hidden">
              <CreditIcon className="mr-2 h-4 w-4" />
              <span>{creditsToShow} {t('credits', {ns: 'userMenu'})}</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <Icon name="User" className="mr-2 h-4 w-4" />
                <span>{t('profile', {ns: 'userMenu'})}</span>
              </Link>
            </DropdownMenuItem>
             <DropdownMenuItem asChild>
              <Link href="/achievements">
                <Icon name="Trophy" className="mr-2 h-4 w-4" />
                <span>{t('achievements', {ns: 'userMenu'})}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/playlist">
                <Icon name="ListMusic" className="mr-2 h-4 w-4" />
                <span>{t('playlist', {ns: 'userMenu'})}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Icon name="Settings" className="mr-2 h-4 w-4" />
                <span>{t('settings', {ns: 'userMenu'})}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Icon name="Globe" className="mr-2 h-4 w-4" />
                <span>{t('language', {ns: 'userMenu'})}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={i18n.language} onValueChange={setLanguage}>
                    {UI_LANGUAGES?.map(lang => (
                      <DropdownMenuRadioItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </DropdownMenuRadioItem>
                    )) || null}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
            >
              <Icon name="Moon" className="mr-2 h-4 w-4" />
              <Label htmlFor="darkMode" className="flex-grow cursor-pointer">
                {t('darkModeLabel', {ns: 'settingsPage'})}
              </Label>
              <Switch
                  id="darkMode"
                  checked={isDarkMode}
                  onCheckedChange={toggleDarkMode}
                  className="ml-auto"
              />
            </DropdownMenuItem>
            {user?.role === 'admin' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin">
                    <Icon name="Shield" className="mr-2 h-4 w-4" />
                    <span>Admin Panel</span>
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
                <Icon name="LogOut" className="mr-2 h-4 w-4" />
                <span>{t('logout', {ns: 'userMenu'})}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
