import { Clock, Gamepad2, GraduationCap, Lock, Monitor, PartyPopper, Smartphone, Sparkles, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { FloatingShapes, ShapeIcon, answerStyle } from "@/components/brand/shapes";
import { HeroPreview } from "@/components/home/hero-preview";
import { PinEntry } from "@/components/home/pin-entry";
import { QuestionTypeIcon } from "@/components/quiz/question-type-icon";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { QUESTION_TYPE_META } from "@/lib/domain/question-defaults";
import { QUESTION_TYPES } from "@/lib/domain/schema";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Napravi",
    text: "Složi kviz od 12 vrsta pitanja — od klasičnog izbora do pribadače na karti. Sve se sprema automatski.",
    icon: Sparkles,
    tone: "bg-violet-500",
  },
  {
    title: "Pridruži se",
    text: "Pokreni igru i pokaži PIN ili QR kod. Igrači ulaze s mobitela, samo s nadimkom — bez registracije.",
    icon: Smartphone,
    tone: "bg-cyan-500",
  },
  {
    title: "Igraj",
    text: "Pitanja se pojavljuju svima u isto vrijeme. Brzina i točnost donose bodove, a poredak se mijenja uživo.",
    icon: Trophy,
    tone: "bg-sun-500",
  },
];

const FEATURES = [
  { icon: Users, title: "Cijela ekipa odjednom", text: "Sobe su projektirane za 20 i više igrača, svaki na svom mobitelu." },
  { icon: Monitor, title: "Prikaz za veliki ekran", text: "Krupna slova i boje čitljive s druge strane dnevnog boravka ili učionice." },
  { icon: PartyPopper, title: "Timovi i vježba", text: "Igrajte u timovima, vodite tempo ručno ili vježbajte sami kad god želite." },
  { icon: Lock, title: "Pošteno bodovanje", text: "Točni odgovori i bodovi računaju se na serveru — nitko ih ne može podvaliti." },
  { icon: Clock, title: "Zajednički sat", text: "Svi vide isto odbrojavanje jer ono dolazi sa servera, ne s mobitela." },
  { icon: GraduationCap, title: "Za razred i za zabavu", text: "Objašnjenja nakon pitanja, ankete i rangiranja za opuštene runde." },
];

const SAMPLE_CARDS = [
  { type: "single_choice" as const, title: "Koji je glavni grad Australije?", answers: ["Sydney", "Canberra", "Melbourne", "Perth"] },
  { type: "pin_image" as const, title: "Gdje se nalazi Vukovar?", answers: [] },
  { type: "slider" as const, title: "Koliko je visoka Dinara?", answers: [] },
  { type: "ordering" as const, title: "Poredaj izume od najstarijeg", answers: ["Kotač", "Tisak", "Parni stroj"] },
];

export default function HomePage() {
  return (
    <div className="relative overflow-x-clip">
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative">
          <FloatingShapes className="opacity-70" />
          <div className="relative mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] items-center gap-14 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3.5 py-1.5 text-sm font-bold text-ink-muted ring-1 ring-white/10">
                <span className="size-2 rounded-full bg-mint-400" /> Kviz uživo · bez instalacije
              </p>
              <h1 className="mt-6 font-display text-5xl font-extrabold leading-[0.98] sm:text-6xl lg:text-7xl">
                Kviz koji <span className="text-gradient">digne cijelu ekipu</span> na noge.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-ink-muted sm:text-xl">
                Ti postaviš pitanja, ekipa uđe s mobitela preko PIN-a, a zatim — odbrojavanje, smijeh i borba za postolje.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/dashboard">Napravi kviz</Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/join">Pridruži se igri</Link>
                </Button>
              </div>
              <div className="mt-8 max-w-lg">
                <p className="mb-2 text-sm font-bold text-ink-subtle">Imaš PIN? Upiši ga ovdje:</p>
                <PinEntry />
              </div>
            </div>
            <div className="pb-10 lg:pb-0">
              <HeroPreview />
            </div>
          </div>
        </section>

        {/* Steps */}
        <section id="kako" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6">
          <SectionHeading eyebrow="Kako radi" title="Tri koraka do kviz-večeri" />
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="surface relative overflow-hidden rounded-2xl p-7">
                <span className="absolute -right-4 -top-6 font-display text-[7rem] font-extrabold leading-none text-white/[0.04]">
                  {i + 1}
                </span>
                <span className={cn("grid size-14 place-items-center rounded-2xl text-night-950", step.tone)}>
                  <step.icon className="size-7" />
                </span>
                <h3 className="mt-6 font-display text-2xl font-extrabold">
                  {i + 1}. {step.title}
                </h3>
                <p className="mt-2 text-ink-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Example cards */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeading eyebrow="Primjeri" title="Pitanja koja se igraju, a ne samo čitaju" />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SAMPLE_CARDS.map((card, i) => (
              <article
                key={card.title}
                className="surface flex flex-col rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-1"
                style={{ rotate: `${[-1.5, 1, -0.5, 1.5][i]}deg` }}
              >
                <div className="flex items-center gap-2.5">
                  <QuestionTypeIcon type={card.type} size="sm" />
                  <span className="text-sm font-bold text-ink-subtle">{QUESTION_TYPE_META[card.type].label}</span>
                </div>
                <h3 className="mt-4 font-display text-xl font-bold leading-snug">{card.title}</h3>
                <div className="mt-4 flex-1">
                  {card.type === "single_choice" && (
                    <div className="grid grid-cols-2 gap-2">
                      {card.answers.map((a, j) => (
                        <span key={a} className={cn("flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-bold text-white", answerStyle(j).bg)}>
                          <ShapeIcon shape={answerStyle(j).shape} className="size-3.5" /> {a}
                        </span>
                      ))}
                    </div>
                  )}
                  {card.type === "pin_image" && <MiniMap />}
                  {card.type === "slider" && <MiniSlider />}
                  {card.type === "ordering" && (
                    <ol className="space-y-2">
                      {card.answers.map((a, j) => (
                        <li key={a} className="flex h-10 items-center gap-2 rounded-lg bg-white/8 px-3 text-sm font-bold">
                          <span className="grid size-6 place-items-center rounded-md bg-violet-500 text-xs">{j + 1}</span>
                          {a}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Question types */}
        <section id="tipovi" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6">
          <SectionHeading
            eyebrow="12 vrsta pitanja"
            title="Za svaku temu pravi oblik pitanja"
            text="Svaka vrsta ima vlastiti uređivač, vlastito sučelje na mobitelu i jasno pravilo bodovanja."
          />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {QUESTION_TYPES.map((type) => (
              <li key={type} className="surface-flat flex gap-4 rounded-2xl p-5">
                <QuestionTypeIcon type={type} />
                <div>
                  <h3 className="font-display text-lg font-bold">{QUESTION_TYPE_META[type].label}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{QUESTION_TYPE_META[type].description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeading eyebrow="Zašto Pitalica" title="Napravljeno za pravu igru uživo" />
          <div className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex gap-4">
                <feature.icon className="mt-1 size-6 shrink-0 text-cyan-300" />
                <div>
                  <h3 className="font-display text-lg font-bold">{feature.title}</h3>
                  <p className="mt-1 text-ink-muted">{feature.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="pitanja" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-16 sm:px-6">
          <SectionHeading eyebrow="Česta pitanja" title="Kratko i jasno" />
          <div className="mt-10 space-y-3">
            {[
              ["Trebaju li igrači račun?", "Ne. Igrač upiše PIN i nadimak i odmah je u predvorju. Račun treba samo onaj tko pravi kvizove."],
              ["Koliko igrača može igrati?", "Sobe su testirane i projektirane za 20+ igrača istovremeno; domaćin može postaviti ograničenje do 100."],
              ["Što ako se nekome prekine veza?", "Mobitel se sam ponovno spaja i vraća igrača točno tamo gdje je igra — s istim bodovima."],
              ["Mogu li igrati sam?", "Da, način vježbe radi bez domaćina. Vlasnik kviza može podijeliti poveznicu za vježbu s drugima."],
            ].map(([q, a]) => (
              <details key={q} className="surface-flat group rounded-xl px-5 py-4 open:bg-night-700/60">
                <summary className="cursor-pointer list-none font-display text-lg font-bold marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {q}
                    <span className="text-2xl text-ink-subtle transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-2 text-ink-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="relative overflow-hidden rounded-[2rem] bg-violet-600 px-6 py-14 text-center sm:px-12">
            <div className="dot-grid absolute inset-0 opacity-60" aria-hidden="true" />
            <FloatingShapes className="opacity-50" />
            <div className="relative">
              <Gamepad2 className="mx-auto size-12 text-sun-300" />
              <h2 className="mt-4 font-display text-4xl font-extrabold sm:text-5xl">Sljedeća runda je tvoja.</h2>
              <p className="mx-auto mt-3 max-w-lg text-lg text-white/80">Prvi kviz složiš za nekoliko minuta. Igrači ne trebaju ništa osim mobitela.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" variant="accent">
                  <Link href="/signup">Napravi besplatan račun</Link>
                </Button>
                <Button asChild size="lg" variant="secondary" className="bg-white/15">
                  <Link href="/join">Imam PIN</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl font-extrabold leading-tight sm:text-5xl">{title}</h2>
      {text && <p className="mt-4 text-lg text-ink-muted">{text}</p>}
    </div>
  );
}

function MiniMap() {
  return (
    <div className="relative h-32 overflow-hidden rounded-xl bg-cyan-500/15 ring-1 ring-cyan-300/20">
      <svg viewBox="0 0 200 120" className="absolute inset-0 size-full" aria-hidden="true">
        <path
          d="M20 30 C50 10 80 20 100 28 S150 22 178 34 L172 52 C150 60 120 54 108 64 S96 92 120 108 L90 112 C70 96 60 76 40 70 S18 52 20 30Z"
          fill="rgb(63 227 166 / 0.35)"
          stroke="rgb(143 245 207 / 0.7)"
          strokeWidth="1.5"
        />
      </svg>
      <span className="absolute left-[78%] top-[30%] -translate-x-1/2 -translate-y-full text-coral-500 drop-shadow">
        <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
          <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Z" fill="currentColor" />
          <circle cx="12" cy="9" r="2.6" fill="#fff" />
        </svg>
      </span>
    </div>
  );
}

function MiniSlider() {
  return (
    <div className="pt-6">
      <p className="text-center font-display text-4xl font-extrabold tabular-nums text-sun-300">1 831 m</p>
      <div className="relative mt-5 h-3 rounded-full bg-white/10">
        <div className="absolute inset-y-0 left-0 w-[61%] rounded-full bg-sun-400" />
        <div className="absolute left-[61%] top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg ring-4 ring-sun-400" />
      </div>
      <div className="mt-2 flex justify-between text-xs font-bold text-ink-faint">
        <span>0</span>
        <span>3 000</span>
      </div>
    </div>
  );
}
