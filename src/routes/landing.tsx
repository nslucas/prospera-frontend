import * as React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Eye,
  HandCoins,
  LockKeyhole,
  Menu,
  PiggyBank,
  Sparkles,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { useAuth } from "@/lib/auth";

const NAV_ITEMS = [
  { label: "Recursos", href: "#recursos" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Segurança", href: "#seguranca" },
];

const FEATURES = [
  {
    eyebrow: "Visão geral",
    title: "O mês inteiro em uma tela.",
    description:
      "Veja saldos, faturas, entradas e saídas sem alternar entre planilhas e aplicativos.",
    image: "/landing/dashboard-mock.png",
    alt: "Painel demonstrativo da Prospera com saldos, faturas e fluxo mensal fictícios",
    icon: WalletCards,
  },
  {
    eyebrow: "Planejamento",
    title: "Limites que acompanham a vida real.",
    description: "Crie orçamentos por categoria e entenda, de relance, quanto ainda pode gastar.",
    image: "/landing/budgets-mock.png",
    alt: "Tela demonstrativa de orçamentos da Prospera com valores fictícios",
    icon: PiggyBank,
  },
  {
    eyebrow: "Relatórios",
    title: "Tendências que ajudam a decidir.",
    description:
      "Compare receitas e despesas, descubra padrões e transforme números em próximos passos.",
    image: "/landing/reports-mock.png",
    alt: "Tela demonstrativa de relatórios da Prospera com gráficos e valores fictícios",
    icon: BarChart3,
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const accessHref = user ? "/home" : "/auth/login";
  const accessLabel = user ? "Acessar painel" : "Entrar";

  return (
    <div className="landing-page min-h-screen overflow-x-hidden bg-[#f7f7f1] text-[#14241e]">
      <header className="sticky top-0 z-50 border-b border-[#dfe5dc]/80 bg-[#f7f7f1]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.75rem] max-w-[78rem] items-center justify-between px-5 sm:px-8">
          <a
            href="#inicio"
            aria-label="Prospera — início"
            className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#105b44]/30"
          >
            <BrandLogo markSize="sm" textClassName="!text-[#14241e] text-xl" />
          </a>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Navegação principal">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-semibold text-[#4f5f58] transition hover:text-[#105b44]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <Link
              to={accessHref}
              className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-[#105b44] transition hover:bg-[#e9eee6]"
            >
              {accessLabel}
            </Link>
            <Link
              to="/auth/register"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#105b44] px-5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(16,91,68,0.2)] transition hover:-translate-y-0.5 hover:bg-[#0b4b37]"
            >
              Começar agora <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            className="grid h-11 w-11 place-items-center rounded-xl border border-[#d7ddd5] bg-white text-[#14241e] sm:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div
            id="landing-mobile-menu"
            className="border-t border-[#dfe5dc] bg-[#f7f7f1] px-5 py-5 sm:hidden"
          >
            <nav className="flex flex-col gap-1" aria-label="Navegação móvel">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-3 text-sm font-bold text-[#384840] hover:bg-white"
                >
                  {item.label}
                </a>
              ))}
              <div className="my-3 h-px bg-[#dfe5dc]" />
              <Link
                to={accessHref}
                className="rounded-xl px-3 py-3 text-sm font-bold text-[#105b44]"
              >
                {accessLabel}
              </Link>
              <Link
                to="/auth/register"
                className="mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-[#105b44] px-5 text-sm font-bold text-white"
              >
                Criar minha conta
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main>
        <section
          id="inicio"
          className="relative isolate overflow-hidden pb-20 pt-16 sm:pb-28 sm:pt-24"
        >
          <div className="landing-orbit absolute -right-64 -top-64 -z-10 hidden h-[46rem] w-[46rem] rounded-full border-[7rem] border-[#c9ff5b]/30 sm:block" />
          <div className="absolute -left-56 top-52 -z-10 h-[30rem] w-[30rem] rounded-full bg-[#dfeeca]/60 blur-3xl" />

          <div className="mx-auto grid max-w-[78rem] items-center gap-14 px-5 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-10">
            <div className="relative z-10 max-w-[39rem]">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#cfdac8] bg-white/80 px-3.5 py-2 text-xs font-bold text-[#105b44] shadow-sm">
                <Sparkles className="h-3.5 w-3.5" /> Sua vida financeira, em perspectiva
              </div>
              <h1 className="font-display text-[3.25rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-[#10251d] sm:text-[4.75rem] lg:text-[4.6rem] xl:text-[5.25rem]">
                Clareza para fazer seu dinheiro <span className="text-[#105b44]">prosperar.</span>
              </h1>
              <p className="mt-7 max-w-[35rem] text-base leading-7 text-[#596860] sm:text-lg sm:leading-8">
                Contas, cartões, orçamentos e planos em um só lugar. Simples para acompanhar hoje e
                inteligente para decidir amanhã.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/auth/register"
                  className="group inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#105b44] px-6 text-sm font-bold text-white shadow-[0_18px_40px_rgba(16,91,68,0.22)] transition hover:-translate-y-0.5 hover:bg-[#0b4b37]"
                >
                  Começar gratuitamente{" "}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#recursos"
                  className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-[#d2dad0] bg-white/70 px-6 text-sm font-bold text-[#18352a] transition hover:border-[#105b44]/30 hover:bg-white"
                >
                  Conhecer recursos <ChevronRight className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#64716b]">
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#16855f]" /> Sem cartão de crédito
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#16855f]" /> Comece em poucos minutos
                </span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[46rem] lg:translate-x-8">
              <div className="absolute -left-8 top-12 z-20 hidden rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_24px_70px_rgba(15,45,34,0.14)] backdrop-blur sm:block">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f5df] text-[#105b44]">
                    <Eye className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold text-[#728079]">Tudo visível</p>
                    <p className="text-sm font-extrabold text-[#18352a]">Uma visão completa</p>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[1.75rem] border border-[#18352a]/10 bg-[#0b2119] p-2.5 shadow-[0_36px_100px_rgba(11,46,36,0.22)] sm:rounded-[2.25rem] sm:p-3.5">
                <div className="mb-3 flex items-center gap-1.5 px-2 pt-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff806d]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f2c95b]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#c9ff5b]" />
                  <span className="ml-3 h-6 flex-1 rounded-lg bg-white/[0.06]" />
                </div>
                <img
                  src="/landing/dashboard-mock.png"
                  alt="Painel demonstrativo da Prospera com dados financeiros fictícios"
                  className="aspect-[1.58/1] w-full rounded-[1.15rem] object-cover object-top sm:rounded-[1.55rem]"
                  loading="eager"
                />
              </div>

              <div className="absolute -bottom-8 right-4 z-20 rounded-2xl bg-[#c9ff5b] p-4 text-[#0b2e24] shadow-[0_22px_60px_rgba(72,100,22,0.25)] sm:right-10 sm:p-5">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em]">
                  Sobra estimada
                </p>
                <p className="mt-1 font-display text-3xl font-extrabold tracking-[-0.05em]">43%</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#dfe5dc] bg-white/55">
          <div className="mx-auto grid max-w-[78rem] gap-4 px-5 py-7 sm:grid-cols-3 sm:px-8">
            {[
              "Seu dinheiro em um só lugar",
              "Planejamento sem planilhas",
              "Decisões com mais contexto",
            ].map((item, index) => (
              <div key={item} className="flex items-center gap-3 sm:justify-center">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e6f3d8] text-xs font-extrabold text-[#105b44]">
                  0{index + 1}
                </span>
                <p className="text-sm font-bold text-[#384840]">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="recursos" className="py-24 sm:py-32">
          <div className="mx-auto max-w-[78rem] px-5 sm:px-8">
            <div className="mx-auto max-w-[43rem] text-center">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#16855f]">
                Feito para o dia a dia
              </p>
              <h2 className="mt-4 font-display text-4xl font-extrabold tracking-[-0.045em] text-[#10251d] sm:text-5xl">
                Menos ruído. Mais direção.
              </h2>
              <p className="mt-5 text-base leading-7 text-[#65736c]">
                A Prospera organiza o que importa e mostra cada número no contexto certo.
              </p>
            </div>

            <div className="mt-20 space-y-24 sm:space-y-32">
              {FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
                  >
                    <div className={index % 2 ? "lg:order-2" : undefined}>
                      <div className="inline-flex items-center gap-2 rounded-full bg-[#e6f3d8] px-3 py-1.5 text-xs font-extrabold text-[#105b44]">
                        <Icon className="h-3.5 w-3.5" /> {feature.eyebrow}
                      </div>
                      <h3 className="mt-5 max-w-[31rem] font-display text-4xl font-extrabold leading-tight tracking-[-0.045em] text-[#10251d] sm:text-[2.75rem]">
                        {feature.title}
                      </h3>
                      <p className="mt-5 max-w-[32rem] text-base leading-7 text-[#65736c]">
                        {feature.description}
                      </p>
                      <Link
                        to="/auth/register"
                        className="group mt-7 inline-flex items-center gap-2 text-sm font-extrabold text-[#105b44]"
                      >
                        Experimentar agora{" "}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>

                    <div className={index % 2 ? "lg:order-1" : undefined}>
                      <div className="relative rounded-[1.7rem] bg-[#e7eddf] p-3 shadow-[0_28px_80px_rgba(20,45,35,0.11)] sm:p-5">
                        <div className="absolute right-7 top-7 z-10 rounded-full border border-white/10 bg-[#07120e]/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70 backdrop-blur">
                          Dados ilustrativos
                        </div>
                        <img
                          src={feature.image}
                          alt={feature.alt}
                          className="aspect-[1.78/1] w-full rounded-[1.15rem] object-cover object-top"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="conexoes-acertos" className="scroll-mt-24 pb-24 sm:pb-32">
          <div className="mx-auto max-w-[78rem] px-5 sm:px-8">
            <div className="relative overflow-hidden rounded-[2rem] border border-[#dce3d8] bg-[#eef1e8] px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
              <div className="absolute -bottom-36 -right-20 h-80 w-80 rounded-full bg-[#c9ff5b]/25 blur-3xl" />
              <div className="relative grid items-center gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
                <div className="max-w-[30rem]">
                  <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#16855f]">
                    <UsersRound className="h-4 w-4" /> Conexões e Acertos
                  </div>
                  <h3 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-[-0.04em] text-[#10251d] sm:text-[2.5rem]">
                    Compartilhe despesas sem perder a perspectiva.
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-[#65736c] sm:text-base">
                    Conecte pessoas, divida compras e acompanhe com clareza quem tem valores a pagar
                    ou receber.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#d5ddd1] bg-white/70 px-3 py-1.5 text-xs font-bold text-[#526159]">
                      Convites por código
                    </span>
                    <span className="rounded-full border border-[#d5ddd1] bg-white/70 px-3 py-1.5 text-xs font-bold text-[#526159]">
                      Saldos por pessoa
                    </span>
                    <span className="rounded-full border border-[#d5ddd1] bg-white/70 px-3 py-1.5 text-xs font-bold text-[#526159]">
                      Acertos quitados
                    </span>
                  </div>
                </div>

                <div className="connections-perspective relative mx-auto w-full max-w-[38rem] py-5">
                  <div className="connections-perspective-card relative mt-8 rounded-[1.6rem] border border-white/10 bg-[#0b2e24] p-4 text-white shadow-[0_30px_70px_rgba(11,46,36,0.23)] sm:mt-0 sm:p-5">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#c9ff5b] text-[#0b2e24]">
                          <HandCoins className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-white/50">Acertos em aberto</p>
                          <p className="text-sm font-extrabold">Resumo por pessoa</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-white/8 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/50">
                        Ilustrativo
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white/[0.07] p-3.5">
                        <p className="text-[10px] font-semibold text-white/45">A receber</p>
                        <p className="mt-1 font-display text-xl font-extrabold text-[#c9ff5b]">
                          R$ 184,90
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/[0.07] p-3.5">
                        <p className="text-[10px] font-semibold text-white/45">A pagar</p>
                        <p className="mt-1 font-display text-xl font-extrabold">R$ 72,40</p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {[
                        ["MA", "Marina Alves", "deve a você", "+ R$ 124,90"],
                        ["JP", "João Pedro", "você deve", "− R$ 72,40"],
                      ].map(([initials, name, label, value], index) => (
                        <div
                          key={name}
                          className="flex items-center gap-3 rounded-xl bg-white/[0.055] p-3"
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[10px] font-extrabold">
                            {initials}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold">{name}</p>
                            <p className="text-[10px] text-white/40">{label}</p>
                          </div>
                          <p
                            className={
                              index === 0
                                ? "text-xs font-extrabold text-[#c9ff5b]"
                                : "text-xs font-extrabold text-white/75"
                            }
                          >
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="connections-floating-card absolute -left-2 top-0 flex items-center gap-3 rounded-2xl border border-[#dfe5dc] bg-white px-3.5 py-3 shadow-[0_18px_45px_rgba(20,45,35,0.14)] sm:-left-8">
                    <div className="flex -space-x-2">
                      {[
                        ["M", "bg-[#c9ff5b]"],
                        ["J", "bg-[#d9eee5]"],
                        ["A", "bg-[#f7d9d2]"],
                      ].map(([initial, color]) => (
                        <span
                          key={initial}
                          className={`grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[9px] font-extrabold text-[#16352a] ${color}`}
                        >
                          {initial}
                        </span>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-[#75817b]">Suas conexões</p>
                      <p className="text-xs font-extrabold text-[#18352a]">3 pessoas</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="bg-[#e8f0d9] py-24 sm:py-28">
          <div className="mx-auto max-w-[78rem] px-5 sm:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#105b44]">
                  Como funciona
                </p>
                <h2 className="mt-4 font-display text-4xl font-extrabold leading-tight tracking-[-0.045em] text-[#10251d] sm:text-5xl">
                  Organizar pode ser simples.
                </h2>
                <p className="mt-5 max-w-md text-base leading-7 text-[#5a6a61]">
                  Comece com o que você já tem e ganhe clareza a cada registro.
                </p>
              </div>

              <ol className="grid gap-4 sm:grid-cols-3">
                {[
                  ["01", "Reúna", "Cadastre suas contas e cartões."],
                  ["02", "Acompanhe", "Registre entradas, saídas e limites."],
                  ["03", "Decida", "Use relatórios para planejar o próximo passo."],
                ].map(([number, title, description]) => (
                  <li
                    key={number}
                    className="rounded-[1.5rem] border border-white/70 bg-white/70 p-6 shadow-sm"
                  >
                    <span className="font-display text-sm font-extrabold text-[#16855f]">
                      {number}
                    </span>
                    <h3 className="mt-8 font-display text-xl font-extrabold text-[#10251d]">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#65736c]">{description}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="seguranca" className="py-24 sm:py-32">
          <div className="mx-auto max-w-[78rem] px-5 sm:px-8">
            <div className="relative overflow-hidden rounded-[2rem] bg-[#0b2e24] px-6 py-12 text-white shadow-[0_32px_90px_rgba(11,46,36,0.2)] sm:px-12 lg:px-16 lg:py-16">
              <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[3rem] border-[#c9ff5b]/10" />
              <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_auto]">
                <div className="flex max-w-[44rem] gap-5">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#c9ff5b] text-[#0b2e24]">
                    <LockKeyhole className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#c9ff5b]">
                      No seu controle
                    </p>
                    <h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
                      Seus dados servem às suas decisões.
                    </h2>
                    <p className="mt-4 max-w-[38rem] text-sm leading-7 text-white/60 sm:text-base">
                      A Prospera foi desenhada para manter sua vida financeira organizada, legível e
                      sempre sob o seu comando.
                    </p>
                  </div>
                </div>
                <Link
                  to="/auth/register"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#c9ff5b] px-6 text-sm font-extrabold text-[#0b2e24] transition hover:-translate-y-0.5 hover:bg-[#d7ff81]"
                >
                  Criar minha conta <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dfe5dc] bg-[#f1f2eb]">
        <div className="mx-auto flex max-w-[78rem] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <BrandLogo markSize="sm" textClassName="!text-[#14241e] text-lg" />
          <p className="text-xs leading-5 text-[#6a7770]">
            © 2026 Prospera. Clareza para decidir melhor.
          </p>
          <div className="flex items-center gap-5 text-xs font-bold text-[#526159]">
            <Link to={accessHref} className="hover:text-[#105b44]">
              {accessLabel}
            </Link>
            <a href="#recursos" className="hover:text-[#105b44]">
              Recursos
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
