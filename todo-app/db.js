// ============================================================
// db.js – Lớp truy cập dữ liệu (SQLite chạy bằng sql.js)
// - Dữ liệu lưu trong file todo.db cùng thư mục
// - sql.js là SQLite biên dịch sang WebAssembly: không cần cài
//   database server hay công cụ build, chạy trên mọi máy có Node.js
// ============================================================
const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const DB_FILE = process.env.DB_FILE || path.join(__dirname, "todo.db");

// Lược đồ dữ liệu: 2 bảng categories (1) — (n) tasks
const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name   TEXT    NOT NULL UNIQUE,
  color  TEXT    NOT NULL DEFAULT '#64748b'
);
CREATE TABLE IF NOT EXISTS tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  description   TEXT    NOT NULL DEFAULT '',
  due_date      TEXT    NOT NULL,                       -- YYYY-MM-DD
  due_time      TEXT,                                   -- HH:MM, có thể trống
  priority      TEXT    NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status        TEXT    NOT NULL DEFAULT 'todo'   CHECK (status IN ('todo','doing','done')),
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL,                       -- ISO 8601
  updated_at    TEXT    NOT NULL,
  completed_at  TEXT                                    -- có giá trị khi status = 'done'
);
CREATE INDEX IF NOT EXISTS idx_tasks_due      ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);
`;

let db = null;

// Mở file todo.db (hoặc tạo mới) và bảo đảm lược đồ tồn tại
async function open() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  db.run(SCHEMA);
  return db;
}

// Ghi toàn bộ CSDL ra file sau mỗi thao tác thay đổi dữ liệu
function save() {
  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
}

// Truy vấn trả về mảng object: all("SELECT ... WHERE id = ?", [1])
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}
const get = (sql, params = []) => all(sql, params)[0] || null;

// Câu lệnh thay đổi dữ liệu; trả về id vừa thêm và số dòng bị ảnh hưởng
function run(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastId = get("SELECT last_insert_rowid() AS id").id;
  return { changes, lastId };
}

// Chạy nhiều lệnh trong 1 transaction rồi lưu file một lần
function transaction(fn) {
  db.run("BEGIN");
  try { const r = fn(); db.run("COMMIT"); save(); return r; }
  catch (e) { db.run("ROLLBACK"); throw e; }
}

module.exports = { open, save, all, get, run, transaction, DB_FILE };
