export function StatsCard({ value, label }) {
  return (
    <article className="soft-card min-h-[140px] p-5">
      <p className="text-3xl font-extrabold text-navy">{value}</p>
      <p className="mt-2 text-sm font-bold leading-5 text-muted">{label}</p>
    </article>
  );
}
