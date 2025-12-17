
cookie# Quy Chuẩn Kiến Trúc & Tổ Chức File Dự Án Chirpter (v2.0)



---

## 1. Triết Lý Cốt Lõi

### 🎯 Hybrid Architecture: Feature-Sliced + Shared Services

Chirpter sử dụng **hybrid approach** kết hợp:
1. **Feature-Sliced Design (80%)** - Nền tảng chính
2. **Shared Services (15%)** - Cho logic tái sử dụng
3. **AI Layer (5%)** - Tách biệt AI logic

### 🎭 Nguyên Tắc Vàng

```typescript
// ✅ Rule #1: Start Simple - Keep in Feature First
features/create/services/book-creation.service.ts  // Start here

// ✅ Rule #2: Extract on Pain - Only when duplicate >2 times
services/server/credit.service.ts                  // Extract here

// ✅ Rule #3: Clear Boundaries - No cross-feature imports
features/create/ ❌→ features/learning/hooks/      // NEVER
features/create/ ✅→ services/shared/              // OK
```

---

## 2. Cấu Trúc Thư Mục Hoàn Chỉnh

```
chirpter/
│
├── src/
│   │
│   ├── app/                          # Next.js App Router (ROUTING)
│   │   ├── (app)/                    # Protected routes
│   │   │   ├── create/
│   │   │   │   └── page.tsx          # Import CreateView từ features
│   │   │   ├── learning/
│   │   │   │   ├── layout.tsx        # LearningProviders
│   │   │   │   └── page.tsx
│   │   │   └── library/[type]/[id]/
│   │   │       ├── layout.tsx        # ReaderProviders
│   │   │       └── page.tsx
│   │   ├── (public)/                 # Public routes
│   │   └── layout.tsx                # GlobalProviders + UIProviders
│   │
│   ├── components/                   # GLOBAL UI Components
│   │   ├── ui/                       # shadcn/ui (kebab-case)
│   │   ├── layout/                   # App layout (PascalCase)
│   │   └── icons.tsx
│   │
│   ├── features/                     # ✅ NGHIỆP VỤ (Core Business Features)
│   │   │
│   │   ├── [feature-name]/           # Cấu trúc chuẩn cho mỗi feature
│   │   │   ├── components/           # UI components
│   │   │   │   ├── [Feature]View.tsx # Main view component
│   │   │   │   └── shared/           # [Optional] Nếu >3 shared components
│   │   │   ├── hooks/                # React hooks
│   │   │   ├── services/             # Feature-specific services
│   │   │   ├── contexts/             # [Optional] Feature contexts
│   │   │   ├── providers/            # [Optional] Provider wrappers
│   │   │   ├── utils/                # [Optional] Feature utilities
│   │   │   ├── types/                # [Optional] Feature types
│   │   │   └── constants.ts          # [Optional] Feature constants
│   │   │
│   │   ├── create/                   # Example: Content Creation
│   │   ├── learning/
│   │   ├── reader/
│   │   ├── vocabulary/
│   │   └── library/
│   │
│   ├── services/                     # ✅ SHARED Services (Cross-Feature Logic)
│   │   │
│   │   ├── server/                   # Server-only ('use server')
│   │   │   ├── user.service.ts       # User CRUD
│   │   │   ├── credit.service.ts     # Credit deduction
│   │   │   ├── transaction.service.ts # Firestore wrapper
│   │   │   ├── achievement.service.ts
│   │   │   └── index.ts              # Re-exports
│   │   │
│   │   ├── client/                   # Client-only (Browser APIs)
│   │   │   ├── vocabulary.service.ts  # IndexedDB
│   │   │   ├── storage.service.ts     # localStorage
│   │   │   └── index.ts
│   │   │
│   │   ├── shared/                   # Isomorphic (Pure functions)
│   │   │   ├── validation.service.ts
│   │   │   ├── markdown-parser.service.ts
│   │   │   ├── formatting.service.ts
│   │   │   └── index.ts
│   │   │
│   │   └── ai/                       # ✅ AI Infrastructure
│   │       ├── prompt-builder.service.ts
│   │       ├── content-generator.service.ts
│   │       └── index.ts
│   │
│   ├── lib/                          # Core Utilities & Config
│   │   ├── constants.ts              # Global constants
│   │   ├── types.ts                  # Global TypeScript types
│   │   ├── utils.ts                  # Pure utility functions
│   │   ├── firebase.ts               # Firebase client
│   │   ├── firebase-admin.ts         # Firebase Admin
│   │   ├── supabase.ts               # Supabase client
│   │   └── dexie.ts                  # IndexedDB setup
│   │
│   ├── contexts/                     # Global React Contexts
│   │   ├── auth-context.tsx
│   │   ├── user-context.tsx
│   │   └── toast-context.tsx
│   │
│   ├── providers/                    # Global Provider Wrappers
│   │   ├── global-providers.tsx      # Auth, User, Toast, Theme
│   │   └── ui-providers.tsx          # AudioPlayer, Modal
│   │
│   └── hooks/                        # Global Custom Hooks
│       ├── useMobile.ts
│       ├── useToast.ts
│       └── useDebounce.ts
│
└── public/                           # Static Assets
```

---

## 3. Anatomy of a Feature

### 📁 Cấu Trúc Chuẩn Cho Mỗi Feature

```
features/[feature-name]/
│
├── components/                    # ✅ REQUIRED
│   ├── [Feature]View.tsx          # Main view (exported to app/page.tsx)
│   ├── [Feature]Form.tsx
│   └── shared/                    # [OPTIONAL] Nếu >3 shared components
│       └── Settings.tsx
│
├── hooks/                         # ✅ RECOMMENDED
│   ├── use[Feature].ts            # Main orchestration hook
│   └── use[Feature]Preview.ts
│
├── services/                      # [OPTIONAL] Nếu có logic riêng
│   ├── [feature]-creation.service.ts  # 'use server'
│   └── [feature]-validation.ts
│
├── contexts/                      # [OPTIONAL] Nếu cần local state
│   └── [Feature]Context.tsx
│
├── providers/                     # [OPTIONAL] Nếu có contexts
│   └── [feature]-providers.tsx
│
├── utils/                         # [OPTIONAL] Feature utilities
│   └── helpers.ts
│
├── types/                         # [OPTIONAL] Feature-specific types
│   └── [feature].types.ts
│
└── constants.ts                   # [OPTIONAL] Feature constants
```

### 🎯 Quyết Định Tạo Subfolder

#### ✅ TẠO subfolder khi:
- **components/shared/** - Khi có ≥3 components dùng chung trong feature
- **services/** - Khi có ≥2 service files
- **types/** - Khi có ≥5 interface/type definitions
- **utils/** - Khi có ≥3 utility functions

#### ❌ KHÔNG TẠO khi:
- Chỉ có 1-2 files → Giữ flat
- Logic đơn giản → Inline trong component/hook

---

## 4. Service Layer Classification

### 🗂️ Decision Tree: Service Thuộc Về Đâu?

```
┌─────────────────────────────────────┐
│ Code này dùng cho bao nhiêu features?│
└─────────────┬───────────────────────┘
              │
     ┌────────┴────────┐
     │                 │
   1 feature        ≥2 features
     │                 │
     ▼                 ▼
features/X/      services/
services/        ├── server/     (Firebase Admin)
                 ├── client/     (Browser APIs)
                 ├── shared/     (Pure functions)
                 └── ai/         (AI-related)
```

### 📊 Service Types & Examples

| Service Type | Location | Example | When to Use |
|-------------|----------|---------|-------------|
| **Feature-Specific** | `features/*/services/` | `book-creation.service.ts` | Chỉ 1 feature dùng |
| **Shared Business** | `services/server/` | `credit.service.ts` | ≥2 features dùng, server-side |
| **Shared Client** | `services/client/` | `vocabulary.service.ts` | ≥2 features dùng, browser APIs |
| **Shared Pure** | `services/shared/` | `markdown-parser.service.ts` | ≥2 features dùng, pure functions |
| **AI Infrastructure** | `services/ai/` | `prompt-builder.service.ts` | AI-related logic |

---

## 5. Data Flow & Communication Patterns

### ✅ ALLOWED Patterns

```typescript
// Pattern 1: Feature → Shared Service
features/create/ → services/server/credit.service.ts

// Pattern 2: Feature → AI Service
features/create/ → services/ai/prompt-builder.service.ts

// Pattern 3: Feature → Global Hook
features/create/ → hooks/useToast.ts

// Pattern 4: Feature → Global UI Component
features/create/ → components/ui/button.tsx
```

### ❌ FORBIDDEN Patterns

```typescript
// ❌ Cross-Feature Direct Import
features/create/ → features/learning/hooks/useVocabulary.ts

// ✅ SOLUTION: Extract to Shared
features/create/ → services/shared/vocabulary.service.ts ← features/learning/
```

### 🔄 Event-Based Communication (Cho Loose Coupling)

```typescript
// lib/event-bus.ts
export const eventBus = new EventBus();

// Feature A emits
eventBus.emit('vocabulary:added', { term: 'hello' });

// Feature B listens
useEffect(() => {
  const handler = (data) => console.log(data.term);
  eventBus.on('vocabulary:added', handler);
  return () => eventBus.off('vocabulary:added', handler);
}, []);
```

---

## 6. Naming Conventions

| Loại File | Convention | Ví Dụ | Lý Do |
|-----------|-----------|-------|-------|
| **React Component (Custom)** | `PascalCase.tsx` | `ItemCard.tsx` | Component tự tạo |
| **React Component (shadcn)** | `kebab-case.tsx` | `button.tsx` | Component từ shadcn/ui |
| **Custom Hook** | `useCamelCase.ts` | `useAuth.ts` | React hook convention |
| **Page & Layout** | `lowercase.tsx` | `page.tsx` | Next.js requirement |
| **Context & Provider** | `PascalCase.tsx` | `AuthContext.tsx` | Provider là component |
| **Service** | `camelCase.service.ts` | `user.service.ts` | Business logic |
| **Types** | `camelCase.types.ts` | `auth.types.ts` | Type definitions |
| **Utility** | `camelCase.ts` | `formatDate.ts` | Utility functions |

---

## 7. Migration Workflow

### 🚀 Quy Trình Refactor Code Hiện Tại

#### Phase 1: Service Layer Setup (Week 1)
```bash
# 1. Tạo service layers
mkdir -p src/services/{server,client,shared,ai}

# 2. Di chuyển existing services
mv src/services/user-service.ts src/services/server/user.service.ts

# 3. Tạo index.ts re-exports
touch src/services/server/index.ts
```

#### Phase 2: Extract Duplicated Logic (Week 2)
```bash
# Identify duplicate code in feature services
# Example: Credit deduction in book-creation.service.ts & piece-creation.service.ts

# Extract to shared
touch src/services/server/credit.service.ts
touch src/services/server/transaction.service.ts

# Update feature services to use shared
```

#### Phase 3: AI Layer (Week 3)
```bash
mkdir src/services/ai
touch src/services/ai/prompt-builder.service.ts
touch src/services/ai/content-generator.service.ts

# Move AI logic from feature services
```

#### Phase 4: Provider Organization (Week 4)
```bash
# Already covered - apply provider restructuring
# Move feature providers to features/*/providers/
```

---

## 8. Checklist Khi Thêm Code Mới

### ❓ Decision Tree

```
1. Đây có phải UI component?
   ├─ YES → features/[feature]/components/
   └─ NO  → Continue to Q2

2. Logic này dùng cho bao nhiêu features?
   ├─ 1 feature  → features/[feature]/services/
   └─ ≥2 features → Continue to Q3

3. Code chạy ở đâu?
   ├─ Server (Firebase Admin) → services/server/
   ├─ Client (Browser APIs)   → services/client/
   └─ Both (Pure functions)   → services/shared/

4. Có liên quan AI?
   ├─ YES → services/ai/
   └─ NO  → Follow Q3
```

---

## 9. Testing Strategy

### 📝 Test Organization

```
src/
├── features/create/
│   ├── __tests__/
│   │   ├── CreateView.test.tsx      # Component tests
│   │   └── useCreationJob.test.ts   # Hook tests
│   └── services/
│       └── __tests__/
│           └── book-creation.service.test.ts
│
└── services/
    └── server/
        └── __tests__/
            └── credit.service.test.ts
```

### Test Levels:
- **Unit**: Services, utils, pure functions
- **Integration**: Feature hooks with services
- **E2E**: Full user flows (Playwright/Cypress)

---

## 10. Performance Optimization

### Code Splitting Strategy

```typescript
// Route-based (Automatic by Next.js)
app/(app)/learning/    → learning.chunk.js
app/(app)/create/      → create.chunk.js

// Component-based (Manual)
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false
});
```

---

## ✅ Summary: Key Takeaways

### DO ✅
- Start simple - keep in feature first
- Extract only when you see duplication (>2 times)
- Use clear service classification (server/client/shared/ai)
- Follow naming conventions strictly
- Test at appropriate levels

### DON'T ❌
- Don't create domain/application layers (overkill)
- Don't extract prematurely
- Don't allow cross-feature imports
- Don't over-engineer with unnecessary abstraction

### Remember 🎯
> **"Simplicity is the ultimate sophistication"**
> 
> Chirpter uses pragmatic architecture that balances:
> - Feature isolation (maintainability)
> - Code reuse (DRY principle)
> - Development speed (pragmatism)