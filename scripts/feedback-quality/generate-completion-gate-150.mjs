import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const scenarios = [
  s("routine-after-dinner", "prompt-a-1", "after dinner", ["ACTION"], {
    offTopic: "My favorite color is navy because it looks calm.",
    fragment: "Dishes and TV after dinner.",
    missing: m("After dinner is usually quiet at my home.", ["ACTION"]),
    generic: m("I usually relax after dinner.", ["ADDITIONAL_ACTION", "SPECIFIC_TIME", "PLACE", "REASON", "FEELING", "RESULT"]),
    grammar: "After dinner, I usually wash the dishes and then watches TV to relax.",
    complete: "After dinner, I wash the dishes and take a short walk around my neighborhood because it helps me unwind."
  }),
  s("preference-quick-meal", "prompt-a-2", "quick meal at home", ["SPECIFIC_TIME", "CHOICE"], {
    offTopic: "I take the subway to work every weekday.",
    fragment: "After work, maybe noodles.",
    missing: m("I like to make a quick meal after work.", ["CHOICE"]),
    generic: m("After work, I usually choose something easy.", ["DETAIL", "REASON", "FEELING", "RESULT"]),
    grammar: "After work, I likes to make noodles because they is quick.",
    complete: "After work, I like to make vegetable noodles because they are quick and require only one pan."
  }),
  s("routine-weekend", "prompt-a-3", "spend your weekend", ["ACTION"], {
    offTopic: "Pasta is my favorite food because it is creamy.",
    fragment: "Nap on weekend.",
    missing: m("Weekends are my free time.", ["ACTION"]),
    generic: m("I usually take a nap on weekends.", ["ADDITIONAL_ACTION", "SPECIFIC_TIME", "PLACE", "FEELING", "REASON", "RESULT"]),
    grammar: "On weekends, I usually taking a nap and meet my friends.",
    complete: "On Saturday afternoons, I take a nap and then meet a friend at a nearby cafe to recharge."
  }),
  s("routine-after-work", "prompt-a-4", "after work", ["ACTION", "REASON"], {
    offTopic: "Online shopping is convenient for many people.",
    fragment: "Gym after work, relaxing.",
    missing: m("After work, I go to the gym.", ["REASON"]),
    generic: m("After work, I go to the gym because it is nice.", ["DETAIL", "FEELING", "RESULT"]),
    grammar: "After work, I goes to the gym because exercise help me relax.",
    complete: "After work, I go to the gym because a short workout helps me release stress from the day."
  }),
  s("problem-work-school", "prompt-b-1", "challenge you often face", ["PROBLEM", "SOLUTION"], {
    offTopic: "Spring is my favorite season because the weather is mild.",
    fragment: "Too many tasks at work.",
    missing: m("I often have too many tasks at work.", ["SOLUTION"]),
    generic: m("I often have too many tasks, so I deal with the problem somehow.", ["DETAIL", "EXAMPLE", "RESULT", "REASON"]),
    grammar: "I often has too many tasks, so I make a priority list to handle them.",
    complete: "I often receive several urgent tasks at once, so I rank them by deadline and confirm priorities with my manager."
  }),
  s("goal-reading-habit", "prompt-b-3", "habit you want to build", ["GOAL", "REASON"], {
    offTopic: "Public transportation is useful in large cities.",
    fragment: "Reading every day for focus.",
    missing: m("I want to read for twenty minutes every day.", ["REASON"]),
    generic: m("I want to read every day because it is good for me.", ["PLAN", "SPECIFIC_TIME", "RESULT", "PROBLEM", "FEELING"]),
    grammar: "I want build a reading habit because it help me focus.",
    complete: "I want to read for twenty minutes before bed because it helps me focus and keeps me away from my phone."
  }),
  s("goal-speaking-plan", "prompt-b-5", "skill you want to improve", ["GOAL", "PLAN"], {
    offTopic: "My room is small but comfortable.",
    fragment: "Speaking English better.",
    missing: m("I want to improve my English speaking this year.", ["PLAN"]),
    generic: m("I want to improve my English speaking, so I will practice somehow.", ["PLAN", "DETAIL", "SPECIFIC_TIME"]),
    grammar: "I want to improve speaking, and I will practices with a friend every evening.",
    complete: "I want to improve my English speaking, so I will practice a five-minute conversation with a friend every evening."
  }),
  s("reflection-technology", "prompt-c-1", "technology changed", ["BEFORE_STATE", "NOW_STATE", "OPINION"], {
    offTopic: "I usually cook noodles after work.",
    fragment: "Online relationships now.",
    missing: m("People used to meet mostly in person, but now they often connect online.", ["OPINION"]),
    generic: m("People used to meet differently, but now they use technology, and I think the change is good.", ["REASON", "EXAMPLE", "ADVANTAGE", "DISADVANTAGE", "DETAIL"]),
    grammar: "People used meet in person, but now they connects online, and I think this change is positive.",
    complete: "People used to rely on face-to-face meetings, but now they maintain relationships through messaging and video calls. I think the change is mostly positive because distance matters less."
  }),
  s("opinion-company-duty", "prompt-c-2", "social responsibilities", ["OPINION"], {
    offTopic: "My favorite snack is chocolate.",
    fragment: "Helping society and workers.",
    missing: m("Successful companies should protect their workers.", ["REASON", "EXAMPLE", "RESULT", "ADVANTAGE", "DISADVANTAGE"]),
    generic: m("Successful companies should protect workers because it is important.", ["EXAMPLE", "RESULT", "ADVANTAGE", "DISADVANTAGE", "DETAIL"]),
    grammar: "Companies should protects workers because safe workplaces benefits society and employees.",
    complete: "Successful companies should provide safe working conditions, reduce pollution, and report their impact honestly because their decisions affect employees and local communities."
  }),
  s("reflection-belief", "prompt-c-3", "belief you have changed", ["BEFORE_STATE", "NOW_STATE", "CHANGE_CAUSE"], {
    offTopic: "I enjoy watching baseball with my brother.",
    fragment: "A different belief now.",
    missing: m("I used to think working long hours meant success, but now I value balance.", ["CHANGE_CAUSE"]),
    generic: m("I used to value long hours, but now I value balance because of an experience.", ["CHANGE_CAUSE", "DETAIL", "EXAMPLE"]),
    grammar: "I used to think long hours meant success, but now I believes balance matters because burnout change my priorities.",
    complete: "I used to think working long hours proved commitment, but now I value sustainable work because burnout taught me that constant overtime reduces both health and performance."
  }),
  s("routine-grocery", "prompt-routine-1103", "grocery shopping", ["ACTION", "REASON"], {
    offTopic: "Comedy movies make me laugh after a busy day.",
    fragment: "Home, refrigerator, tired.",
    missing: m("After grocery shopping, I go home and put the food away.", ["REASON"]),
    generic: m("I put the food away because that is better.", ["DETAIL", "RESULT", "FEELING"]),
    grammar: "After grocery shopping, I goes home and put the cold food away because it need refrigeration.",
    complete: "After grocery shopping, I put the cold food in the refrigerator first because I do not want it to spoil."
  }),
  s("routine-morning", "prompt-intro-v2-0008", "in the morning", ["ACTION"], {
    offTopic: "My best friend is kind and funny.",
    fragment: "Wake up and coffee.",
    missing: m("Mornings are usually busy for me.", ["ACTION"]),
    generic: m("I drink coffee every morning.", ["ADDITIONAL_ACTION", "SPECIFIC_TIME", "PLACE", "REASON", "RESULT"]),
    grammar: "Every morning, I drinks water and check my schedule before work.",
    complete: "Every morning, I drink a glass of water, make coffee, and check my schedule before work."
  }),
  s("preference-color", "prompt-intro-v2-0004", "favorite color", ["CHOICE", "REASON"], {
    offTopic: "I usually wake up at seven on weekdays.",
    fragment: "Blue, calm ocean.",
    missing: m("My favorite color is blue.", ["REASON"]),
    generic: m("My favorite color is blue because it is nice.", ["DETAIL", "FEELING", "EXAMPLE"]),
    grammar: "My favorite color are blue because it make me feel calm.",
    complete: "My favorite color is blue because it reminds me of the ocean and makes me feel calm."
  }),
  s("preference-nearby-place", "prompt-intro-v2-0018", "favorite place near your home", ["CHOICE"], {
    offTopic: "I want to improve my English this year.",
    fragment: "The quiet park nearby.",
    missing: m("I like it because it is quiet and close to home.", ["CHOICE"]),
    generic: m("My favorite place near my home is somewhere nice.", ["DETAIL", "REASON", "ACTION", "FEELING", "SPECIFIC_TIME"]),
    grammar: "My favorite place are the riverside park because it feel peaceful.",
    complete: "My favorite place near my home is the riverside park because I can walk there quietly after dinner."
  }),
  s("preference-food", "prompt-intro-v2-0041", "favorite food", ["CHOICE"], {
    offTopic: "Rainy days make the streets look gray.",
    fragment: "Kimchi stew, spicy and warm.",
    missing: m("I like it because the taste is comforting.", ["CHOICE"]),
    generic: m("My favorite food is something delicious.", ["DETAIL", "REASON", "EXAMPLE", "FEELING", "PLACE"]),
    grammar: "My favorite food are kimchi stew because it remind me of home.",
    complete: "My favorite food is kimchi stew because its spicy broth reminds me of meals with my family."
  }),
  s("goal-health-plan", "prompt-goal-11", "health goal", ["GOAL", "PLAN"], {
    offTopic: "I would like to visit Canada next winter.",
    fragment: "Better stamina this year.",
    missing: m("I want to improve my stamina this year.", ["PLAN"]),
    generic: m("I want to improve my stamina, so I will exercise more.", ["PLAN", "SPECIFIC_TIME", "DETAIL"]),
    grammar: "I want to improve my stamina, so I will jogs three times a week.",
    complete: "I want to improve my stamina, so I will jog for thirty minutes three times a week and track each run."
  }),
  s("problem-time-management", "prompt-problem-01", "managing your time", ["PROBLEM", "SOLUTION"], {
    offTopic: "I like beaches more than mountains.",
    fragment: "Too many tasks and no time.",
    missing: m("I often waste time because I check my phone while working.", ["SOLUTION"]),
    generic: m("I often waste time on my phone, so I try to handle it somehow.", ["SOLUTION", "DETAIL", "EXAMPLE", "RESULT"]),
    grammar: "I often waste time on my phone, so I makes a list and turn it off.",
    complete: "I often lose time by checking my phone, so I put it in another room and work from a short priority list."
  }),
  s("problem-commute-delay", "prompt-problem-1108", "commuting delays", ["PROBLEM", "SOLUTION"], {
    offTopic: "My favorite singer released a new song yesterday.",
    fragment: "Late bus, very stressful.",
    missing: m("My bus is often delayed during the morning commute.", ["SOLUTION"]),
    generic: m("My bus is often delayed, so I do something about it.", ["SOLUTION", "DETAIL", "EXAMPLE", "RESULT"]),
    grammar: "When my bus is delayed, I checks the subway route and message my team.",
    complete: "When my bus is delayed, I check the subway route and message my team before I become late."
  }),
  s("balanced-self-checkout", "prompt-balance-1101", "self-checkout kiosks", ["ADVANTAGE", "DISADVANTAGE", "OPINION"], {
    offTopic: "I usually read a book before bed.",
    fragment: "Convenient but sometimes confusing.",
    missing: m("Self-checkout kiosks reduce waiting time, and I support using them.", ["DISADVANTAGE"]),
    generic: m("They reduce waiting time, but they also have some problems. Overall, I support them.", ["DISADVANTAGE", "DETAIL", "EXAMPLE"]),
    grammar: "Self-checkout kiosks reduces waiting time, but errors makes them confusing, so I supports them only with staff nearby.",
    complete: "Self-checkout kiosks reduce waiting time, but they can be confusing when an error occurs. Overall, I support them when staff are nearby."
  }),
  s("balanced-open-office", "prompt-balance-1102", "open-plan offices", ["ADVANTAGE", "DISADVANTAGE", "OPINION"], {
    offTopic: "I want to learn how to bake bread.",
    fragment: "Helpful and harmful overall.",
    missing: m("Open-plan offices make communication easier, so I think they are helpful overall.", ["DISADVANTAGE"]),
    generic: m("They make communication easier, but they can also be bad. Overall, I think they are helpful.", ["DISADVANTAGE", "DETAIL", "EXAMPLE"]),
    grammar: "Open-plan offices makes teamwork easier, but noise hurt concentration, so I thinks quiet rooms are necessary.",
    complete: "Open-plan offices make quick collaboration easier, but constant noise can hurt concentration. I think they work best when quiet rooms are available."
  }),
  s("preference-spicy-food", "prompt-intro-v2-0054", "spicy food", ["OPINION", "REASON"], {
    offTopic: "I take the subway to work every morning.",
    fragment: "Yes, spicy food, exciting.",
    missing: m("I like spicy food.", ["REASON"]),
    generic: m("I like spicy food because it is good.", ["DETAIL", "EXAMPLE", "FEELING", "RESULT"]),
    grammar: "I likes spicy food because the strong flavor make meals exciting.",
    complete: "I like spicy food because the strong flavor wakes me up and makes a simple meal more exciting."
  }),
  s("reflection-success", "prompt-reflection-01", "idea of success", ["BEFORE_STATE", "NOW_STATE", "CHANGE_CAUSE"], {
    offTopic: "I usually play games after dinner.",
    fragment: "A different meaning of success now.",
    missing: m("I used to think success meant earning a high salary.", ["NOW_STATE", "CHANGE_CAUSE"]),
    generic: m("I used to value money, but now I value balance because life changed.", ["CHANGE_CAUSE", "DETAIL", "EXAMPLE"]),
    grammar: "I used to value money, but now I values balance because burnout change my priorities.",
    complete: "I used to think success meant earning a high salary, but now I value meaningful work and personal time because burnout changed my priorities."
  }),
  s("reflection-friendship", "prompt-reflection-26", "view of friendship", ["BEFORE_STATE", "NOW_STATE"], {
    offTopic: "Online classes are convenient for busy students.",
    fragment: "A different view of friendship now.",
    missing: m("When I was younger, I thought a good friend had to contact me every day.", ["NOW_STATE"]),
    generic: m("I used to want many friends, but now I prefer fewer friends.", ["CHANGE_CAUSE", "EXAMPLE", "RESULT", "FEELING", "DETAIL"]),
    grammar: "I used to want many friends, but now I prefers a few people I can trust.",
    complete: "I used to value having many friends, but now I prefer a few people I can trust because honest conversations matter more to me."
  }),
  s("general-home-location", "prompt-intro-v2-0002", "Where do you live", ["PLACE"], {
    offTopic: "I want to become a better cook.",
    fragment: "Western Seoul, near a park.",
    missing: m("My neighborhood is quiet and convenient.", ["PLACE"]),
    generic: m("I live in a nice area.", ["DETAIL", "FEELING", "REASON"]),
    grammar: "I am live in western Seoul near a small park.",
    complete: "I live in western Seoul near a small park, so the neighborhood is quiet in the evening."
  }),
  s("general-learning-reason", "prompt-intro-v2-0104", "learning English", ["REASON"], {
    offTopic: "My favorite bag is a small backpack.",
    fragment: "Because travel and new people.",
    missing: m("I am learning English these days.", ["REASON"]),
    generic: m("I am learning English because it is useful.", ["DETAIL", "GOAL", "PLAN", "RESULT", "EXAMPLE", "FEELING"]),
    grammar: "I learning English because I want talk with local people when I travel.",
    complete: "I am learning English because I want to talk with local people confidently when I travel abroad."
  })
];

const cases = [];
let caseNumber = 1;

for (const item of scenarios) {
  cases.push(buildCase(item, "OFF_TOPIC", item.samples.offTopic, ["TASK_RESET"], item.requiredSlots, false, {
    forbiddenFocusTypes: ["GRAMMAR_FIX", "EXPRESSION_POLISH"]
  }));
  cases.push(buildCase(item, "FRAGMENT", item.samples.fragment, ["LANGUAGE_FIX"], [], false, {
    requiresComparison: true
  }));
  cases.push(buildCase(
    item,
    "MISSING_SLOT",
    item.samples.missing.answer,
    ["SLOT"],
    item.samples.missing.targetSlots,
    false
  ));
  cases.push(buildCase(
    item,
    "GENERIC_CONTENT",
    item.samples.generic.answer,
    ["SLOT"],
    item.samples.generic.targetSlots,
    false
  ));
  cases.push(buildCase(item, "GRAMMAR", item.samples.grammar, ["LANGUAGE_FIX"], [], false, {
    requiresComparison: true,
    forbiddenFocusTypes: ["TASK_RESET", "EXPRESSION_POLISH"]
  }));
  cases.push(buildCase(item, "COMPLETE", item.samples.complete, ["COMPLETE"], [], true, {
    allowAcceptedRevision: false,
    expectFixPoints: false
  }));
}

if (scenarios.length !== 25 || cases.length !== 150) {
  throw new Error(`Expected 25 scenarios and 150 cases, received ${scenarios.length} and ${cases.length}`);
}

const outputPath = path.join(__dirname, "cases.completion-gate-150.json");
await fs.writeFile(outputPath, `${JSON.stringify(cases, null, 2)}\n`, "utf8");
console.log(`Wrote ${cases.length} cases to ${outputPath}`);

function buildCase(item, category, answer, expectedMissionKinds, expectedTargetSlots, expectedLoopComplete, options = {}) {
  const label = category.toLowerCase().replaceAll("_", "-");
  return {
    caseId: `completion-gate-${String(caseNumber++).padStart(3, "0")}`,
    name: `${item.name} - ${label}`,
    category,
    promptId: item.promptId,
    promptQuestionIncludesAny: [item.questionNeedle],
    answer,
    expectedMissionKinds,
    forbiddenFocusTypes: options.forbiddenFocusTypes ?? [],
    expectedTargetSlots,
    expectedLoopComplete,
    requiresComparison: options.requiresComparison === true,
    requiresScaffold: category === "OFF_TOPIC" || category === "MISSING_SLOT" || category === "GENERIC_CONTENT",
    allowAcceptedRevision: options.allowAcceptedRevision,
    expectFixPoints: options.expectFixPoints,
    expectedBehavior: expectedBehavior(category, expectedTargetSlots)
  };
}

function s(name, promptId, questionNeedle, requiredSlots, samples) {
  return { name, promptId, questionNeedle, requiredSlots, samples };
}

function m(answer, targetSlots) {
  return { answer, targetSlots };
}

function expectedBehavior(category, targetSlots) {
  if (category === "OFF_TOPIC") return "Return TASK_RESET, keep the loop open, and scaffold a direct answer to one required slot.";
  if (category === "FRAGMENT") return "Choose LANGUAGE_FIX and minimally turn the grounded fragment into a complete sentence.";
  if (category === "GRAMMAR") return "Choose LANGUAGE_FIX and show a grounded before/after repair.";
  if (category === "COMPLETE") return "Complete the loop without forcing an optional mission.";
  return `Keep the loop open, target ${targetSlots.join(" or ")}, and provide a usable scaffold.`;
}
