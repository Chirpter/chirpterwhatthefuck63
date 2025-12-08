

"use client";

import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/useToast';
import type { Book, Chapter } from '@/lib/types';
import { getGlobalBooks } from '@/services/library-service';

type FormValues = {
  title: string;
  author?: string;
  price: number;
  isBilingual: boolean;
  primaryLanguage: string;
  secondaryLanguage?: string;
  tags: string[];
  content: string;
  coverImageOption: 'upload' | 'none';
  coverImageFile?: File | null;
  isGlobal: true;
};

export const useAdminBooks = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const { toast } = useToast();

  const loadGlobalBooks = useCallback(async () => {
    setIsLoading(true);
    try {
        const globalBooks = await getGlobalBooks({ all: true });
        setBooks(globalBooks.items);
    } catch (error) {
        console.error('Error fetching global books:', error);
        toast({
            title: 'Error',
            description: 'Could not load books from the store.',
            variant: 'destructive',
        });
    } finally {
        setIsLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    loadGlobalBooks();
  }, [loadGlobalBooks]);

  const handleAddNew = () => {
    setEditingBook(null);
    setIsFormOpen(true);
  };

  const handleEdit = (book: Book) => {
    setEditingBook(book);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingBook(null);
  };

  const handleSave = async (data: FormValues, bookId?: string) => {
    try {
      let chapters: Chapter[];
      try {
        chapters = JSON.parse(data.content);
        if (!Array.isArray(chapters)) throw new Error("Content is not a JSON array.");
      } catch (e) {
        throw new Error("Invalid JSON format for chapters.");
      }

      let coverUrl: string | undefined = undefined;
      if (data.coverImageOption === 'upload' && data.coverImageFile) {
        const fileReader = new FileReader();
        const fileDataUrl = await new Promise<string>((resolve, reject) => {
          fileReader.onerror = reject;
          fileReader.onload = () => resolve(fileReader.result as string);
          fileReader.readAsDataURL(data.coverImageFile!);
        });
        
        const storagePath = `globalCovers/${bookId || Date.now()}/cover.webp`;
        const imageRef = storageRef(storage, storagePath);
        await uploadString(imageRef, fileDataUrl, 'data_url');
        coverUrl = await getDownloadURL(imageRef);
      }

      const bookData: Omit<Book, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        title: { [data.primaryLanguage]: data.title },
        author: data.author,
        price: data.price,
        isBilingual: data.isBilingual,
        origin: data.isBilingual ? `${data.primaryLanguage}-${data.secondaryLanguage}` : data.primaryLanguage,
        langs: data.isBilingual ? [data.primaryLanguage, data.secondaryLanguage as string] : [data.primaryLanguage],
        tags: data.tags,
        isGlobal: true,
        type: 'book',
        chapters,
        status: 'published',
        contentState: 'ready',
        coverState: coverUrl ? 'ready' : 'ignored',
        labels: [], // Or derive from tags if needed
        display: 'book',
        cover: coverUrl ? { url: coverUrl, type: 'upload' } : undefined,
      };

      if (bookId) {
        await updateDoc(doc(db, 'globalBooks', bookId), { ...bookData, updatedAt: serverTimestamp() });
        toast({ title: "Success", description: "Book updated successfully." });
      } else {
        await addDoc(collection(db, 'globalBooks'), { ...bookData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        toast({ title: "Success", description: "New global book added." });
      }
      handleCloseForm();
      loadGlobalBooks(); // Refresh list after saving
    } catch (error) {
      console.error("Error saving global book:", error);
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
      throw error; // Re-throw to keep the dialog open
    }
  };

  return {
    books,
    isLoading,
    isFormOpen,
    editingBook,
    handleAddNew,
    handleEdit,
    handleSave,
    handleCloseForm,
    loadGlobalBooks,
  };
};
