import type { FeatureData } from "@/types/feature";

type FeatureCardProps = {
  feature: FeatureData;
};

function FeatureIcon({ icon }: { icon: FeatureData["icon"] }) {
  const className = "h-5 w-5 text-blue-400";

  switch (icon) {
    case "dashboard":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "ai":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
          <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
          <path d="M6 10h12v2a6 6 0 0 1-12 0v-2z" />
          <path d="M8 18h8M10 22h4" />
        </svg>
      );
    case "sync":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 21h5v-5" />
        </svg>
      );
    case "engine":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}

export default function FeatureCard({ feature }: FeatureCardProps) {
  return (
    <article className="rounded-xl border border-white/[0.06] bg-zinc-900/50 p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
        <FeatureIcon icon={feature.icon} />
      </div>
      <h3 className="text-sm font-semibold text-white">{feature.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
        {feature.description}
      </p>
    </article>
  );
}
