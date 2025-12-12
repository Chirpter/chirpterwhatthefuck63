# Quy Chuẩn Kiến Trúc & Tổ Chức File Dự Án Chirpter

**Ghi chú quan trọng:** Tài liệu này là kim chỉ nam, là "Hiến pháp" cho việc tổ chức và viết mã nguồn cho dự án. Mọi thay đổi về cấu trúc và file mới phải tuân thủ nghiêm ngặt các quy tắc dưới đây để đảm bảo sự nhất quán, dễ bảo trì và khả năng mở rộng.

## 1. Triết lý cốt lõi

- **Feature-Sliced Design (Phân lớp theo tính năng):** Logic, UI, và dữ liệu của một tính năng nghiệp vụ (domain) cụ thể sẽ được nhóm lại với nhau. Điều này giúp tăng tính đóng gói, giảm sự phụ thuộc chéo và giúp việc tìm kiếm, sửa đổi code trở nên cực kỳ nhanh chóng.
- **Tách biệt các mối quan tâm (Separation of Concerns):** Mỗi thư mục, mỗi file có một vai trò và trách nhiệm duy nhất, không chồng chéo.
- **Dễ đoán (Predictability):** Cấu trúc file và quy ước đặt tên phải đủ rõ ràng để bất kỳ ai cũng có thể đoán được vị trí và vai trò của một đoạn code mà không cần tìm kiếm nhiều.

---

## 2. Sơ đồ cấu trúc thư mục chi tiết

```
chirpter/
│
├── src/
│   │
│   ├── app/                  # ✅ Routing & Pages (Next.js App Router)
│   │   ├── (app)/            #   - Route group cho các trang cần đăng nhập
│   │   │   ├── library/
│   │   │   ├── create/
│   │   │   └── ...
│   │   ├── (public)/         #   - Route group cho các trang công khai (landing, login)
│   │   └── layout.tsx        #   - Root layout của toàn bộ ứng dụng
│   │
│   ├── components/           # ✅ UI Components dùng chung TOÀN CỤC
│   │   ├── ui/               #   - Component nguyên thủy từ shadcn/ui (Button, Input...)
│   │   ├── layout/           #   - Component cấu trúc trang chính (Header, Footer, Nav...)
│   │   └── icons.tsx         #   - Component Icon toàn cục
│   │
│   ├── features/             # ✅ TÍNH NĂNG NGHIỆP VỤ (CORE)
│   │   └── admin/            #   - Ví dụ: tính năng Admin
│   │       ├── components/   #     - Component CHỈ dùng trong tính năng Admin
│   │       ├── hooks/        #     - Hook CHỈ dùng trong tính năng Admin
│   │       └── services/     #     - Service CHỈ dùng trong tính năng Admin
│   │
│   ├── contexts/             # ✅ Global State Management & Providers
│   │   ├── AuthContext.tsx   #   - Định nghĩa Context VÀ export Provider
│   │   └── ...
│   │
│   ├── hooks/                # ✅ Reusable GLOBAL Hooks (dùng ở nhiều feature)
│   │   ├── useMobile.ts
│   │   └── useToast.ts
│   │
│   ├── services/             # ✅ Global Business Logic Services (Non-UI)
│   │   ├── user-service.ts   #   - Logic quản lý người dùng (giao tiếp Firebase)
│   │   └── ...               #   - Logic nghiệp vụ lõi, tái sử dụng được
│   │
│   ├── lib/                  # ✅ Core Utilities & Definitions (Non-UI, Global)
│   │   ├── constants.ts      #   - Hằng số toàn cục
│   │   ├── types.ts          #   - Định nghĩa kiểu TypeScript toàn cục
│   │   ├── utils.ts          #   - Các hàm tiện ích thuần túy, toàn cục
│   │   └── ...
│   │
│   ├── ai/                   # ✅ AI-related Logic (Genkit)
│   │   ├── genkit.ts         #   - File khởi tạo và cấu hình chính của Genkit
│   │   └── flows/            #   - Chứa các flow AI cụ thể
│   │
│   └── providers/            # ✅ Global Context Providers Wrapper
│       └── AppProviders.tsx  #   - Một component duy nhất để wrap tất cả provider
│
├── public/                   # ✅ Static Assets (Nằm ngoài src/)
│   ├── locales/
│   └── sounds/
│
└── package.json
```

---

## 3. Diễn giải chi tiết vai trò & quy tắc

### `src/app` - Bộ Não Định Tuyến
- **Vai trò:** Định nghĩa URL và lắp ráp các trang từ các `features` và `components`.
- **Quy tắc:** Chỉ chứa file `page.tsx`, `layout.tsx` và các file đặc biệt của Next.js. File `page.tsx` nên import component từ `src/features` hoặc `src/components`, hạn chế tối đa việc viết JSX phức tạp trực tiếp.

### `src/components` - Xưởng Sản Xuất Component Chung
- **Vai trò:** Chứa các component giao diện có khả năng tái sử dụng cao, không thuộc về một tính năng cụ thể nào.
- **Phân loại:**
    - `ui/`: Component nguyên thủy, nền tảng (Button, Input).
    - `layout/`: Các thành phần bố cục chính của ứng dụng (Header, Footer).
- **Quy tắc:** Nếu một component gắn liền với logic của một tính năng (ví dụ: `AdminBookForm`), nó phải thuộc về `src/features/admin/components/`.

### `src/features` - Trái Tim của Ứng Dụng
- **Vai trò:** **Nơi quan trọng nhất.** Mỗi thư mục con đại diện cho một tính năng nghiệp vụ (domain). Toàn bộ code liên quan đến tính năng đó (UI, logic, data fetching) sẽ được đóng gói tại đây.
- **Quy tắc:**
    - **Tính đóng gói:** Một feature không nên import trực tiếp từ một feature khác.
    - **Phân loại nội bộ:** Bên trong mỗi feature sẽ có các thư mục con như `components/`, `hooks/`, `services/`, `types/`... dành riêng cho nó.

### `src/hooks` - Thư Viện Hook Toàn Cục
- **Vai trò:** Chỉ chứa các custom hook có thể được sử dụng bởi **nhiều tính năng khác nhau**.
- **Quy tắc:** Nếu một hook chỉ phục vụ cho một tính năng, nó phải nằm trong `src/features/[ten-tinh-nang]/hooks/`.

### `src/contexts` & `src/providers` - Hệ Thống Cung Cấp Toàn Cục
- **Vai trò:**
    - `src/contexts/`: Định nghĩa các React Context và export cả component Provider tương ứng. Ví dụ: `AuthContext.tsx` sẽ export `AuthContext` và `AuthProvider`.
    - `src/providers/`: Chỉ chứa 1 file `AppProviders.tsx` để tổng hợp tất cả các provider từ `src/contexts` lại, giúp `layout.tsx` gốc luôn gọn gàng.

### `src/services` - Phòng Logic Nghiệp Vụ (Toàn Cục)
- **Vai trò:** Chứa các logic nghiệp vụ lõi, không gắn với giao diện (non-UI), và có thể được tái sử dụng trên toàn ứng dụng. Đây là nơi xử lý giao tiếp với cơ sở dữ liệu, các API bên ngoài.
- **Ví dụ:** `user-service.ts`, `book-creation-service.ts`.

### `src/lib` - Hộp Công Cụ Tiện Ích (Toàn Cục)
- **Vai trò:** Chứa các hàm tiện ích thuần túy (`utils.ts`), định nghĩa kiểu (`types.ts`), và hằng số (`constants.ts`) dùng chung cho toàn bộ dự án. Đây là những thành phần không chứa logic nghiệp vụ phức tạp.

### `src/ai` - Bộ phận Chuyên Gia Trí Tuệ Nhân Tạo
- **Vai trò:** Tập trung toàn bộ code liên quan đến AI sử dụng Genkit.

### `public/` - Kho Tài Sản Tĩnh
- **Vai trò:** Chứa các file tĩnh được phục vụ trực tiếp từ server (hình ảnh, fonts, file dịch thuật JSON).

---

## 4. Quy chuẩn đặt tên file: Một quy tắc, một ngoại lệ

Để đảm bảo sự nhất quán với cả quy ước chung của React và quy ước riêng của công cụ (ShadCN), chúng ta áp dụng một hệ thống tên file kép.

| Loại file | Quy ước đặt tên | Ví dụ chuẩn | Lý do và Ghi nhớ |
| :--- | :--- | :--- | :--- |
| 📁 **Component React (Tự tạo)** | `PascalCase.tsx` | `ItemCard.tsx`, `AppHeader.tsx` | **GHI NHỚ: Component tự lắp ráp.** Đây là quy tắc chính cho tất cả các component do chúng ta tự tạo (trong `features`, `layout`...). Nó giúp phân biệt rõ ràng với logic thông thường. |
| 📁 **Component React (ShadCN)** | `kebab-case.tsx` | `alert-dialog.tsx`, `button.tsx` | **GHI NHỚ: Component nền tảng.** Đây là **ngoại lệ duy nhất**, chỉ áp dụng cho các file trong `src/components/ui/`. Giữ nguyên tên gốc của ShadCN giúp dễ dàng cập nhật và nhận biết đây là các "khối xây dựng" nguyên thủy. |
| 📁 **Custom Hook** | `useCamelCase.ts` | `useAuth.ts`, `useScrollData.ts` | **GHI NHỚ: Hook là một hành động `use`**. Tiền tố `use` là quy tắc bắt buộc của React để đảm bảo các Rules of Hooks hoạt động đúng. |
| 📁 **Page & Layout (Next.js)** | `chữ-thường.tsx` | `page.tsx`, `layout.tsx` | **GHI NHỚ: File của Next.js**. Tuân thủ nghiêm ngặt quy định của Next.js App Router để hệ thống định tuyến nhận diện được. |
| 📁 **Context & Provider** | `PascalCaseContext.tsx` | `AuthContext.tsx` | **GHI NHỚ: Context cũng là một Component**. File này về bản chất export một Provider, mà Provider là một component bậc cao (HOC). |
| 📁 **Function, Service, Util** | `camelCase.ts` | `formatDate.ts`, `userService.ts` | **GHI NHỚ: Logic là một hàm**. Dùng `camelCase` để phân biệt rõ ràng với các file Component `PascalCase`, giúp dễ dàng xác định file nào chứa logic nghiệp vụ. |
| 📁 **Định nghĩa Types** | `camelCase.types.ts` | `user.types.ts`, `auth.types.ts` | **GHI NHỚ: Types có hậu tố `.types`**. Hậu tố này giúp phân biệt rõ ràng file định nghĩa kiểu với các file logic khác, tránh nhầm lẫn. |
| 📁 **File CSS/Style** | `kebab-case.css` | `app-shell.module.css`, `globals.css`| **GHI NHỚ: CSS dùng kebab-case**. Giống với quy ước đặt tên class trong CSS, tạo sự đồng bộ và dễ nhận biết. |

---

## 5. Cấu trúc dữ liệu Firestore chi tiết (Ví dụ: Một `Book`)

Dưới đây là cấu trúc đầy đủ và đã được thống nhất của một tài liệu `Book` được lưu trữ trong Firestore. Kiến trúc này được thiết kế để linh hoạt, mạnh mẽ và phục vụ cho tất cả các tính năng của ứng dụng.

```json
{
    // --- Metadata Cốt lõi & Nhận dạng ---
    "id": "book_abc_123",
    "type": "book",
    "userId": "user_xyz_789",
    "title": { "en": "The Two Worlds", "vi": "Hai Thế Giới" },
    "author": "Chirpter AI",
    "prompt": "A story about a dragon crossing into the human world.",
    
    // --- Định dạng & Ngôn ngữ (Quan trọng cho UI/TTS) ---
    "origin": "en-vi-ph",      // 🛑 BẤT BIẾN: "Giấy khai sinh" của sách. Ví dụ: "en", "en-vi", "en-vi-ph".
    "langs": ["en", "vi"],      // ✅ LINH HOẠT: Mảng chứa tất cả các ngôn ngữ hiện có.
    "unit": "phrase",           // ✅ BOOK-LEVEL: Đơn vị nội dung của TOÀN BỘ sách ('sentence' hoặc 'phrase').

    // --- Phân loại & Tìm kiếm ---
    "tags": ["fantasy", "adventure"], // Tags do người dùng/hệ thống gán
    "labels": ["bilingual", "short-read"], // Labels do hệ thống tự động gán để lọc
    "display": "book",          // Luôn là "book" cho loại nội dung này
    "isGlobal": false,          // Có phải là sách trong cửa hàng chung không?

    // --- Trạng thái Xử lý (Quan trọng cho UI) ---
    "status": "draft",          // Trạng thái tổng thể: 'processing', 'draft', 'published'
    "contentState": "ready",    // Trạng thái nội dung: 'processing', 'ready', 'error'
    "coverState": "ready",      // Trạng thái ảnh bìa: 'processing', 'ready', 'error', 'ignored'
    "contentError": null,       // Thông báo lỗi nếu tạo nội dung thất bại
    "coverError": null,         // Thông báo lỗi nếu tạo ảnh bìa thất bại
    "contentRetries": 0,        // Số lần đã thử tạo lại nội dung
    "coverRetries": 0,          // Số lần đã thử tạo lại ảnh bìa

    // --- Thông tin Ảnh bìa ---
    "cover": {
        "type": "ai", // 'ai', 'upload', hoặc 'none'
        "url": "https://path/to/image.webp",
        "inputPrompt": "A mythical dragon emerging from a portal..."
    },

    // --- Nội dung Chính (THEO KIẾN TRÚC TỐI ƯU HÓA) ---
    "chapters": [
        {
            "id": "ch_01",
            "order": 0,
            "title": { "en": "The Portal", "vi": "Cánh Cổng" },
            "segments": [
                {
                    "id": "seg_01_01",
                    "order": 0,
                    "type": "text",
                    "content": {
                        "en": "The rift shimmered,",
                        "vi": "Vết nứt lung linh,"
                    }
                },
                {
                    "id": "seg_01_02",
                    "order": 1,
                    "type": "text",
                    "content": {
                        "en": " a tear in reality's fabric.",
                        "vi": " một vết rách trên tấm vải của thực tại."
                    }
                },
                {
                  "id": "seg_para_break_1",
                  "order": 2,
                  "type": "paragraph_break",
                  "content": { "en": "" }
                },
                {
                    "id": "seg_01_03",
                    "order": 3,
                    "type": "text",
                    "content": {
                        "en": "A new paragraph starts here.",
                        "vi": "Một đoạn mới bắt đầu ở đây."
                    }
                }
            ],
            "stats": { 
                "totalSegments": 4,
                "totalWords": 12 
            }
        }
    ],

    // --- Dữ liệu Hệ thống & Người dùng ---
    "isComplete": false,             // Người dùng tự đánh dấu đã đọc xong hay chưa.
    "selectedBookmark": "default", // ID của bookmark được chọn để hiển thị.
    "createdAt": "...",              // Firestore Timestamp
    "updatedAt": "..."               // Firestore Timestamp
}
```
