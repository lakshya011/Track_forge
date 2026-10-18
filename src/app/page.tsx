import Link from "next/link";
import { Suspense } from "react";
import Generator from "@/components/Generator";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-8 flex-1">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="display text-xl font-extrabold tracking-[0.2em] uppercase">Track Forge</span>
          <span className="hidden sm:inline text-xs text-muted">Circuit homologation, from your name</span>
        </Link>
        <div className="flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="light idle" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
      </header>
      <div className="chequer rounded-full" aria-hidden />
      <Suspense fallback={<div className="text-muted">Opening the office…</div>}>
        <Generator />
      </Suspense>
      <footer className="pt-8 text-xs text-muted border-t border-line">
        Unofficial fan project, not affiliated with Formula 1 or any circuit. Grades, licences and lap times are fictional. Circuit geometry from the
        open f1-circuits dataset (MIT), elevation from Open Topo Data (SRTM).
      </footer>
    </main>
  );
}
