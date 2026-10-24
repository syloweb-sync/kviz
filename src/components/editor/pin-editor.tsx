"use client";

import { Slider } from "radix-ui";
import { PinCanvas } from "@/components/shared/pin-canvas";
import { SwitchRow } from "@/components/ui/switch";
import type { QuestionOf } from "@/lib/domain/schema";
import { ImageField } from "./image-field";
import { SectionTitle, produce } from "./primitives";

export function PinImageEditor({ question, onChange }: { question: QuestionOf<"pin_image">; onChange: (q: QuestionOf<"pin_image">) => void }) {
  const c = question.config;
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle hint="Karta, fotografija ili dijagram. Igrači će dodirom označiti mjesto.">Slika</SectionTitle>
        {c.image ? (
          <div className="space-y-3">
            <PinCanvas
              image={c.image}
              label="Kliknite na sliku da označite točno mjesto. Strelicama pomičete oznaku."
              markers={c.target ? [{ point: c.target, tone: "target", label: "Točno mjesto" }] : []}
              radius={c.radius}
              radiusCenter={c.target}
              onPick={(point) => onChange(produce(question, (q) => void (q.config.target = point)))}
            />
            <p className="text-sm text-ink-subtle">
              {c.target
                ? `Točno mjesto: ${Math.round(c.target.x * 100)} % širine, ${Math.round(c.target.y * 100)} % visine.`
                : "Kliknite na sliku da označite točno mjesto."}
            </p>
            <ImageField
              compact
              aspect="h-16"
              label="Zamijeni sliku"
              value={null}
              onChange={(media) =>
                media &&
                onChange(
                  produce(question, (q) => {
                    q.config.image = media;
                    q.config.target = null;
                  }),
                )
              }
            />
          </div>
        ) : (
          <ImageField label="Slika za pribadaču" value={null} onChange={(media) => onChange(produce(question, (q) => void (q.config.image = media)))} />
        )}
      </div>
      <div>
        <SectionTitle hint="Zeleni krug pokazuje područje koje se priznaje kao točno.">
          Dopušteno odstupanje: {Math.round(c.radius * 100)} % širine slike
        </SectionTitle>
        <Slider.Root
          className="relative flex h-8 touch-none select-none items-center"
          min={1}
          max={50}
          step={1}
          value={[Math.round(c.radius * 100)]}
          onValueChange={([v]) => onChange(produce(question, (q) => void (q.config.radius = (v ?? 8) / 100)))}
          aria-label="Dopušteno odstupanje"
        >
          <Slider.Track className="relative h-3 grow rounded-full bg-white/10">
            <Slider.Range className="absolute h-full rounded-full bg-mint-400" />
          </Slider.Track>
          <Slider.Thumb className="block size-7 rounded-full bg-white shadow-lg ring-4 ring-mint-400 focus-visible:outline-none focus-visible:ring-cyan-300" />
        </Slider.Root>
      </div>
      <SwitchRow
        id={`${question.id}-graded`}
        label="Bodovi prema blizini"
        description="Unutar kruga: 100 % u središtu, 50 % na rubu. Isključeno: puni bodovi bilo gdje unutar kruga."
        checked={c.graded}
        onCheckedChange={(v) => onChange(produce(question, (q) => void (q.config.graded = v)))}
      />
    </div>
  );
}
