

'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { useRouter } from 'next/navigation';
import { AdminBookForm } from '@/features/admin/components/AdminBookForm';
import { useAdminBooks } from '@/features/admin/hooks/useAdminBooks';
import { BookItemCard } from '@/features/library/components/BookItemCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminBookmarks } from '../hooks/useAdminBookmarks';
import { AdminBookmarkForm } from './AdminBookmarkForm';
import { BookmarkCard, type BookmarkCardProps } from '@/features/user/components/BookmarkCard';
import { BookmarkStyleProvider } from '@/features/library/components/BookmarkStyleProvider';
import { ACHIEVEMENTS } from '@/features/user/constants/achievements';
import type { Achievement } from '@/features/user/constants/achievements';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";


// Wrapper component to give each bookmark its own state
const AdminBookmarkCard: React.FC<Omit<BookmarkCardProps, 'isComplete' | 'onCardClick'>> = (props) => {
    const [isPreviewCompleted, setIsPreviewCompleted] = useState(false);
    
    const handleTogglePreview = () => {
        // Only allow toggling if there is a completed state
        if (props.bookmark.completedState?.mainVisual) {
            setIsPreviewCompleted(prev => !prev);
        }
    };

    return (
        <BookmarkCard
            {...props}
            isComplete={isPreviewCompleted}
            onCardClick={handleTogglePreview}
            onEditClick={props.onEditClick} // Pass the original onClick to onEditClick
        />
    );
};

const AchievementAdminCard: React.FC<{achievement: Achievement}> = ({ achievement }) => {
    const { t } = useTranslation(['achievements']);
    return (
        <Card className="flex items-center p-3 gap-3">
            <div className="relative h-12 w-12 flex-shrink-0">
                <Icon name={achievement.icon} className="h-full w-full text-primary" />
            </div>
            <div className="flex-grow min-w-0">
                <p className="font-semibold text-body-base truncate">{t(achievement.nameKey)}</p>
                <div className="flex items-center gap-1 mt-1">
                    {achievement.tiers.map(tier => (
                        <TooltipProvider key={tier.level}>
                            <Tooltip>
                                <TooltipTrigger>
                                     <Badge variant="outline">{tier.goal}</Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="text-caption">Level {tier.level}: {tier.creditReward} credits</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ))}
                </div>
            </div>
            <Button variant="outline" size="sm">Set Reward</Button>
        </Card>
    );
};


export default function AdminView() {
  const { authUser } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const {
    books,
    isLoading: isLoadingBooks,
    isFormOpen: isBookFormOpen,
    editingBook,
    handleAddNew: handleAddNewBook,
    handleEdit: handleEditBook,
    handleSave: handleSaveBook,
    handleCloseForm: handleCloseBookForm,
    loadGlobalBooks,
  } = useAdminBooks();
  
  const {
    bookmarks,
    isLoading: isLoadingBookmarks,
    isFormOpen: isBookmarkFormOpen,
    editingBookmark,
    handleEdit: handleEditBookmark,
    handleSave: handleSaveBookmark,
    handleCloseForm: handleCloseBookmarkForm,
    loadBookmarks,
  } = useAdminBookmarks();


  if (!authUser || !user) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Icon name="BookOpen" className="h-12 w-12 animate-pulse text-primary" />
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="container mx-auto flex h-full items-center justify-center">
        <Card className="max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-headline-1">Admin Access Required</CardTitle>
            <CardDescription className="text-body-base">
              This page is restricted to administrators. Please contact the project owner for access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Admin View
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-headline-1">Admin Dashboard</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <CardTitle className="text-headline-2">Achievements Management</CardTitle>
                <CardDescription className="text-body-sm">
                    Assign bookmark rewards to achievements.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                 {ACHIEVEMENTS.filter(a => a.category === 'other').map(ach => (
                    <AchievementAdminCard key={ach.id} achievement={ach} />
                 ))}
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row justify-between items-center">
                <div>
                    <CardTitle className="text-headline-2">Bookmarks Management</CardTitle>
                    <CardDescription className="text-body-sm">
                        Configure how system-wide bookmarks are obtained and priced.
                    </CardDescription>
                </div>
                <Button onClick={loadBookmarks} variant="outline" size="sm" disabled={isLoadingBookmarks}>
                    <Icon name="RotateCw" className={isLoadingBookmarks ? "animate-spin" : ""} />
                </Button>
            </CardHeader>
            <CardContent>
                {isLoadingBookmarks ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(144px, 1fr))' }}>
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
                    </div>
                ) : bookmarks.length > 0 ? (
                    <BookmarkStyleProvider items={[]} availableBookmarks={bookmarks}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(144px, 1fr))' }}>
                            {bookmarks.map((bm) => (
                                <AdminBookmarkCard
                                    key={bm.id}
                                    bookmark={bm}
                                    status={bm.status === 'published' ? 'owned' : 'locked'}
                                    price={bm.price}
                                    onEditClick={() => handleEditBookmark(bm)}
                                />
                            ))}
                        </div>
                    </BookmarkStyleProvider>
                ) : (
                    <p className="text-body-sm">No system bookmarks found.</p>
                )}
            </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle className="text-headline-2">Global Books Management</CardTitle>
            <CardDescription className="text-body-sm">
                Add, edit, or remove books from the system-wide store.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={loadGlobalBooks} variant="outline" size="sm" disabled={isLoadingBooks}>
                <Icon name="RotateCw" className={isLoadingBooks ? "animate-spin" : ""} />
            </Button>
            <Button onClick={handleAddNewBook}>Add New Book</Button>
          </div>
        </CardHeader>
        <CardContent>
           {isLoadingBooks ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-card p-4 rounded-lg shadow-md animate-pulse">
                        <Skeleton className="h-48 bg-muted rounded-md mb-4" />
                        <Skeleton className="h-6 w-3/4 bg-muted rounded-md mb-2" />
                        <Skeleton className="h-4 w-1/2 bg-muted rounded-md mb-4" />
                        <Skeleton className="h-8 w-full bg-muted rounded-md" />
                    </div>
                ))}
            </div>
           ) : books.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                {books.map(book => (
                    <BookItemCard key={book.id} book={book} onPurchase={() => handleEditBook(book)} />
                ))}
            </div>
           ) : (
             <p className="text-body-sm">No global books found.</p>
           )}
        </CardContent>
      </Card>

      <AdminBookForm
            isOpen={isBookFormOpen}
            onOpenChange={handleCloseBookForm}
            onSave={handleSaveBook}
            initialData={editingBook}
      />
      <AdminBookmarkForm
            isOpen={isBookmarkFormOpen}
            onOpenChange={handleCloseBookmarkForm}
            onSave={handleSaveBookmark}
            initialData={editingBookmark}
      />

    </div>
  );
}
