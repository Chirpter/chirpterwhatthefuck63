// src/features/profile/components/ProfileView.tsx

"use client";

import React, { useState, useRef, useMemo } from 'react';
import { useUser } from '@/contexts/user-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getLevelStyles, type LevelTier } from '@/lib/utils';
import { updateUserProfile } from '@/services/server/user-service';
import { useToast } from '@/hooks/useToast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { User } from '@/lib/types';
import { ACHIEVEMENTS } from '@/features/user/constants/achievements';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/auth-context';
import { Logo } from '@/components/ui/Logo';


// --- Reusable Components for the new Profile View ---

const StatItem = ({ value, label }: { value: string | number, label: string }) => (
  <div className="text-center">
    <p className="text-body-lg font-bold">{value}</p>
    <p className="text-caption uppercase tracking-wider">{label}</p>
  </div>
);

const WishNote = ({ children, x, y, style, contentClass }: { children: React.ReactNode, x?: number, y?: number, style?: React.CSSProperties, contentClass?: string }) => (
  <foreignObject x={x} y={y} style={style} width="96" height="56">
      <Popover>
        <PopoverTrigger asChild>
          <button 
            className="w-24 h-14 bg-amber-100/80 backdrop-blur-sm rounded-lg shadow-lg transform hover:scale-110 transition-transform duration-300"
          >
            <div className="w-full h-full p-1.5 relative overflow-hidden">
              {/* Simulating rolled paper */}
              <div className="absolute top-1 left-1 w-2 h-[calc(100%-8px)] bg-amber-300/50 rounded-full"></div>
              <div className="absolute top-1 right-1 w-2 h-[calc(100%-8px)] bg-amber-300/50 rounded-full"></div>
              <div className="absolute -top-1 left-2 w-[calc(100%-16px)] h-2 bg-amber-300/50 rounded-full"></div>
              <div className="absolute -bottom-1 left-2 w-[calc(100%-16px)] h-2 bg-amber-300/50 rounded-full"></div>
              <div className={cn("text-caption font-serif italic truncate text-amber-900", contentClass)}>
                {children}
              </div>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-3 bg-amber-50 border-amber-200">
          <p className="text-body-sm font-serif text-amber-900">{children}</p>
        </PopoverContent>
      </Popover>
    </foreignObject>
);


// --- REFACTORED JourneyTree ---
// This component is now a flexible container for a dynamic, state-driven SVG.
// It will render different visual states based on the user's level and gender.

interface JourneyTreeProps {
  userLevel: number;
  userGender?: 'male' | 'female' | 'other';
}

const JourneyTree: React.FC<JourneyTreeProps> = ({ userLevel, userGender }) => {
  // TODO: Add logic to select the correct SVG based on userLevel.
  // For now, it's a placeholder.
  const treeState = `Level ${userLevel}`;
  const character = userGender === 'female' ? 'Girl' : 'Boy';

  return (
    <div className="relative w-full aspect-square max-w-md mx-auto">
      {/* 
        This SVG is now a placeholder. You can provide the new, complex SVG code,
        and I will place it here. We can have multiple <g> groups for different
        tree levels and show/hide them with React logic.
      */}
      <svg viewBox="0 0 400 400" className="w-full h-full">
        <defs>
            <linearGradient id="trunkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6B4F39" />
                <stop offset="50%" stopColor="#8A6B52" />
                <stop offset="100%" stopColor="#6B4F39" />
            </linearGradient>
            <linearGradient id="leafGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#65A30D" />
                <stop offset="100%" stopColor="#4D7C0F" />
            </linearGradient>
        </defs>
        
        {/* Placeholder tree */}
        <g>
          <path d="M0 380 Q 200 360, 400 380 L 400 400 L 0 400 Z" fill="url(#leafGradient)" opacity="0.6" />
          <path d="M200,380 Q190,250 160,180 T150,100" stroke="url(#trunkGradient)" strokeWidth="18" fill="none" strokeLinecap="round" />
          <circle cx="150" cy="100" r="50" fill="url(#leafGradient)" opacity="0.8" />
          <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="#fff" className="font-bold font-headline text-headline-1">
            {treeState}
          </text>
           <text x="50%" y="60%" dominantBaseline="middle" textAnchor="middle" fill="#fff" className="font-body text-body-base">
            Character: {character}
          </text>
        </g>
        
        {/* TODO: Add SVG groups for different levels here.
        
        <g style={{ display: userLevel === 2 ? 'block' : 'none' }}>
           ... SVG paths for level 2 tree ...
        </g>
        <g style={{ display: userLevel === 3 ? 'block' : 'none' }}>
           ... SVG paths for level 3 tree ...
        </g>
        
        */}

        {/* Wish notes can still be included */}
         <WishNote x={150} y={240} style={{ transform: 'rotate(2deg)' }} contentClass="text-rose-800">
            "A new journey awaits."
        </WishNote>
      </svg>
    </div>
  );
};


const TimelinePost = ({ icon, title, description, children }: { icon: any, title: string, description: string, children?: React.ReactNode }) => (
    <div className="pl-8 relative border-l-2 border-dashed">
        <div className="absolute -left-4 top-0 h-8 w-8 rounded-full bg-background border-2 flex items-center justify-center">
            <Icon name={icon} className="h-4 w-4 text-primary" />
        </div>
        <div className="mb-8">
            <h4 className="font-headline font-semibold">{title}</h4>
            <p className="text-body-sm text-muted-foreground">{description}</p>
            {children && <div className="mt-2">{children}</div>}
        </div>
    </div>
);


export default function ProfileView() {
    const { user, loading, reloadUser } = useUser();
    const { authUser } = useAuth(); // Import authUser
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingCover, setIsUploadingCover] = useState(false);
    const coverPhotoInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;
        
        setIsUploading(true);
        try {
            await updateUserProfile(user.uid, { profilePictureFile: file });
            toast({ title: "Success", description: "Avatar updated successfully." });
            await reloadUser();
        } catch (error) {
            console.error("Failed to upload new avatar:", error);
            toast({ title: "Error", description: "Failed to upload new avatar.", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleCoverPhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;
        
        setIsUploadingCover(true);
        try {
            await updateUserProfile(user.uid, { profileCoverFile: file });
            toast({ title: "Success", description: "Cover photo updated successfully." });
            await reloadUser();
        } catch (error) {
            console.error("Failed to upload cover photo:", error);
            toast({ title: "Error", description: "Failed to upload cover photo.", variant: "destructive" });
        } finally {
            setIsUploadingCover(false);
        }
    };


    if (loading || !user || !authUser) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <Logo className="h-24 w-24 animate-pulse text-primary mx-auto" />
                    <p className="mt-2 text-body-sm">Loading Profile...</p>
                </div>
            </div>
        );
    }
    
    const levelStyles = getLevelStyles(user.level, user.plan);

    return (
        <div className="w-full">
            {/* --- HEADER SECTION --- */}
            <header className="mb-8 relative group/header">
                <div className="relative h-48 md:h-64 rounded-lg bg-muted overflow-hidden">
                    {user.coverPhotoURL ? (
                        <Image src={user.coverPhotoURL} alt="User cover photo" layout="fill" objectFit="cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10"></div>
                    )}
                    <div className="absolute inset-0 bg-black/20"></div>
                    <Button
                        variant="secondary"
                        className="absolute top-4 right-4 opacity-0 group-hover/header:opacity-100 transition-opacity z-10"
                        onClick={() => coverPhotoInputRef.current?.click()}
                        disabled={isUploadingCover}
                    >
                         {isUploadingCover ? <Icon name="Loader2" className="h-4 w-4 animate-spin mr-2" /> : <Icon name="Image" className="h-4 w-4 mr-2" />}
                        Change Cover
                    </Button>
                    <input
                        type="file"
                        ref={coverPhotoInputRef}
                        onChange={handleCoverPhotoChange}
                        className="hidden"
                        accept="image/jpeg, image/png, image/webp"
                    />
                </div>

                 <div className="relative px-4 md:px-8 -mt-16 md:-mt-20">
                     <div className="flex items-start justify-start gap-6 md:gap-12">
                        {/* Left Column: Profile Info */}
                        <div className="flex items-end gap-4 md:gap-6 flex-shrink-0">
                             <Dialog>
                                <DialogTrigger asChild>
                                    <div className="relative flex-shrink-0 cursor-pointer">
                                        <div className={cn("rounded-full border-4 border-background", levelStyles.frameClasses)}>
                                            <Avatar className="h-24 w-24 md:h-32 md:w-32">
                                                <AvatarImage src={authUser.photoURL || ''} alt={user.displayName || 'User'} />
                                                <AvatarFallback className="text-4xl">{user.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                        </div>
                                        <div className={cn("absolute -bottom-1 left-1/2 -translate-x-1/2 h-6 rounded-md px-3 text-body-sm font-bold flex items-center justify-center", levelStyles.badgeClasses)}>
                                            {user.level}
                                        </div>
                                    </div>
                                </DialogTrigger>
                                <DialogContent className="max-w-sm p-4">
                                    <DialogHeader>
                                        <DialogTitle className="text-center font-headline">{user.displayName}'s Profile Photo</DialogTitle>
                                    </DialogHeader>
                                    <div className="aspect-square w-full rounded-lg overflow-hidden my-4 relative">
                                        <Image src={authUser.photoURL || 'https://placehold.co/400x400.png'} alt={user.displayName || 'User'} layout="fill" objectFit="cover" />
                                    </div>
                                    <Button className="w-full" onClick={() => avatarInputRef.current?.click()} disabled={isUploading}>
                                        {isUploading ? <Icon name="Loader2" className="h-4 w-4 animate-spin mr-2" /> : <Icon name="Image" className="h-4 w-4 mr-2" />}
                                        Change Photo
                                    </Button>
                                    <input type="file" ref={avatarInputRef} onChange={handleAvatarChange} className="hidden" accept="image/jpeg, image/png, image/webp" />
                                </DialogContent>
                            </Dialog>
                        </div>
                        
                        {/* Right Column: Name, stats, badges */}
                        <div className="flex-grow pt-20 md:pt-24 flex justify-between items-end">
                            <div className="space-y-1">
                                <h2 className={cn("text-headline-1", user.plan === 'pro' && 'text-level-gold')}>{user.displayName}</h2>
                                <p className="text-body-sm text-muted-foreground">@{user.username || user.uid.substring(0,8)}</p>
                            </div>
                            <div className="hidden md:flex items-center gap-6">
                               <StatItem value={user.stats?.booksCreated || 0} label="posts" />
                               <StatItem value={user.credits} label="credits" />
                            </div>
                        </div>
                    </div>
                </div>
            </header>


            {/* --- MAIN CONTENT --- */}
            <main className="grid grid-cols-1 md:grid-cols-2 gap-8 md:p-6">
                
                {/* Left Column: The Journey Tree */}
                <div className="flex flex-col items-center">
                    <JourneyTree userLevel={user.level} userGender="male" />
                </div>
                
                {/* Right Column: The Timeline */}
                <div>
                    <h3 className="text-headline-2 mb-4">Journey</h3>
                    <div className="max-h-[80vh] overflow-y-auto pr-4">
                        <TimelinePost icon="FileText" title="Published a new work" description="2 days ago">
                             <Card className="p-3 bg-muted/50 flex items-center gap-3">
                                <Image src="https://images.unsplash.com/photo-1544716278-e513176f20b5?q=80&w=400&auto=format&fit=crop" alt="Book Cover" width={40} height={50} className="rounded-sm" />
                                <div className="flex-grow">
                                    <p className="font-semibold text-body-base">Homebound</p>
                                    <p className="text-caption">A book about dragons.</p>
                                </div>
                                <Button size="sm" variant="outline">View</Button>
                            </Card>
                        </TimelinePost>
                        
                        <TimelinePost icon="Image" title="Shared a moment" description="5 days ago">
                            <div className="grid grid-cols-3 gap-1.5">
                                <Image src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=400&auto=format&fit=crop" alt="Beach" width={150} height={150} className="rounded-md object-cover aspect-square" />
                                <Image src="https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=400&auto=format&fit=crop" alt="Mountains" width={150} height={150} className="rounded-md object-cover aspect-square" />
                                <Image src="https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=400&auto=format&fit=crop" alt="Forest" width={150} height={150} className="rounded-md object-cover aspect-square" />
                            </div>
                        </TimelinePost>

                         <TimelinePost icon="Award" title="Reached a milestone" description="1 week ago">
                             <p className="text-body-base">Congratulations on completing your first course!</p>
                        </TimelinePost>
                    </div>
                </div>
            </main>
        </div>
    );
}
