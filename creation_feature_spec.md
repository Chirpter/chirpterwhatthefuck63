# 📝 Creation Feature Specification & Verification Checklist

## 🎯 PURPOSE
This document serves as a **client acceptance checklist** for the Content Creation feature. It focuses on **expected behaviors** and **business requirements** rather than implementation details. Use this to verify the system matches client expectations before optimization.

---

## 📚 CONTENT TYPES

### ☑️ Feature 1.1: Dual Content Types
- [x] **Book**: Multi-chapter content with optional cover image.
- [x] **Piece**: Single-part content (poem, article, dialogue) without cover.
- [x] Both types share common fields: title, origin, languages, tags, status.

**UI Implementation**: A tab selector switches between "Book" and "Piece" creation forms, each managed by the `useCreationJob` hook configured for that specific type.

---

## 🌍 LANGUAGE FORMATS (Content Presentation Modes)

### ☑️ Feature 2.1: Three Language Format Options

| Format | `origin` Value | `unit` Field | Description | AI Generation |
|--------|----------------|--------------|-------------|---------------|
| **Mono** | `"en"` | `sentence` | Single language only | Sentence |
| **Bi-Sentence** | `"en-vi"` | `sentence` | Bilingual sentence pairs | Paired sentences |
| **Bi-Phrase** | `"en-vi-ph"`| `phrase` | Bilingual phrase chunks | Paired phrases |

**Important Notes**:
- The `origin` field defines the language and format requested from the AI.
- The `unit` field in the database (`sentence` or `phrase`) determines how the content is structured and rendered.
- **Bi-Phrase** generation now correctly instructs the AI to return phrase-pairs, which are then parsed and stored appropriately.

**Client Requirements**:
- [x] User can toggle between monolingual and bilingual modes.
- [x] When bilingual, user can choose "Sentence" or "Phrase" format, which correctly updates the `origin` and `unit` values.
- [ ] Format selector is disabled in "Add Chapters" mode (maintains existing book format).

### ☑️ Feature 2.2: Language Selection
- [x] Primary language selector (required).
- [x] Secondary language selector (appears when bilingual mode enabled).
- [x] Validation: Secondary language must differ from primary.
- [x] Supported languages: English, Spanish, French, Japanese, Korean, Vietnamese, Chinese (Simplified).

---

## 📖 BOOK-SPECIFIC FEATURES

### ☑️ Feature 3.1: Book Length Options

| Length | Chapters | Words/Chapter | Base Credits |
|--------|----------|---------------|--------------|
| **Short Story** | 1-3 | ~200 | 1 |
| **Mini Book** | 3-5 | ~200 | 2 |
| **Standard Book** | 4-15 | ~200 | 2 (Preview) / 8 (Full) |
| **Long Book** | 4-15 | ~300 | 15 |

**Client Requirements**:
- [x] User can select book length from cards.
- [x] Credit cost for the content is displayed on each option card.
- [x] "Long Book" is correctly marked as "Coming Soon" and disabled.

### ☑️ Feature 3.2: Generation Scope (Standard Book Only)

**When book length = "Standard Book"**:
- [x] **Preview Mode (2 credits)**: Generate first 2-4 chapters + outline for remaining chapters.
- [x] **Full Mode (8 credits)**: Generate complete book with all chapters.

**Expected Behavior**:
- [x] Scope selector appears only for Standard/Long books.
- [x] Preview mode creates chapter titles for ungenerated chapters.
- [x] User can later use "Add Chapters" to continue from preview.

### ☑️ Feature 3.3: Chapter Count Customization
- [x] Input field to specify target chapter count.
- [x] Default value based on selected book length.
- [x] Validation ranges are correctly applied:
  - Short Story: 1-3 chapters
  - Mini Book: 1-5 chapters
  - Standard Book: 4-15 chapters
  - Long Book: 4-15 chapters
- [x] Auto-corrects on blur if out of range.

### ☑️ Feature 3.4: Cover Image Options

| Option | Description | Credits | Restrictions |
|--------|-------------|---------|--------------|
| **None** | No cover image | 0 | - |
| **AI Generate** | Generate from prompt | +1 | Free & Pro |
| **Upload** | Upload custom image | +1 | **Pro Only** |

**Client Requirements**:
- [x] Dropdown selector for cover option.
- [x] When "AI Generate" selected: text input for custom prompt appears.
- [x] When "Upload" selected: file input appears (correctly disabled for Free users with Pro badge).
- [x] If no custom prompt, AI uses book title/description.
- [x] Cover generation runs **in parallel** with content generation.

**File Validation** (Upload):
- [x] Maximum file size: 2MB.
- [x] Accepted formats: JPG, PNG, WebP.
- [x] Shows an error toast if file exceeds limit.

---

## 🎨 PIECE-SPECIFIC FEATURES

### ☑️ Feature 4.1: Presentation Style

**Display Modes**:
- [x] **Book Mode**: Traditional book layout with pagination.
- [x] **Card Mode**: Single card with aspect ratio options.
  - [x] Square (1:1)
  - [x] Portrait (3:4) - Default
  - [x] Landscape (4:3)

**Client Requirements**:
- [x] Visual selector with icon previews.
- [x] Selected style affects final rendering in library.

### ☑️ Feature 4.2: Content Length
- [x] Fixed cost: **1 credit** per piece.
- [x] Target length: <500 words.
- [x] No chapter/section controls (single unified content).

---

## ✍️ CONTENT INPUT & VALIDATION

### ☑️ Feature 5.1: AI Prompt Input

**Client Requirements**:
- [x] Multiline textarea for content description.
- [x] Character counter showing "X / 500".
- [x] Placeholder text provides examples.
- [x] Auto-focus on a default prompt clears it for user input.
- [x] Required field.

**Validation Rules**:
- [x] **Client-side**: Max 500 characters.
- [x] **Server-side**: Truncates to 500 characters.
- [x] Empty prompt shows error: "Prompt is required".

### ☑️ Feature 5.2: Tags (Optional)
- [x] User can add and remove custom tags in the creation form.
- [x] Tag format: lowercase, hyphens for spaces, alphanumeric only.

---

## 💰 CREDIT SYSTEM

### ☑️ Feature 6.1: Credit Cost Calculation

**Formula**:
```
Total Cost = Base Content Cost + Cover Cost (if applicable)
```

**Display Requirements**:
- [x] Credit cost for each length option is shown on its card.
- [x] Credit badge on submit button shows **total calculated cost**.
- [x] Cost updates dynamically when user changes:
  - Book length
  - Generation scope
  - Cover option

### ☑️ Feature 6.2: Insufficient Credits Handling
- [x] Submit button disabled when `user.credits < creditCost`.
- [x] Button shows "Insufficient Credits" text.

### ☑️ Feature 6.3: Credit Deduction Timing
- [x] Credits deducted **immediately** when submit button clicked.
- [x] Deduction happens **before** AI generation starts, within an atomic transaction.

**Retry Mechanism**:
- [x] Failed generations can be retried from Library.
- [x] Retry does NOT deduct additional credits.

---

## 🎬 GENERATION WORKFLOW

### ☑️ Feature 7.1: Submit Flow (`useCreationJob` Hook)

**Client Requirements**:
1. [x] User fills form and clicks "Generate".
2. [x] Client validates all inputs.
3. [x] If valid, call server action `createLibraryItem`.
4. [x] Server returns `jobId` immediately.
5. [x] Client stores `jobId` in sessionStorage for recovery.
6. [x] Client subscribes to Firestore for real-time updates on that `jobId`.
7. [x] UI shows generation animation.

### ☑️ Feature 7.2: Pre-Validation Checklist (Client-Side)
- [x] Prompt is not empty.
- [x] Prompt ≤ 500 characters.
- [x] Secondary language ≠ Primary language (if bilingual).
- [x] Chapter count within valid range.
- [x] Cover file ≤ 2MB (if upload mode).
- [x] User has sufficient credits.

### ☑️ Feature 7.3: Parallel Generation Pipeline

**Server Behavior**:
- [x] Server creates the initial job document in Firestore within a transaction that also deducts credits.
- [x] It then triggers two **parallel, non-blocking** background tasks: one for content and one for the cover.
- [x] Each pipeline updates its own state (`contentState`, `coverState`) independently.
- [x] Job is considered "finalized" for the UI when both pipelines are no longer `processing`.
- [x] Partial success is supported (e.g., content ready, cover failed).

### ☑️ Feature 7.4: Real-Time Progress Updates

**Firestore States**:
- [x] UI correctly subscribes to the job document and updates based on `contentState` and `coverState`.
- [x] States handled: `pending`, `processing`, `ready`, `error`, `ignored`.
- [x] Error messages from the server are displayed to the user.

### ☑️ Feature 7.5: Concurrent Job Limiting
- [x] User is limited to **3 concurrent processing jobs**.
- [x] If user tries to start a 4th job, the request is blocked.
- [x] A toast notification informs the user of the limit.
- [x] The "Generate" button is temporarily disabled for a 10-second cooldown period to prevent spamming.

---

## 🎨 ANIMATION & UI FEEDBACK

### ☑️ Feature 8.1: Generation Animation Sequence

**Visual States** (Book):
1. [x] **Initial State**: Closed book with placeholder cover.
2. [x] **Content Processing**: Book opens, typewriter animation with placeholder text is shown.
3. [x] **Cover Processing**: Book is closed, cover area shows a loading indicator.
4. [x] **Completed**: Book is closed with the final cover (or title card if no cover). "View in Library" button appears.

**Notes**:
- [x] The animation sequence is a client-side representation; actual generation is parallel.

### ☑️ Feature 8.2: Error States
- [x] UI correctly displays messages for partial failures (e.g., "Content created, but cover failed.").
- [x] "Retry" button appears on the failed component in the Library view.

---

## 📤 OUTPUT FORMAT & PARSING

### ☑️ Feature 9.1: AI Output Format (Markdown)

**Monolingual / Bilingual Sentence**:
```markdown
# Book Title
## Chapter 1
Sentence one.
Sentence two.
```
```markdown
# Book Title {Tiêu đề sách}
## Chapter 1 {Chương 1}
Sentence one. {Câu một.}
Sentence two. {Câu hai.}
```

**Bilingual Phrase**:
```markdown
# Book Title {Tiêu đề sách}
## Chapter 1 {Chương 1}
Phrase one, {Cụm từ một,} | and phrase two. {và cụm từ hai.}
```

**Parsing Rules**:
- [x] `# Title` → Extracts book title. `## Chapter` → Starts new chapter.
- [x] **Sentence Mode**: Parser splits text into sentences based on punctuation (`.`, `!`, `?`).
- [x] **Phrase Mode**: Parser first splits by sentence, then splits each sentence by the `|` delimiter to create phrase pairs.
- [x] Bilingual text is extracted using `{}` delimiters.

### ☑️ Feature 9.2: Database Structure

**Correctness Verified for `unit: 'sentence'`**:
- Each sentence becomes a separate segment.
- `content` field stores an object with language keys and full sentence strings.
  ```json
  "content": { "en": "This is a test.", "vi": "Đây là một bài kiểm tra." }
  ```

**Correctness Verified for `unit: 'phrase'`**:
- Each sentence still becomes a separate segment.
- `content` field stores an object where each language key holds an **array of phrase strings**.
  ```json
  "content": {
    "en": ["Hello,", " this is a test."],
    "vi": ["Xin chào,", " đây là một bài kiểm tra."]
  }
  ```

---

## 🔧 ADVANCED FEATURES (Contextual Creation)

### ☑️ Feature 10.1: Add Chapters Mode (Book Only)

**Trigger**: User clicks "Add Chapters" in Library. This is **outside the scope** of the main `CreateView` and its `useCreationJob` hook. It uses a separate, specialized flow.

**Behavior**:
- [x] Form is pre-filled with existing book data.
- [x] AI receives a summary of existing chapters to ensure continuity.
- [x] New chapters are appended to the existing book document.

### ☑️ Feature 10.2: Session Recovery

**Scenario**: User refreshes page during generation.
- [x] `useCreationJob` stores the active `jobId` in `sessionStorage`.
- [x] On page load, it checks for this ID and automatically resumes progress tracking.
- [x] `sessionStorage` is cleared when the job is finalized.

### ☑️ Feature 10.3: Pro Feature Enforcement
- [x] **Client-Side**: "Upload Cover" option is visually disabled for Free users with a "Pro" badge.
- [x] **Server-Side**: The `createLibraryItem` server action must validate the user's plan and reject upload requests from non-Pro users.

---

## ✅ ACCEPTANCE CRITERIA SUMMARY

### Must Have (P0)
- [x] Book and Piece creation working end-to-end.
- [x] All three language formats generate and store data correctly.
- [x] Credit deduction is atomic and accurate.
- [x] Parallel generation pipeline for content and cover.
- [x] Real-time progress updates are functional.
- [x] Error states and retry mechanisms are handled.
- [x] Concurrent job limiting (max 3) is enforced.

### Should Have (P1)
- [x] Animation sequence matches expected flow.
- [x] Session recovery on page refresh.
- [x] Pro feature enforcement on both client and server.

### Nice to Have (P2)
- [ ] Default prompt suggestions.
- [ ] Tag auto-complete.

---

## 🐛 KNOWN ISSUES / AREAS FOR IMPROVEMENT
*All major known issues have been resolved as of the last update.*
- The system is now robust against race conditions from old `setTimeout` calls.
- `bi-phrase` data structure is now correctly generated and stored.
- All creation flows are correctly routed through the `createLibraryItem` facade.

---

**Document Version**: 2.0  
**Last Updated**: (Current Date)  
**Status**: Aligned with Production Code
