
"use client"

import type { LucideProps } from 'lucide-react';
import {
  AlertCircle,
  Award,
  Book,
  BookHeart,
  BookOpen,
  BrainCircuit,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Edit,
  Eye,
  Feather,
  FileText,
  Folder,
  FolderPlus,
  Globe,
  Grid,
  Grip,
  Image,
  Inbox,
  Info,
  Languages,
  Layers,
  LayoutDashboard,
  Library,
  List,
  ListChecks,
  ListMusic,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Minus,
  Moon,
  MoreVertical,
  Palette,
  Pause,
  PenLine,
  Pilcrow,
  Play,
  Plus,
  PlusSquare,
  Puzzle,
  RectangleHorizontal,
  RectangleVertical,
  RefreshCw,
  Repeat,
  Repeat1,
  RotateCw,
  Save,
  Search,
  SearchX,
  Send,
  Settings,
  Shield,
  Sparkles,
  Square,
  Star,
  Store,
  Table,
  Trash2,
  Trophy,
  Upload,
  User,
  Volume2,
  Wand2,
  X,
  Youtube,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Bookmark,
  ChevronUp,
  Maximize,
  MousePointer2,
  PackageOpen,
  SkipBack,
  SkipForward,
  IterationCw,
  ArrowRight, // Added this icon
} from 'lucide-react';
import * as React from 'react';

const ShadowingIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Left Trapezoid (Outlined) */}
      <polygon points="12,22 3,27 3,5 12,10" fill="none" />
      
      {/* Right Trapezoid (Filled) */}
      <polygon points="20,10 29,5 29,27 20,22" fill="currentColor" />
      
      {/* Center Dashed Line */}
      <line x1="16" y1="3" x2="16" y2="29" strokeDasharray="4 3" />
    </svg>
);


// List of all available icons from lucide-react that are used in the project
export const Icons = {
  AlertCircle,
  Award,
  Book,
  BookHeart,
  BookOpen,
  BrainCircuit,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Edit,
  Eye,
  Feather,
  FileText,
  Folder,
  FolderPlus,
  Globe,
  Grid,
  Grip,
  Image,
  Inbox,
  Info,
  Languages,
  Layers,
  LayoutDashboard,
  Library,
  List,
  ListChecks,
  ListMusic,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Minus,
  Moon,
  MoreVertical,
  Palette,
  Pause,
  PenLine,
  Pilcrow,
  Play,
  Plus,
  PlusSquare,
  Puzzle,
  RectangleHorizontal,
  RectangleVertical,
  RefreshCw,
  Repeat,
  Repeat1,
  RotateCw,
  Save,
  Search,
  SearchX,
  Send,
  Settings,
  Shield,
  Sparkles,
  Square,
  Star,
  Store,
  Table,
  Trash2,
  Trophy,
  Upload,
  User,
  Volume2,
  Wand2,
  X,
  Youtube,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Bookmark,
  ChevronUp,
  Maximize,
  MousePointer2,
  PackageOpen,
  SkipBack,
  SkipForward,
  IterationCw,
  Shadowing: ShadowingIcon,
  ArrowRight, // Added this icon
};

export type IconName = keyof typeof Icons;

interface IconProps extends Omit<LucideProps, 'ref'> {
    name: IconName;
}

export const Icon = ({ name, ...props }: IconProps) => {
    const LucideIcon = Icons[name];
    if (!LucideIcon) {
        // Fallback for an icon that might not be in the list
        return <div className="h-4 w-4" role="img" aria-label="icon placeholder" />;
    }
    return (
        <LucideIcon {...props} />
    );
};
