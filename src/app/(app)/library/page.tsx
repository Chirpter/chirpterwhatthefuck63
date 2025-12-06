import { redirect } from 'next/navigation';

// This is the root page for authenticated users.
// It should redirect to the default authenticated view, which is the book library.
export default function LibraryRootPage() {
  redirect('/library/book');
}
