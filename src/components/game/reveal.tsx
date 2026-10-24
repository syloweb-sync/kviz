"use client";

import { Check, X } from "lucide-react";
import { motion } from "motion/react";
import { ShapeIcon, answerStyle } from "@/components/brand/shapes";
import { PinCanvas, type PinMarker } from "@/components/shared/pin-canvas";
import type { PublicQuestion, RevealedAnswer } from "@/lib/domain/public-view";
import type { QuestionStats } from "@/lib/domain/results";
import { mediaUrl } from "@/lib/media";
import { cn, formatNumber } from "@/lib/utils";

/**
 * Correct answer + answer distribution for a closed question. Used on the host screen
 * (large), the player phone (compact) and in the editor preview.
 */
export function RevealView({
  question,
  answer,
  stats,
  own,
  size = "md",
}: {
  question: PublicQuestion;
  answer: RevealedAnswer | null;
  stats: QuestionStats | null;
  own: Record<string, unknown> | null;
  size?: "md" | "lg";
}) {
  const c = question.config;
  const big = size === "lg";
  const dist = stats?.distribution;
  const total = Math.max(1, stats?.responseCount ?? 0);

  switch (c.type) {
    case "single_choice":
    case "multi_select":
    case "poll":
    case "image_choice": {
      const counts = dist?.kind === "options" ? dist.counts : {};
      const voters = dist?.kind === "options" ? dist.voters : null;
      const correctIds =
        answer?.type === "single_choice" || answer?.type === "image_choice"
          ? [answer.correctOptionId]
          : answer?.type === "multi_select"
            ? answer.correctOptionIds
            : [];
      const ownIds = own ? ((own.optionIds as string[] | undefined) ?? [own.optionId as string]) : [];
      const options = c.options.map((o) => ({ id: o.id, label: "text" in o ? o.text : o.caption, media: o.media }));
      const max = Math.max(1, ...options.map((o) => counts[o.id] ?? 0));
      return (
        <ul className={cn("grid gap-2.5", big ? "gap-3 md:grid-cols-2" : "")}>
          {options.map((option, index) => {
            const style = answerStyle(index);
            const count = counts[option.id] ?? 0;
            const correct = correctIds.includes(option.id);
            const dim = correctIds.length > 0 && !correct;
            const url = mediaUrl(option.media);
            return (
              <li key={option.id} className={cn("relative overflow-hidden rounded-xl bg-night-800 ring-1 ring-white/8", dim && "opacity-55")}>
                <motion.div
                  className={cn("absolute inset-y-0 left-0", style.bg)}
                  initial={{ width: 0 }}
                  animate={{ width: `${(count / max) * 100}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  style={{ opacity: 0.85 }}
                />
                <div className={cn("relative flex items-center gap-3 px-3", big ? "min-h-16 text-xl" : "min-h-12")}>
                  <ShapeIcon shape={style.shape} className={cn("shrink-0 text-white", big ? "size-6" : "size-5")} />
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className={cn("shrink-0 rounded-md object-cover", big ? "size-12" : "size-9")} />
                  )}
                  <span className="min-w-0 flex-1 font-bold text-white">
                    {option.label || (url ? "" : `Opcija ${index + 1}`)}
                    {ownIds.includes(option.id) && <span className="ml-2 rounded-full bg-night-950/50 px-2 py-0.5 text-xs">tvoj odgovor</span>}
                    {voters?.[option.id]?.length ? (
                      <span className="block truncate text-xs font-semibold text-white/80">{voters[option.id]!.join(", ")}</span>
                    ) : null}
                  </span>
                  <span className="font-display font-extrabold tabular-nums text-white">{count}</span>
                  {correct && (
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-mint-500">
                      <Check className="size-4" strokeWidth={3.5} />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      );
    }
    case "true_false": {
      const t = dist?.kind === "boolean" ? dist.trueCount : 0;
      const f = dist?.kind === "boolean" ? dist.falseCount : 0;
      const correct = answer?.type === "true_false" ? answer.correct : null;
      return (
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: true, label: "Točno", count: t, cls: "bg-mint-500" },
            { value: false, label: "Netočno", count: f, cls: "bg-coral-500" },
          ].map((item) => (
            <div key={item.label} className={cn("rounded-2xl p-4 text-center text-white", item.cls, correct !== null && correct !== item.value && "opacity-40")}>
              <p className={cn("font-display font-extrabold", big ? "text-3xl" : "text-xl")}>
                {item.label} {correct === item.value && <Check className="inline size-6" strokeWidth={3} />}
              </p>
              <p className={cn("font-display font-extrabold tabular-nums", big ? "text-6xl" : "text-4xl")}>{item.count}</p>
              {own && own.value === item.value && <p className="text-sm font-bold">tvoj odgovor</p>}
            </div>
          ))}
        </div>
      );
    }
    case "slider":
    case "numeric": {
      const target = answer && (answer.type === "slider" || answer.type === "numeric") ? answer.target : null;
      const tolerance = answer && (answer.type === "slider" || answer.type === "numeric") ? answer.tolerance : 0;
      const unit = c.unit ? ` ${c.unit}` : "";
      const buckets = dist?.kind === "numbers" ? dist.buckets : [];
      const maxBucket = Math.max(1, ...buckets.map((b) => b.count));
      return (
        <div className="space-y-4">
          {target !== null && (
            <div className="rounded-2xl bg-mint-400/12 p-4 text-center ring-1 ring-mint-400/40">
              <p className="text-sm font-bold uppercase tracking-widest text-mint-300">Točan odgovor</p>
              <p className={cn("font-display font-extrabold tabular-nums text-mint-300", big ? "text-6xl" : "text-4xl")}>
                {formatNumber(target)}
                {unit}
              </p>
              {tolerance > 0 && <p className="text-sm font-semibold text-ink-muted">priznaje se ± {formatNumber(tolerance)}{unit}</p>}
            </div>
          )}
          {typeof own?.value === "number" && (
            <p className="text-center font-semibold text-ink-muted">
              Tvoj odgovor: <strong className="text-sun-300">{formatNumber(own.value as number)}{unit}</strong>
            </p>
          )}
          {buckets.length > 0 && (
            <div>
              <div className={cn("flex items-end gap-1", big ? "h-40" : "h-24")} aria-label="Raspodjela odgovora">
                {buckets.map((b, i) => {
                  const containsTarget = target !== null && target >= b.from && (target < b.to || (i === buckets.length - 1 && target <= b.to));
                  return (
                    <motion.div
                      key={i}
                      title={`${formatNumber(b.from)} – ${formatNumber(b.to)}: ${b.count}`}
                      className={cn("flex-1 rounded-t-md", containsTarget ? "bg-mint-400" : "bg-sun-400/70")}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(4, (b.count / maxBucket) * 100)}%` }}
                      transition={{ duration: 0.6, delay: i * 0.03 }}
                    />
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-xs font-bold text-ink-faint">
                <span>{formatNumber(buckets[0]!.from)}</span>
                {dist?.kind === "numbers" && dist.average !== null && <span>prosjek {formatNumber(Math.round(dist.average * 100) / 100)}</span>}
                <span>{formatNumber(buckets[buckets.length - 1]!.to)}</span>
              </div>
            </div>
          )}
        </div>
      );
    }
    case "short_answer": {
      const accepted = answer?.type === "short_answer" ? answer.acceptedAnswers : [];
      const groups = dist?.kind === "texts" ? dist.groups : [];
      return (
        <div className="space-y-4">
          {accepted.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold uppercase tracking-widest text-mint-300">Prihvaćeni odgovori</p>
              <div className="flex flex-wrap gap-2">
                {accepted.map((a) => (
                  <span key={a} className={cn("rounded-full bg-mint-400 px-3 py-1 font-bold text-night-950", big && "px-4 py-1.5 text-xl")}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
          {typeof own?.text === "string" && (
            <p className="font-semibold text-ink-muted">
              Tvoj odgovor: <strong className="text-ink">„{own.text as string}”</strong>
            </p>
          )}
          {groups.length > 0 && (
            <ul className="space-y-1.5">
              {groups.map((g) => (
                <li key={g.text} className="flex items-center gap-2 rounded-lg bg-night-800 px-3 py-2">
                  {g.status === "correct" ? (
                    <Check className="size-4 text-mint-400" />
                  ) : g.status === "pending_review" ? (
                    <span className="size-2 rounded-full bg-sun-400" />
                  ) : (
                    <X className="size-4 text-coral-400" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-semibold">{g.text}</span>
                  <span className="font-display font-bold tabular-nums">{g.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    case "pin_image": {
      if (!c.image) return null;
      const target = answer?.type === "pin_image" ? answer.target : null;
      const radius = answer?.type === "pin_image" ? answer.radius : undefined;
      const others: PinMarker[] = (dist?.kind === "points" ? dist.points : []).map((p) => ({ point: p, tone: "other" }));
      const markers: PinMarker[] = [...others];
      if (typeof own?.x === "number") markers.push({ point: { x: own.x as number, y: own.y as number }, tone: "player", label: "Tvoj odgovor" });
      if (target) markers.push({ point: target, tone: "correct", label: "Točno mjesto" });
      return (
        <div>
          <PinCanvas image={c.image} label="Točno mjesto i odgovori igrača" markers={markers} radius={radius} radiusCenter={target} className={big ? "mx-auto max-h-[52vh] w-auto" : ""} />
          <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm font-semibold text-ink-muted">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-mint-400" /> točno mjesto</span>
            {typeof own?.x === "number" && <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-sun-400" /> tvoj odgovor</span>}
            {others.length > 0 && <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-cyan-300" /> ostali ({others.length})</span>}
          </p>
        </div>
      );
    }
    case "ordering": {
      const order = answer?.type === "ordering" ? answer.correctOrder : [];
      const accuracy = dist?.kind === "sequence" ? dist.positionAccuracy : {};
      const byId = new Map(c.items.map((i) => [i.id, i.text]));
      return (
        <ol className="space-y-2">
          {(order.length ? order : c.items.map((i) => i.id)).map((id, index) => (
            <li key={id} className={cn("flex items-center gap-3 rounded-xl bg-night-800 px-3 ring-1 ring-white/8", big ? "min-h-16 text-xl" : "min-h-12")}>
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mint-400 font-display font-extrabold text-night-950">{index + 1}</span>
              <span className="min-w-0 flex-1 font-bold">{byId.get(id)}</span>
              {stats && <span className="text-sm font-bold tabular-nums text-ink-subtle">{Math.round((accuracy[id] ?? 0) * 100)} % točno</span>}
            </li>
          ))}
        </ol>
      );
    }
    case "matching": {
      const pairs = answer?.type === "matching" ? answer.pairs : [];
      const accuracy = dist?.kind === "matching" ? dist.pairAccuracy : {};
      const left = new Map(c.left.map((l) => [l.id, l.text]));
      const right = new Map(c.right.map((r) => [r.id, r.text]));
      return (
        <ul className="space-y-2">
          {pairs.map((pair, index) => (
            <li key={pair.leftId} className={cn("grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 rounded-xl bg-night-800 px-3 py-2.5 ring-1 ring-white/8", big && "text-xl")}>
              <span className={cn("rounded-lg px-2.5 py-1 font-bold text-white", answerStyle(index).bg)}>{left.get(pair.leftId)}</span>
              <span className="text-ink-faint">↔</span>
              <span className="font-bold">{right.get(pair.rightId)}</span>
              {stats && <span className="text-sm font-bold tabular-nums text-ink-subtle">{Math.round((accuracy[pair.leftId] ?? 0) * 100)} %</span>}
            </li>
          ))}
        </ul>
      );
    }
    case "ranking": {
      const order = dist?.kind === "ranking" ? dist.order : [];
      const byId = new Map(c.options.map((o) => [o.id, o.text]));
      const max = Math.max(1, ...order.map((o) => o.score));
      return (
        <div>
          <p className="mb-2 text-sm font-bold uppercase tracking-widest text-sun-300">Poredak grupe</p>
          <ol className="space-y-2">
            {order.map((item, index) => (
              <li key={item.id} className="relative overflow-hidden rounded-xl bg-night-800 ring-1 ring-white/8">
                <motion.div className="absolute inset-y-0 left-0 bg-sun-400/25" initial={{ width: 0 }} animate={{ width: `${(item.score / max) * 100}%` }} transition={{ duration: 0.7 }} />
                <div className={cn("relative flex items-center gap-3 px-3", big ? "min-h-16 text-xl" : "min-h-12")}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sun-400 font-display font-extrabold text-night-950">{index + 1}</span>
                  <span className="min-w-0 flex-1 font-bold">{byId.get(item.id)}</span>
                  <span className="text-sm font-bold tabular-nums text-ink-subtle">⌀ {item.averagePosition.toFixed(1)}. mjesto</span>
                </div>
              </li>
            ))}
          </ol>
          {order.length === 0 && <p className="text-ink-muted">Nema glasova.</p>}
        </div>
      );
    }
  }
}

/** Big "correct / wrong" banner shown to a player after the reveal or with immediate feedback. */
export function ResultBanner({ status, points }: { status: string | null; points: number | null }) {
  if (!status) return null;
  const variants: Record<string, { title: string; cls: string; icon: React.ReactNode }> = {
    correct: { title: "Točno!", cls: "bg-mint-500 text-night-950", icon: <Check className="size-10" strokeWidth={3} /> },
    partial: { title: "Djelomično točno", cls: "bg-sun-400 text-night-950", icon: <Check className="size-10" strokeWidth={3} /> },
    incorrect: { title: "Netočno", cls: "bg-coral-500 text-white", icon: <X className="size-10" strokeWidth={3} /> },
    pending_review: { title: "Domaćin pregledava odgovor", cls: "bg-violet-500 text-white", icon: <span className="text-3xl">…</span> },
    ungraded: { title: "Glas zabilježen", cls: "bg-cyan-500 text-night-950", icon: <Check className="size-10" strokeWidth={3} /> },
  };
  const v = variants[status] ?? variants.incorrect!;
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      className={cn("flex items-center gap-4 rounded-3xl px-6 py-5", v.cls)}
      role="status"
    >
      {v.icon}
      <div>
        <p className="font-display text-3xl font-extrabold leading-tight">{v.title}</p>
        {points !== null && status !== "ungraded" && status !== "pending_review" && (
          <p className="font-display text-xl font-bold tabular-nums">+ {formatNumber(points)} bodova</p>
        )}
      </div>
    </motion.div>
  );
}
