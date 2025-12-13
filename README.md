# Quy Chuẩn Kiến Trúc & Tổ Chức File Dự Án Chirpter (v2.0)

---

## 1. Triết Lý Cốt Lõi

### 🎯 Hybrid Architecture: Feature-Sliced + Shared Services

Chirpter sử dụng **hybrid approach** kết hợp:
1. **Feature-Sliced Design (80%)** - Nền tảng chính cho cấu trúc thư mục và UI.
2. **Shared Services (15%)** - Cho logic nghiệp vụ có thể tái sử dụng giữa các features.
3. **AI Layer (5%)** - Tách biệt logic liên quan đến AI.

### 🎭 Nguyên Tắc Vàng

```typescript
// ✅ Rule #1: Start Simple - Keep logic inside the feature first.
// features/create/services/book-creation.service.ts  // Bắt đầu ở đây

// ✅ Rule #2: Extract on Pain - Only extract to a shared service when a piece of logic is used in more than one feature.
// services/server/credit.service.ts                  // Tách ra đây khi cần tái sử dụng

// ✅ Rule #3: Clear Boundaries - No cross-feature imports.
// features/create/ ❌→ features/learning/hooks/      // KHÔNG BAO GIỜ
// features/create/ ✅→ services/shared/              // HOÀN TOÀN OK
```

---

## 2. Cấu Trúc Thư Mục Chính Thức

```
chirpter/
│
├── src/
│   │
│   ├── app/                          # Next.js App Router (QUẢN LÝ ROUTING)
│   │   ├── (app)/                    # Các route cần xác thực
│   │   │   ├── create/
│   │   │   │   └── page.tsx          # Import <CreateView> từ features
│   │   │   └── ...
│   │   ├── (public)/                 # Các route công khai (vd: /login)
│   │   └── layout.tsx                # Layout gốc, chứa các Global Providers
│   │
│   ├── components/                   # Các UI Component DÙNG CHUNG TOÀN APP
│   │   ├── ui/                       # shadcn/ui (dạng kebab-case)
│   │   ├── layout/                   # Các component layout chính (AppHeader, MobileNav)
│   │   └── icons.tsx                 # Quản lý icon tập trung
│   │
│   ├── features/                     # ✅ TRÁI TIM CỦA ỨNG DỤNG (Nơi chứa logic và UI của từng tính năng)
│   │   │
│   │   ├── [feature-name]/           # Cấu trúc chuẩn cho mỗi feature
│   │   │   ├── components/           # UI components chỉ dùng trong feature này
│   │   │   │   ├── [Feature]View.tsx # Component chính của feature, được import vào `app/.../page.tsx`
│   │   │   │   └── ...
│   │   │   ├── hooks/                # React hooks chỉ dùng trong feature này
│   │   │   ├── services/             # Logic nghiệp vụ chỉ dùng trong feature này
│   │   │   ├── contexts/             # [Tùy chọn] Context cục bộ của feature
│   │   │   └── ...
│   │   │
│   │   ├── create/                   # Ví dụ: Tính năng tạo nội dung
│   │   ├── learning/
│   │   ├── library/
│   │   └── ...
│   │
│   ├── services/                     # ✅ LOGIC DÙNG CHUNG (Logic nghiệp vụ có thể tái sử dụng)
│   │   │
│   │   ├── server/                   # Logic chỉ chạy trên server ('use server'), vd: tương tác Firebase Admin
│   │   │   ├── user.service.ts
│   │   │   ├── credit.service.ts     # <--- Ví dụ: Logic trừ credit được tách ra đây
│   │   │   └── index.ts
│   │   │
│   │   ├── client/                   # Logic chỉ chạy trên client, vd: tương tác IndexedDB
│   │   │   ├── vocabulary.service.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── shared/                   # Logic có thể chạy ở cả server và client (isomorphic)
│   │   │   ├── validation.service.ts
│   │   │   └── index.ts
│   │   │
│   │   └── ai/                       # Logic liên quan đến AI (vd: xây dựng prompt)
│   │       ├── prompt-builder.service.ts
│   │       └── index.ts
│   │
│   ├── lib/                          # Các hàm tiện ích cốt lõi & cấu hình
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   ├── utils.ts
│   │   ├── firebase.ts               # Cấu hình Firebase client
│   │   └── ...
│   │
│   ├── contexts/                     # React Context DÙNG CHUNG TOÀN APP
│   │   ├── auth-context.tsx
│   │   └── user-context.tsx
│   │
│   ├── providers/                    # Các component Provider (bọc các context lại)
│   │   ├── global-providers.tsx      # Bọc tất cả các context toàn cục
│   │   └── ...
│   │
│   └── hooks/                        # Custom Hooks DÙNG CHUNG TOÀN APP
│       ├── useMobile.ts
│       └── useToast.ts
│
└── public/                           # Tài sản tĩnh (hình ảnh, fonts...)
```

---

## 3. Quy Trình Làm Việc Với Kiến Trúc Mới

Khi bạn cần thêm một đoạn code mới, hãy tự hỏi:

**1. Code này dùng cho bao nhiêu tính năng?**

*   **Chỉ một tính năng duy nhất?**
    *   → Đặt nó vào bên trong thư mục feature tương ứng. Ví dụ: logic chỉ dùng cho việc tạo sách sẽ nằm ở `src/features/create/services/book-logic.ts`.

*   **Có khả năng dùng cho hai hoặc nhiều tính năng?** (Ví dụ: logic trừ credit, logic phân tích markdown)
    *   → Đặt nó vào thư mục `src/services/`.

**2. Nếu đặt vào `src/services/`, nó thuộc loại nào?**

*   **Chỉ chạy trên Server?** (Dùng `firebase-admin`, các tác vụ an toàn)
    *   → `src/services/server/`

*   **Chỉ chạy trên Client?** (Dùng `localStorage`, `IndexedDB`, các API của trình duyệt)
    *   → `src/services/client/`
    
*   **Chạy được ở cả hai nơi?** (Các hàm xử lý dữ liệu thuần túy, không phụ thuộc môi trường)
    *   → `src/services/shared/`

*   **Liên quan đến AI?**
    *   → `src/services/ai/`

Kiến trúc này giúp cân bằng giữa tốc độ phát triển (giữ logic đơn giản trong feature) và khả năng bảo trì lâu dài (tách logic dùng chung ra một nơi riêng biệt).
