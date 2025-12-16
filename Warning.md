# Cảnh Báo: Các Lỗi AI Thường Mắc Phải (Sửa Đúng Thành Sai)

Tài liệu này ghi lại các lỗi lặp đi lặp lại mà AI đã gây ra trong quá trình phát triển, đặc biệt là các trường hợp "sửa đúng thành sai" hoặc tạo ra lỗi mới một cách hệ thống. Mục đích là để nhận biết và tránh các lỗi này trong tương lai.

---

## 1. Lỗi Cú Pháp Chuỗi Ký Tự Động (Template Literal)

### Hiện tượng

AI liên tục tạo ra cú pháp sai khi cố gắng chèn một biến vào trong một chuỗi ký tự.

*   **Cú pháp SAI (do AI tạo):** `'some_string_${'${variable}'}'`
*   **Cú pháp ĐÚNG (mong muốn):** `` `some_string_${variable}` ``

Lỗi này xuất hiện ở rất nhiều nơi, ví dụ như khi tạo khóa cho `localStorage` hoặc `sessionStorage` (ví dụ: `activeJobId_${'${user.uid}'}`).

### Nguyên nhân

Đây là một "lỗi hệ thống" trong mô hình tạo mã của AI, có thể do các mẫu (pattern) không chính xác trong dữ liệu huấn luyện. AI đã nhầm lẫn giữa chuỗi ký tự thông thường (dùng dấu nháy đơn `'`) và template literal (dùng dấu backtick `` ` ``).

### Hậu quả

*   Ứng dụng hoạt động sai logic vì không lấy được giá trị đúng của biến.
*   Gây ra các lỗi khó lường, đặc biệt là các lỗi chỉ xảy ra ở lần thứ hai thực hiện một hành động (ví dụ: tạo sách lần 2, lưu trữ session...).

---

## 2. Lỗi Không `await` Hàm `cookies()` trong Middleware của Next.js 15+

### Hiện tượng

Trong file `src/middleware.ts`, AI đã viết code để lấy cookie như sau:

*   **Cú pháp SAI (do AI tạo):** `const cookieStore = cookies();`
*   **Cú pháp ĐÚNG (cho Next.js 15+):** `const cookieStore = await cookies();`

### Nguyên nhân

Trong các phiên bản Next.js trước, hàm `cookies()` là một hàm đồng bộ (synchronous). Tuy nhiên, kể từ Next.js 15, nó đã được thay đổi thành một hàm bất đồng bộ (asynchronous) và cần từ khóa `await` để lấy được giá trị đúng. AI đã không cập nhật kiến thức của mình theo phiên bản mới nhất của framework.

### Hậu quả

*   Biến `cookieStore` không chứa đối tượng cookies mà chứa một Promise.
*   Việc gọi `cookieStore.get(...)` ngay sau đó sẽ gây ra lỗi runtime vì `get` không phải là một phương thức của Promise.
*   Toàn bộ logic xác thực người dùng trong middleware bị phá vỡ, dẫn đến việc không thể truy cập các trang được bảo vệ.
