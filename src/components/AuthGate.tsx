"use client";
import { useAuth } from "@/lib/auth";
import { ReactNode } from "react";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, signInGoogle } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex-1 flex items-center justify-center bg-[var(--bg-base)]">
        <div className="text-sm text-[var(--text-muted)]">読み込み中…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex-1 flex items-center justify-center bg-[var(--bg-base)] px-6">
        <div className="max-w-sm w-full text-center">
          <div className="font-quest text-3xl font-bold tracking-[0.15em] text-[var(--accent-gold)] mb-2">
            MILESTRIDE
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            冒険者として、目標までの道のりを<br />クエストとして攻略する
          </p>

          <div className="mb-8 rounded-2xl bg-[var(--bg-panel)] ring-1 ring-[var(--ring-soft)] shadow-sm px-5 py-5 text-left">
            <div className="font-quest text-[10px] font-bold text-[var(--accent-purple)] tracking-wider uppercase mb-3 text-center">
              エリア: 影響力の武器
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-[220px] rounded-xl ring-1 ring-[var(--accent-emerald)]/60 bg-[var(--bg-elev)] px-3 py-2.5 shadow-sm">
                <div className="font-quest text-[9px] font-bold text-[var(--accent-emerald)] tracking-wider uppercase mb-1">
                  Lv.1 Quest
                </div>
                <div className="text-xs font-semibold text-[var(--text-primary)]">
                  <span className="text-[var(--accent-emerald)] mr-1">✓</span>
                  返報性の原理を読む
                </div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-[var(--bg-base)] overflow-hidden">
                  <div className="h-full w-full bg-[var(--accent-emerald)]" />
                </div>
              </div>
              <div className="h-5 w-px bg-gradient-to-b from-[var(--accent-emerald)] to-[var(--accent-blue)]" />
              <div className="w-[220px] rounded-xl ring-1 ring-[var(--accent-blue)]/60 bg-[var(--bg-elev)] px-3 py-2.5 shadow-sm">
                <div className="font-quest text-[9px] font-bold text-[var(--accent-blue)] tracking-wider uppercase mb-1">
                  Lv.2 Quest
                </div>
                <div className="text-xs font-semibold text-[var(--text-primary)]">
                  <span className="text-[var(--accent-blue)] mr-1">◐</span>
                  顧客提案で先に価値提供
                </div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-[var(--bg-base)] overflow-hidden">
                  <div className="h-full w-1/2 bg-[var(--accent-blue)]" />
                </div>
              </div>
            </div>
            <div className="mt-3 text-[10px] text-[var(--text-muted)] text-center leading-snug">
              読んだ内容を実戦で試す流れを<br />ひとつずつクリアして進めます
            </div>
          </div>

          <button
            onClick={() => signInGoogle().catch(console.error)}
            className="w-full py-3 px-5 rounded-2xl bg-[var(--bg-panel)] ring-1 ring-[var(--ring-soft)] shadow-sm font-medium text-[var(--text-primary)] active:scale-[0.98] transition flex items-center justify-center gap-2.5"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC04" d="M3.97 10.71A5.42 5.42 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
            </svg>
            Googleでサインイン
          </button>
          <p className="mt-6 text-[10px] text-[var(--text-muted)]">
            あなた専用の冒険地図が端末をまたいで同期されます
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
