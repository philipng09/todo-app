# Prompt vibe code

Prompt 1 là đề bài gốc đưa cho AI (Claude). Prompt 2–8 là các yêu cầu chi tiết theo từng bước xây dựng; mỗi bước ghi kèm kết quả và chỉnh sửa. Có thể dùng lại bộ prompt này để tái tạo ứng dụng.

## Prompt 1 – Yêu cầu ban đầu
> Todo app: chương trình quản lý các task cá nhân.
> Chức năng: 1) hiển thị các task trong ngày hôm nay, có thể search, filter; 2) thêm sửa xoá; 3) trang thống kê, có đưa những data mock vào.
> Dùng Node.js, tự quyết định database. Code đưa lên GitHub với README mô tả chức năng hệ thống. Phải chạy được.

**Kết quả:** AI đề xuất kiến trúc Node.js + Express + SQLite, giao diện HTML/CSS/JS thuần và Chart.js cho biểu đồ; chia API theo REST.

## Prompt 2 – Ràng buộc cấu trúc thư mục
> Mình upload lên GitHub bằng giao diện web nên không upload được thư mục con. Để tất cả file nằm chung một thư mục.

**Kết quả:** mọi file đặt ngang hàng; server chỉ trả đúng 5 file giao diện (`index.html`, `stats.html`, `style.css`, `app.js`, `stats.js`) để không lộ `server.js` hay `todo.db`; Chart.js lấy thẳng từ `node_modules` qua đường dẫn `/vendor/chart.js`.

## Prompt 3 – Thiết kế database
> Thiết kế bảng cho task có tiêu đề, mô tả, ngày giờ hết hạn, độ ưu tiên, trạng thái, danh mục. Ràng buộc dữ liệu đặt ngay trong database. Lưu thêm thời điểm hoàn thành để làm thống kê.

**Kết quả:** 2 bảng `categories` và `tasks` (quan hệ 1–n), ràng buộc `CHECK`, khoá ngoại `ON DELETE SET NULL`, 3 chỉ mục, cột `completed_at`.

## Prompt 4 – Bảo đảm "phải chạy được" trên mọi máy
> Thư viện better-sqlite3 cần biên dịch native, máy Windows không khớp phiên bản Node dễ lỗi khi npm install. Đổi sang cách khác mà vẫn dùng SQLite.

**Kết quả:** đổi sang `sql.js` (SQLite chạy bằng WebAssembly), không cần công cụ build; viết lớp `db.js` để lưu file sau mỗi transaction.

## Prompt 5 – Dữ liệu mẫu
> Tạo khoảng 75 task mẫu thực tế cho sinh viên đang đi làm (học tập, công việc affiliate, cá nhân, sức khoẻ, mua sắm), trải từ 3 tuần trước tới tuần sau, có task hôm nay và task quá hạn. Lần seed nào cũng ra cùng dữ liệu.

**Kết quả:** `seed.js` dùng bộ sinh số ngẫu nhiên có hạt giống cố định; tự chạy khi database trống; nút "Khôi phục dữ liệu mẫu" trên trang thống kê.

## Prompt 6 – Giao diện trang Công việc
> Trang chủ mở sẵn task hôm nay. Có tab 7 ngày tới, quá hạn, tất cả kèm số lượng. Thanh tìm kiếm tô sáng từ khoá, lọc theo trạng thái, ưu tiên, danh mục, sắp xếp. Mỗi task có viền màu theo độ ưu tiên, tick để hoàn thành, nút sửa và xoá có hỏi lại. Form thêm/sửa dạng hộp thoại. Chạy tốt trên điện thoại.

## Prompt 7 – Trang thống kê
> Trang thống kê có 4 chỉ số chính, biểu đồ 14 ngày gần nhất, biểu đồ theo trạng thái và độ ưu tiên, bảng theo danh mục.

## Prompt 8 – Kiểm thử và sửa lỗi
> Chạy thử toàn bộ chức năng trên trình duyệt và viết test tự động cho API.

**Lỗi phát hiện và đã sửa:**
- Seed bị lỗi khi task ngẫu nhiên rơi vào hôm nay ngoài 9 task định sẵn → lấy trạng thái theo `i % 9`.
- Biểu đồ không hiện do đường dẫn tới Chart.js trong `node_modules` sai → trỏ thẳng tới `node_modules/chart.js/dist/chart.umd.min.js`.
- Hai biểu đồ trạng thái/ưu tiên để trống một cột → cố định lưới 2 cột trên máy tính, 1 cột trên điện thoại.

Kết quả cuối: 8/8 bài test API đạt; cài mới từ thư mục trống bằng `npm install` + `npm start` chạy được ngay.
