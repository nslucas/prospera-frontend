import type { ReactNode } from "react";
import { BarChart3, ShieldCheck, Sparkles } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";

export function AuthLayout({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden min-h-screen overflow-hidden bg-[#0b2e24] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute -left-28 -top-28 h-[28rem] w-[28rem] rounded-full border-[70px] border-[#c9ff5b]/10" />
        <div className="absolute -bottom-32 -right-20 h-[30rem] w-[30rem] rounded-full bg-[#c9ff5b]/10 blur-3xl" />
        <BrandLogo textClassName="!text-white text-2xl" className="relative" />

        <div className="relative max-w-xl py-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-semibold text-white/65">
            <Sparkles className="h-3.5 w-3.5 text-[#c9ff5b]" /> Clareza para decidir melhor
          </span>
          <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.04] tracking-[-0.055em] xl:text-6xl">
            A vida financeira fica mais leve quando tudo faz sentido.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-white/55">
            Contas, cartões, limites e planos em uma única visão — simples o bastante para usar
            todos os dias.
          </p>
          <div className="mt-10 grid max-w-lg grid-cols-2 gap-3">
            <AuthFeature
              icon={<BarChart3 className="h-5 w-5" />}
              title="Visão completa"
              text="Entenda o mês sem planilhas."
            />
            <AuthFeature
              icon={<ShieldCheck className="h-5 w-5" />}
              title="No seu controle"
              text="Seus dados, suas decisões."
            />
          </div>
        </div>

        <p className="relative text-xs text-white/35">Prospera · Finanças pessoais com contexto</p>
      </aside>

      <main className="soft-grid flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className={`w-full ${compact ? "max-w-lg" : "max-w-md"}`}>
          <BrandLogo className="mb-10 lg:hidden" markSize="sm" textClassName="text-2xl" />
          <div className="rounded-[1.75rem] border border-border/80 bg-card p-6 shadow-[0_28px_80px_rgba(20,36,30,0.09)] sm:p-8">
            {children}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">
            Prospera · Seu dinheiro em perspectiva
          </p>
        </div>
      </main>
    </div>
  );
}

function AuthFeature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
      <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[#c9ff5b] text-[#0b2e24]">
        {icon}
      </span>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-white/45">{text}</p>
    </div>
  );
}
