"use client";

import { ArrowDown, ArrowUp, Check, GripVertical, Send, X } from "lucide-react";
import { motion } from "motion/react";
import { Slider } from "radix-ui";
import { useState } from "react";
import { ShapeIcon, answerStyle } from "@/components/brand/shapes";
import { PinCanvas } from "@/components/shared/pin-canvas";
import { SortableList, moveItem } from "@/components/shared/sortable-list";
import { Button } from "@/components/ui/button";
import type { PublicConfig, PublicQuestion } from "@/lib/domain/public-view";
import type { NormalizedPoint } from "@/lib/domain/schema";
import { mediaUrl } from "@/lib/media";
import { cn, formatNumber } from "@/lib/utils";

/**
 * Player-side answer components, one per question type. They only ever see the public view
 * of a question and emit a public answer payload; validation and scoring happen on the server.
 */

export interface AnswerInputProps {
  question: PublicQuestion;
  disabled: boolean;
  /** The payload already submitted (restored after reconnect), if any. */
  submitted: Record<string, unknown> | null;
  onSubmit: (answer: Record<string, unknown>) => void;
  /** Allow sending again (host enabled answer changes). */
  allowChange?: boolean;
  busy?: boolean;
}

type ConfigOf<T extends PublicConfig["type"]> = Extract<PublicConfig, { type: T }>;

function SubmitBar({ disabled, busy, label = "Pošalji odgovor", onClick, hint }: { disabled: boolean; busy?: boolean; label?: string; onClick: () => void; hint?: string }) {
  return (
    <div className="sticky bottom-0 -mx-1 mt-4 bg-gradient-to-t from-night-900 via-night-900/95 to-transparent px-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4">
      {hint && <p className="mb-2 text-center text-sm font-semibold text-ink-subtle">{hint}</p>}
      <Button size="xl" variant="accent" className="w-full" disabled={disabled} loading={busy} onClick={onClick}>
        <Send /> {label}
      </Button>
    </div>
  );
}

export function AnswerInput(props: AnswerInputProps) {
  const { question } = props;
  const c = question.config;
  switch (c.type) {
    case "single_choice":
    case "poll":
      return <ChoiceAnswer {...props} config={c} />;
    case "image_choice":
      return <ImageChoiceAnswer {...props} config={c} />;
    case "multi_select":
      return <MultiAnswer {...props} config={c} />;
    case "true_false":
      return <TrueFalseAnswer {...props} />;
    case "slider":
      return <SliderAnswer {...props} config={c} />;
    case "numeric":
      return <NumericAnswer {...props} config={c} />;
    case "short_answer":
      return <ShortAnswer {...props} config={c} />;
    case "pin_image":
      return <PinAnswer {...props} config={c} />;
    case "ordering":
      return <OrderAnswer {...props} items={c.items} hint="Povuci ili koristi strelice da složiš točan redoslijed." />;
    case "ranking":
      return <OrderAnswer {...props} items={c.options} hint="Složi od najdražeg (gore) prema najmanje dragom." ranking />;
    case "matching":
      return <MatchingAnswer {...props} config={c} />;
  }
}

function AnswerTile({
  index,
  selected,
  dimmed,
  onClick,
  disabled,
  children,
  role = "button",
}: {
  index: number;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  role?: "button" | "checkbox";
}) {
  const style = answerStyle(index);
  return (
    <motion.button
      type="button"
      role={role === "checkbox" ? "checkbox" : undefined}
      aria-checked={role === "checkbox" ? selected : undefined}
      aria-pressed={role === "button" ? selected : undefined}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative flex min-h-24 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-display text-lg font-bold text-white transition-[opacity,box-shadow] sm:min-h-28 sm:text-xl",
        style.bg,
        selected && "ring-4 ring-white ring-offset-2 ring-offset-night-900",
        dimmed && "opacity-35",
        disabled && !selected && "cursor-default",
      )}
      style={{ boxShadow: `0 6px 0 0 ${style.shadow}` }}
    >
      <ShapeIcon shape={style.shape} className="size-8 shrink-0 drop-shadow" />
      <span className="min-w-0 flex-1 break-words leading-tight">{children}</span>
      {selected && (
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-night-950">
          <Check className="size-5" strokeWidth={3} />
        </span>
      )}
    </motion.button>
  );
}

function OptionContent({ text, media }: { text: string; media: { path: string } | null }) {
  const url = mediaUrl(media);
  return (
    <span className="flex items-center gap-3">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-14 shrink-0 rounded-lg object-cover ring-2 ring-white/40" />
      )}
      <span>{text}</span>
    </span>
  );
}

function ChoiceAnswer({ config, disabled, submitted, onSubmit, allowChange }: AnswerInputProps & { config: ConfigOf<"single_choice"> | ConfigOf<"poll"> }) {
  const chosen = (submitted?.optionId as string | undefined) ?? null;
  const locked = disabled || (chosen !== null && !allowChange);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {config.options.map((option, index) => (
        <AnswerTile
          key={option.id}
          index={index}
          selected={chosen === option.id}
          dimmed={chosen !== null && chosen !== option.id}
          disabled={locked}
          onClick={() => onSubmit({ optionId: option.id })}
        >
          <OptionContent text={option.text} media={option.media} />
        </AnswerTile>
      ))}
    </div>
  );
}

function ImageChoiceAnswer({ config, disabled, submitted, onSubmit, allowChange }: AnswerInputProps & { config: ConfigOf<"image_choice"> }) {
  const chosen = (submitted?.optionId as string | undefined) ?? null;
  const locked = disabled || (chosen !== null && !allowChange);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {config.options.map((option, index) => {
        const style = answerStyle(index);
        const url = mediaUrl(option.media);
        const selected = chosen === option.id;
        return (
          <motion.button
            key={option.id}
            type="button"
            aria-pressed={selected}
            aria-label={option.caption || `Slika ${index + 1}`}
            whileTap={locked ? undefined : { scale: 0.96 }}
            disabled={locked}
            onClick={() => onSubmit({ optionId: option.id })}
            className={cn(
              "overflow-hidden rounded-2xl bg-night-800 text-left ring-4 transition-opacity",
              selected ? "ring-white" : style.ring,
              chosen !== null && !selected && "opacity-35",
            )}
          >
            <span className="relative block aspect-square bg-night-950">
              {url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={option.caption} className="size-full object-cover" />
              )}
              <span className={cn("absolute left-2 top-2 grid size-9 place-items-center rounded-lg text-white", style.bg)}>
                <ShapeIcon shape={style.shape} className="size-5" />
              </span>
              {selected && (
                <span className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-white text-night-950">
                  <Check className="size-5" strokeWidth={3} />
                </span>
              )}
            </span>
            {option.caption && <span className="block px-3 py-2 font-bold">{option.caption}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}

function MultiAnswer({ config, disabled, submitted, onSubmit, allowChange, busy }: AnswerInputProps & { config: ConfigOf<"multi_select"> }) {
  const initial = (submitted?.optionIds as string[] | undefined) ?? [];
  const [picked, setPicked] = useState<string[]>(initial);
  const locked = disabled || (submitted !== null && !allowChange);
  return (
    <div>
      <p className="mb-3 rounded-xl bg-cyan-400/10 px-4 py-2 text-center font-bold text-cyan-300">Može biti više točnih odgovora</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {config.options.map((option, index) => (
          <AnswerTile
            key={option.id}
            index={index}
            role="checkbox"
            selected={picked.includes(option.id)}
            dimmed={false}
            disabled={locked}
            onClick={() => setPicked((p) => (p.includes(option.id) ? p.filter((x) => x !== option.id) : [...p, option.id]))}
          >
            <OptionContent text={option.text} media={option.media} />
          </AnswerTile>
        ))}
      </div>
      {!locked && <SubmitBar disabled={picked.length === 0} busy={busy} onClick={() => onSubmit({ optionIds: picked })} hint={`Odabrano: ${picked.length}`} />}
    </div>
  );
}

function TrueFalseAnswer({ disabled, submitted, onSubmit, allowChange }: AnswerInputProps) {
  const chosen = typeof submitted?.value === "boolean" ? (submitted.value as boolean) : null;
  const locked = disabled || (chosen !== null && !allowChange);
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { value: true, label: "Točno", cls: "bg-mint-500", shadow: "#0f9566", Icon: Check },
        { value: false, label: "Netočno", cls: "bg-coral-500", shadow: "#e84a36", Icon: X },
      ].map(({ value, label, cls, shadow, Icon }) => (
        <motion.button
          key={label}
          type="button"
          aria-pressed={chosen === value}
          whileTap={locked ? undefined : { scale: 0.95 }}
          disabled={locked}
          onClick={() => onSubmit({ value })}
          className={cn(
            "flex min-h-44 flex-col items-center justify-center gap-3 rounded-3xl font-display text-3xl font-extrabold text-white sm:min-h-56",
            cls,
            chosen === value && "ring-4 ring-white ring-offset-2 ring-offset-night-900",
            chosen !== null && chosen !== value && "opacity-35",
          )}
          style={{ boxShadow: `0 8px 0 0 ${shadow}` }}
        >
          <Icon className="size-14" strokeWidth={3} />
          {label}
        </motion.button>
      ))}
    </div>
  );
}

function SliderAnswer({ config, disabled, submitted, onSubmit, allowChange, busy }: AnswerInputProps & { config: ConfigOf<"slider"> }) {
  const mid = config.min + Math.round((config.max - config.min) / 2 / config.step) * config.step;
  const [value, setValue] = useState<number>(typeof submitted?.value === "number" ? (submitted.value as number) : mid);
  const locked = disabled || (submitted !== null && !allowChange);
  const nudge = (dir: 1 | -1) => setValue((v) => Math.min(config.max, Math.max(config.min, Number((v + dir * config.step).toFixed(6)))));
  return (
    <div className="flex flex-col">
      <div className="surface rounded-3xl px-5 py-8 text-center">
        <p className="font-display text-6xl font-extrabold tabular-nums text-sun-300 sm:text-7xl" aria-live="polite">
          {formatNumber(value)}
          {config.unit && <span className="ml-2 text-3xl text-sun-300/70">{config.unit}</span>}
        </p>
        <Slider.Root
          className="relative mt-10 flex h-12 touch-none select-none items-center"
          min={config.min}
          max={config.max}
          step={config.step}
          value={[value]}
          disabled={locked}
          onValueChange={([v]) => v !== undefined && setValue(v)}
          aria-label="Vaša procjena"
        >
          <Slider.Track className="relative h-4 grow rounded-full bg-white/10">
            <Slider.Range className="absolute h-full rounded-full bg-sun-400" />
          </Slider.Track>
          <Slider.Thumb className="block size-11 rounded-full bg-white shadow-xl ring-[6px] ring-sun-400 focus-visible:outline-none focus-visible:ring-cyan-300" />
        </Slider.Root>
        <div className="mt-2 flex justify-between text-sm font-bold text-ink-faint">
          <span>{formatNumber(config.min)}</span>
          <span>{formatNumber(config.max)}</span>
        </div>
        {!locked && (
          <div className="mt-5 flex justify-center gap-3">
            <Button variant="secondary" size="lg" onClick={() => nudge(-1)} aria-label="Smanji">
              −
            </Button>
            <Button variant="secondary" size="lg" onClick={() => nudge(1)} aria-label="Povećaj">
              +
            </Button>
          </div>
        )}
      </div>
      {!locked && <SubmitBar disabled={false} busy={busy} onClick={() => onSubmit({ value })} />}
    </div>
  );
}

function NumericAnswer({ config, disabled, submitted, onSubmit, allowChange, busy }: AnswerInputProps & { config: ConfigOf<"numeric"> }) {
  const [text, setText] = useState(typeof submitted?.value === "number" ? String(submitted.value) : "");
  const locked = disabled || (submitted !== null && !allowChange);
  const normalized = text.replace(",", ".").trim();
  const value = normalized === "" || normalized === "-" ? null : Number(normalized);
  let error: string | null = null;
  if (value !== null && !Number.isFinite(value)) error = "Upišite broj.";
  else if (value !== null && !config.allowDecimals && !Number.isInteger(value)) error = "Upišite cijeli broj.";
  else if (value !== null && config.min !== null && value < config.min) error = `Najmanje ${formatNumber(config.min)}.`;
  else if (value !== null && config.max !== null && value > config.max) error = `Najviše ${formatNumber(config.max)}.`;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value !== null && !error) onSubmit({ value });
      }}
    >
      <label htmlFor="numeric-answer" className="sr-only">
        Vaš odgovor
      </label>
      <div className="surface flex items-center gap-3 rounded-3xl p-4">
        <input
          id="numeric-answer"
          inputMode={config.allowDecimals ? "decimal" : "numeric"}
          autoComplete="off"
          value={text}
          disabled={locked}
          onChange={(e) => setText(e.target.value.replace(/[^\d.,-]/g, "").slice(0, 24))}
          placeholder="0"
          aria-invalid={error ? true : undefined}
          className="h-20 min-w-0 flex-1 rounded-2xl bg-night-950/70 px-4 text-center font-display text-5xl font-extrabold tabular-nums text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        />
        {config.unit && <span className="font-display text-2xl font-bold text-ink-muted">{config.unit}</span>}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-center font-semibold text-coral-400">
          {error}
        </p>
      )}
      {!locked && (
        <div className="sticky bottom-0 mt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="submit" size="xl" variant="accent" className="w-full" disabled={value === null || error !== null} loading={busy}>
            <Send /> Pošalji odgovor
          </Button>
        </div>
      )}
    </form>
  );
}

function ShortAnswer({ config, disabled, submitted, onSubmit, allowChange, busy }: AnswerInputProps & { config: ConfigOf<"short_answer"> }) {
  const [text, setText] = useState(typeof submitted?.text === "string" ? (submitted.text as string) : "");
  const locked = disabled || (submitted !== null && !allowChange);
  const Field = config.multiline ? "textarea" : "input";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSubmit({ text });
      }}
    >
      <label htmlFor="short-answer" className="sr-only">
        Vaš odgovor
      </label>
      <Field
        id="short-answer"
        value={text}
        maxLength={config.maxLength}
        disabled={locked}
        autoComplete="off"
        autoCapitalize="sentences"
        spellCheck={false}
        placeholder="Upiši odgovor…"
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setText(e.target.value)}
        className={cn(
          "w-full rounded-2xl bg-night-950/70 px-5 font-display text-2xl font-bold text-ink ring-2 ring-white/12 placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-cyan-300",
          config.multiline ? "min-h-40 py-4" : "h-20",
        )}
      />
      <p className="mt-1.5 text-right text-xs font-semibold text-ink-faint">
        {text.length} / {config.maxLength}
      </p>
      {!locked && (
        <div className="sticky bottom-0 mt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="submit" size="xl" variant="accent" className="w-full" disabled={!text.trim()} loading={busy}>
            <Send /> Pošalji odgovor
          </Button>
        </div>
      )}
    </form>
  );
}

function PinAnswer({ config, disabled, submitted, onSubmit, allowChange, busy }: AnswerInputProps & { config: ConfigOf<"pin_image"> }) {
  const [point, setPoint] = useState<NormalizedPoint | null>(
    typeof submitted?.x === "number" && typeof submitted?.y === "number" ? { x: submitted.x as number, y: submitted.y as number } : null,
  );
  const locked = disabled || (submitted !== null && !allowChange);
  if (!config.image) return <p className="text-ink-muted">Slika nije dostupna.</p>;
  return (
    <div>
      <PinCanvas
        image={config.image}
        label="Dodirni sliku da postaviš pribadaču. Strelicama je možeš pomicati."
        markers={point ? [{ point, tone: "player" }] : []}
        onPick={locked ? undefined : setPoint}
        disabled={locked}
        className="max-h-[60dvh] object-contain"
      />
      {!locked && (
        <SubmitBar
          disabled={!point}
          busy={busy}
          onClick={() => point && onSubmit({ x: point.x, y: point.y })}
          hint={point ? "Možeš pomaknuti pribadaču prije slanja." : "Dodirni mjesto na slici."}
        />
      )}
    </div>
  );
}

function OrderAnswer({
  items: initialItems,
  disabled,
  submitted,
  onSubmit,
  allowChange,
  busy,
  hint,
  ranking,
}: AnswerInputProps & { items: { id: string; text: string }[]; hint: string; ranking?: boolean }) {
  const restored = Array.isArray(submitted?.order)
    ? (submitted.order as string[]).map((id) => initialItems.find((i) => i.id === id)).filter(Boolean)
    : null;
  const [items, setItems] = useState(restored && restored.length === initialItems.length ? (restored as typeof initialItems) : initialItems);
  const locked = disabled || (submitted !== null && !allowChange);
  return (
    <div>
      <p className="mb-3 text-center text-sm font-semibold text-ink-subtle">{hint}</p>
      <SortableList
        items={items}
        onReorder={setItems}
        disabled={locked}
        className="space-y-2.5"
        renderItem={(item, index, handle) => (
          <div
            className={cn(
              "flex min-h-16 items-center gap-2 rounded-2xl bg-night-700 p-2 pl-3 ring-2 ring-white/8",
              handle.isDragging && "ring-cyan-300 shadow-[var(--shadow-lift)]",
            )}
          >
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl font-display text-lg font-extrabold", ranking ? "bg-sun-400 text-night-950" : "bg-violet-500")}>
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 font-bold leading-tight">{item.text}</span>
            {!locked && (
              <>
                <button type="button" className="grid size-10 place-items-center rounded-lg text-ink-muted hover:bg-white/8 disabled:opacity-25" aria-label={`Pomakni „${item.text}” gore`} disabled={index === 0} onClick={() => setItems((l) => moveItem(l, index, index - 1))}>
                  <ArrowUp className="size-5" />
                </button>
                <button
                  type="button"
                  className="grid size-10 place-items-center rounded-lg text-ink-muted hover:bg-white/8 disabled:opacity-25"
                  aria-label={`Pomakni „${item.text}” dolje`}
                  disabled={index === items.length - 1}
                  onClick={() => setItems((l) => moveItem(l, index, index + 1))}
                >
                  <ArrowDown className="size-5" />
                </button>
                <button
                  type="button"
                  className="grid size-10 cursor-grab touch-none place-items-center rounded-lg text-ink-subtle active:cursor-grabbing"
                  aria-label={`Povuci „${item.text}”`}
                  {...handle.attributes}
                  {...handle.listeners}
                >
                  <GripVertical className="size-5" />
                </button>
              </>
            )}
          </div>
        )}
      />
      {!locked && <SubmitBar disabled={false} busy={busy} onClick={() => onSubmit({ order: items.map((i) => i.id) })} />}
    </div>
  );
}

const PAIR_COLORS = ["bg-coral-500", "bg-cyan-500", "bg-sun-500", "bg-mint-500", "bg-violet-500", "bg-rose-500"];

function MatchingAnswer({ config, disabled, submitted, onSubmit, allowChange, busy }: AnswerInputProps & { config: ConfigOf<"matching"> }) {
  const [matches, setMatches] = useState<Record<string, string>>((submitted?.matches as Record<string, string> | undefined) ?? {});
  const [activeLeft, setActiveLeft] = useState<string | null>(null);
  const locked = disabled || (submitted !== null && !allowChange);
  const pairIndex = (leftId: string) => Object.keys(matches).indexOf(leftId);
  const rightOwner = (rightId: string) => Object.entries(matches).find(([, r]) => r === rightId)?.[0] ?? null;

  function pickRight(rightId: string) {
    if (!activeLeft) return;
    setMatches((m) => {
      const next = Object.fromEntries(Object.entries(m).filter(([l, r]) => l !== activeLeft && r !== rightId));
      next[activeLeft] = rightId;
      return next;
    });
    setActiveLeft(null);
  }

  const colorFor = (leftId: string | null) => (leftId && pairIndex(leftId) >= 0 ? PAIR_COLORS[pairIndex(leftId) % PAIR_COLORS.length] : null);

  return (
    <div>
      <p className="mb-3 text-center text-sm font-semibold text-ink-subtle">
        {activeLeft ? "Sad dodirni pojam s desne strane." : "Dodirni pojam lijevo, pa njegov par desno."}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <ul className="space-y-2.5" aria-label="Lijevi stupac">
          {config.left.map((item) => {
            const color = colorFor(item.id);
            const active = activeLeft === item.id;
            const url = mediaUrl(item.media);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={locked}
                  aria-pressed={active}
                  onClick={() => setActiveLeft(active ? null : item.id)}
                  className={cn(
                    "flex min-h-16 w-full items-center gap-2 rounded-2xl px-3 py-2 text-left font-bold ring-2 transition-colors",
                    color ? `${color} text-white ring-transparent` : "bg-night-700 ring-white/10",
                    active && "ring-4 ring-white",
                  )}
                >
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
                  )}
                  <span className="min-w-0 break-words leading-tight">{item.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="space-y-2.5" aria-label="Desni stupac">
          {config.right.map((item) => {
            const owner = rightOwner(item.id);
            const color = colorFor(owner);
            const url = mediaUrl(item.media);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={locked || !activeLeft}
                  onClick={() => pickRight(item.id)}
                  className={cn(
                    "flex min-h-16 w-full items-center gap-2 rounded-2xl px-3 py-2 text-left font-bold ring-2 transition-colors",
                    color ? `${color} text-white ring-transparent` : "bg-night-800 ring-white/10",
                    activeLeft && !locked && !color && "ring-cyan-300/60",
                  )}
                >
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
                  )}
                  <span className="min-w-0 break-words leading-tight">{item.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {!locked && (
        <SubmitBar
          disabled={Object.keys(matches).length === 0}
          busy={busy}
          onClick={() => onSubmit({ matches })}
          hint={`Spojeno ${Object.keys(matches).length} od ${config.left.length}`}
        />
      )}
    </div>
  );
}
