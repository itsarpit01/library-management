export default function StatCard({ icon: Icon, label, value, hint, tone = "primary" }) {
  return (
    <div className="card stat-card">
      <span className={`stat-icon ${tone}`}>
        <Icon size={22} />
      </span>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {hint && <p className="stat-hint">{hint}</p>}
      </div>
    </div>
  );
}