import fs from "fs";
import path from "path";

const OUTPUT_SQL = path.join("infra", "mysql", "schema", "077-replace-intro-prompts-with-foundation-set.sql");

const QUESTIONS = `
What is your name, and what do you like about it?
Where do you live?
What do you like about your city?
What is your favorite color? Why?
What is your favorite season? Why?
What is one thing you are good at?
What is one thing you want to learn?
What do you usually do in the morning?
What do you usually do at night?
What makes you happy?
What makes you feel calm?
What is your favorite day of the week? Why?
What kind of person are you?
What is one small goal you have now?
What do you like to do alone?
What do you like to do with other people?
What is something you always carry?
What is your favorite place near your home?
What is something people do not know about you?
What do you want to do better this year?
What time do you usually wake up?
What is the first thing you do after waking up?
What do you eat for breakfast?
What do you do on a busy day?
What do you do on a free day?
What is your favorite time of day? Why?
What is one thing you do every day?
What is one thing you often forget?
What do you do when you are tired?
What do you do when you have free time?
What is your morning routine?
What is your night routine?
What do you usually do after work or school?
What do you like to do on weekends?
What do you dislike doing every day?
What is one thing that makes your day better?
What is one thing you want to change in your daily life?
What do you do when you cannot sleep?
What do you usually buy at a convenience store?
What is a simple thing you enjoy every day?
What is your favorite food?
Why do you like that food?
What food do you eat often?
What food do you want to try?
What food do you not like?
What do you usually drink in the morning?
Do you like coffee or tea? Why?
What is your favorite snack?
What is your favorite fruit?
What is your favorite Korean food?
What food reminds you of home?
What food do you eat when you feel tired?
What food do you eat when you are happy?
Do you like spicy food? Why or why not?
Do you like sweet food? Why or why not?
What is a good meal for a rainy day?
What do you like to eat with friends?
What can you cook well?
What do you want to cook someday?
If you could eat only one food today, what would you choose?
What is your favorite hobby?
Why do you like your hobby?
What hobby do you want to try?
What do you do for fun?
What do you do when you are bored?
Do you like watching movies? Why?
What kind of movies do you like?
Do you like listening to music? Why?
What kind of music do you like?
What song do you listen to often?
Do you like reading books? Why or why not?
What kind of videos do you watch online?
What game do you like to play?
What sport do you like?
Do you like taking photos? Why?
What do you like to do at home?
What do you like to do outside?
What hobby helps you relax?
What did you enjoy doing as a child?
What new hobby would make your life more fun?
Who is your best friend?
What do you like about your best friend?
Who do you talk to often?
Who makes you laugh?
Who helps you when you have a problem?
Who do you want to thank today?
What do you like to do with your friends?
What makes a good friend?
What do you usually talk about with your friends?
Do you like meeting new people? Why or why not?
Are you a quiet person or a talkative person?
What kind of people do you like?
What do you do when a friend feels sad?
What is a good gift for a friend?
Who is someone you respect?
Why do you respect that person?
What is a good way to say sorry?
What is a good way to say thank you?
What do you want to do with your family this month?
Who is an important person in your life?
What subject did you like in school?
What subject was difficult for you?
What do you like to learn?
Why are you learning English?
What is easy about learning English?
What is hard about learning English?
What English word do you like?
What do you want to say better in English?
What is a good way to study?
When do you study best?
Where do you study best?
Do you like studying alone or with others?
What helps you focus?
What makes you lose focus?
What kind of work do you like?
What is important in a job?
What do you want to do better at work or school?
What skill do you want to have?
What did you learn recently?
What is one small study goal for this week?
What is your favorite room at home?
Why do you like that room?
What do you usually do at home?
What is one thing in your room that you like?
What does your desk look like?
What do you want to change in your room?
Do you like a clean room? Why?
What is a comfortable place for you?
What place helps you relax?
What is your favorite café?
What do you like to do at a café?
What is your favorite park?
What do you like about your neighborhood?
What place do you visit often?
What place do you want to visit in your city?
Do you like quiet places or busy places?
What is a good place to meet friends?
What is a good place to study?
What place makes you feel happy?
What place do you want to live in someday?
Do you like traveling? Why or why not?
Where do you want to travel?
What country do you want to visit?
What city do you want to visit?
What do you like to do when you travel?
What food do you want to try on a trip?
What do you always take on a trip?
Do you like traveling alone or with others?
What was your best trip?
Why was that trip special?
What place do you want to visit again?
What is a good travel memory?
What is hard when you travel?
What is fun when you travel?
Do you like beaches or mountains?
Do you like hotels or guest houses?
What would you do on a one-day trip?
What would you buy as a travel gift?
What photo would you take on a trip?
If you could travel tomorrow, where would you go?
What makes you smile?
What makes you nervous?
What makes you angry?
What makes you feel proud?
What makes you feel thankful?
What do you do when you feel sad?
What do you do when you feel stressed?
What do you do when you feel excited?
What is a small thing that gives you energy?
What is a small thing that bothers you?
Do you like rainy days? Why or why not?
Do you like cold weather? Why or why not?
Do you like hot weather? Why or why not?
Do you like trying new things?
Do you like making plans?
Do you like surprises?
What is easy for you?
What is difficult for you?
What is important to you these days?
What is one thing you are thankful for today?
What do you want to do tomorrow?
What do you want to do this weekend?
What do you want to do next month?
What do you want to do next year?
What kind of person do you want to be?
What is one dream you have?
What would you do with a free afternoon?
What would you do with one free day?
What would you buy with 50,000 won?
What would you do if you had more time?
What would you do if you could speak English well?
What would you do if you could live in another country?
What animal would you like to be for one day?
What job did you want as a child?
What job looks interesting to you now?
What new thing do you want to try soon?
What habit do you want to make?
What habit do you want to stop?
What would your perfect day look like?
What message do you want to send to your future self?
What is your favorite number? Why?
What is your favorite animal? Why?
What is your favorite flower?
What is your favorite smell?
What is your favorite sound?
What is your favorite word in Korean?
What is your favorite English word?
What is your favorite thing to wear?
What is your favorite bag or item?
What is your favorite kind of shoes?
What color do you wear often?
What food do you never get tired of?
What drink do you never get tired of?
What is your favorite thing in your home?
What is your favorite thing on your desk?
What is your favorite thing in your bag?
What is your favorite sound in nature?
What is your favorite place to sit?
What small thing do you love?
What do you choose first at a restaurant?
What is one happy memory from your childhood?
What game did you like as a child?
What food did you like as a child?
What cartoon did you like as a child?
What place did you often visit as a child?
Who was your favorite teacher?
What did you like about your school?
What did you not like about school?
What was your favorite school lunch?
What did you want to be as a child?
What toy did you like when you were young?
What song reminds you of your childhood?
What smell reminds you of your childhood?
What was your favorite family trip?
What did you often do after school?
What did you like to do during vacation?
What was your favorite place in your school?
What is one funny memory from school?
What is one thing you miss from childhood?
What would you say to your younger self?
What app do you use every day?
What app is useful for you?
What app is fun for you?
What do you usually watch on your phone?
What do you usually search online?
Do you like taking selfies? Why or why not?
Do you like using social media? Why or why not?
What do you usually post online?
What kind of photos do you take?
What is your favorite photo on your phone?
What do you do when your phone battery is low?
How long do you use your phone every day?
What do you want to use your phone less for?
What do you want to use your phone more for?
Do you prefer texting or calling? Why?
What emoji do you use often?
What video made you laugh recently?
What online shop do you use often?
What is one good thing about the internet?
What is one bad thing about using your phone too much?
What do you like to buy?
What do you buy often?
What do you want to buy these days?
What was your last online order?
Do you like shopping online or offline? Why?
What store do you visit often?
What do you usually buy at a supermarket?
What do you usually buy at a convenience store?
What is something cheap but useful?
What is something expensive but worth it?
What do you spend too much money on?
What do you want to save money for?
What is a good gift under 10,000 won?
What is a good gift under 50,000 won?
Do you like window shopping? Why or why not?
What do you check before buying something?
What was a good thing you bought recently?
What was a bad thing you bought recently?
What would you buy for your room?
What would you buy for someone you love?
What do you do to stay healthy?
What healthy food do you like?
What unhealthy food do you like?
Do you like walking? Why or why not?
Do you like running? Why or why not?
What exercise do you want to try?
What exercise is easy for you?
What exercise is hard for you?
How do you feel after exercise?
What do you do when you have a cold?
What do you do when your head hurts?
What do you do when your body feels tired?
What helps you sleep well?
What stops you from sleeping well?
What time do you want to go to bed?
What time do you want to wake up?
What is one good habit for your health?
What is one bad habit for your health?
What do you want to eat less?
What do you want to eat more?
What movie do you want to watch again?
What movie made you laugh?
What movie made you cry?
What drama do you like?
What drama character do you like?
What kind of stories do you like?
Do you like happy endings? Why or why not?
Do you like scary movies? Why or why not?
Do you like action movies? Why or why not?
Do you like romantic movies? Why or why not?
What music do you listen to when you are happy?
What music do you listen to when you are sad?
What music do you listen to when you study?
What singer or band do you like?
What song do you want to sing well?
What book do you want to read?
What story did you like as a child?
What character do you want to meet?
What movie snack do you like?
What show do you watch when you want to relax?
Do you like mornings or nights? Why?
Do you like cats or dogs? Why?
Do you like summer or winter? Why?
Do you like spring or fall? Why?
Do you like coffee or juice? Why?
Do you like rice or noodles? Why?
Do you like bread or rice? Why?
Do you like buses or subways? Why?
Do you like books or videos? Why?
Do you like texting or talking? Why?
Do you like cooking or eating out? Why?
Do you like home or outside? Why?
Do you like quiet music or loud music? Why?
Do you like simple clothes or colorful clothes? Why?
Do you like planning or doing things freely? Why?
Do you like small groups or big groups? Why?
Do you like taking photos or being in photos? Why?
Do you like fast food or home food? Why?
Do you like city life or country life? Why?
Do you like working alone or with a team? Why?
What habit do you want to start this week?
What habit do you want to stop this week?
What is one thing you want to do every morning?
What is one thing you want to do every night?
What is one thing you want to practice every day?
What do you want to learn for ten minutes a day?
What do you want to do less often?
What do you want to do more often?
What small goal can you finish today?
What small goal can you finish this week?
What helps you keep a habit?
What makes it hard to keep a habit?
Who can help you with your goal?
What is one goal for your English study?
What is one goal for your health?
What is one goal for your money?
What is one goal for your home?
What is one goal for your free time?
What will you do after finishing a goal?
What goal would make you feel proud?
What do you say when you meet someone new?
What do you say when you are late?
What do you say when you need help?
What do you say when you want to thank someone?
What do you say when you make a mistake?
What do you do when you meet a new friend?
What do you do when someone gives you a gift?
What do you do when someone is angry?
What do you do when someone is kind to you?
What do you do when you feel shy?
What do you do before meeting friends?
What do you do after meeting friends?
What do you talk about with new people?
What topic is easy for you to talk about?
What topic is hard for you to talk about?
What makes a conversation fun?
What makes a conversation difficult?
What is a good question to ask a new friend?
What is a good way to start a chat?
What is a good way to end a chat?
If you could fly, where would you go?
If you could be invisible, what would you do?
If you could meet any animal, what would you meet?
If you could live in a movie, what movie would you choose?
If you could eat dinner with anyone, who would you choose?
If you could have one superpower, what would you choose?
If you could change your name, what name would you choose?
If you could design your dream room, what would it look like?
If you could open a small shop, what would you sell?
If you could make a new holiday, what would it be?
If you could get one free ticket, where would you go?
If you could learn one skill in one day, what would it be?
If you could speak one more language, what would it be?
If you could change the weather today, what would it be?
If you could have any pet, what would you choose?
If you could make a new app, what would it do?
If you could have a perfect breakfast, what would you eat?
If you could live near the sea, what would you do every day?
If you could live near a mountain, what would you do every day?
If you could give yourself one gift, what would it be?
`.trim().split(/\r?\n/).map((question) => question.trim()).filter(Boolean);

const TOPICS = [
  ["Self and Basics", 1, 20],
  ["Daily Routine", 21, 40],
  ["Food and Drinks", 41, 60],
  ["Hobbies and Fun", 61, 80],
  ["Friends and People", 81, 100],
  ["Study and Work", 101, 120],
  ["Home and Places", 121, 140],
  ["Travel", 141, 160],
  ["Feelings and Weather", 161, 180],
  ["Future and Imagination", 181, 200],
  ["Favorites and Objects", 201, 220],
  ["Childhood Memories", 221, 240],
  ["Phone and Internet", 241, 260],
  ["Shopping and Money", 261, 280],
  ["Health and Exercise", 281, 300],
  ["Movies Music Stories", 301, 320],
  ["Simple Choices", 321, 340],
  ["Goals and Habits", 341, 360],
  ["Social Situations", 361, 380],
  ["Imagination", 381, 400],
];

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line) || !line.includes("=")) {
      continue;
    }
    const index = line.indexOf("=");
    env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return env;
}

function outputText(data) {
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("\n")
    .trim();
}

async function translateBatch(env, batch) {
  const body = {
    model: env.OPENAI_FEEDBACK_MODEL || "gpt-5.4-mini",
    reasoning: { effort: "low" },
    text: {
      format: {
        type: "json_schema",
        name: "intro_prompt_translation_batch",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  index: { type: "integer" },
                  questionKo: { type: "string" },
                },
                required: ["index", "questionKo"],
              },
            },
          },
          required: ["items"],
        },
      },
    },
    input: [
      {
        role: "system",
        content: [
          "You translate simple English beginner writing prompts for a Korean English-learning app.",
          "Return natural Korean only, not literal awkward Korean.",
          "Keep the meaning exactly aligned with the English question.",
          "Use concise polite Korean question endings.",
        ].join("\n"),
      },
      {
        role: "user",
        content: `Translate these items. Return only JSON.\n${JSON.stringify({ items: batch }, null, 2)}`,
      },
    ],
  };

  const response = await fetch(env.OPENAI_API_URL || "https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI status ${response.status}: ${raw.slice(0, 500)}`);
  }
  const data = JSON.parse(raw);
  const text = outputText(data);
  if (!text) {
    throw new Error(`OpenAI returned no output text: ${raw.slice(0, 500)}`);
  }
  return JSON.parse(text).items;
}

async function translateAll() {
  const env = loadEnv(".env");
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing in .env");
  }

  const translations = new Map();
  const chunkSize = 50;
  for (let start = 0; start < QUESTIONS.length; start += chunkSize) {
    const batch = QUESTIONS.slice(start, start + chunkSize).map((question, offset) => ({
      index: start + offset + 1,
      question,
    }));
    const translated = await translateBatch(env, batch);
    for (const item of translated) {
      translations.set(item.index, String(item.questionKo || "").trim());
    }
    console.error(`translated ${Math.min(start + chunkSize, QUESTIONS.length)}/${QUESTIONS.length}`);
  }

  for (let index = 1; index <= QUESTIONS.length; index += 1) {
    if (!translations.get(index)) {
      throw new Error(`Missing translation for prompt ${index}`);
    }
  }
  return translations;
}

function topicFor(index) {
  return TOPICS.find(([, start, end]) => index >= start && index <= end)[0];
}

function detailOrder(index) {
  return TOPICS.findIndex(([, start, end]) => index >= start && index <= end) + 1;
}

function lower(question) {
  return question.toLowerCase();
}

function matches(question, regexp) {
  return regexp.test(lower(question));
}

function answerMode(question) {
  if (matches(question, /^(if you could|what would|where would|who would)|\bwant to\b|\bgoal\b|\bdream\b|\bfuture self\b|\bperfect day\b|\btomorrow\b|\bnext month\b|\bnext year\b|\bthis weekend\b|\bthis week\b|\bsomeday\b|\bsoon\b|\bwould make\b|\bwould you buy\b|\bwould you do\b|\bwill you do\b/)) {
    return "GOAL_PLAN";
  }
  if (matches(question, /\bwhen you have a problem\b|\bwhen you cannot sleep\b|\bwhen you are tired\b|\bwhen you feel sad\b|\bwhen you feel stressed\b|\bwhen someone is angry\b|\bhead hurts\b|\bhave a cold\b|\bstops you\b|\blose focus\b|\bdifficult\b|\bhard\b|\bbad thing\b|\btoo much\b/)) {
    return "PROBLEM_SOLUTION";
  }
  if (matches(question, /\bfavorite\b|\blike\b|\bprefer\b|\bchoose\b|\bnever get tired\b|\bwhat kind of\b|\bdo you like\b|\bcoffee or\b|\brice or\b|\bbuses or\b|\bbooks or\b|\btexting or\b|\bcooking or\b|\bhome or\b|\bquiet music\b|\bsimple clothes\b|\bplanning or\b|\bsmall groups\b|\btaking photos or\b|\bfast food\b|\bcity life\b|\bworking alone\b|\bcats or dogs\b|\bsummer or winter\b|\bspring or fall\b|\bmornings or nights\b/)) {
    return "PREFERENCE";
  }
  if (matches(question, /\busually\b|\bevery day\b|\boften\b|\broutine\b|\bwhat do you do\b|\bwhat do you say\b|\bwhat time\b|\bhow long\b|\bbefore\b|\bafter\b|\bwhen you\b/)) {
    return "ROUTINE";
  }
  return "GENERAL_DESCRIPTION";
}

function expectedTense(question, mode) {
  if (matches(question, /\bdid you\b|\bwas your\b|\bwere you\b|\bas a child\b|\bchildhood\b|\byoung\b|\brecently\b|\blast online\b|\bbest trip\b|\bmade you\b|\breminds you\b|\bfavorite teacher\b|\bfamily trip\b|\bafter school\b|\bduring vacation\b|\byounger self\b|\bwhat did\b|\bwhat was\b/)) {
    return "PAST_SIMPLE";
  }
  if (mode === "GOAL_PLAN") {
    return "FUTURE_PLAN";
  }
  return "PRESENT_SIMPLE";
}

function tipFor(question, mode) {
  if (mode === "GOAL_PLAN") {
    return "하고 싶은 일과 이유를 짧게 덧붙여 보세요.";
  }
  if (mode === "ROUTINE") {
    return "보통 하는 행동을 한두 문장으로 말해 보세요.";
  }
  if (mode === "PREFERENCE") {
    return "선택한 것과 이유를 한 문장씩 써 보세요.";
  }
  if (mode === "PROBLEM_SOLUTION") {
    return "상황과 내가 하는 행동을 짧게 연결해 보세요.";
  }
  if (matches(question, /^who\b/)) {
    return "누구인지 말하고 이유나 장면을 덧붙여 보세요.";
  }
  if (matches(question, /^where\b|\bplace\b|\bcity\b|\bcountry\b|\bhome\b/)) {
    return "장소를 말하고 그곳의 느낌이나 이유를 덧붙여 보세요.";
  }
  return "짧게 답한 뒤 이유나 예시를 한 문장 더 붙여 보세요.";
}

function starterFrame(question, mode) {
  if (matches(question, /^if you could/)) return "If I could, I would ...";
  if (matches(question, /^where do you want|^what country|^what city/)) return "I want to visit ... because ...";
  if (matches(question, /^what is your favorite|^what .*favorite/)) return "My favorite ... is ... because ...";
  if (matches(question, /^why do you/)) return "I like it because ...";
  if (matches(question, /^do you prefer|\bprefer\b/)) return "I prefer ... because ...";
  if (matches(question, /^do you like|\b or \b.*why/)) return "I like ... because ...";
  if (mode === "GOAL_PLAN") return "I want to ... because ...";
  if (mode === "ROUTINE") return "I usually ...";
  if (mode === "PROBLEM_SOLUTION") return "When that happens, I usually ...";
  if (matches(question, /^who\b/)) return "I think of ... because ...";
  if (matches(question, /^where\b/)) return "I live in ...";
  return "I think ...";
}

function starterMeaning(frame) {
  if (frame.startsWith("If I could")) return "할 수 있다면 ...할 거예요";
  if (frame.startsWith("I want")) return "저는 ...하고 싶어요, 왜냐하면 ...";
  if (frame.startsWith("My favorite")) return "제가 가장 좋아하는 ...은 ...예요, 왜냐하면 ...";
  if (frame.startsWith("I prefer")) return "저는 ...을 더 좋아해요, 왜냐하면 ...";
  if (frame.startsWith("I like")) return "저는 ...을 좋아해요, 왜냐하면 ...";
  if (frame.startsWith("I usually")) return "저는 보통 ...해요";
  if (frame.startsWith("When that happens")) return "그럴 때 저는 보통 ...해요";
  if (frame.startsWith("I live")) return "저는 ...에 살아요";
  return "저는 ...라고 생각해요";
}

function starterExample(frame) {
  if (frame.startsWith("If I could")) return "If I could, I would try it this weekend.";
  if (frame.startsWith("I want to visit")) return "I want to visit Busan because I like the sea.";
  if (frame.startsWith("My favorite")) return "My favorite season is fall because the weather is cool.";
  if (frame.startsWith("I prefer")) return "I prefer texting because it feels easier for me.";
  if (frame.startsWith("I like")) return "I like coffee because it helps me wake up.";
  if (frame.startsWith("I want")) return "I want to practice English every day because I want to speak better.";
  if (frame.startsWith("I usually")) return "I usually drink water in the morning.";
  if (frame.startsWith("When that happens")) return "When that happens, I usually take a short rest.";
  if (frame.startsWith("I live")) return "I live in Seoul.";
  if (frame.startsWith("I think of")) return "I think of my friend because she always helps me.";
  return "I think it is important to me.";
}

function slotsFor(question, mode) {
  const required = ["MAIN_ANSWER"];
  if (mode === "ROUTINE" || mode === "GOAL_PLAN" || mode === "PROBLEM_SOLUTION") {
    required.push("ACTIVITY");
  } else if (mode === "PREFERENCE") {
    required.push("REASON");
  } else if (matches(question, /^where\b|\bplace\b|\bcity\b|\bcountry\b|\bhome\b|\broom\b|\bschool\b/)) {
    required.push("TIME_OR_PLACE");
  } else {
    required.push("REASON");
  }

  const optional = [];
  const add = (slot) => {
    if (!required.includes(slot) && !optional.includes(slot)) {
      optional.push(slot);
    }
  };
  if (matches(question, /why|because|favorite|like|prefer|important|respect|thank|good way|bad thing|worth it/)) add("REASON");
  if (matches(question, /where|when|time|place|city|country|home|school|café|cafe|park|store|trip|travel|restaurant|room|desk|bag|morning|night|weekend|today|tomorrow|month|year/)) add("TIME_OR_PLACE");
  if (matches(question, /feel|happy|sad|stress|excited|tired|relax|comfortable|proud|thankful|nervous|angry|calm|smile|energy|bothers|laugh|cry/)) add("FEELING");
  if (matches(question, /do |eat|drink|buy|use|watch|listen|play|read|cook|study|work|exercise|travel|meet|talk|say|carry|wear|take|post|search|shop|save|sleep|wake|learn|practice|visit/)) add("ACTIVITY");
  add("EXAMPLE");

  return [
    ...required.map((slot, index) => ({ slot, role: "REQUIRED", order: index + 1 })),
    ...optional.slice(0, 2).map((slot, index) => ({ slot, role: "OPTIONAL", order: required.length + index + 1 })),
  ];
}

function sql(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function buildMigration(translations) {
  const promptRows = [];
  const slotRows = [];

  for (let index = 1; index <= QUESTIONS.length; index += 1) {
    const question = QUESTIONS[index - 1];
    const mode = answerMode(question);
    const frame = starterFrame(question, mode);
    const promptId = `prompt-intro-v2-${String(index).padStart(4, "0")}`;
    const row = {
      id: promptId,
      topic: topicFor(index),
      detailOrder: detailOrder(index),
      questionEn: question,
      questionKo: translations.get(index),
      tip: tipFor(question, mode),
      displayOrder: 900000 + index,
      mode,
      expectedTense: expectedTense(question, mode),
      starterFrame: frame,
      starterMeaningKo: starterMeaning(frame),
      starterExampleEn: starterExample(frame),
    };
    promptRows.push(row);
    for (const slot of slotsFor(question, mode)) {
      slotRows.push({ promptId, ...slot });
    }
  }

  const lines = [];
  lines.push("-- Replace old intro prompts with a foundation set of 400 beginner-friendly questions.");
  lines.push("-- Generated from the curated question list provided on 2026-05-12.");
  lines.push("");
  lines.push("SET NAMES utf8mb4;");
  lines.push("");
  lines.push("START TRANSACTION;");
  lines.push("");
  lines.push("-- Disable previous intro difficulty prompts so only the new foundation set is recommended.");
  lines.push(`UPDATE prompt_hint_items item
JOIN prompt_hints hint ON hint.id = item.hint_id
JOIN prompts prompt ON prompt.id = hint.prompt_id
SET item.is_active = 0
WHERE prompt.difficulty = 'I'
  AND prompt.id NOT LIKE 'prompt-intro-v2-%';`);
  lines.push("");
  lines.push(`UPDATE prompt_hints hint
JOIN prompts prompt ON prompt.id = hint.prompt_id
SET hint.is_active = 0
WHERE prompt.difficulty = 'I'
  AND prompt.id NOT LIKE 'prompt-intro-v2-%';`);
  lines.push("");
  lines.push(`UPDATE prompt_task_profile_slots slot_assignment
JOIN prompt_task_profiles profile ON profile.prompt_id = slot_assignment.prompt_id
JOIN prompts prompt ON prompt.id = profile.prompt_id
SET slot_assignment.is_active = 0
WHERE prompt.difficulty = 'I'
  AND prompt.id NOT LIKE 'prompt-intro-v2-%';`);
  lines.push("");
  lines.push(`UPDATE prompt_task_profiles profile
JOIN prompts prompt ON prompt.id = profile.prompt_id
SET profile.is_active = 0
WHERE prompt.difficulty = 'I'
  AND prompt.id NOT LIKE 'prompt-intro-v2-%';`);
  lines.push("");
  lines.push(`UPDATE prompts prompt
SET prompt.is_active = 0
WHERE prompt.difficulty = 'I'
  AND prompt.id NOT LIKE 'prompt-intro-v2-%';`);
  lines.push("");
  lines.push(`INSERT INTO prompt_topic_categories (name, display_order, is_active)
VALUES ('Intro Foundation', 500, 1)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), display_order = VALUES(display_order), is_active = VALUES(is_active);`);
  lines.push("SET @intro_foundation_category_id = LAST_INSERT_ID();");
  lines.push("");
  lines.push("DROP TEMPORARY TABLE IF EXISTS tmp_intro_v2_prompts;");
  lines.push(`CREATE TEMPORARY TABLE tmp_intro_v2_prompts (
    prompt_id VARCHAR(64) NOT NULL,
    detail_name VARCHAR(120) NOT NULL,
    detail_order INT NOT NULL,
    question_en TEXT NOT NULL,
    question_ko TEXT NOT NULL,
    tip TEXT NOT NULL,
    display_order INT NOT NULL,
    answer_mode_code VARCHAR(64) NOT NULL,
    expected_tense VARCHAR(40) NOT NULL,
    starter_frame VARCHAR(255) NOT NULL,
    starter_meaning_ko VARCHAR(255) NOT NULL,
    starter_example_en VARCHAR(255) NOT NULL,
    PRIMARY KEY (prompt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push("");
  lines.push("INSERT INTO tmp_intro_v2_prompts (prompt_id, detail_name, detail_order, question_en, question_ko, tip, display_order, answer_mode_code, expected_tense, starter_frame, starter_meaning_ko, starter_example_en)");
  lines.push("VALUES");
  lines.push(
    promptRows
      .map((row) => `    (${[
        sql(row.id),
        sql(row.topic),
        row.detailOrder,
        sql(row.questionEn),
        sql(row.questionKo),
        sql(row.tip),
        row.displayOrder,
        sql(row.mode),
        sql(row.expectedTense),
        sql(row.starterFrame),
        sql(row.starterMeaningKo),
        sql(row.starterExampleEn),
      ].join(", ")})`)
      .join(",\n") + ";",
  );
  lines.push("");
  lines.push("DROP TEMPORARY TABLE IF EXISTS tmp_intro_v2_slots;");
  lines.push(`CREATE TEMPORARY TABLE tmp_intro_v2_slots (
    prompt_id VARCHAR(64) NOT NULL,
    slot_code VARCHAR(64) NOT NULL,
    slot_role VARCHAR(16) NOT NULL,
    display_order INT NOT NULL,
    PRIMARY KEY (prompt_id, slot_code, slot_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push("");
  lines.push("INSERT INTO tmp_intro_v2_slots (prompt_id, slot_code, slot_role, display_order)");
  lines.push("VALUES");
  lines.push(slotRows.map((row) => `    (${[sql(row.promptId), sql(row.slot), sql(row.role), row.order].join(", ")})`).join(",\n") + ";");
  lines.push("");
  lines.push("-- Make reruns safe when a prompt's slot or hint shape changes.");
  lines.push("UPDATE prompt_task_profile_slots SET is_active = 0 WHERE prompt_id LIKE 'prompt-intro-v2-%';");
  lines.push(`UPDATE prompt_hint_items item
JOIN prompt_hints hint ON hint.id = item.hint_id
SET item.is_active = 0
WHERE hint.prompt_id LIKE 'prompt-intro-v2-%';`);
  lines.push("UPDATE prompt_hints SET is_active = 0 WHERE prompt_id LIKE 'prompt-intro-v2-%';");
  lines.push("");

  for (const [code, order] of [
    ["ROUTINE", 1],
    ["PREFERENCE", 2],
    ["GOAL_PLAN", 3],
    ["PROBLEM_SOLUTION", 4],
    ["GENERAL_DESCRIPTION", 8],
  ]) {
    lines.push(`INSERT INTO prompt_answer_modes (code, display_order, is_active) VALUES (${sql(code)}, ${order}, 1) ON DUPLICATE KEY UPDATE display_order = VALUES(display_order), is_active = VALUES(is_active);`);
  }
  lines.push("");
  for (const [code, order] of [
    ["MAIN_ANSWER", 1],
    ["REASON", 2],
    ["EXAMPLE", 3],
    ["FEELING", 4],
    ["ACTIVITY", 5],
    ["TIME_OR_PLACE", 6],
  ]) {
    lines.push(`INSERT INTO prompt_task_slots (code, display_order, is_active) VALUES (${sql(code)}, ${order}, 1) ON DUPLICATE KEY UPDATE display_order = VALUES(display_order), is_active = VALUES(is_active);`);
  }
  lines.push("");
  lines.push(`INSERT INTO prompt_topic_details (category_id, name, display_order, is_active)
SELECT @intro_foundation_category_id, detail_name, MIN(detail_order), 1
FROM tmp_intro_v2_prompts
GROUP BY detail_name
ON DUPLICATE KEY UPDATE display_order = VALUES(display_order), is_active = VALUES(is_active);`);
  lines.push("");
  lines.push(`INSERT INTO prompts (id, topic_detail_id, difficulty, question_en, question_ko, tip, display_order, is_active)
SELECT prompt.prompt_id, detail.id, 'I', prompt.question_en, prompt.question_ko, prompt.tip, prompt.display_order, 1
FROM tmp_intro_v2_prompts prompt
JOIN prompt_topic_details detail
  ON detail.category_id = @intro_foundation_category_id
 AND detail.name = prompt.detail_name
ON DUPLICATE KEY UPDATE
    topic_detail_id = VALUES(topic_detail_id),
    difficulty = VALUES(difficulty),
    question_en = VALUES(question_en),
    question_ko = VALUES(question_ko),
    tip = VALUES(tip),
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);`);
  lines.push("");
  lines.push(`INSERT INTO prompt_task_profiles (prompt_id, answer_mode_id, expected_tense, expected_pov, is_active)
SELECT prompt.prompt_id, mode.id, prompt.expected_tense, 'FIRST_PERSON', 1
FROM tmp_intro_v2_prompts prompt
JOIN prompt_answer_modes mode ON mode.code = prompt.answer_mode_code
ON DUPLICATE KEY UPDATE
    answer_mode_id = VALUES(answer_mode_id),
    expected_tense = VALUES(expected_tense),
    expected_pov = VALUES(expected_pov),
    is_active = VALUES(is_active);`);
  lines.push("");
  lines.push(`INSERT INTO prompt_task_profile_slots (prompt_id, slot_id, slot_role, display_order, is_active)
SELECT slot.prompt_id, task_slot.id, slot.slot_role, slot.display_order, 1
FROM tmp_intro_v2_slots slot
JOIN prompt_task_slots task_slot ON task_slot.code = slot.slot_code
ON DUPLICATE KEY UPDATE display_order = VALUES(display_order), is_active = VALUES(is_active);`);
  lines.push("");
  lines.push(`INSERT INTO prompt_hints (id, prompt_id, hint_type, title, display_order, is_active)
SELECT CONCAT('hint-', prompt_id, '-starter'), prompt_id, 'STARTER', '첫 문장 스타터', 1, 1
FROM tmp_intro_v2_prompts
ON DUPLICATE KEY UPDATE
    prompt_id = VALUES(prompt_id),
    hint_type = VALUES(hint_type),
    title = VALUES(title),
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);`);
  lines.push("");
  lines.push(`INSERT INTO prompt_hint_items (id, hint_id, item_type, content, meaning_ko, usage_tip_ko, example_en, expression_family, display_order, is_active)
SELECT
    CONCAT('hint-', prompt_id, '-starter-item-1'),
    CONCAT('hint-', prompt_id, '-starter'),
    'FRAME',
    starter_frame,
    starter_meaning_ko,
    '첫 문장은 짧게 시작하고, 이유나 예시를 한 문장 더 붙여 보세요.',
    starter_example_en,
    'INTRO_FOUNDATION_STARTER',
    1,
    1
FROM tmp_intro_v2_prompts
ON DUPLICATE KEY UPDATE
    hint_id = VALUES(hint_id),
    item_type = VALUES(item_type),
    content = VALUES(content),
    meaning_ko = VALUES(meaning_ko),
    usage_tip_ko = VALUES(usage_tip_ko),
    example_en = VALUES(example_en),
    expression_family = VALUES(expression_family),
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);`);
  lines.push("");
  lines.push(`INSERT INTO prompt_coach_profiles (prompt_id, primary_category, secondary_categories_json, preferred_expression_families_json, avoid_families_json, starter_style, notes)
SELECT
    prompt_id,
    answer_mode_code,
    JSON_ARRAY('intro', 'foundation', LOWER(REPLACE(detail_name, ' ', '_'))),
    JSON_ARRAY('starter_intro', 'reason', 'detail'),
    JSON_ARRAY('formal_conclusion', 'complex_academic', 'generic_example_marker'),
    'DIRECT',
    'Intro foundation prompt. Keep feedback beginner-friendly and mission-centered.'
FROM tmp_intro_v2_prompts
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);`);
  lines.push("");
  lines.push("DROP TEMPORARY TABLE IF EXISTS tmp_intro_v2_slots;");
  lines.push("DROP TEMPORARY TABLE IF EXISTS tmp_intro_v2_prompts;");
  lines.push("");
  lines.push("COMMIT;");
  lines.push("");

  return {
    sql: lines.join("\n"),
    summary: {
      prompts: promptRows.length,
      duplicateQuestions: QUESTIONS.length - new Set(QUESTIONS).size,
      modeCounts: promptRows.reduce((acc, row) => {
        acc[row.mode] = (acc[row.mode] || 0) + 1;
        return acc;
      }, {}),
      tenseCounts: promptRows.reduce((acc, row) => {
        acc[row.expectedTense] = (acc[row.expectedTense] || 0) + 1;
        return acc;
      }, {}),
      samples: promptRows.slice(0, 5).map((row) => ({
        id: row.id,
        en: row.questionEn,
        ko: row.questionKo,
        topic: row.topic,
        mode: row.mode,
        tense: row.expectedTense,
      })),
    },
  };
}

if (QUESTIONS.length !== 400) {
  throw new Error(`Expected 400 questions, got ${QUESTIONS.length}`);
}

const translations = await translateAll();
const migration = buildMigration(translations);
fs.writeFileSync(OUTPUT_SQL, migration.sql, "utf8");
console.log(JSON.stringify({ output: OUTPUT_SQL, ...migration.summary }, null, 2));
