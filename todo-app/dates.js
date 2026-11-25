// dates.js – Xử lý ngày theo giờ địa phương (tránh lệch múi giờ khi dùng toISOString)
const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => fmt(new Date());
function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  return fmt(new Date(y, m - 1, d + n));
}
module.exports = { today, addDays, fmt };
