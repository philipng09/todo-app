// ============================================================
// seed.js – Sinh dữ liệu mẫu (mock data) cho ứng dụng
// Chạy riêng:  npm run seed   (xoá dữ liệu cũ và tạo lại)
// Server cũng tự gọi seed() khi CSDL còn trống lúc khởi động
// ============================================================
const db = require("./db");
const { today, addDays } = require("./dates");

const CATEGORIES = [
  ["Học tập", "#2563eb"], ["Công việc", "#d97706"], ["Cá nhân", "#7c3aed"],
  ["Sức khỏe", "#059669"], ["Mua sắm", "#db2777"]
];

// Mỗi mẫu: [tiêu đề, mô tả, danh mục (index), độ ưu tiên]
const TEMPLATES = [
  ["Ôn tập chương 6 Advanced FrontEnd", "Xem lại xZoom, Bootstrap progress và jQuery", 0, "high"],
  ["Nộp bài Lab 07 CSS nâng cao", "Kiểm tra link GitHub Pages trước khi nộp", 0, "high"],
  ["Đọc tài liệu Node.js Express", "Routing, middleware, xử lý lỗi", 0, "medium"],
  ["Làm bài tập IELTS Reading", "2 passage, bấm giờ 40 phút", 0, "medium"],
  ["Họp nhóm đồ án SalonBook", "Chốt giao diện trang đặt lịch", 0, "high"],
  ["Viết báo cáo nhóm Việt Du Ký", "Phần chiến lược kênh phân phối", 0, "medium"],
  ["Tổng hợp số liệu affiliate tuần", "TikTok Shop và Shopee, so sánh tuần trước", 1, "high"],
  ["Gửi brief cho KOC mới", "Kèm hướng dẫn nội dung và mã giảm giá", 1, "medium"],
  ["Cập nhật dashboard doanh thu", "Làm mới dữ liệu GMV theo SKU", 1, "medium"],
  ["Trả lời email đối tác", "Xác nhận lịch livestream", 1, "low"],
  ["Lên kế hoạch nội dung tháng 12", "Chủ đề Giáng sinh và Tết", 1, "medium"],
  ["Review hợp đồng creator", "Kiểm tra điều khoản thanh toán", 1, "high"],
  ["Dọn dẹp phòng", "Sắp xếp bàn học và tủ sách", 2, "low"],
  ["Gọi điện cho gia đình", "", 2, "medium"],
  ["Sao lưu ảnh điện thoại", "Đẩy lên Google Photos", 2, "low"],
  ["Gia hạn thẻ thư viện", "", 2, "low"],
  ["Chạy bộ 5km", "Công viên Gia Định, 6h sáng", 3, "medium"],
  ["Tập gym buổi tối", "Ngày tập thân trên", 3, "medium"],
  ["Uống đủ 2 lít nước", "", 3, "low"],
  ["Khám răng định kỳ", "Đặt lịch trước 1 ngày", 3, "high"],
  ["Mua đồ dùng học tập", "Bút, sổ, giấy note", 4, "low"],
  ["Đi siêu thị cuối tuần", "Rau, trái cây, sữa", 4, "medium"],
  ["Đặt quà sinh nhật bạn", "Giao trước thứ 6", 4, "high"],
  ["Mua tai nghe mới", "So sánh giá Shopee và Lazada", 4, "low"]
];

// Bộ sinh số ngẫu nhiên có hạt giống: lần seed nào cũng cho cùng dữ liệu
function rng(seed) { return () => (seed = (seed * 9301 + 49297) % 233280) / 233280; }

function seed() {
  const rand = rng(42);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const now = new Date();
  const T = today();

  db.transaction(() => {
    db.run("DELETE FROM tasks");
    db.run("DELETE FROM categories");
    db.run("DELETE FROM sqlite_sequence");
    CATEGORIES.forEach(([n, c]) => db.run("INSERT INTO categories(name,color) VALUES (?,?)", [n, c]));
    const catIds = db.all("SELECT id FROM categories ORDER BY id").map((r) => r.id);

    // 75 task trải từ 21 ngày trước đến 7 ngày tới
    for (let i = 0; i < 75; i++) {
      const [title, desc, cat, prio] = TEMPLATES[i % TEMPLATES.length];
      const offset = i < 9 ? 0 : Math.floor(rand() * 29) - 21;       // 9 task đầu nằm trong hôm nay
      const due = addDays(T, offset);
      const created = new Date(now.getTime() + (offset - 2 - Math.floor(rand() * 3)) * 86400000);
      let status;
      if (offset < 0) status = rand() < 0.8 ? "done" : pick(["todo", "doing"]);  // quá khứ: phần lớn đã xong
      else if (offset === 0) status = ["done", "done", "doing", "todo", "todo", "doing", "todo", "done", "todo"][i % 9];
      else status = rand() < 0.15 ? "doing" : "todo";
      const completed = status === "done"
        ? new Date(Math.min(now.getTime(), new Date(due + "T00:00:00").getTime() + Math.floor(rand() * 20) * 3600000)).toISOString()
        : null;
      const time = rand() < 0.6 ? `${String(7 + Math.floor(rand() * 14)).padStart(2, "0")}:${pick(["00", "15", "30", "45"])}` : null;
      db.run(
        `INSERT INTO tasks(title,description,due_date,due_time,priority,status,category_id,created_at,updated_at,completed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [title, desc, due, time, prio, status, catIds[cat], created.toISOString(), (completed || created.toISOString()), completed]
      );
    }
  });
  return db.get("SELECT COUNT(*) AS n FROM tasks").n;
}

module.exports = { seed };

// Chạy trực tiếp: node seed.js
if (require.main === module) {
  db.open().then(() => console.log(`Đã tạo ${seed()} task mẫu trong ${db.DB_FILE}`));
}
