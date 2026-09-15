export default function ComingSoon({ title }) {
  return (
    <main className="flex-1 min-w-0 flex items-center justify-center p-8">
      <div className="text-center">
        <p className="text-2xl font-semibold" style={{ color: "var(--text)" }}>{title}</p>
        <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>Coming soon.</p>
      </div>
    </main>
  );
}
