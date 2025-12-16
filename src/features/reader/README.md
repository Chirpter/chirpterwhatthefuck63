# Reader Feature Architecture & Dependencies

This document outlines the architecture of the Reader feature and its key dependencies on other parts of the Chirpter application. It is intended for developers working on or integrating with the Reader components.

---

## 1. Core Philosophy

The Reader is designed to be a "dumb" but powerful display engine. Its primary responsibilities are:
1.  **Displaying Content:** Efficiently rendering text and other media based on structured data.
2.  **Pagination:** Intelligently splitting long content into virtual pages.
3.  **Interactivity:** Responding to user input (text selection, toolbar changes) and global state changes (audio playback).

The Reader itself should contain minimal business logic. Most of the heavy lifting is delegated to specialized services and hooks.

---

## 2. Key Components & Their Roles

-   **`BookReader.tsx` / `PieceReader.tsx`**: These are the main entry points for the feature. They orchestrate all other parts of the reader, manage state, and handle user interactions like text selection.
-   **`shared/ContentPageRenderer.tsx`**: A crucial component responsible for rendering a single "page" of content. It applies formatting, styles, and highlights text based on audio playback.
-   **`shared/ReaderToolbar.tsx`**: The UI for user settings (font size, background, etc.). It interacts with `useEditorSettings` to persist choices.

---

## 3. External Dependencies

A developer working on the Reader **MUST** be aware of the following files and systems outside the `src/features/reader/` directory.

### 3.1. Data Flow & Routing

-   **Entry Point:** `src/app/(app)/read/[id]/page.tsx`
    -   **Description:** This is the Next.js Server Component that initiates the entire reading experience.
    -   **Responsibility:** It fetches the `Book` or `Piece` data from Firestore using a server-side service (`getLibraryItemById`) before the client-side `BookReader` or `PieceReader` is ever rendered.
    -   **Key Takeaway:** The Reader component receives its primary `book` or `piece` data as a fully-resolved prop. It does not fetch this data itself.

### 3.2. Core Logic Services

-   **Pagination Engine:**
    -   **Files:** `src/lib/pagination/PageCalculator.ts` & `src/lib/pagination/SegmentCalibrator.ts`
    -   **Description:** This is the "brain" behind pagination. `SegmentCalibrator` measures the height of text segments, and `PageCalculator` uses that data to divide content into pages that fit the screen.
    -   **Key Takeaway:** Any change to fonts, line-height, or element padding within the Reader will affect this engine's calculations.

-   **Content Parser:**
    -   **File:** `src/services/shared/SegmentParser.ts`
    -   **Description:** This service contains the logic for parsing the raw Markdown content (from AI generation) into the structured `Segment[]` array that the entire Reader system depends on.
    -   **Key Takeaway:** Understand how `sentence` vs. `phrase` units are handled, and how bilingual content `{}` is parsed.

### 3.3. Global Contexts & Hooks (State Management)

The Reader is a highly interactive component that subscribes to several global states.

-   **Audio Player:**
    -   **Hook:** `useAudioPlayer` (from `src/contexts/audio-player-context.tsx`)
    -   **File:** `src/features/player/services/AudioEngine.ts`
    -   **Usage:**
        -   The Reader listens to `audioPlayer.position` to automatically turn pages as the audio progresses.
        -   It uses `audioPlayer.currentSegmentLanguage` and `audioPlayer.speechBoundary` to apply real-time text highlighting.

-   **Editor Settings:**
    -   **Hook:** `useEditorSettings` (from `src/hooks/useEditorSettings.ts`)
    -   **Usage:** Persists the user's visual preferences (font size, background color) for each book individually using `localStorage`. Used by `ReaderToolbar` and `ContentPageRenderer`.

-   **General App Settings:**
    -   **Hook:** `useSettings` (from `src/contexts/settings-context.tsx`)
    -   **Usage:** Primarily used to check if the `wordLookupEnabled` feature is active before handling text selection.

-   **Lookup Popover:**
    -   **Component:** `src/features/lookup/components/LookupPopover.tsx`
    -   **Usage:** When a user selects text, the Reader calculates the position and context, then triggers this global popover to display translation and other info.

### 3.4. Data Structures (Types)

-   **File:** `src/lib/types.ts`
    -   **Description:** The single source of truth for data shapes.
    -   **Key Takeaway:** All data passed to and used within the Reader components **must** conform to the interfaces defined here, especially `Book`, `Piece`, `Chapter`, and `Segment`.

---

## 4. Development Workflow Example

A typical data flow for rendering a book page:

1.  User navigates to `/read/book-123`.
2.  `page.tsx` on the server fetches the data for `book-123`.
3.  `BookReader` component is rendered on the client with the fetched `book` data.
4.  `usePagination` hook is called.
5.  `SegmentCalibrator` runs, checks its cache, or measures text heights by rendering hidden elements.
6.  `PageCalculator` takes the calibration data and the book's segments, then calculates and returns an array of `Page` objects.
7.  `BookReader` now has the paginated data and displays the current page (`pages[currentPageIndex]`) via `ContentPageRenderer`.
8.  If the user plays audio, `useAudioPlayer` updates, causing `BookReader` to re-render, find the new page for the current audio segment, and update its state.

By understanding these external dependencies, the Reader team can work more effectively and avoid introducing breaking changes to the rest of the application.
