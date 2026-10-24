import { LIMITS, type Question, type QuizDocument } from "./schema";

export interface ValidationIssue {
  /** Index in the quiz's question list, or null for quiz-level issues. */
  questionIndex: number | null;
  questionId: string | null;
  message: string;
}

const filled = (value: string | null | undefined) => (value ?? "").trim().length > 0;

function hasDuplicates(values: string[]): boolean {
  const normalized = values.map((v) => v.trim().toLocaleLowerCase("hr"));
  return new Set(normalized).size !== normalized.length;
}

/** Returns human-readable problems that prevent a single question from being played. */
export function validateQuestionForPlay(question: Question): string[] {
  const issues: string[] = [];
  if (!filled(question.title)) issues.push("Upišite tekst pitanja.");

  switch (question.type) {
    case "single_choice":
    case "multi_select":
    case "poll": {
      const { options } = question.config;
      if (options.length < LIMITS.minOptions) issues.push("Dodajte barem dva odgovora.");
      if (options.some((o) => !filled(o.text) && !o.media)) issues.push("Svaki odgovor treba tekst ili sliku.");
      if (hasDuplicates(options.filter((o) => filled(o.text)).map((o) => o.text)))
        issues.push("Odgovori se ne smiju ponavljati.");
      if (question.type === "single_choice") {
        const ok = options.some((o) => o.id === question.config.correctOptionId);
        if (!ok) issues.push("Označite točan odgovor.");
      }
      if (question.type === "multi_select") {
        const ids = new Set(options.map((o) => o.id));
        const correct = question.config.correctOptionIds.filter((id) => ids.has(id));
        if (correct.length === 0) issues.push("Označite barem jedan točan odgovor.");
      }
      break;
    }
    case "true_false":
      if (question.config.correct === null) issues.push("Odaberite je li tvrdnja točna ili netočna.");
      break;
    case "slider": {
      const { min, max, step, target, tolerance } = question.config;
      if (!(min < max)) issues.push("Najmanja vrijednost mora biti manja od najveće.");
      else {
        if (step > max - min) issues.push("Korak je veći od raspona klizača.");
        if ((max - min) / step > 100_000) issues.push("Klizač ima previše koraka — povećajte korak.");
        if (target === null) issues.push("Zadajte točnu vrijednost.");
        else if (target < min || target > max) issues.push("Točna vrijednost mora biti unutar raspona.");
        if (tolerance > max - min) issues.push("Tolerancija je veća od cijelog raspona.");
      }
      break;
    }
    case "short_answer": {
      const accepted = question.config.acceptedAnswers.filter(filled);
      if (accepted.length === 0 && !question.config.manualReview)
        issues.push("Dodajte barem jedan prihvatljiv odgovor ili uključite ručni pregled.");
      if (accepted.some((a) => a.trim().length > question.config.maxLength))
        issues.push("Prihvatljiv odgovor je dulji od dopuštene duljine upisa.");
      break;
    }
    case "numeric": {
      const { target, min, max, allowDecimals } = question.config;
      if (target === null) issues.push("Zadajte točan broj.");
      else {
        if (!allowDecimals && !Number.isInteger(target))
          issues.push("Točan broj je decimalan, a decimale nisu dopuštene.");
        if (min !== null && target < min) issues.push("Točan broj je manji od dopuštenog minimuma.");
        if (max !== null && target > max) issues.push("Točan broj je veći od dopuštenog maksimuma.");
      }
      if (min !== null && max !== null && min >= max) issues.push("Minimum mora biti manji od maksimuma.");
      break;
    }
    case "pin_image":
      if (!question.config.image) issues.push("Dodajte sliku.");
      if (!question.config.target) issues.push("Označite točno mjesto na slici.");
      break;
    case "ordering":
    case "ranking": {
      const items = question.type === "ordering" ? question.config.items : question.config.options;
      if (items.length < LIMITS.minItems) issues.push("Dodajte barem dvije stavke.");
      if (items.some((i) => !filled(i.text))) issues.push("Svaka stavka treba tekst.");
      if (hasDuplicates(items.filter((i) => filled(i.text)).map((i) => i.text)))
        issues.push("Stavke se ne smiju ponavljati.");
      break;
    }
    case "matching": {
      const { pairs } = question.config;
      if (pairs.length < 2) issues.push("Dodajte barem dva para.");
      if (pairs.some((p) => (!filled(p.left) && !p.leftMedia) || (!filled(p.right) && !p.rightMedia)))
        issues.push("Svaki par treba obje strane.");
      if (hasDuplicates(pairs.filter((p) => filled(p.left)).map((p) => p.left)))
        issues.push("Lijeve stavke se ne smiju ponavljati.");
      if (hasDuplicates(pairs.filter((p) => filled(p.right)).map((p) => p.right)))
        issues.push("Desne stavke se ne smiju ponavljati.");
      break;
    }
    case "image_choice": {
      const { options, correctOptionId } = question.config;
      if (options.length < LIMITS.minOptions) issues.push("Dodajte barem dvije slike.");
      if (options.some((o) => !o.media)) issues.push("Svaki odgovor treba sliku.");
      if (!options.some((o) => o.id === correctOptionId)) issues.push("Označite točnu sliku.");
      break;
    }
  }
  return issues;
}

/** Validates an entire quiz before a game can start. An empty array means it is playable. */
export function validateQuizForPlay(quiz: Pick<QuizDocument, "title" | "questions">): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!filled(quiz.title)) issues.push({ questionIndex: null, questionId: null, message: "Kviz treba naslov." });
  if (quiz.questions.length === 0)
    issues.push({ questionIndex: null, questionId: null, message: "Dodajte barem jedno pitanje." });
  quiz.questions.forEach((question, index) => {
    for (const message of validateQuestionForPlay(question)) {
      issues.push({ questionIndex: index, questionId: question.id, message });
    }
  });
  return issues;
}
