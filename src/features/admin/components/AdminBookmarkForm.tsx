
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CombinedBookmark, BookmarkStatus } from '@/features/admin/hooks/useAdminBookmarks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/useToast';
import { Icon } from '@/components/ui/icons';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';


const formSchema = z.object({
  price: z.coerce.number().min(0, "Price must be 0 or more.").default(0),
  status: z.enum(['published', 'unpublished', 'maintenance']).default('unpublished'),
  unlockType: z.enum(['free', 'purchase', 'pro']).default('free'),
  releaseDate: z.date().optional(),
  endDate: z.date().optional(),
});

type AdminBookmarkFormValues = z.infer<typeof formSchema>;

interface StatusChangeDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    currentStatus: BookmarkStatus;
    onConfirm: (newStatus: BookmarkStatus) => void;
    isSubmitting: boolean;
}

const StatusChangeDialog: React.FC<StatusChangeDialogProps> = ({ isOpen, onOpenChange, currentStatus, onConfirm, isSubmitting }) => {
    const [selectedStatus, setSelectedStatus] = useState<BookmarkStatus | ''>('');
    const [confirmationText, setConfirmationText] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSelectedStatus('');
            setConfirmationText('');
        }
    }, [isOpen]);

    const isConfirmationMatching = selectedStatus ? confirmationText === selectedStatus : false;
    const availableStatuses = (['published', 'unpublished', 'maintenance'] as BookmarkStatus[]).filter(s => s !== currentStatus);

    return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Change Bookmark Status</AlertDialogTitle>
                    <AlertDialogDescription>
                        Select a new status. To confirm, you must type the name of the new status. This is a critical action.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                    <Select onValueChange={(v) => setSelectedStatus(v as BookmarkStatus)} value={selectedStatus}>
                        <SelectTrigger><SelectValue placeholder="Select new status..." /></SelectTrigger>
                        <SelectContent>
                            {availableStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    {selectedStatus && (
                         <div className="space-y-2">
                             <Label htmlFor="confirmation-text">
                                Type <span className="font-bold text-primary">{selectedStatus}</span> to confirm:
                            </Label>
                             <Input
                                id="confirmation-text"
                                value={confirmationText}
                                onChange={(e) => setConfirmationText(e.target.value)}
                                disabled={isSubmitting}
                                autoFocus
                            />
                         </div>
                    )}
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => selectedStatus && onConfirm(selectedStatus)} disabled={!isConfirmationMatching || isSubmitting}>
                         {isSubmitting && <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Change
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};


interface AdminBookmarkFormProps {
  initialData: CombinedBookmark | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: Partial<AdminBookmarkFormValues>, bookmarkId: string) => Promise<void>;
}

export const AdminBookmarkForm: React.FC<AdminBookmarkFormProps> = ({ isOpen, onOpenChange, onSave, initialData }) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isStatusChangeDialogOpen, setIsStatusChangeDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<AdminBookmarkFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      price: 0,
      status: 'unpublished',
      unlockType: 'free',
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        price: initialData.price || 0,
        status: initialData.status || 'unpublished',
        unlockType: initialData.unlockType || 'free',
        releaseDate: initialData.releaseDate ? new Date(initialData.releaseDate) : undefined,
        endDate: initialData.endDate ? new Date(initialData.endDate) : undefined,
      });
    } else {
      reset();
    }
  }, [initialData, reset]);

  const onSubmit = async (data: AdminBookmarkFormValues) => {
    if (!initialData) return;
    setIsSaving(true);
    try {
      // We only save fields that are editable in this form, status is handled separately.
      const dataToSave: Partial<AdminBookmarkFormValues> = {
          price: data.price,
          unlockType: data.unlockType,
          releaseDate: data.releaseDate,
          endDate: data.endDate,
      };
      await onSave(dataToSave, initialData.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save bookmark metadata:", error);
      toast({ title: "Error", description: "Failed to save the bookmark metadata.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: BookmarkStatus) => {
    if (!initialData) return;
    setIsSaving(true);
    try {
        await onSave({ status: newStatus }, initialData.id);
        toast({ title: "Status Updated", description: `Bookmark is now ${newStatus}.` });
        setIsStatusChangeDialogOpen(false);
        onOpenChange(false); // Close the main dialog too
    } catch (error) {
        console.error("Failed to update status:", error);
        toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };
  
  const statusColorClasses = {
      published: 'bg-green-100 text-green-800 border-green-300',
      unpublished: 'bg-gray-100 text-gray-800 border-gray-300',
      maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-300'
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] font-body">
        <DialogHeader>
          <DialogTitle className="font-headline">Edit Bookmark Metadata</DialogTitle>
          <DialogDescription>
            Configure how this bookmark ({initialData?.name}) is accessed by users.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Status</Label>
              <div className="col-span-3 flex items-center justify-between">
                <div className={cn("px-2.5 py-0.5 text-xs font-semibold rounded-full border", statusColorClasses[initialData?.status || 'unpublished'])}>
                    {initialData?.status || 'unpublished'}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsStatusChangeDialogOpen(true)}>
                    Change Status
                </Button>
              </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="unlockType" className="text-right">Unlock Type</Label>
            <Controller
              name="unlockType"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select unlock type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="purchase">Purchase</SelectItem>
                    <SelectItem value="pro">Pro Perk</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price" className="text-right">Price (Credits)</Label>
            <Input id="price" type="number" {...register('price')} className="col-span-3" />
            {errors.price && <p className="col-span-4 text-right text-xs text-destructive">{errors.price.message}</p>}
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Availability</Label>
             <div className="col-span-3 space-y-2">
                 <Controller
                  name="releaseDate"
                  control={control}
                  render={({ field }) => (
                     <Popover>
                        <PopoverTrigger asChild>
                          <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                            <Icon name="Calendar" className="mr-2 h-4 w-4" />
                            {field.value ? `Starts: ${format(field.value, "PPP")}` : <span>Set release date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent>
                      </Popover>
                  )}
                />
                 <Controller
                  name="endDate"
                  control={control}
                  render={({ field }) => (
                     <Popover>
                        <PopoverTrigger asChild>
                          <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                            <Icon name="Calendar" className="mr-2 h-4 w-4" />
                            {field.value ? `Ends: ${format(field.value, "PPP")}` : <span>Set end date (optional)</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent>
                      </Popover>
                  )}
                />
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSaving}>
            {isSaving && <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />}
            Save Metadata
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <StatusChangeDialog 
        isOpen={isStatusChangeDialogOpen}
        onOpenChange={setIsStatusChangeDialogOpen}
        currentStatus={initialData?.status || 'unpublished'}
        onConfirm={handleStatusChange}
        isSubmitting={isSaving}
    />
    </>
  );
};
