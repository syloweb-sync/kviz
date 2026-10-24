import { z } from "zod";

/**
 * The quiz document model. Every question is a discriminated union on `type`, with a
 * type-specific `config`. The same schemas validate data in the editor (client) and in
 * route handlers / database writes (server).
 *
 * These schemas describe *structure*. They intentionally accept incomplete drafts (empty
 * titles, missing correct answers) so autosave never loses work. Whether a quiz can be
 * played is decided separately by `validateQuizForPlay` in `validation.ts`.
 */

export const QUIZ_SCHEMA_VERSION = 1;

export const QUESTION_TYPES = [
  "single_choice",
  "multi_select",
  "true_false",
  "slider",
  "short_answer",
  "numeric",
  "pin_image",
  "ordering",
  "matching",
  "image_choice",
  "poll",
  "ranking",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const LIMITS = {
  quizTitle: 120,
  quizDescription: 500,
  category: 40,
  tags: 10,
  tag: 24,
  questions: 100,
  questionTitle: 300,
  explanation: 500,
  optionText: 120,
  minOptions: 2,
  maxOptions: 6,
  minItems: 2,
  maxItems: 8,
  acceptedAnswers: 20,
  shortAnswerMax: 200,
  unit: 16,
  minTime: 5,
  maxTime: 240,
} as const;

const id = z.string().regex(/^[A-Za-z0-9_-]{6,40}$/, "Neispravan identifikator");

export const mediaRefSchema = z.object({
  /** Object path inside the `quiz-media` storage bucket, e.g. `<user-id>/<uuid>.webp`. */
  path: z
    .string()
    .min(3)
    .max(300)
    .regex(/^[A-Za-z0-9/_.-]+$/, "Neispravna putanja medija")
    .refine((p) => !p.includes(".."), "Neispravna putanja medija"),
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  alt: z.string().max(200).optional(),
});
export type MediaRef = z.infer<typeof mediaRefSchema>;

const text = (max: number) => z.string().max(max);

export const choiceOptionSchema = z.object({
  id,
  text: text(LIMITS.optionText),
  media: mediaRefSchema.nullable().default(null),
});
export type ChoiceOption = z.infer<typeof choiceOptionSchema>;

const optionsArray = z.array(choiceOptionSchema).max(LIMITS.maxOptions);

export const singleChoiceConfig = z.object({
  options: optionsArray,
  correctOptionId: id.nullable(),
});

export const multiSelectConfig = z.object({
  options: optionsArray,
  correctOptionIds: z.array(id).max(LIMITS.maxOptions),
  partialCredit: z.boolean().default(false),
});

export const trueFalseConfig = z.object({
  correct: z.boolean().nullable(),
});

export const sliderConfig = z.object({
  min: z.number().finite(),
  max: z.number().finite(),
  step: z.number().finite().positive(),
  unit: text(LIMITS.unit).default(""),
  target: z.number().finite().nullable(),
  /** Absolute distance from the target that still counts as correct. */
  tolerance: z.number().finite().min(0),
  /** When true only the exact target value is correct (tolerance ignored). */
  exactMatch: z.boolean().default(false),
  /** When true, answers inside the tolerance earn 50–100% depending on how close they are. */
  graded: z.boolean().default(true),
});

export const shortAnswerConfig = z.object({
  acceptedAnswers: z.array(text(LIMITS.shortAnswerMax)).max(LIMITS.acceptedAnswers),
  caseSensitive: z.boolean().default(false),
  accentSensitive: z.boolean().default(false),
  normalizeWhitespace: z.boolean().default(true),
  multiline: z.boolean().default(false),
  maxLength: z.number().int().min(1).max(LIMITS.shortAnswerMax).default(80),
  /** Unmatched answers are held for host review instead of being marked wrong. */
  manualReview: z.boolean().default(false),
});

export const numericConfig = z.object({
  target: z.number().finite().nullable(),
  tolerance: z.number().finite().min(0).default(0),
  allowDecimals: z.boolean().default(false),
  unit: text(LIMITS.unit).default(""),
  min: z.number().finite().nullable().default(null),
  max: z.number().finite().nullable().default(null),
});

export const normalizedPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type NormalizedPoint = z.infer<typeof normalizedPointSchema>;

export const pinImageConfig = z.object({
  image: mediaRefSchema.nullable(),
  target: normalizedPointSchema.nullable(),
  /** Accepted radius as a fraction of the image width (0.01 – 0.5). */
  radius: z.number().min(0.01).max(0.5).default(0.08),
  graded: z.boolean().default(true),
});

export const orderItemSchema = z.object({ id, text: text(LIMITS.optionText) });

export const orderingConfig = z.object({
  /** Items stored in the correct order. */
  items: z.array(orderItemSchema).max(LIMITS.maxItems),
  partialCredit: z.boolean().default(true),
});

export const matchPairSchema = z.object({
  id,
  left: text(LIMITS.optionText),
  leftMedia: mediaRefSchema.nullable().default(null),
  right: text(LIMITS.optionText),
  rightMedia: mediaRefSchema.nullable().default(null),
});

export const matchingConfig = z.object({
  pairs: z.array(matchPairSchema).max(LIMITS.maxOptions),
  partialCredit: z.boolean().default(true),
});

export const imageOptionSchema = z.object({
  id,
  media: mediaRefSchema.nullable(),
  caption: text(LIMITS.optionText).default(""),
});

export const imageChoiceConfig = z.object({
  options: z.array(imageOptionSchema).max(LIMITS.maxOptions),
  correctOptionId: id.nullable(),
});

export const pollConfig = z.object({
  options: optionsArray,
  /** Show who voted for what on the results screen (otherwise only counts). */
  showVoterNames: z.boolean().default(false),
});

export const rankingConfig = z.object({
  options: z.array(orderItemSchema).max(LIMITS.maxItems),
});

export const POINTS_MODES = ["standard", "double", "none"] as const;
export type PointsMode = (typeof POINTS_MODES)[number];

const questionBase = z.object({
  id,
  title: text(LIMITS.questionTitle),
  media: mediaRefSchema.nullable().default(null),
  timeLimit: z.number().int().min(LIMITS.minTime).max(LIMITS.maxTime).default(20),
  points: z.enum(POINTS_MODES).default("standard"),
  explanation: text(LIMITS.explanation).default(""),
  /** `immediate` tells the player right after submitting; `on_close` waits for the reveal. */
  feedback: z.enum(["on_close", "immediate"]).default("on_close"),
});

export const questionSchema = z.discriminatedUnion("type", [
  questionBase.extend({ type: z.literal("single_choice"), config: singleChoiceConfig }),
  questionBase.extend({ type: z.literal("multi_select"), config: multiSelectConfig }),
  questionBase.extend({ type: z.literal("true_false"), config: trueFalseConfig }),
  questionBase.extend({ type: z.literal("slider"), config: sliderConfig }),
  questionBase.extend({ type: z.literal("short_answer"), config: shortAnswerConfig }),
  questionBase.extend({ type: z.literal("numeric"), config: numericConfig }),
  questionBase.extend({ type: z.literal("pin_image"), config: pinImageConfig }),
  questionBase.extend({ type: z.literal("ordering"), config: orderingConfig }),
  questionBase.extend({ type: z.literal("matching"), config: matchingConfig }),
  questionBase.extend({ type: z.literal("image_choice"), config: imageChoiceConfig }),
  questionBase.extend({ type: z.literal("poll"), config: pollConfig }),
  questionBase.extend({ type: z.literal("ranking"), config: rankingConfig }),
]);

export type Question = z.infer<typeof questionSchema>;
export type QuestionOf<T extends QuestionType> = Extract<Question, { type: T }>;

export const quizDocumentSchema = z.object({
  title: text(LIMITS.quizTitle),
  description: text(LIMITS.quizDescription).default(""),
  coverImage: mediaRefSchema.nullable().default(null),
  category: text(LIMITS.category).nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(LIMITS.tag)).max(LIMITS.tags).default([]),
  questions: z.array(questionSchema).max(LIMITS.questions),
});

export type QuizDocument = z.infer<typeof quizDocumentSchema>;

/** Portable JSON export/import envelope. */
export const quizExportSchema = z.object({
  format: z.literal("pitalica-quiz"),
  version: z.literal(QUIZ_SCHEMA_VERSION),
  exportedAt: z.string().optional(),
  quiz: quizDocumentSchema,
});
export type QuizExport = z.infer<typeof quizExportSchema>;

export const GAME_MODES = ["classic", "team", "host_controlled", "practice"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const gameSettingsSchema = z.object({
  /** When set, replaces every question's own time limit. */
  timerOverride: z.number().int().min(LIMITS.minTime).max(LIMITS.maxTime).nullable().default(null),
  basePoints: z.number().int().min(100).max(5000).default(1000),
  speedBonus: z.boolean().default(true),
  randomizeQuestions: z.boolean().default(false),
  randomizeAnswers: z.boolean().default(false),
  showLeaderboard: z.boolean().default(true),
  showCorrectAnswers: z.boolean().default(true),
  showExplanations: z.boolean().default(true),
  allowLateJoin: z.boolean().default(true),
  nicknameFilter: z.boolean().default(true),
  allowAnswerChange: z.boolean().default(false),
  soundEffects: z.boolean().default(true),
  music: z.boolean().default(false),
  reducedMotion: z.boolean().default(false),
  maxPlayers: z.number().int().min(2).max(100).default(50),
  teamNames: z.array(z.string().trim().min(1).max(24)).min(2).max(4).default(["Koralji", "Cijani"]),
});

export type GameSettings = z.infer<typeof gameSettingsSchema>;

export const DEFAULT_GAME_SETTINGS: GameSettings = gameSettingsSchema.parse({});

/** Settings a client may pass when creating a game; everything is optional. */
export const createGameSchema = z.object({
  quizId: z.uuid(),
  mode: z.enum(GAME_MODES).default("classic"),
  settings: gameSettingsSchema.partial().default({}),
});
export type CreateGameInput = z.infer<typeof createGameSchema>;
