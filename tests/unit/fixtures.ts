import { createQuestion } from "@/lib/domain/question-defaults";
import type { Question, QuestionOf } from "@/lib/domain/schema";

/** Builders for fully configured, playable questions of every type. */

export function singleChoice(): QuestionOf<"single_choice"> {
  const q = createQuestion("single_choice");
  q.title = "Glavni grad Australije?";
  const texts = ["Sydney", "Canberra", "Melbourne", "Perth"];
  q.config.options.forEach((o, i) => (o.text = texts[i] ?? ""));
  q.config.correctOptionId = q.config.options[1]!.id;
  return q;
}

export function multiSelect(partialCredit = false): QuestionOf<"multi_select"> {
  const q = createQuestion("multi_select");
  q.title = "Koji su sisavci?";
  const texts = ["Dupin", "Morski pas", "Šišmiš", "Pingvin"];
  q.config.options.forEach((o, i) => (o.text = texts[i] ?? ""));
  q.config.correctOptionIds = [q.config.options[0]!.id, q.config.options[2]!.id];
  q.config.partialCredit = partialCredit;
  return q;
}

export function trueFalse(correct = true): QuestionOf<"true_false"> {
  const q = createQuestion("true_false");
  q.title = "Zemlja je okrugla.";
  q.config.correct = correct;
  return q;
}

export function slider(overrides: Partial<QuestionOf<"slider">["config"]> = {}): QuestionOf<"slider"> {
  const q = createQuestion("slider");
  q.title = "Visina Dinare (m)?";
  q.config = { ...q.config, min: 0, max: 3000, step: 1, target: 1831, tolerance: 100, ...overrides };
  return q;
}

export function shortAnswer(overrides: Partial<QuestionOf<"short_answer">["config"]> = {}): QuestionOf<"short_answer"> {
  const q = createQuestion("short_answer");
  q.title = "Najduža rijeka u Hrvatskoj?";
  q.config = { ...q.config, acceptedAnswers: ["Sava"], ...overrides };
  return q;
}

export function numeric(overrides: Partial<QuestionOf<"numeric">["config"]> = {}): QuestionOf<"numeric"> {
  const q = createQuestion("numeric");
  q.title = "Koliko kostiju ima odrasla osoba?";
  q.config = { ...q.config, target: 206, tolerance: 0, ...overrides };
  return q;
}

export function pinImage(width = 1000, height = 500): QuestionOf<"pin_image"> {
  const q = createQuestion("pin_image");
  q.title = "Gdje je Vukovar?";
  q.config.image = { path: "user/map.png", width, height };
  q.config.target = { x: 0.5, y: 0.5 };
  q.config.radius = 0.1;
  return q;
}

export function ordering(partialCredit = true): QuestionOf<"ordering"> {
  const q = createQuestion("ordering");
  q.title = "Poredaj od najstarijeg";
  const texts = ["Kotač", "Tiskarski stroj", "Parni stroj", "Internet"];
  q.config.items.forEach((item, i) => (item.text = texts[i] ?? ""));
  q.config.partialCredit = partialCredit;
  return q;
}

export function matching(partialCredit = true): QuestionOf<"matching"> {
  const q = createQuestion("matching");
  q.title = "Spoji državu i glavni grad";
  const pairs: [string, string][] = [
    ["Francuska", "Pariz"],
    ["Italija", "Rim"],
    ["Mađarska", "Budimpešta"],
  ];
  q.config.pairs.forEach((p, i) => {
    p.left = pairs[i]![0];
    p.right = pairs[i]![1];
  });
  q.config.partialCredit = partialCredit;
  return q;
}

export function imageChoice(): QuestionOf<"image_choice"> {
  const q = createQuestion("image_choice");
  q.title = "Zastava Islanda?";
  q.config.options.forEach((o, i) => (o.media = { path: `user/flag-${i}.png`, width: 300, height: 200 }));
  q.config.correctOptionId = q.config.options[2]!.id;
  return q;
}

export function poll(): QuestionOf<"poll"> {
  const q = createQuestion("poll");
  q.title = "Kamo na izlet?";
  const texts = ["More", "Planina", "Grad"];
  q.config.options.forEach((o, i) => (o.text = texts[i] ?? ""));
  return q;
}

export function ranking(): QuestionOf<"ranking"> {
  const q = createQuestion("ranking");
  q.title = "Najdraže godišnje doba";
  const texts = ["Proljeće", "Ljeto", "Jesen", "Zima"];
  q.config.options.forEach((o, i) => (o.text = texts[i] ?? ""));
  return q;
}

export function allQuestionTypes(): Question[] {
  return [
    singleChoice(),
    multiSelect(),
    trueFalse(),
    slider(),
    shortAnswer(),
    numeric(),
    pinImage(),
    ordering(),
    matching(),
    imageChoice(),
    poll(),
    ranking(),
  ];
}
