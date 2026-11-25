// ============================================================
// stats.js – Trang thống kê: số liệu tổng quan + biểu đồ Chart.js
// ============================================================
const $ = (s) => document.querySelector(s);
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const charts = [];

async function load() {
  const s = await (await fetch("/api/stats")).json();
  // ---------- Thẻ số liệu ----------
  $("#kTotal").textContent = s.total;
  $("#kTotalHint").textContent = `${s.done} hoàn thành · ${s.total - s.done} còn lại`;
  $("#kRate").textContent = s.completion_rate + "%";
  $("#kRateHint").textContent = `${s.done}/${s.total} task`;
  $("#kToday").textContent = `${s.today_done}/${s.today_total}`;
  $("#kOverdue").textContent = s.overdue;

  // ---------- Biểu đồ ----------
  charts.forEach((c) => c.destroy()); charts.length = 0;
  Chart.defaults.color = css("--muted");
  Chart.defaults.borderColor = css("--line");
  Chart.defaults.font.family = '"Segoe UI", Roboto, Arial, sans-serif';

  const labels = s.daily.map((d) => d.date.slice(8) + "/" + d.date.slice(5, 7));
  charts.push(new Chart($("#chDaily"), {
    type: "bar",
    data: { labels, datasets: [
      { label: "Đến hạn", data: s.daily.map((d) => d.due), backgroundColor: css("--line"), borderRadius: 4 },
      { label: "Hoàn thành", data: s.daily.map((d) => d.completed), backgroundColor: css("--done"), borderRadius: 4 }
    ] },
    options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  }));

  const ST = { todo: ["Chưa làm", css("--todo")], doing: ["Đang làm", css("--doing")], done: ["Hoàn thành", css("--done")] };
  const st = ["todo", "doing", "done"].map((k) => (s.by_status.find((x) => x.key === k) || { n: 0 }).n);
  charts.push(new Chart($("#chStatus"), {
    type: "doughnut",
    data: { labels: Object.values(ST).map((x) => x[0]), datasets: [{ data: st, backgroundColor: Object.values(ST).map((x) => x[1]), borderWidth: 0 }] },
    options: { maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom" } } }
  }));

  const PR = { high: "Cao", medium: "Trung bình", low: "Thấp" };
  const pr = ["high", "medium", "low"].map((k) => s.by_priority.find((x) => x.key === k) || { n: 0, done: 0 });
  charts.push(new Chart($("#chPriority"), {
    type: "bar",
    data: { labels: Object.values(PR), datasets: [
      { label: "Hoàn thành", data: pr.map((x) => x.done), backgroundColor: css("--done"), borderRadius: 4 },
      { label: "Chưa xong", data: pr.map((x) => x.n - x.done), backgroundColor: [css("--high"), css("--medium"), css("--low")].map((c) => c + "99"), borderRadius: 4 }
    ] },
    options: { maintainAspectRatio: false, indexAxis: "y", scales: { x: { stacked: true, ticks: { precision: 0 } }, y: { stacked: true } }, plugins: { legend: { position: "bottom" } } }
  }));

  // ---------- Bảng theo danh mục ----------
  $("#catBody").innerHTML = s.by_category.map((c) => {
    const rate = c.n ? Math.round((c.done / c.n) * 100) : 0;
    return `<tr><td><span class="chip"><span class="dot" style="background:${c.color}"></span>${c.name}</span></td>
      <td class="num">${c.n}</td><td class="num">${c.done}</td><td class="num">${rate}%</td></tr>`;
  }).join("");
}

$("#btnReset").onclick = async () => {
  if (!confirm("Xoá toàn bộ dữ liệu hiện tại và tạo lại 75 task mẫu?")) return;
  await fetch("/api/reset", { method: "POST" });
  const t = $("#toast"); t.textContent = "Đã khôi phục dữ liệu mẫu"; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
  load();
};

load();
