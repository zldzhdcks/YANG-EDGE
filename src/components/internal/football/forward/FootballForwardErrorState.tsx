export default function FootballForwardErrorState({ code }: { code: string }) {
  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-10 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-xl rounded-lg border border-red-900/80 bg-red-950/40 p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-red-300">
          OFFICIAL FORWARD
        </p>
        <h1 className="mt-2 text-xl font-semibold text-white">
          Official Forward evidence unavailable
        </h1>
        <p className="mt-3 text-sm text-zinc-300">
          The committed Official Forward read model did not load. No substitute
          model is shown.
        </p>
        <p className="mt-4 font-mono text-xs text-red-200" data-forward-error-code={code}>
          {code}
        </p>
      </div>
    </main>
  );
}
