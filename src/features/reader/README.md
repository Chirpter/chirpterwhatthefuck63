# Reader Feature

This directory contains all components and logic specifically for the content reading experience.

## Key Components

-   `BookReader.tsx`: The main component for displaying paginated book content.
-   `PieceReader.tsx`: The main component for displaying single-page "piece" content.
-   `shared/ContentPageRenderer.tsx`: Renders the content of a single page, applying formatting and styles.
-   `shared/ReaderToolbar.tsx`: The floating toolbar for changing font size, background, etc.
-   `shared/SegmentRenderer.tsx`: Renders a single segment of text, handling monolingual, bilingual, and text highlighting logic.

## Core Dependencies & Logic Flow

The Reader feature is complex and relies on several key systems from outside this directory. Understanding this flow is crucial for development.

1.  **Entry Point (`/read/[id]/page.tsx`):**
    -   This is a **Server Component**.
    -   It fetches the `Book` or `Piece` data from Firestore using a server-side service.
    -   It then renders either `<BookReader>` or `<PieceReader>` and passes the fetched data as a prop.
    -   **Key Takeaway:** Reader components receive their primary data already loaded.

2.  **Pagination System (`/lib/pagination/`):**
    -   **This is the most critical dependency.** It's responsible for splitting the content into pages.
    -   **`usePagination.ts` (Hook):** The "conductor" used by `BookReader` and `PieceReader`. It orchestrates the process.
    -   **`SegmentCalibrator.ts`:** A utility class that measures the dimensions of text elements in the browser to establish a baseline. It caches results in `localStorage` for performance.
    -   **`PageCalculator.ts`:** Uses the baseline from the calibrator to calculate how many segments can fit on each page.
    -   **Key Takeaway:** Changes to fonts, text sizes, or container dimensions within the Reader **will** affect pagination calculations.

3.  **Content Parsing (`/services/shared/SegmentParser.ts`):**
    -   This service contains the logic to parse Markdown text from the AI into structured `Segment` objects.
    -   It handles splitting text into sentences or phrases and parsing bilingual formats (e.g., `English sentence. {Vietnamese translation.}`).
    -   **Key Takeaway:** The Reader components consume the output of this parser. Any issues with how text is displayed often trace back to this file.

4.  **Global Contexts & Hooks:**
    -   **`useAudioPlayer` (`/contexts/audio-player-context.tsx`):** The Reader syncs with the audio player. When a segment is being spoken, the Reader must highlight the corresponding text and automatically turn to the correct page.
    -   **`useEditorSettings` (`/hooks/useEditorSettings.ts`):** This hook manages user preferences for the reader (background, font size, etc.) and persists them in `localStorage`. The `ReaderToolbar` modifies these settings, and `ContentPageRenderer` consumes them to apply styles.
    -   **`useSettings` (`/contexts/settings-context.tsx`):** Used to check if the global "Word Lookup" feature is enabled.
    -   **`LookupPopover` (`/features/lookup/`):** Triggered by the Reader when a user selects text.

## Development Workflow

1.  A user navigates to `/read/[id]`.
2.  The server-side `page.tsx` fetches the data for that `id`.
3.  The `BookReader` or `PieceReader` component is rendered with the data.
4.  The `usePagination` hook is activated.
5.  `SegmentCalibrator` quickly checks for a cached layout baseline in `localStorage`. If not found, it invisibly renders and measures sample text to create one.
6.  `PageCalculator` uses this baseline to divide all `Segment` objects into an array of `Page` objects.
7.  The `BookReader` receives the `pages` array and displays the current page (`pages[currentPageIndex]`).
8.  The user interacts, changing pages (which updates `currentPageIndex`) or modifying settings via `ReaderToolbar`.
9.  If the audio player is active for this book, `useEffect` in `BookReader` listens for changes and automatically turns the page.
