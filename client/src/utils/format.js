export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

export const daysLate = (dueDate) => {
  const diff = Date.now() - new Date(dueDate).getTime();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
};

export const MAX_ISSUE_DAYS = 15;

// Date ko <input type="date"> ki value ("YYYY-MM-DD", local time) banata hai
export const toDateInput = (value) => {
  const d = new Date(value);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Aaj se offset din baad ki date
export const dateInput = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toDateInput(d);
};