
import LibraryPageComponent from "../library-page-component";

// This component now simply renders the client-side page component,
// which will handle its own data fetching.
export default function PieceLibraryPage() {
  return <LibraryPageComponent contentType="piece" />;
}
