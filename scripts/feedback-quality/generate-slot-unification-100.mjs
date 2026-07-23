import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const scenarios = [
  scenario("routine-weekend", "prompt-a-3", "usually spend your weekend", [
    v("off topic", "My favorite food is pasta because it is creamy.", ["TASK_RESET"], false),
    v("fragment", "Nap on weekend.", ["TASK_RESET", "GRAMMAR_FIX"], false),
    v("one bare action", "I usually take a nap.", ["DETAIL", "SITUATION", "REASON"], false),
    v("broken habitual form", "I usually taking a nap on Saturday.", ["GRAMMAR_FIX"], false),
    v("complete routine", "On Saturday afternoons, I usually take a nap and then walk around my neighborhood to clear my head.", ["EXPRESSION_POLISH", "DETAIL", "RESULT"], true)
  ]),
  scenario("routine-after-work-reason", "prompt-a-4", "after work", [
    v("off topic", "Online shopping is convenient for many people.", ["TASK_RESET"], false),
    v("fragment", "Go home and dinner.", ["TASK_RESET", "GRAMMAR_FIX"], false),
    v("missing reason", "After work, I go to the gym.", ["REASON"], false),
    v("broken reason", "After work, I go gym because make me healthy.", ["GRAMMAR_FIX", "REASON"], false),
    v("complete answer", "After work, I go to the gym because exercising helps me release stress from the day.", ["EXPRESSION_POLISH", "DETAIL", "RESULT"], true)
  ]),
  scenario("routine-grocery", "prompt-routine-1103", "grocery shopping", [
    v("off topic", "I enjoy watching baseball with my brother.", ["TASK_RESET"], false),
    v("fragment", "Home, refrigerator, rest.", ["TASK_RESET", "GRAMMAR_FIX"], false),
    v("missing reason", "After grocery shopping, I go home and put the food away.", ["REASON"], false),
    v("grammar conflict", "I goes home and putting food in refrigerator because tired.", ["GRAMMAR_FIX"], false),
    v("complete answer", "After grocery shopping, I put the cold food in the refrigerator first because I do not want it to spoil.", ["EXPRESSION_POLISH", "DETAIL", "RESULT"], true)
  ]),
  scenario("routine-morning", "prompt-intro-v2-0008", "in the morning", [
    v("off topic", "My best friend is kind and funny.", ["TASK_RESET"], false),
    v("fragment", "Wake up and coffee.", ["TASK_RESET", "GRAMMAR_FIX"], false),
    v("one bare action", "I drink coffee.", ["DETAIL", "SITUATION", "REASON"], false),
    v("wrong habit tense", "I drank coffee every morning before work.", ["GRAMMAR_FIX"], false),
    v("complete routine", "Every morning, I drink a glass of water, make coffee, and check my schedule before work.", ["EXPRESSION_POLISH", "DETAIL", "RESULT"], true)
  ]),
  scenario("preference-color", "prompt-intro-v2-0004", "favorite color", [
    v("off topic", "I usually wake up at seven on weekdays.", ["TASK_RESET"], false),
    v("fragment", "Blue.", ["TASK_RESET", "REASON"], false),
    v("missing reason", "My favorite color is blue.", ["REASON"], false),
    v("generic reason", "My favorite color is blue because it is nice.", ["DETAIL", "EXAMPLE", "FEELING", "RESULT"], false),
    v("complete preference", "My favorite color is blue because it reminds me of the ocean and makes me feel calm.", ["EXPRESSION_POLISH", "EXAMPLE", "DETAIL"], true)
  ]),
  scenario("preference-nearby-place", "prompt-intro-v2-0018", "favorite place near your home", [
    v("off topic", "I want to improve my English this year.", ["TASK_RESET"], false),
    v("fragment", "The park.", ["TASK_RESET", "DETAIL", "REASON"], false),
    v("bare choice", "My favorite place near my home is the riverside park.", ["REASON", "DETAIL", "FEELING"], false),
    v("broken description", "I like riverside park because there very quiet.", ["GRAMMAR_FIX"], false),
    v("complete preference", "My favorite place near my home is the riverside park because I can walk there quietly after dinner.", ["EXPRESSION_POLISH", "EXAMPLE", "DETAIL"], true)
  ]),
  scenario("preference-food", "prompt-intro-v2-0041", "favorite food", [
    v("off topic", "Rainy days make the streets look gray.", ["TASK_RESET"], false),
    v("fragment", "Kimchi stew.", ["TASK_RESET", "REASON", "DETAIL"], false),
    v("bare choice", "My favorite food is kimchi stew.", ["REASON", "DETAIL", "FEELING"], false),
    v("generic reason", "My favorite food is kimchi stew because it is good.", ["DETAIL", "EXAMPLE", "FEELING", "RESULT"], false),
    v("complete preference", "My favorite food is kimchi stew because its spicy broth reminds me of meals with my family.", ["EXPRESSION_POLISH", "EXAMPLE", "DETAIL"], true)
  ]),
  scenario("goal-speaking-plan", "prompt-b-5", "skill you want to improve", [
    v("off topic", "My room is small but comfortable.", ["TASK_RESET"], false),
    v("fragment", "Speaking English better.", ["TASK_RESET", "GRAMMAR_FIX"], false),
    v("goal without plan", "I want to improve my English speaking this year.", ["DETAIL"], false),
    v("broken plan", "I want improve speaking and I will practice with friend every day.", ["GRAMMAR_FIX"], false),
    v("complete goal plan", "I want to improve my English speaking this year, so I will practice a five-minute conversation with a friend every evening.", ["EXPRESSION_POLISH", "RESULT", "DETAIL"], true)
  ]),
  scenario("goal-habit-reason", "prompt-b-3", "habit you want to build", [
    v("off topic", "Public transportation is useful in large cities.", ["TASK_RESET"], false),
    v("fragment", "Read every day.", ["TASK_RESET", "GRAMMAR_FIX"], false),
    v("missing reason", "I want to read for twenty minutes every day.", ["REASON"], false),
    v("generic reason", "I want to read every day because it is good.", ["DETAIL", "EXAMPLE", "FEELING", "RESULT"], false),
    v("complete goal", "I want to read for twenty minutes before bed because regular reading helps me focus and sleep without my phone.", ["EXPRESSION_POLISH", "DETAIL", "RESULT"], true)
  ]),
  scenario("goal-health-plan", "prompt-goal-11", "health goal", [
    v("off topic", "Comedy movies are my favorite because they are funny.", ["TASK_RESET"], false),
    v("fragment", "Healthy body this year.", ["TASK_RESET", "GRAMMAR_FIX"], false),
    v("goal without plan", "I want to improve my stamina this year.", ["DETAIL"], false),
    v("vague plan", "I want to be healthier, and I will do many exercises.", ["DETAIL", "EXAMPLE", "RESULT", "EXPRESSION_POLISH"], false),
    v("complete goal plan", "I want to improve my stamina, so I will jog for thirty minutes three times a week and track each run.", ["EXPRESSION_POLISH", "RESULT", "DETAIL"], true)
  ]),
  scenario("problem-time-management", "prompt-problem-01", "managing your time", [
    v("off topic", "I would like to visit Canada next winter.", ["TASK_RESET"], false),
    v("fragment", "Too many tasks.", ["TASK_RESET", "GRAMMAR_FIX"], false),
    v("problem without solution", "I often waste time because I check my phone while working.", ["DETAIL"], false),
    v("broken solution", "I make list and turn off phone for solve it.", ["GRAMMAR_FIX"], false),
    v("complete problem solution", "I often lose time by checking my phone, so I put it in another room and work from a short priority list.", ["EXPRESSION_POLISH", "EXAMPLE", "RESULT"], true)
  ]),
  scenario("problem-commute-delay", "prompt-problem-1108", "commuting delays", [
    v("off topic", "My favorite singer released a new song yesterday.", ["TASK_RESET"], false),
    v("fragment", "Late bus, very stress.", ["TASK_RESET", "GRAMMAR_FIX"], false),
    v("problem without solution", "My bus is often delayed during the morning commute.", ["DETAIL"], false),
    v("broken response", "When bus late, I checking subway and call company.", ["GRAMMAR_FIX"], false),
    v("complete problem solution", "When my bus is delayed, I check the subway route and message my team before I become late.", ["EXPRESSION_POLISH", "RESULT", "DETAIL"], true)
  ]),
  scenario("balanced-self-checkout", "prompt-balance-1101", "self-checkout kiosks", [
    v("off topic", "I usually cook noodles after work.", ["TASK_RESET"], false),
    v("fragment", "Convenient but difficult.", ["TASK_RESET", "GRAMMAR_FIX", "DETAIL"], false),
    v("missing drawback", "Self-checkout kiosks are useful because they reduce waiting time, and I support them.", ["DETAIL"], false),
    v("missing opinion", "They reduce waiting time, but older customers may find them confusing.", ["TASK_RESET", "DETAIL"], false),
    v("complete balance", "Self-checkout kiosks reduce waiting time, but they can be confusing when an error occurs. Overall, I support them when staff are nearby.", ["EXPRESSION_POLISH", "EXAMPLE", "DETAIL"], true)
  ]),
  scenario("balanced-open-office", "prompt-balance-1102", "open-plan offices", [
    v("off topic", "I want to learn how to bake bread.", ["TASK_RESET"], false),
    v("fragment", "Helpful and harmful.", ["TASK_RESET", "GRAMMAR_FIX", "DETAIL"], false),
    v("one side only", "Open-plan offices make communication easier, so I think they are helpful.", ["DETAIL"], false),
    v("sides without clear view", "They make teamwork easy, but the noise makes concentration difficult.", ["TASK_RESET", "DETAIL"], false),
    v("complete balance", "Open-plan offices make quick collaboration easier, but constant noise can hurt concentration. I think they work best when quiet rooms are available.", ["EXPRESSION_POLISH", "EXAMPLE", "DETAIL"], true)
  ]),
  scenario("opinion-spicy-food", "prompt-intro-v2-0054", "spicy food", [
    v("off topic", "I take the subway to work every morning.", ["TASK_RESET"], false),
    v("fragment", "Yes, spicy food.", ["TASK_RESET", "GRAMMAR_FIX", "REASON"], false),
    v("missing reason", "I like spicy food.", ["REASON"], false),
    v("generic reason", "I like spicy food because it is good.", ["DETAIL", "EXAMPLE", "FEELING", "RESULT"], false),
    v("complete opinion", "I like spicy food because the strong flavor wakes me up and makes a simple meal more exciting.", ["EXPRESSION_POLISH", "EXAMPLE", "DETAIL"], true)
  ]),
  scenario("opinion-company-duty", "prompt-c-2", "social responsibilities", [
    v("off topic", "My favorite season is spring because the flowers are pretty.", ["TASK_RESET"], false),
    v("fragment", "Help society.", ["TASK_RESET", "GRAMMAR_FIX"], false),
    v("thin opinion", "Successful companies should protect the environment.", ["REASON", "DETAIL", "EXAMPLE"], false),
    v("broken opinion", "Companies should helping workers and not make pollution.", ["GRAMMAR_FIX"], false),
    v("complete opinion", "Successful companies should reduce pollution and provide safe working conditions because their decisions affect both communities and employees.", ["EXPRESSION_POLISH", "EXAMPLE", "DETAIL"], true)
  ]),
  scenario("reflection-success", "prompt-reflection-01", "idea of success", [
    v("off topic", "I usually play games after dinner.", ["TASK_RESET"], false),
    v("fragment", "Success changed a lot.", ["TASK_RESET", "GRAMMAR_FIX", "DETAIL"], false),
    v("missing current state", "I used to think success meant earning a high salary.", ["DETAIL"], false),
    v("missing cause", "I used to value money, but now I think having enough personal time is more important.", ["REASON"], false),
    v("complete reflection", "I used to think success meant earning a high salary, but now I value meaningful work and personal time because burnout changed my priorities.", ["EXPRESSION_POLISH", "EXAMPLE", "DETAIL"], true)
  ]),
  scenario("reflection-friendship", "prompt-reflection-26", "view of friendship", [
    v("off topic", "Online classes are convenient for busy students.", ["TASK_RESET"], false),
    v("fragment", "Friendship different now.", ["TASK_RESET", "GRAMMAR_FIX", "DETAIL"], false),
    v("only past", "When I was younger, I thought a good friend had to contact me every day.", ["DETAIL"], false),
    v("broken comparison", "Before I want many friends, but now close friends more important.", ["GRAMMAR_FIX"], false),
    v("complete reflection", "I used to value having many friends, but now I prefer a few people I can trust and speak honestly with.", ["EXPRESSION_POLISH", "EXAMPLE", "DETAIL"], true)
  ]),
  scenario("general-home-location", "prompt-intro-v2-0002", "Where do you live", [
    v("off topic", "I want to become a better cook.", ["TASK_RESET"], false),
    v("fragment", "Seoul.", ["TASK_RESET", "SITUATION", "DETAIL"], false),
    v("short valid", "I live in Seoul.", ["DETAIL", "SITUATION", "EXPRESSION_POLISH"], true),
    v("grammar error", "I am live in Seoul near river.", ["GRAMMAR_FIX"], false),
    v("complete description", "I live in western Seoul near a small park, so the neighborhood is quiet in the evening.", ["EXPRESSION_POLISH", "DETAIL", "RESULT"], true)
  ]),
  scenario("general-learning-reason", "prompt-intro-v2-0104", "learning English", [
    v("off topic", "My favorite snack is chocolate.", ["TASK_RESET"], false),
    v("fragment", "Because travel.", ["TASK_RESET", "GRAMMAR_FIX"], false),
    v("generic reason", "I am learning English because it is important.", ["DETAIL", "EXAMPLE", "RESULT"], false),
    v("broken reason", "I learning English because want talk foreign people.", ["GRAMMAR_FIX"], false),
    v("complete reason", "I am learning English because I want to talk with local people confidently when I travel abroad.", ["EXPRESSION_POLISH", "EXAMPLE", "DETAIL"], true)
  ])
];

let casesCounter = 1;

const cases = scenarios.flatMap((item) => item.variants.map((variant) => ({
  caseId: `slot-unification-${String(casesCounter++).padStart(3, "0")}`,
  name: `${item.name} - ${variant.label}`,
  category: variant.category,
  promptId: item.promptId,
  promptQuestionIncludesAny: [item.questionNeedle],
  answer: variant.answer,
  expectedFocusTypes: variant.expectedFocusTypes,
  forbiddenFocusTypes: variant.forbiddenFocusTypes,
  expectedLoopComplete: variant.expectedLoopComplete,
  expectedBehavior: variant.expectedBehavior
})));

if (cases.length !== 100) {
  throw new Error(`Expected 100 cases, received ${cases.length}`);
}

const outputPath = path.join(__dirname, "cases.slot-unification-100.json");
await fs.writeFile(outputPath, `${JSON.stringify(cases, null, 2)}\n`, "utf8");
console.log(`Wrote ${cases.length} cases to ${outputPath}`);

function scenario(name, promptId, questionNeedle, variants) {
  return { name, promptId, questionNeedle, variants };
}

function v(label, answer, expectedFocusTypes, expectedLoopComplete, options = {}) {
  return {
    label,
    answer,
    expectedFocusTypes,
    expectedLoopComplete,
    category: options.category ?? categoryFor(label),
    forbiddenFocusTypes: options.forbiddenFocusTypes ?? (label === "off topic" ? ["GRAMMAR_FIX", "EXPRESSION_POLISH"] : []),
    expectedBehavior: options.expectedBehavior ?? behaviorFor(label)
  };
}

function categoryFor(label) {
  if (label === "off topic") return "OFF_TOPIC";
  if (label === "fragment") return "FRAGMENT";
  if (label.includes("broken") || label.includes("grammar")) return "GRAMMAR";
  if (label.includes("complete")) return "COMPLETE";
  if (label.includes("generic") || label.includes("vague")) return "GENERIC_CONTENT";
  return "MISSING_SLOT";
}

function behaviorFor(label) {
  if (label === "off topic") return "Reset to the actual question without polishing the unrelated answer.";
  if (label === "fragment") return "Recover a usable sentence or reset when no proposition is available.";
  if (label.includes("broken") || label.includes("grammar")) return "Repair the blocking or high-value local grammar before optional enrichment.";
  if (label.includes("complete")) return "Complete the loop or offer only a genuinely optional small refinement.";
  if (label.includes("generic") || label.includes("vague")) return "Treat the stated slot as present but request one concrete supporting detail.";
  return "Choose the precise missing semantic slot and provide a directly usable scaffold.";
}
