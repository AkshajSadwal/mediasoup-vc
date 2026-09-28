export default function DashboardCard({
  children,
  className = "",
  title,
  subtitle,
  action,
}) {
  return (
    <section
      className={`rounded-[28px] border border-white/10 bg-slate-950/45 p-5 shadow-2xl shadow-black/20 backdrop-blur-2xl ${className}`}
    >
      {(title || subtitle || action) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
            {subtitle && <p className="mt-1 text-xs text-white/45">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
