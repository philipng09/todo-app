// ============================================================
// test.js – Kiểm thử API tự động:  npm test
// Dùng CSDL tạm (không đụng vào todo.db thật)
// ============================================================
const test = require("node:test");
const assert = require("node:assert");
const os = require("os"), path = require("path"), fs = require("fs");
process.env.DB_FILE = path.join(os.tmpdir(), `todo-test-${Date.now()}.db`);
process.env.PORT = 3999;
const BASE = "http://localhost:3999";
const { today } = require("./dates");
require("./server");

const call = async (url, method = "GET", body) => {
  const r = await fetch(BASE + url, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
  return { status: r.status, data: r.status === 204 ? null : await r.json() };
};
const wait = () => new Promise((r) => setTimeout(r, 800));   // chờ server khởi động và tạo dữ liệu mẫu

test("API Todo app", async (t) => {
  await wait();
  let id;
  await t.test("có dữ liệu mẫu và task hôm nay", async () => {
    const { data } = await call("/api/tasks/counts");
    assert.equal(data.all, 75);
    assert.ok(data.today > 0);
    const list = (await call("/api/tasks?view=today")).data;
    assert.ok(list.every((x) => x.due_date === today()));
  });
  await t.test("tìm kiếm và lọc", async () => {
    const r = (await call("/api/tasks?view=all&q=IELTS")).data;
    assert.ok(r.length > 0 && r.every((x) => /IELTS/i.test(x.title + x.description)));
    const f = (await call("/api/tasks?view=all&priority=high&status=todo")).data;
    assert.ok(f.every((x) => x.priority === "high" && x.status === "todo"));
  });
  await t.test("thêm task", async () => {
    const r = await call("/api/tasks", "POST", { title: "Task kiểm thử", due_date: today(), priority: "high", category_id: 1 });
    assert.equal(r.status, 201); id = r.data.id;
    assert.equal(r.data.category_name, "Học tập");
  });
  await t.test("từ chối dữ liệu sai", async () => {
    assert.equal((await call("/api/tasks", "POST", { title: "", due_date: today() })).status, 400);
    assert.equal((await call("/api/tasks", "POST", { title: "A", due_date: "25/11/2026" })).status, 400);
    assert.equal((await call("/api/tasks", "POST", { title: "A", due_date: today(), priority: "gấp" })).status, 400);
  });
  await t.test("sửa task và ghi nhận thời điểm hoàn thành", async () => {
    const r = await call(`/api/tasks/${id}`, "PUT", { title: "Task đã sửa", status: "done" });
    assert.equal(r.data.title, "Task đã sửa");
    assert.ok(r.data.completed_at);
    const back = await call(`/api/tasks/${id}/toggle`, "PATCH");
    assert.equal(back.data.status, "todo"); assert.equal(back.data.completed_at, null);
  });
  await t.test("xoá task", async () => {
    assert.equal((await call(`/api/tasks/${id}`, "DELETE")).status, 204);
    assert.equal((await call(`/api/tasks/${id}`)).status, 404);
  });
  await t.test("thống kê", async () => {
    const s = (await call("/api/stats")).data;
    assert.equal(s.total, 75);
    assert.equal(s.daily.length, 14);
    assert.equal(s.by_category.length, 5);
  });
  fs.rmSync(process.env.DB_FILE, { force: true });
  setImmediate(() => process.exit(0));
});
