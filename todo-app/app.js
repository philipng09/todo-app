// ============================================================
// app.js – Trang Công việc: hiển thị, tìm kiếm, lọc, thêm/sửa/xoá task
// ============================================================
const $ = (s) => document.querySelector(s);
const state = { view: "today", categories: [], editingId: null, deletingId: null };

const LABEL = {
  priority: { high: "Cao", medium: "Trung bình", low: "Thấp" },
  status: { todo: "Chưa làm", doing: "Đang làm", done: "Hoàn thành" },
  view: {
    today: ["Hôm nay", "Các task đến hạn trong ngày"],
    upcoming: ["7 ngày tới", "Các task đến hạn trong tuần tới"],
    overdue: ["Quá hạn", "Các task đã qua hạn mà chưa hoàn thành"],
    all: ["Tất cả task", "Toàn bộ task trong hệ thống"]
  }
};

// ---------- Ngày giờ ----------
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = ymd(new Date());
function niceDate(s) {
  if (s === todayStr) return "Hôm nay";
  const d = new Date(s + "T00:00:00"), t = new Date(todayStr + "T00:00:00");
  const diff = Math.round((d - t) / 86400000);
  if (diff === 1) return "Ngày mai";
  if (diff === -1) return "Hôm qua";
  return d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
}

// ---------- Gọi API ----------
async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra");
  return data;
}

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200);
}

// Thoát ký tự HTML và tô sáng từ khoá tìm kiếm
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function highlight(text, q) {
  const safe = esc(text);
  if (!q) return safe;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return safe.replace(re, "<mark>$1</mark>");
}

// ---------- Tải và hiển thị ----------
async function loadCounts() {
  const c = await api("/api/tasks/counts");
  for (const k in c) $("#c-" + k).textContent = c[k];
}

async function loadTasks() {
  const params = new URLSearchParams({
    view: state.view, q: $("#q").value, status: $("#fStatus").value,
    priority: $("#fPriority").value, category_id: $("#fCategory").value, sort: $("#sort").value
  });
  const tasks = await api("/api/tasks?" + params);
  render(tasks);
}

function taskHtml(t, q) {
  const late = t.status !== "done" && t.due_date < todayStr;
  const cat = t.category_name
    ? `<span class="chip"><span class="dot" style="background:${esc(t.category_color)}"></span>${esc(t.category_name)}</span>` : "";
  return `
  <li class="task p-${t.priority} ${t.status === "done" ? "is-done" : ""}" data-id="${t.id}">
    <input type="checkbox" ${t.status === "done" ? "checked" : ""} aria-label="Đánh dấu hoàn thành" data-act="toggle">
    <div>
      <p class="title">${highlight(t.title, q)}</p>
      ${t.description ? `<p class="desc">${highlight(t.description, q)}</p>` : ""}
      <div class="meta">
        <span class="chip ${late ? "late" : ""}">📅 ${niceDate(t.due_date)}${t.due_time ? " · " + t.due_time : ""}${late ? " · quá hạn" : ""}</span>
        <span class="chip">⚑ ${LABEL.priority[t.priority]}</span>
        <span class="chip s-${t.status}">● ${LABEL.status[t.status]}</span>
        ${cat}
      </div>
    </div>
    <div class="actions">
      <button class="icon-btn" data-act="edit" title="Sửa" aria-label="Sửa">✎</button>
      <button class="icon-btn" data-act="delete" title="Xoá" aria-label="Xoá">🗑</button>
    </div>
  </li>`;
}

function render(tasks) {
  const q = $("#q").value.trim();
  const wrap = $("#listWrap");
  // Thanh tiến độ: bao nhiêu task trong danh sách đã xong
  const done = tasks.filter((t) => t.status === "done").length;
  $("#progress").hidden = tasks.length === 0;
  $("#progressText").textContent = `Đã xong ${done}/${tasks.length} task`;
  $("#progressBar").style.width = tasks.length ? (done / tasks.length) * 100 + "%" : "0";

  if (!tasks.length) {
    wrap.innerHTML = `<div class="empty">${q || $("#fStatus").value || $("#fPriority").value || $("#fCategory").value
      ? "Không có task nào khớp bộ lọc." : "Chưa có task nào ở đây. Bấm “＋ Thêm task” để tạo mới."}</div>`;
    return;
  }
  // Nhóm theo ngày cho các tab có nhiều ngày (khi sắp xếp theo hạn chót)
  if (state.view !== "today" && $("#sort").value === "due") {
    const groups = {};
    tasks.forEach((t) => (groups[t.due_date] ||= []).push(t));
    wrap.innerHTML = Object.keys(groups).sort().map((d) =>
      `<div class="group-title">${niceDate(d)} · ${d.split("-").reverse().join("/")}</div><ul class="list">${groups[d].map((t) => taskHtml(t, q)).join("")}</ul>`
    ).join("");
  } else {
    wrap.innerHTML = `<ul class="list">${tasks.map((t) => taskHtml(t, q)).join("")}</ul>`;
  }
}

const refresh = () => Promise.all([loadTasks(), loadCounts()]).catch((e) => toast(e.message));

// ---------- Thêm / sửa ----------
function openForm(task) {
  const f = $("#form");
  f.reset();
  $("#formError").textContent = "";
  state.editingId = task ? task.id : null;
  $("#dlgTitle").textContent = task ? "Sửa task" : "Thêm task";
  f.due_date.value = task ? task.due_date : todayStr;
  if (task) {
    f.title.value = task.title; f.description.value = task.description;
    f.due_time.value = task.due_time || ""; f.priority.value = task.priority;
    f.status.value = task.status; f.category_id.value = task.category_id ?? "";
  }
  $("#dlg").showModal();
  f.title.focus();
}

$("#form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const body = {
    title: f.title.value, description: f.description.value, due_date: f.due_date.value,
    due_time: f.due_time.value, priority: f.priority.value, status: f.status.value,
    category_id: f.category_id.value || null
  };
  if (!body.title.trim()) return ($("#formError").textContent = "Vui lòng nhập tiêu đề");
  if (!body.due_date) return ($("#formError").textContent = "Vui lòng chọn ngày hết hạn");
  try {
    if (state.editingId) await api(`/api/tasks/${state.editingId}`, { method: "PUT", body: JSON.stringify(body) });
    else await api("/api/tasks", { method: "POST", body: JSON.stringify(body) });
    $("#dlg").close();
    toast(state.editingId ? "Đã cập nhật task" : "Đã thêm task mới");
    refresh();
  } catch (err) { $("#formError").textContent = err.message; }
});
$("#btnCancel").onclick = () => $("#dlg").close();
$("#btnAdd").onclick = () => openForm(null);

// ---------- Hành động trên từng task: đánh dấu xong, sửa, xoá ----------
$("#listWrap").addEventListener("click", async (e) => {
  const act = e.target.dataset.act;
  const li = e.target.closest(".task");
  if (!act || !li) return;
  const id = li.dataset.id;
  try {
    if (act === "toggle") {
      const t = await api(`/api/tasks/${id}/toggle`, { method: "PATCH" });
      toast(t.status === "done" ? "Đã hoàn thành 🎉" : "Đã chuyển về chưa làm");
      refresh();
    } else if (act === "edit") {
      openForm(await api(`/api/tasks/${id}`));
    } else if (act === "delete") {
      state.deletingId = id;
      $("#delText").textContent = `“${li.querySelector(".title").textContent}” sẽ bị xoá vĩnh viễn.`;
      $("#dlgDelete").showModal();
    }
  } catch (err) { toast(err.message); }
});
$("#delCancel").onclick = () => $("#dlgDelete").close();
$("#delOk").onclick = async () => {
  try { await api(`/api/tasks/${state.deletingId}`, { method: "DELETE" }); toast("Đã xoá task"); refresh(); }
  catch (err) { toast(err.message); }
  $("#dlgDelete").close();
};

// ---------- Tab, tìm kiếm, bộ lọc ----------
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
  state.view = b.dataset.view;
  document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", x === b));
  [$("#pageTitle").textContent, $("#pageSub").textContent] = LABEL.view[state.view];
  loadTasks();
}));
let timer;
$("#q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(loadTasks, 200); });   // chờ gõ xong 0,2s
["#fStatus", "#fPriority", "#fCategory", "#sort"].forEach((s) => $(s).addEventListener("change", loadTasks));

// Phím tắt: N để thêm task, / để tìm kiếm
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input,textarea,select") || document.querySelector("dialog[open]")) return;
  if (e.key === "n") { e.preventDefault(); openForm(null); }
  if (e.key === "/") { e.preventDefault(); $("#q").focus(); }
});

// ---------- Khởi động ----------
(async () => {
  $("#todayLabel").textContent = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  state.categories = await api("/api/categories");
  const opts = state.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  $("#fCategory").insertAdjacentHTML("beforeend", opts);
  $("#formCategory").insertAdjacentHTML("beforeend", opts);
  refresh();
})();
