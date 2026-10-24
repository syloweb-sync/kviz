"use client";

import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/switch";
import { SortableList, moveItem } from "@/components/shared/sortable-list";
import { createId } from "@/lib/domain/random";
import { LIMITS, type QuestionOf } from "@/lib/domain/schema";
import { cn } from "@/lib/utils";
import { ImageField } from "./image-field";
import { SectionTitle, produce } from "./primitives";

type Item = { id: string; text: string };

function ItemList({
  items,
  onChange,
  numbered,
  label,
}: {
  items: Item[];
  onChange: (items: Item[]) => void;
  numbered: boolean;
  label: string;
}) {
  return (
    <>
      <SortableList
        items={items}
        onReorder={onChange}
        className="space-y-2"
        renderItem={(item, index, handle) => (
          <div className={cn("flex items-center gap-2 rounded-xl bg-night-950/50 p-2 ring-1 ring-white/8", handle.isDragging && "ring-2 ring-cyan-300 shadow-[var(--shadow-lift)]")}>
            <button
              type="button"
              className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-ink-subtle hover:bg-white/8 active:cursor-grabbing"
              aria-label={`Povuci stavku ${index + 1}`}
              {...handle.attributes}
              {...handle.listeners}
            >
              <GripVertical className="size-5" />
            </button>
            {numbered && <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-500 font-bold">{index + 1}</span>}
            <input
              value={item.text}
              maxLength={LIMITS.optionText}
              placeholder={`${label} ${index + 1}`}
              aria-label={`${label} ${index + 1}`}
              onChange={(e) => onChange(items.map((it, i) => (i === index ? { ...it, text: e.target.value } : it)))}
              className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 font-semibold placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            />
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Pomakni stavku ${index + 1} gore`} disabled={index === 0} onClick={() => onChange(moveItem(items, index, index - 1))}>
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Pomakni stavku ${index + 1} dolje`}
              disabled={index === items.length - 1}
              onClick={() => onChange(moveItem(items, index, index + 1))}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Ukloni stavku ${index + 1}`}
              disabled={items.length <= LIMITS.minItems}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 />
            </Button>
          </div>
        )}
      />
      {items.length < LIMITS.maxItems && (
        <Button type="button" variant="secondary" className="mt-3" onClick={() => onChange([...items, { id: createId(), text: "" }])}>
          <Plus /> Dodaj stavku
        </Button>
      )}
    </>
  );
}

export function OrderingEditor({ question, onChange }: { question: QuestionOf<"ordering">; onChange: (q: QuestionOf<"ordering">) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <SectionTitle hint="Upišite stavke u TOČNOM redoslijedu. Igračima će se prikazati izmiješane.">Točan redoslijed</SectionTitle>
        <ItemList numbered label="Stavka" items={question.config.items} onChange={(items) => onChange(produce(question, (q) => void (q.config.items = items)))} />
      </div>
      <SwitchRow
        id={`${question.id}-partial`}
        label="Djelomično bodovanje"
        description="Bodovi razmjerni broju stavki na točnom mjestu."
        checked={question.config.partialCredit}
        onCheckedChange={(v) => onChange(produce(question, (q) => void (q.config.partialCredit = v)))}
      />
    </div>
  );
}

export function RankingEditor({ question, onChange }: { question: QuestionOf<"ranking">; onChange: (q: QuestionOf<"ranking">) => void }) {
  return (
    <div>
      <SectionTitle hint="Nema točnog poretka — igrači slažu prema vlastitom izboru, a na kraju se vidi poredak cijele grupe.">
        Opcije za rangiranje
      </SectionTitle>
      <ItemList numbered={false} label="Opcija" items={question.config.options} onChange={(options) => onChange(produce(question, (q) => void (q.config.options = options)))} />
    </div>
  );
}

export function MatchingEditor({ question, onChange }: { question: QuestionOf<"matching">; onChange: (q: QuestionOf<"matching">) => void }) {
  const { pairs } = question.config;
  return (
    <div className="space-y-5">
      <div>
        <SectionTitle hint="Svaki red je jedan točan par. Desni stupac igračima se miješa.">Parovi</SectionTitle>
        <ul className="space-y-3">
          {pairs.map((pair, index) => (
            <li key={pair.id} className="rounded-xl bg-night-950/50 p-3 ring-1 ring-white/8">
              <div className="flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-cyan-500 font-bold text-night-950">{index + 1}</span>
                <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <input
                    value={pair.left}
                    maxLength={LIMITS.optionText}
                    placeholder="Lijevo"
                    aria-label={`Par ${index + 1}, lijeva strana`}
                    onChange={(e) => onChange(produce(question, (q) => void (q.config.pairs[index]!.left = e.target.value)))}
                    className="h-10 min-w-0 rounded-lg bg-night-950/70 px-3 font-semibold ring-1 ring-white/10 placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  />
                  <span className="text-ink-faint" aria-hidden="true">
                    ↔
                  </span>
                  <input
                    value={pair.right}
                    maxLength={LIMITS.optionText}
                    placeholder="Desno"
                    aria-label={`Par ${index + 1}, desna strana`}
                    onChange={(e) => onChange(produce(question, (q) => void (q.config.pairs[index]!.right = e.target.value)))}
                    className="h-10 min-w-0 rounded-lg bg-night-950/70 px-3 font-semibold ring-1 ring-white/10 placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Ukloni par ${index + 1}`}
                  disabled={pairs.length <= 2}
                  onClick={() => onChange(produce(question, (q) => void q.config.pairs.splice(index, 1)))}
                >
                  <Trash2 />
                </Button>
              </div>
              <details className="mt-2 pl-10">
                <summary className="cursor-pointer text-xs font-semibold text-ink-subtle hover:text-ink">Slike uz par (neobavezno)</summary>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <ImageField compact aspect="aspect-[4/3]" label="Lijeva slika" value={pair.leftMedia} onChange={(m) => onChange(produce(question, (q) => void (q.config.pairs[index]!.leftMedia = m)))} />
                  <ImageField compact aspect="aspect-[4/3]" label="Desna slika" value={pair.rightMedia} onChange={(m) => onChange(produce(question, (q) => void (q.config.pairs[index]!.rightMedia = m)))} />
                </div>
              </details>
            </li>
          ))}
        </ul>
        {pairs.length < LIMITS.maxOptions && (
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => onChange(produce(question, (q) => void q.config.pairs.push({ id: createId(), left: "", leftMedia: null, right: "", rightMedia: null })))}
          >
            <Plus /> Dodaj par
          </Button>
        )}
      </div>
      <SwitchRow
        id={`${question.id}-partial`}
        label="Djelomično bodovanje"
        description="Bodovi razmjerni broju točno spojenih parova."
        checked={question.config.partialCredit}
        onCheckedChange={(v) => onChange(produce(question, (q) => void (q.config.partialCredit = v)))}
      />
    </div>
  );
}
