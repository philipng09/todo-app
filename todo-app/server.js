// ============================================================
// server.js – REST API + phục vụ giao diện (Express)
// Chạy: npm install  ->  npm start  ->  mở http://localhost:3000
// ============================================================
const express = require("express");
const path = require("path");
const db = require("./db");
const { seed } = require("./seed");
const { today, addDays } = require("./dates");

const app = express();
app.use(express.json());

const PRIORITIES = ["low", "medium", "high"];
const STATUSES = ["todo", "doing", "done"];

// ---------- Kiểm tra dữ liệu gửi lên khi thêm/sửa task ----------
function validate(body, partial = false) {
  const errors = [];
  const out = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has("title")) {
    const t = String(body.title || "").trim();
    if (!t) errors.push("Tiêu đề không được để trống");
    else if (t.length > 120) errors.push("Tiêu đề tối đa 120 ký tự");
    out.title = t;
  }
  if (has("description")) out.description = String(body.description).slice(0, 1000);
  if (!partial || has("due_date")) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.due_date || "")) errors.push("Ngày hết hạn phải có dạng YYYY-MM-DD");
    out.due_date = body.due_date;
  }
  if (has("due_time")) {
    if (body.due_time && !/^\d{2}:\d{2}$/.test(body.due_time)) errors.push("Giờ phải có dạng HH:MM");
    out.due_time = body.due_time || null;
  }
  if (has("priority")) {
    if (!PRIORITIES.includes(body.priority)) errors.push("Độ ưu tiên không hợp lệ");
    out.priority = body.priority;
  }
  if (has("status")) {
    if (!STATUSES.includes(body.status)) errors.push("Trạng thái không hợp lệ");
    out.status = body.status;
  }
  if (has("category_id")) {
    const id = body.category_id === null || body.category_id === "" ? null : Number(body.category_id);
    if (id !== null && !db.get("SELECT id FROM categories WHERE id = ?", [id])) errors.push("Danh mục không tồn tại");
    out.category_id = id;
  }
  return { errors, data: out };
}

// Câu SELECT chung: kèm tên và màu danh mục
const TASK_SELECT = `
  SELECT t.*, c.name AS category_name, c.color AS category_color
  FROM tasks t LEFT JOIN categories c ON c.id = t.category_id`;

// ---------- API ----------

// Danh sách task + bộ lọc
// view: today | upcoming | overdue | all ; q: tìm theo tiêu đề/mô tả
// status, priority, category_id: lọc ; sort: due | priority | created
app.get("/api/tasks", (req, res) => {
  const { view = "today", q = "", status, priority, category_id, sort = "due" } = req.query;
  const T = today();
  const where = [];
  const params = [];
  if (view === "today") { where.push("t.due_date = ?"); params.push(T); }
  else if (view === "upcoming") { where.push("t.due_date > ? AND t.due_date <= ?"); params.push(T, addDays(T, 7)); }
  else if (view === "overdue") { where.push("t.due_date < ? AND t.status <> 'done'"); params.push(T); }
  if (q.trim()) { where.push("(t.title LIKE ? OR t.description LIKE ?)"); params.push(`%${q.trim()}%`, `%${q.trim()}%`); }
  if (STATUSES.includes(status)) { where.push("t.status = ?"); params.push(status); }
  if (PRIORITIES.includes(priority)) { where.push("t.priority = ?"); params.push(priority); }
  if (category_id) { where.push("t.category_id = ?"); params.push(Number(category_id)); }

  const prioRank = "CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END";
  const order = {
    due: `t.status = 'done', t.due_date, t.due_time IS NULL, t.due_time, ${prioRank}`,
    priority: `t.status = 'done', ${prioRank}, t.due_date`,
    created: "t.created_at DESC"
  }[sort] || "t.due_date";

  const sql = `${TASK_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${order}`;
  res.json(db.all(sql, params));
});

// Số lượng task theo từng tab (hiển thị trên nút tab)
app.get("/api/tasks/counts", (req, res) => {
  const T = today();
  res.json({
    today: db.get("SELECT COUNT(*) n FROM tasks WHERE due_date = ?", [T]).n,
    upcoming: db.get("SELECT COUNT(*) n FROM tasks WHERE due_date > ? AND due_date <= ?", [T, addDays(T, 7)]).n,
    overdue: db.get("SELECT COUNT(*) n FROM tasks WHERE due_date < ? AND status <> 'done'", [T]).n,
    all: db.get("SELECT COUNT(*) n FROM tasks").n
  });
});

app.get("/api/tasks/:id", (req, res) => {
  const task = db.get(`${TASK_SELECT} WHERE t.id = ?`, [Number(req.params.id)]);
  task ? res.json(task) : res.status(404).json({ error: "Không tìm thấy task" });
});

// Thêm task
app.post("/api/tasks", (req, res) => {
  const { errors, data } = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join("; ") });
  const now = new Date().toISOString();
  const status = data.status || "todo";
  const { lastId } = db.transaction(() => db.run(
    `INSERT INTO tasks(title,description,due_date,due_time,priority,status,category_id,created_at,updated_at,completed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [data.title, data.description || "", data.due_date, data.due_time || null, data.priority || "medium",
     status, data.category_id ?? null, now, now, status === "done" ? now : null]
  ));
  res.status(201).json(db.get(`${TASK_SELECT} WHERE t.id = ?`, [lastId]));
});

// Sửa task (gửi các trường cần đổi)
app.put("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const old = db.get("SELECT * FROM tasks WHERE id = ?", [id]);
  if (!old) return res.status(404).json({ error: "Không tìm thấy task" });
  const { errors, data } = validate(req.body, true);
  if (errors.length) return res.status(400).json({ error: errors.join("; ") });
  const now = new Date().toISOString();
  // Cập nhật thời điểm hoàn thành khi trạng thái chuyển sang/ra khỏi 'done'
  if (data.status && data.status !== old.status) data.completed_at = data.status === "done" ? now : null;
  data.updated_at = now;
  const keys = Object.keys(data);
  db.transaction(() => db.run(`UPDATE tasks SET ${keys.map((k) => k + " = ?").join(", ")} WHERE id = ?`, [...keys.map((k) => data[k]), id]));
  res.json(db.get(`${TASK_SELECT} WHERE t.id = ?`, [id]));
});

// Đánh dấu xong / chưa xong nhanh bằng checkbox
app.patch("/api/tasks/:id/toggle", (req, res) => {
  const id = Number(req.params.id);
  const t = db.get("SELECT status FROM tasks WHERE id = ?", [id]);
  if (!t) return res.status(404).json({ error: "Không tìm thấy task" });
  const now = new Date().toISOString();
  const done = t.status !== "done";
  db.transaction(() => db.run("UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?",
    [done ? "done" : "todo", done ? now : null, now, id]));
  res.json(db.get(`${TASK_SELECT} WHERE t.id = ?`, [id]));
});

// Xoá task
app.delete("/api/tasks/:id", (req, res) => {
  const { changes } = db.transaction(() => db.run("DELETE FROM tasks WHERE id = ?", [Number(req.params.id)]));
  changes ? res.status(204).end() : res.status(404).json({ error: "Không tìm thấy task" });
});

app.get("/api/categories", (req, res) => {
  res.json(db.all(`SELECT c.*, COUNT(t.id) AS task_count FROM categories c
                   LEFT JOIN tasks t ON t.category_id = c.id GROUP BY c.id ORDER BY c.id`));
});

// Số liệu cho trang thống kê
app.get("/api/stats", (req, res) => {
  const T = today();
  const n = (sql, p = []) => db.get(sql, p).n;
  const total = n("SELECT COUNT(*) n FROM tasks");
  const done = n("SELECT COUNT(*) n FROM tasks WHERE status = 'done'");
  // 14 ngày gần nhất: số task đến hạn và số task hoàn thành mỗi ngày
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(T, -i);
    daily.push({
      date: d,
      due: n("SELECT COUNT(*) n FROM tasks WHERE due_date = ?", [d]),
      completed: n("SELECT COUNT(*) n FROM tasks WHERE status = 'done' AND due_date = ?", [d])
    });
  }
  res.json({
    total, done,
    completion_rate: total ? Math.round((done / total) * 100) : 0,
    overdue: n("SELECT COUNT(*) n FROM tasks WHERE due_date < ? AND status <> 'done'", [T]),
    today_total: n("SELECT COUNT(*) n FROM tasks WHERE due_date = ?", [T]),
    today_done: n("SELECT COUNT(*) n FROM tasks WHERE due_date = ? AND status = 'done'", [T]),
    by_status: db.all("SELECT status AS key, COUNT(*) AS n FROM tasks GROUP BY status"),
    by_priority: db.all(`SELECT priority AS key, COUNT(*) AS n, SUM(status='done') AS done FROM tasks GROUP BY priority`),
    by_category: db.all(`SELECT c.name, c.color, COUNT(t.id) AS n, COALESCE(SUM(t.status='done'),0) AS done
                         FROM categories c LEFT JOIN tasks t ON t.category_id = c.id GROUP BY c.id ORDER BY n DESC`),
    daily
  });
});

// Tạo lại dữ liệu mẫu (nút "Khôi phục dữ liệu mẫu" trên trang thống kê)
app.post("/api/reset", (req, res) => res.json({ tasks: seed() }));

// ---------- Giao diện ----------
// Chỉ phục vụ đúng các file giao diện (không lộ server.js, todo.db…)
const PUBLIC = ["index.html", "stats.html", "style.css", "app.js", "stats.js"];
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/:file", (req, res, next) =>
  PUBLIC.includes(req.params.file) ? res.sendFile(path.join(__dirname, req.params.file)) : next());
// Thư viện biểu đồ lấy thẳng từ node_modules (cài bằng npm install)
app.get("/vendor/chart.js", (req, res) => res.sendFile(path.join(__dirname, "node_modules", "chart.js", "dist", "chart.umd.min.js")));

// Lỗi không lường trước: trả JSON thay vì trang lỗi HTML
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: "Lỗi máy chủ" }); });

const PORT = process.env.PORT || 3000;
db.open().then(() => {
  if (db.get("SELECT COUNT(*) AS n FROM tasks").n === 0) console.log(`CSDL trống, đã tạo ${seed()} task mẫu`);
  app.listen(PORT, () => console.log(`Todo app đang chạy tại http://localhost:${PORT}`));
});

module.exports = app;
