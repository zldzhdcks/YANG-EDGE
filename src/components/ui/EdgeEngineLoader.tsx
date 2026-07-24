type EdgeEngineLoaderProps = {
  open: boolean;
};

export default function EdgeEngineLoader({ open }: EdgeEngineLoaderProps) {
  if (!open) return null;

  return (
    <div
      className="edge-loader-overlay fixed inset-0 z-[100] flex items-center justify-center bg-[#09090b]/85 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label="EDGE Engine 분석중"
    >
      <div className="mx-4 w-full max-w-xs rounded-2xl border border-white/[0.08] bg-zinc-900 px-8 py-10 text-center shadow-2xl shadow-blue-500/10">
        <p className="text-[10px] font-medium tracking-[0.25em] text-blue-500 uppercase">
          YANG EDGE
        </p>

        <div className="mt-8 flex h-10 items-end justify-center gap-1.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((index) => (
            <span
              key={index}
              className="edge-loader-bar inline-block w-1.5 rounded-full bg-blue-500"
              style={{
                height: `${18 + index * 4}px`,
                animationDelay: `${index * 0.12}s`,
              }}
            />
          ))}
        </div>

        <p className="mt-8 text-sm font-medium tracking-wide text-white">
          EDGE Engine 분석중...
        </p>

        <div className="mt-6 h-px w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div className="edge-loader-progress h-full w-full bg-gradient-to-r from-blue-600 to-blue-400" />
        </div>
      </div>
    </div>
  );
}
