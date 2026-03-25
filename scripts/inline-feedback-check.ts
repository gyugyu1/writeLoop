import { buildInlineFeedbackSegments } from "../apps/frontend/lib/inline-feedback";

type Case = {
  name: string;
  original: string;
  corrected: string;
  inlineFeedback?: Array<{
    type: "KEEP" | "REPLACE" | "ADD" | "REMOVE";
    originalText: string;
    revisedText: string;
  }>;
};

const cases: Case[] = [
  {
    name: "acceptable phrase with extra detail",
    original: "I like pizza because it is tasty.",
    corrected: "I like pizza because it is tasty and has many flavors.",
    inlineFeedback: [
      { type: "KEEP", originalText: "I like pizza because it is tasty", revisedText: "I like pizza because it is tasty" },
      { type: "ADD", originalText: "", revisedText: " and has many flavors" },
      { type: "KEEP", originalText: ".", revisedText: "." }
    ]
  },
  {
    name: "punctuation only",
    original: "I like pizza",
    corrected: "I like pizza.",
    inlineFeedback: [
      { type: "KEEP", originalText: "I like pizza", revisedText: "I like pizza" },
      { type: "ADD", originalText: "", revisedText: "." }
    ]
  },
  {
    name: "preposition fix",
    original: "I go school every day.",
    corrected: "I go to school every day.",
    inlineFeedback: [
      { type: "KEEP", originalText: "I ", revisedText: "I " },
      { type: "REPLACE", originalText: "go school", revisedText: "go to school" },
      { type: "KEEP", originalText: " every day.", revisedText: " every day." }
    ]
  },
  {
    name: "article insertion hidden inside replace",
    original: "He is student.",
    corrected: "He is a student.",
    inlineFeedback: [
      { type: "KEEP", originalText: "He ", revisedText: "He " },
      { type: "REPLACE", originalText: "is student", revisedText: "is a student" },
      { type: "KEEP", originalText: ".", revisedText: "." }
    ]
  },
  {
    name: "remove duplicate",
    original: "I like pizza pizza because it is cheap.",
    corrected: "I like pizza because it is cheap.",
    inlineFeedback: [
      { type: "KEEP", originalText: "I like pizza", revisedText: "I like pizza" },
      { type: "REMOVE", originalText: " pizza", revisedText: "" },
      { type: "KEEP", originalText: " because it is cheap.", revisedText: " because it is cheap." }
    ]
  },
  {
    name: "article fix",
    original: "I bought book yesterday.",
    corrected: "I bought a book yesterday.",
    inlineFeedback: [
      { type: "KEEP", originalText: "I bought", revisedText: "I bought" },
      { type: "ADD", originalText: "", revisedText: " a" },
      { type: "KEEP", originalText: " book yesterday.", revisedText: " book yesterday." }
    ]
  },
  {
    name: "model replace that should normalize to keep+add",
    original: "tasty",
    corrected: "tasty and has many flavors",
    inlineFeedback: [{ type: "REPLACE", originalText: "tasty", revisedText: "tasty and has many flavors" }]
  }
];

for (const item of cases) {
  const segments = buildInlineFeedbackSegments(item.original, item.corrected, item.inlineFeedback);
  console.log(`\n[${item.name}]`);
  for (const segment of segments) {
    console.log(JSON.stringify(segment));
  }
}
