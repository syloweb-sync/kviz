import { createId } from "./random";
import type { ChoiceOption, Question, QuestionOf, QuestionType } from "./schema";

/** Human-facing metadata for each question type (Croatian UI copy). */
export const QUESTION_TYPE_META: Record<
  QuestionType,
  { label: string; description: string; scored: boolean; example: string }
> = {
  single_choice: {
    label: "Jedan točan odgovor",
    description: "Klasika: 2–6 ponuđenih odgovora, samo jedan je točan.",
    scored: true,
    example: "Koji je glavni grad Australije?",
  },
  multi_select: {
    label: "Više točnih odgovora",
    description: "Igrači označavaju sve točne odgovore. Može i djelomično bodovanje.",
    scored: true,
    example: "Koje od ovih životinja su sisavci?",
  },
  true_false: {
    label: "Točno / netočno",
    description: "Dva velika gumba za brze tvrdnje.",
    scored: true,
    example: "Mjesec je veći od Plutona.",
  },
  slider: {
    label: "Klizač procjene",
    description: "Procjena broja klizačem. Bodovi ovise o udaljenosti od točnog.",
    scored: true,
    example: "Koliko je visok Dinara (u metrima)?",
  },
  short_answer: {
    label: "Kratki odgovor",
    description: "Igrači upisuju odgovor. Vi zadajete prihvatljive varijante.",
    scored: true,
    example: "Kako se zove najduža rijeka u Hrvatskoj?",
  },
  numeric: {
    label: "Brojčani odgovor",
    description: "Upis točnog broja, uz opcionalnu toleranciju i mjernu jedinicu.",
    scored: true,
    example: "Koliko kostiju ima odrasla osoba?",
  },
  pin_image: {
    label: "Pribadača na slici",
    description: "Igrači dodirom označe točno mjesto na slici ili karti.",
    scored: true,
    example: "Gdje se na karti nalazi Vukovar?",
  },
  ordering: {
    label: "Poredaj redom",
    description: "Složi stavke u točan redoslijed povlačenjem.",
    scored: true,
    example: "Poredaj izume od najstarijeg prema najnovijem.",
  },
  matching: {
    label: "Spoji parove",
    description: "Povezivanje pojmova iz dva stupca.",
    scored: true,
    example: "Spoji državu s njezinim glavnim gradom.",
  },
  image_choice: {
    label: "Slike kao odgovori",
    description: "Odgovori su slike, s opcionalnim opisom.",
    scored: true,
    example: "Koja je od ovih zastava zastava Islanda?",
  },
  poll: {
    label: "Anketa",
    description: "Pitanje bez točnog odgovora — samo glasanje i rezultati uživo.",
    scored: false,
    example: "Gdje idemo na sljedeći izlet?",
  },
  ranking: {
    label: "Rangiranje",
    description: "Igrači slažu opcije po vlastitom izboru, a vidi se poredak cijele grupe.",
    scored: false,
    example: "Poredaj godišnja doba od najdražeg do najmanje dragog.",
  },
};

export function isScoredType(type: QuestionType): boolean {
  return QUESTION_TYPE_META[type].scored;
}

function emptyOptions(count: number): ChoiceOption[] {
  return Array.from({ length: count }, () => ({ id: createId(), text: "", media: null }));
}

const base = {
  title: "",
  media: null,
  timeLimit: 20,
  points: "standard" as const,
  explanation: "",
  feedback: "on_close" as const,
};

/** Creates a new question of the given type with sensible defaults. */
export function createQuestion<T extends QuestionType>(type: T): QuestionOf<T> {
  const id = createId();
  const question = ((): Question => {
    switch (type) {
      case "single_choice":
        return { ...base, id, type, config: { options: emptyOptions(4), correctOptionId: null } };
      case "multi_select":
        return {
          ...base,
          id,
          type,
          config: { options: emptyOptions(4), correctOptionIds: [], partialCredit: false },
        };
      case "true_false":
        return { ...base, id, type, timeLimit: 10, config: { correct: null } };
      case "slider":
        return {
          ...base,
          id,
          type,
          timeLimit: 30,
          config: {
            min: 0,
            max: 100,
            step: 1,
            unit: "",
            target: null,
            tolerance: 5,
            exactMatch: false,
            graded: true,
          },
        };
      case "short_answer":
        return {
          ...base,
          id,
          type,
          timeLimit: 30,
          config: {
            acceptedAnswers: [""],
            caseSensitive: false,
            accentSensitive: false,
            normalizeWhitespace: true,
            multiline: false,
            maxLength: 80,
            manualReview: false,
          },
        };
      case "numeric":
        return {
          ...base,
          id,
          type,
          timeLimit: 30,
          config: { target: null, tolerance: 0, allowDecimals: false, unit: "", min: null, max: null },
        };
      case "pin_image":
        return {
          ...base,
          id,
          type,
          timeLimit: 30,
          config: { image: null, target: null, radius: 0.08, graded: true },
        };
      case "ordering":
        return {
          ...base,
          id,
          type,
          timeLimit: 40,
          config: {
            items: Array.from({ length: 4 }, () => ({ id: createId(), text: "" })),
            partialCredit: true,
          },
        };
      case "matching":
        return {
          ...base,
          id,
          type,
          timeLimit: 45,
          config: {
            pairs: Array.from({ length: 3 }, () => ({
              id: createId(),
              left: "",
              leftMedia: null,
              right: "",
              rightMedia: null,
            })),
            partialCredit: true,
          },
        };
      case "image_choice":
        return {
          ...base,
          id,
          type,
          config: {
            options: Array.from({ length: 4 }, () => ({ id: createId(), media: null, caption: "" })),
            correctOptionId: null,
          },
        };
      case "poll":
        return {
          ...base,
          id,
          type,
          points: "none",
          config: { options: emptyOptions(3), showVoterNames: false },
        };
      case "ranking":
        return {
          ...base,
          id,
          type,
          points: "none",
          timeLimit: 40,
          config: { options: Array.from({ length: 4 }, () => ({ id: createId(), text: "" })) },
        };
      default: {
        const exhaustive: never = type as never;
        throw new Error(`Nepoznat tip pitanja: ${String(exhaustive)}`);
      }
    }
  })();
  return question as QuestionOf<T>;
}

/** Deep copy with fresh IDs for the question and all of its options/items. */
export function cloneQuestionWithNewIds(question: Question): Question {
  const copy = structuredClone(question);
  copy.id = createId();
  const remap = new Map<string, string>();
  const fresh = (old: string) => {
    const next = remap.get(old) ?? createId();
    remap.set(old, next);
    return next;
  };
  switch (copy.type) {
    case "single_choice":
    case "image_choice":
      copy.config.options.forEach((o) => (o.id = fresh(o.id)));
      copy.config.correctOptionId = copy.config.correctOptionId ? fresh(copy.config.correctOptionId) : null;
      break;
    case "multi_select":
      copy.config.options.forEach((o) => (o.id = fresh(o.id)));
      copy.config.correctOptionIds = copy.config.correctOptionIds.map(fresh);
      break;
    case "poll":
      copy.config.options.forEach((o) => (o.id = fresh(o.id)));
      break;
    case "ordering":
      copy.config.items.forEach((i) => (i.id = fresh(i.id)));
      break;
    case "ranking":
      copy.config.options.forEach((i) => (i.id = fresh(i.id)));
      break;
    case "matching":
      copy.config.pairs.forEach((p) => (p.id = fresh(p.id)));
      break;
    default:
      break;
  }
  return copy;
}

/** Effective point multiplier for a question (polls and rankings never award points). */
export function pointsMultiplier(question: Question): number {
  if (!isScoredType(question.type)) return 0;
  if (question.points === "none") return 0;
  return question.points === "double" ? 2 : 1;
}
