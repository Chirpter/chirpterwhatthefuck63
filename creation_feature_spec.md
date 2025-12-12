# 📝 Creation Feature Specification & Verification Checklist

## 🎯 PURPOSE
This document serves as an up-to-date **client acceptance checklist** for the Content Creation feature. It has been revised to reflect the current implementation and business requirements. Use this to verify system behavior.

---

## 📚 CONTENT TYPES

### ☑️ Feature 1.1: Dual Content Types
- [X] **Book**: Multi-chapter content with optional cover image.
- [X] **Piece**: Single-part content (poem, article, dialogue) without a cover.
- [X] Both types share common fields: title, origin, languages, tags, status.

**UI Implementation**: Tabs allow switching between "Book" and "Piece" creation modes.

---

## 🌍 LANGUAGE FORMATS (Content Presentation Modes)

### ☑️ Feature 2.1: Three Language Format Options

| Format | `origin` Value | Description | `unit` Field | `content` Structure |
|---|---|---|---|---|
| **Mono** | `"en"` | Single language only | `"sentence"` | `{"en": "..."}` |
| **Bi-Sentence**| `"en-vi"` | Bilingual sentence pairs | `"sentence"` | `{"en": "...", "vi": "..."}` |
| **Bi-Phrase** | `"en-vi-ph"`| Bilingual phrase chunks | `"phrase"` | `{"en": [...], "vi": [...]}` |

**Important Notes**:
- **AI Generation**: The AI model is now prompted differently based on the `unit`.
  - For `sentence` unit: `Primary sentence. {Secondary sentence.}`
  - For `phrase` unit: `Phrase 1 {Dịch 1} | Phrase 2 {Dịch 2}`.
- **Parsing**: The `MarkdownParser` correctly processes both AI output formats to populate the specified `content` structure. `Bi-Phrase` is no longer a client-side enhancement but is generated and stored correctly.
- **User Selection**: Users can choose "Sentence" or "Phrase" format in bilingual mode. This directly sets the `unit` and `origin` fields.

**Client Requirements**:
- [X] User can toggle between monolingual and bilingual modes.
- [X] When bilingual, user can choose "Sentence" or "Phrase" format.
- [X] Format selector is disabled when adding chapters to an existing book.

### ☑️ Feature 2.2: Language Selection
- [X] Primary and optional secondary language selectors.
- [X] Validation: Secondary language must differ from primary.
- [X] Supported languages: English, Spanish, French, Japanese, Korean, Vietnamese, Chinese (Simplified).

---

## 📖 BOOK-SPECIFIC FEATURES

### ☑️ Feature 3.1: Book Length Options

| Length | Chapters | Words/Chapter | Credits (Base) |
|---|---|---|---|
| **Short Story** | 1-3 | ~200 | 1 |
| **Mini Book** | 3-5 | ~200 | 2 |
| **Standard Book**| 4-15 | ~200 | 2 (preview) / 8 (full) |
| **Long Book** | 4-15 | ~300 | 15 (Coming Soon) |

**Client Requirements**:
- [X] User can select book length.
- [X] Credit costs for each length option are displayed.
- [X] "Long Book" is marked as "Coming Soon" and is disabled.

### ☑️ Feature 3.2: Generation Scope (Standard Book Only)

**When book length = "Standard Book"**:
- [X] **Preview Mode (2 credits)**: Generate first 2-4 chapters + outline for remaining chapters.
- [X] **Full Mode (8 credits)**: Generate complete book with all chapters.

**Expected Behavior**:
- [X] Scope selector appears for Standard/Long books.
- [X] Preview mode creates chapter titles for ungenerated chapters.
- [X] User can use "Add Chapters" from the Library to continue a book from preview.

### ☑️ Feature 3.3: Chapter Count Customization
- [X] Input field to specify target chapter count.
- [X] Default value updates based on selected book length.
- [X] Validation ranges are enforced on blur.

### ☑️ Feature 3.4: Cover Image Options

| Option | Description | Credits | Restrictions |
|---|---|---|---|
| **None** | No cover image | 0 | - |
| **AI Generate** | Generate from prompt | +1 | Free & Pro |
| **Upload** | Upload custom image | +1 | **Pro Only** |

**Client Requirements**:
- [X] Dropdown selector for cover option.
- [X] Text input for custom AI prompt appears when "AI Generate" is selected.
- [X] File input (disabled for Free users with a Pro badge) appears for "Upload".
- [X] Cover generation runs **in parallel** with content generation.

**File Validation** (Upload):
- [X] Maximum file size: 2MB.
- [X] Accepted formats: JPG, PNG, WebP.
- [X] Error message shown for oversized files.

---

## 🎨 PIECE-SPECIFIC FEATURES

### ☑️ Feature 4.1: Presentation Style

**Display Modes**:
- [X] **Book Mode**: Traditional layout with pagination.
- [X] **Card Mode**: Single card with aspect ratio options (1:1, 3:4, 4:3).

**Client Requirements**:
- [X] Visual selector with icon previews for style selection.
- [X] Selected style affects final rendering in the library.

### ☑️ Feature 4.2: Content Length
- [X] Fixed cost: **1 credit** per piece.
- [X] Target length: <500 words.

---

## ✍️ CONTENT INPUT & VALIDATION

### ☑️ Feature 5.1: AI Prompt Input

**Client Requirements**:
- [X] Multiline textarea with a character counter.
- [X] Placeholder text provides examples and is cleared on focus.
- [X] Required field (unless in "Add Chapters" mode).

**Validation Rules**:
- [X] **Client-side**: Max 500 characters.
- [X] **Server-side**: Truncates to 500 characters as a safety measure.
- [X] Error shown for empty or whitespace-only prompts.

### ☑️ Feature 5.2: Tags (Optional)
- [X] UI exists for adding and removing tags.
- [X] Tag format: lowercase, hyphens for spaces, alphanumeric only, max 15 chars.

---

## 💰 CREDIT SYSTEM

### ☑️ Feature 6.1: Credit Cost Calculation

**Formula**: `Total Cost = Base Content Cost + Cover Cost`
- Base Content Cost is determined by Book Length and Scope.
- Cover Cost is +1 for AI or Upload options.

**Display Requirements**:
- [X] Credit badge on the main "Generate" button shows the total calculated cost.
- [X] Badge updates dynamically as user changes options.
- [X] Hard-coded credit indicators on individual length options serve as a guide for the *base* content cost.

### ☑️ Feature 6.2: Insufficient Credits Handling
- [X] Submit button is disabled if `user.credits < creditCost`.
- [X] Button text changes to "Insufficient Credits".

### ☑️ Feature 6.3: Credit Deduction Timing
- [X] Credits are deducted atomically on the server when the creation job is initiated.
- [X] Failed generations can be retried from the Library without additional credit cost.

---

## 🎬 GENERATION WORKFLOW

### ☑️ Feature 7.1: Submit Flow & Session Recovery
1. [X] User fills form and clicks "Generate".
2. [X] Client validates inputs.
3. [X] `createLibraryItem` server action is called.
4. [X] Server returns a `jobId`.
5. [X] Client stores `jobId` in `sessionStorage` (Key: `activeJobId_{userId}`).
6. [X] Client subscribes to Firestore for real-time updates.
7. [X] On page reload, `useCreationJob` hook reads from `sessionStorage` to resume tracking the active job.

### ☑️ Feature 7.2: Parallel Generation Pipeline

**Server Behavior**:
- The server initiates content and cover generation pipelines to run **in parallel**.
- Each pipeline updates its own state (`contentState`, `coverState`) independently in Firestore.
- The overall job `status` is considered `draft` (complete) only when both pipelines finish (either `ready`, `error`, or `ignored`).
- Partial success is handled (e.g., content ready, cover failed).

### ☑️ Feature 7.3: Job Limit and Rate Limiting
- [X] A user can have a maximum of **3** jobs in the `processing` state simultaneously.
- [X] If a user tries to create a 4th job, the request is rejected, and a toast notification is shown.
- [X] The "Generate" button is temporarily disabled for 10 seconds as a cooldown.

---

## 🎨 ANIMATION & UI FEEDBACK

### ☑️ Feature 8.1: Generation Animation Sequence

**Visual States**:
1.  **Initial**: Closed book with placeholder cover.
2.  **Content Processing**: Book opens, typewriter animation with sample text appears.
3.  **Cover Processing**: If content finishes first, book closes, cover area shows loading indicator.
4.  **Completed**: Book shows final cover (if any). "View in Library" button appears.

**Important Note**: The visual animation appears sequential, but the actual generation pipelines on the server run in parallel.

### ☑️ Feature 8.2: Error States

**Partial Failure Scenarios**:
- [X] Content ✓, Cover ✗ → Displays error message for cover.
- [X] Content ✗, Cover ✓ → Displays error message for content.
- [X] Both ✗ → Displays a general failure message.
- [X] "Retry" buttons appear in the library for failed pipelines.

---

## 📤 OUTPUT FORMAT & PARSING

### ☑️ Feature 9.1: AI Output Format (Unified Markdown)

The AI is always prompted to generate a single Markdown string containing both title and content.

**Monolingual Example**:
```markdown
# My Adventure
This is the first sentence. This is the second.
```

**Bilingual Sentence Example**:
```markdown
# My Adventure {Cuộc phiêu lưu của tôi}
First sentence. {Câu đầu tiên.} Second sentence. {Câu thứ hai.}
```

**Bilingual Phrase Example**:
```markdown
# My Phrased Story {Truyện Cụm Từ}
Phrase one {Cụm một} | phrase two {cụm hai}.
```

### ☑️ Feature 9.2: Parser Logic

The `MarkdownParser` service is responsible for consuming the AI's markdown output and converting it into the final Firestore data structure.

**Parsing Rules**:
- [X] **Title**: Extracts `# Title {Dịch}` as the book title.
- [X] **Chapters**: Splits content at `## Chapter` headings.
- [X] **Paragraphs**: Splits content into paragraphs based on double newlines (`\n\n`).
- [X] **Sentences/Phrases**:
  - For `sentence` unit: Splits each paragraph into sentences using robust sentence-boundary detection. Handles bilingual `{}` pairs.
  - For `phrase` unit: Splits each sentence by the `|` delimiter first, then processes each `Primary {Secondary}` pair.
- [X] **Data Structure**: Populates the `segments` array with the appropriate `content` object structure based on the `unit`.

**Example `bi-phrase` output structure**:
```typescript
{
  segments: [
    {
      type: "start_para",
      content: {
        en: ["Phrase one", "phrase two."],
        vi: ["Cụm một", "cụm hai."]
      },
      // ... other fields
    }
  ]
}
```

---

## 🔧 ADVANCED FEATURES

### ☑️ Feature 10.1: Add Chapters Mode (Book Only)

**Current Implementation**: This logic is now handled in `book-creation.service.ts` via the `regenerateBookContent` function. It is **not** part of the `CreateView` UI.
- It can be triggered from the Library on a book that is a "preview".
- The service automatically summarizes existing content to provide context to the AI for generating new chapters.

### ☑️ Feature 10.2: Pro Feature Enforcement
- [X] **Upload Cover (Pro Only)**: The UI correctly shows a "Pro" badge and disables the file input for non-Pro users.
- [X] **Server validation** is in place to reject upload requests from non-Pro users.

---

**Document Version**: 1.1 (Revised to match current code)
**Last Updated**: [Current Date]
**Status**: Aligned with Production Code
```