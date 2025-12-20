
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Book, Chapter, CoverJobType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LANGUAGES, MAX_IMAGE_SIZE_BYTES } from '@/lib/constants';
import { useToast } from '@/hooks/useToast';
import { Icon } from '@/components/ui/icons';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

const formSchema = z.object({
  title: z.string().min(1, "Title is required."),
  author: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be 0 or more."),
  isBilingual: z.boolean(),
  primaryLanguage: z.string(),
  secondaryLanguage: z.string().optional(),
  tags: z.array(z.string()),
  content: z.string().min(1, "JSON content is required.").refine(val => {
      try {
          JSON.parse(val);
          return true;
      } catch (e) {
          return false;
      }
  }, { message: "Invalid JSON format for content." }),
  coverImageOption: z.enum(['upload', 'none']),
  coverImageFile: z.any().optional(),
  isGlobal: z.literal(true),
});

type AdminBookFormValues = z.infer<typeof formSchema>;

interface AdminBookFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: AdminBookFormValues, bookId?: string) => Promise<void>;
  initialData?: Book | null;
}

export const AdminBookForm: React.FC<AdminBookFormProps> = ({ isOpen, onOpenChange, onSave, initialData }) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AdminBookFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      isGlobal: true,
      tags: [],
      price: 0,
      isBilingual: false,
      primaryLanguage: 'en',
      coverImageOption: 'none',
    },
  });

  const tags = watch('tags');
  const isBilingual = watch('isBilingual');

  useEffect(() => {
    if (initialData) {
      const [primaryLang, secondaryLang] = (initialData.origin || 'en').split('-');
      const initialIsBilingual = initialData.langs?.length > 1;
      reset({
        title: initialData.title[primaryLang] || Object.values(initialData.title)[0] || '',
        author: initialData.author,
        price: initialData.price || 0,
        isBilingual: initialIsBilingual,
        primaryLanguage: primaryLang,
        secondaryLanguage: initialIsBilingual ? secondaryLang : undefined,
        tags: initialData.tags || [],
        content: JSON.stringify(initialData.chapters || [], null, 2),
        coverImageOption: initialData.cover?.url ? 'upload' : 'none',
        isGlobal: true,
      });
    } else {
      reset({
        title: '',
        author: '',
        price: 0,
        isBilingual: false,
        primaryLanguage: 'en',
        secondaryLanguage: undefined,
        tags: [],
        content: '[]',
        coverImageOption: 'none',
        coverImageFile: null,
        isGlobal: true,
      });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: AdminBookFormValues) => {
    setIsSaving(true);
    try {
      await onSave(data, initialData?.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save book:", error);
      toast({ title: "Error", description: "Failed to save the book.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        toast({ title: "File too large", description: `Please upload an image smaller than ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB.`, variant: "destructive" });
        return;
      }
      setValue('coverImageFile', file);
    }
  };
  
  const handleAddTag = () => {
    const newTag = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (newTag && !tags.includes(newTag)) {
      setValue('tags', [...tags, newTag]);
    }
    setTagInput('');
  };
  
  const handleRemoveTag = (tagToRemove: string) => {
    setValue('tags', tags.filter(tag => tag !== tagToRemove));
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] font-body">
        <DialogHeader>
          <DialogTitle className="text-headline-1">{initialData ? 'Edit Global Book' : 'Add New Global Book'}</DialogTitle>
          <DialogDescription className="text-body-sm">
            Fill in the details for the system-wide book. Content must be a valid JSON array of Chapters.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right text-body-sm">Title</Label>
            <Input id="title" {...register('title')} className="col-span-3" />
            {errors.title && <p className="col-span-4 text-right text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="author" className="text-right text-body-sm">Author</Label>
            <Input id="author" {...register('author')} className="col-span-3" />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price" className="text-right text-body-sm">Price (Credits)</Label>
            <Input id="price" type="number" {...register('price')} className="col-span-3" />
            {errors.price && <p className="col-span-4 text-right text-xs text-destructive">{errors.price.message}</p>}
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-body-sm">Languages</Label>
            <div className="col-span-3 space-y-2">
                <div className="flex items-center space-x-2">
                    <Controller
                        name="isBilingual"
                        control={control}
                        render={({ field }) => <Switch id="isBilingual" checked={field.value} onCheckedChange={field.onChange} />}
                    />
                    <Label htmlFor="isBilingual">Bilingual</Label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Controller
                        name="primaryLanguage"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Primary Language" /></SelectTrigger>
                                <SelectContent>{LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                            </Select>
                        )}
                    />
                    {isBilingual && (
                         <Controller
                            name="secondaryLanguage"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Secondary Language" /></SelectTrigger>
                                    <SelectContent>{LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                                </Select>
                            )}
                        />
                    )}
                </div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="tags" className="text-right text-body-sm">Tags</Label>
                <div className="col-span-3">
                    <div className="flex gap-2">
                        <Input id="tags" value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="e.g., van-hoc-viet-nam" />
                        <Button type="button" onClick={handleAddTag}>Add</Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                        {tags.map(tag => (
                            <Badge key={tag} variant="secondary">
                                {tag}
                                <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1 rounded-full p-0.5 hover:bg-destructive/50">
                                    <Icon name="X" className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                </div>
          </div>
          
           <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-body-sm">Cover Image</Label>
            <div className="col-span-3">
                <Controller
                    name="coverImageOption"
                    control={control}
                    render={({ field }) => (
                         <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Cover Option" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="upload">Upload New</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
                 {watch('coverImageOption') === 'upload' && (
                    <Input type="file" accept="image/*" className="mt-2" onChange={handleFileChange} />
                )}
            </div>
          </div>


          <div className="grid grid-cols-4 gap-4">
            <Label htmlFor="content" className="text-right pt-2 text-body-sm">Content (JSON)</Label>
            <Textarea id="content" {...register('content')} className="col-span-3 h-48 font-mono" />
            {errors.content && <p className="col-span-4 text-right text-xs text-destructive">{errors.content.message}</p>}
          </div>

        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSaving}>
            {isSaving && <Icon name="Wand2" className="mr-2 h-4 w-4 animate-pulse" />}
            Save Book
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
