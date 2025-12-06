
"use client";
import LibraryPageComponent from "../library-page-component";

// This component now simply renders the client-side page component,
// which will handle its own data fetching.
export default function OtherLibraryPage() {
  // We'll treat 'other' as 'piece' for data fetching purposes
  return <LibraryPageComponent contentType="piece" />;
}
