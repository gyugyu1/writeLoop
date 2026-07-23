-- Manual review of all 675 active questions.
-- Only questions with a confirmed wording, translation, or learning-contract issue
-- are changed here. Every row below was reviewed against its active slot metadata.

-- Core questions
UPDATE prompts
SET question_en = 'When do you usually make a quick meal at home, and what meal do you make?',
    question_ko = '집에서 간단한 식사를 주로 언제 만들고, 보통 어떤 식사를 만드나요?',
    tip = '간단한 식사를 만드는 때와 음식 이름을 차례로 말해 보세요.'
WHERE id = 'prompt-a-2'
  AND is_active = 1;

UPDATE prompt_hint_items
SET content = 'When I need a quick meal at home, I usually make...'
WHERE id = 'hint-a-2-1-item-1';

-- Goal and plan questions
UPDATE prompts
SET question_en = 'How would you like to reduce your screen time at night this year, and what steps will you take?',
    question_ko = '올해 밤의 화면 사용 시간을 어떻게 줄이고 싶고, 어떤 단계를 밟을 건가요?'
WHERE id = 'prompt-goal-1106'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'Which basic design skill would you like to improve this year, and what steps will you take?',
    question_ko = '올해 어떤 기초 디자인 능력을 키우고 싶고, 어떤 단계를 밟을 건가요?'
WHERE id = 'prompt-goal-1115'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'What weekend routine would help you prepare for the new week, and how will you build it this year?',
    question_ko = '새로운 한 주를 준비하는 데 도움이 될 주말 루틴은 무엇이고, 올해 그 루틴을 어떻게 만들 건가요?'
WHERE id = 'prompt-goal-1119'
  AND is_active = 1;

UPDATE prompt_hint_items
SET content = 'My goal is to reduce my screen time at night by... ',
    example_en = 'My goal is to stop using my phone after 10 p.m.',
    meaning_ko = '제 목표는 ...하여 밤의 화면 사용 시간을 줄이는 것입니다.'
WHERE id = 'hint-goal-1106-1-item-1';

UPDATE prompt_hint_items
SET content = 'One basic design skill I want to improve is... ',
    example_en = 'One basic design skill I want to improve is choosing colors.',
    meaning_ko = '제가 키우고 싶은 기초 디자인 능력 하나는 ...입니다.'
WHERE id = 'hint-goal-1115-1-item-1';

UPDATE prompt_hint_items
SET content = 'A weekend routine that would help me prepare for the new week is... ',
    example_en = 'A weekend routine that would help me prepare is planning my week on Sunday.',
    meaning_ko = '새로운 한 주를 준비하는 데 도움이 될 주말 루틴은 ...입니다.'
WHERE id = 'hint-goal-1119-1-item-1';

-- Balanced opinion and reflection questions
UPDATE prompts
SET question_ko = '일상적인 스마트폰 사용이 사람들의 삶을 어떻게 바꿨고, 그 변화가 대체로 긍정적인지 말해 주세요.'
WHERE id = 'prompt-balance-21'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'What are the benefits and drawbacks of programs that reward people for sharing personal data, and what is your view?',
    question_ko = '개인정보를 제공한 사람에게 보상을 주는 프로그램의 장점과 단점은 무엇이며, 이에 대한 생각은 어떤가요?'
WHERE id = 'prompt-balance-1124'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'What are the benefits and drawbacks of using another screen while watching a video, and what is your view?',
    question_ko = '영상을 보면서 다른 화면을 함께 사용하는 습관의 장점과 단점은 무엇이며, 이에 대한 생각은 어떤가요?'
WHERE id = 'prompt-balance-1127'
  AND is_active = 1;

UPDATE prompts
SET question_ko = '공부 습관이 시간이 지나며 어떻게 바뀌었는지와 그 이유를 설명해 주세요.'
WHERE id = 'prompt-reflection-06'
  AND is_active = 1;

-- General description questions
UPDATE prompts
SET question_ko = '자주 쓰는 생활용품을 설명하고 왜 중요하게 느끼는지 말해 주세요.'
WHERE id = 'prompt-general-46'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'Describe a bus route you know well and explain why it is memorable to you.',
    question_ko = '잘 아는 버스 노선을 설명하고, 왜 기억에 남는지 말해 주세요.'
WHERE id = 'prompt-general-1103'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'Describe a local bridge or walkway you enjoy using and explain why it is memorable to you.',
    question_ko = '이용하기 좋아하는 동네 다리나 산책로를 설명하고, 왜 기억에 남는지 말해 주세요.'
WHERE id = 'prompt-general-1106'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'Describe a cafe you often revisit and explain why it is memorable to you.',
    question_ko = '자주 다시 가는 카페를 설명하고, 왜 기억에 남는지 말해 주세요.'
WHERE id = 'prompt-general-1109'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'Describe a notebook you often carry and explain why it matters to you.',
    question_ko = '자주 들고 다니는 노트를 설명하고, 왜 중요한지 말해 주세요.'
WHERE id = 'prompt-general-1112'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'Describe a topic you enjoy talking about and explain why it remains important to you.',
    question_ko = '이야기하기 좋아하는 주제를 설명하고, 왜 여전히 중요한지 말해 주세요.'
WHERE id = 'prompt-general-1115'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'Describe a sound you enjoy on rainy days and explain why it is memorable to you.',
    question_ko = '비 오는 날 좋아하는 소리를 설명하고, 왜 기억에 남는지 말해 주세요.'
WHERE id = 'prompt-general-1118'
  AND is_active = 1;

UPDATE prompts
SET question_ko = '직접 돌보는 식물을 설명하고, 왜 중요한지 말해 주세요.'
WHERE id = 'prompt-general-1121'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'Describe a recipe from your home that you remember well and explain why it is memorable to you.',
    question_ko = '집에서 먹던 음식의 레시피를 설명하고, 왜 기억에 남는지 말해 주세요.'
WHERE id = 'prompt-general-1124'
  AND is_active = 1;

-- Routine questions whose second request is the result of the routine.
UPDATE prompts
SET question_en = 'What do you usually do before an early appointment, and how does that preparation help you?',
    question_ko = '이른 약속 전에 보통 무엇을 준비하고, 그 준비가 어떻게 도움이 되나요?'
WHERE id = 'prompt-routine-1102'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'What do you usually do during your first hour at work, and how does that routine help you?',
    question_ko = '출근 후 첫 한 시간 동안 보통 무엇을 하고, 그 루틴이 어떻게 도움이 되나요?'
WHERE id = 'prompt-routine-1105'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'What do you usually do after finishing a workout, and how does that routine help you?',
    question_ko = '운동을 마친 뒤 보통 무엇을 하고, 그 루틴이 어떻게 도움이 되나요?'
WHERE id = 'prompt-routine-1108'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'What do you usually do while preparing for an exam, and how does that routine help you?',
    question_ko = '시험을 준비할 때 보통 무엇을 하고, 그 루틴이 어떻게 도움이 되나요?'
WHERE id = 'prompt-routine-1111'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'What do you usually do at home on Friday night, and how does that routine help you?',
    question_ko = '금요일 밤 집에서 보통 무엇을 하고, 그 루틴이 어떻게 도움이 되나요?'
WHERE id = 'prompt-routine-1114'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'What do you usually do when you arrive somewhere too early, and how does that action help you?',
    question_ko = '어딘가에 너무 일찍 도착했을 때 보통 무엇을 하고, 그 행동이 어떻게 도움이 되나요?'
WHERE id = 'prompt-routine-1117'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'What do you usually do while riding the subway alone, and how does that routine help you?',
    question_ko = '혼자 지하철을 탈 때 보통 무엇을 하고, 그 루틴이 어떻게 도움이 되나요?'
WHERE id = 'prompt-routine-1120'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'What do you usually do before starting a side project, and how does that preparation help you?',
    question_ko = '개인 프로젝트를 시작하기 전에 보통 무엇을 하고, 그 준비가 어떻게 도움이 되나요?'
WHERE id = 'prompt-routine-1123'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'What do you usually do during a break on campus, and how does that routine help you?',
    question_ko = '캠퍼스에서 쉬는 시간에 보통 무엇을 하고, 그 루틴이 어떻게 도움이 되나요?'
WHERE id = 'prompt-routine-1126'
  AND is_active = 1;

-- Preference questions with an ambiguous "why".
UPDATE prompts
SET question_en = 'What is one thing you usually carry in your everyday bag, and why do you carry it?',
    question_ko = '평소 가방에 넣어 다니는 물건 하나는 무엇이고, 왜 가지고 다니나요?'
WHERE id = 'prompt-preference-1108'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'What kitchen tool do you use often, and why do you use it?',
    question_ko = '어떤 주방 도구를 자주 사용하고, 왜 그 도구를 사용하나요?'
WHERE id = 'prompt-preference-1115'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'What kind of online creator do you watch, and why do you watch them?',
    question_ko = '어떤 온라인 크리에이터를 보고, 왜 그 사람의 콘텐츠를 보나요?'
WHERE id = 'prompt-preference-1117'
  AND is_active = 1;

-- Problem and solution questions
UPDATE prompts SET question_ko = '시간을 관리할 때 자주 겪는 어려움 하나와, 그 문제에 어떻게 대처하는지 말해 주세요.' WHERE id = 'prompt-problem-01' AND is_active = 1;
UPDATE prompts SET question_ko = '동기를 유지할 때 자주 겪는 어려움 하나와, 그 문제에 어떻게 대처하는지 말해 주세요.' WHERE id = 'prompt-problem-06' AND is_active = 1;
UPDATE prompts SET question_ko = '사람들 앞에서 말할 때 자주 겪는 어려움 하나와, 그 문제에 어떻게 대처하는지 말해 주세요.' WHERE id = 'prompt-problem-11' AND is_active = 1;
UPDATE prompts SET question_ko = '일과 휴식의 균형을 맞출 때 자주 겪는 어려움 하나와, 그 문제에 어떻게 대처하는지 말해 주세요.' WHERE id = 'prompt-problem-16' AND is_active = 1;
UPDATE prompts SET question_ko = '팀으로 일할 때 자주 겪는 어려움 하나와, 그 문제에 어떻게 대처하는지 말해 주세요.' WHERE id = 'prompt-problem-21' AND is_active = 1;
UPDATE prompts SET question_ko = '빠르게 결정할 때 자주 겪는 어려움 하나와, 그 문제에 어떻게 대처하는지 말해 주세요.' WHERE id = 'prompt-problem-26' AND is_active = 1;
UPDATE prompts SET question_ko = '조별 과제나 팀 프로젝트에서 자주 겪는 어려움 하나와, 그 문제에 어떻게 대처하는지 말해 주세요.' WHERE id = 'prompt-problem-31' AND is_active = 1;
UPDATE prompts SET question_ko = '집중을 유지할 때 자주 겪는 어려움 하나와, 그 문제에 어떻게 대처하는지 말해 주세요.' WHERE id = 'prompt-problem-36' AND is_active = 1;
UPDATE prompts SET question_ko = '예상치 못한 변화가 생겼을 때 자주 겪는 어려움 하나와, 그 문제에 어떻게 대처하는지 말해 주세요.' WHERE id = 'prompt-problem-41' AND is_active = 1;
UPDATE prompts SET question_ko = '작은 실수를 지나치게 곱씹을 때 겪는 어려움 하나와, 그 문제에 어떻게 대처하는지 말해 주세요.' WHERE id = 'prompt-problem-46' AND is_active = 1;

UPDATE prompts SET question_en = 'What problem do noisy places sometimes cause for you, and what do you do about it?', question_ko = '시끄러운 장소가 가끔 어떤 문제를 일으키고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1101' AND is_active = 1;
UPDATE prompts SET question_en = 'What problem do you sometimes have when managing your inbox, and what do you do about it?', question_ko = '메일함을 관리할 때 가끔 겪는 문제는 무엇이고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1102' AND is_active = 1;
UPDATE prompts SET question_en = 'When you are confused and find it hard to ask a question, what do you do, and how does that help?', question_ko = '이해가 되지 않는데 질문하기 어려울 때 무엇을 하고, 그 방법이 어떻게 도움이 되나요?' WHERE id = 'prompt-problem-1103' AND is_active = 1;
UPDATE prompts SET question_en = 'What makes it hard for you to recover after a bad day, and what do you do about it?', question_ko = '힘든 하루를 보낸 뒤 회복하기 어렵게 만드는 문제는 무엇이고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1104' AND is_active = 1;
UPDATE prompts SET question_en = 'What problem do you sometimes have when deciding what to do first, and what do you do about it?', question_ko = '무엇부터 할지 정할 때 가끔 겪는 문제는 무엇이고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1105' AND is_active = 1;
UPDATE prompts SET question_en = 'When you find it hard to start a small task right away, what do you do, and how does that help?', question_ko = '작은 일을 바로 시작하기 어려울 때 무엇을 하고, 그 방법이 어떻게 도움이 되나요?' WHERE id = 'prompt-problem-1106' AND is_active = 1;
UPDATE prompts SET question_en = 'What problem do you face when you have to speak while nervous, and what do you do about it?', question_ko = '긴장한 상태에서 말해야 할 때 어떤 문제를 겪고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1107' AND is_active = 1;
UPDATE prompts SET question_en = 'What commuting delay do you sometimes experience, and what do you do when it happens?', question_ko = '통근 중 어떤 지연을 겪을 때가 있고, 그럴 때 어떻게 대처하나요?', tip = '겪는 지연 상황과 그때의 대처 방법을 차례로 말해 보세요.' WHERE id = 'prompt-problem-1108' AND is_active = 1;
UPDATE prompts SET question_en = 'When too many browser tabs make it hard to focus, what do you do, and how does that help?', question_ko = '브라우저 탭이 너무 많아 집중하기 어려울 때 무엇을 하고, 그 방법이 어떻게 도움이 되나요?' WHERE id = 'prompt-problem-1109' AND is_active = 1;
UPDATE prompts SET question_en = 'What problem do you have when remembering people''s names, and what do you do about it?', question_ko = '사람의 이름을 기억할 때 어떤 문제를 겪고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1110' AND is_active = 1;
UPDATE prompts SET question_en = 'What problem do you sometimes face when trying to stay calm during a conflict, and what do you do about it?', question_ko = '갈등 중에 침착함을 유지하려 할 때 어떤 문제를 겪고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1111' AND is_active = 1;
UPDATE prompts SET question_en = 'When you cannot fix a minor tech problem, what do you do, and how does that help?', question_ko = '사소한 기기 문제를 해결하지 못할 때 무엇을 하고, 그 방법이 어떻게 도움이 되나요?' WHERE id = 'prompt-problem-1112' AND is_active = 1;
UPDATE prompts SET question_en = 'What makes it difficult to share unfinished work early, and what do you do about it?', question_ko = '끝나지 않은 작업을 미리 공유하기 어렵게 만드는 문제는 무엇이고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1113' AND is_active = 1;
UPDATE prompts SET question_en = 'What problem do you have on a very sleepy morning, and what do you do about it?', question_ko = '아주 졸린 아침에 어떤 문제를 겪고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1114' AND is_active = 1;
UPDATE prompts SET question_en = 'When you make too many plans for the weekend, what do you do to simplify them, and how does that help?', question_ko = '주말 계획을 너무 많이 세웠을 때 어떻게 단순하게 정리하고, 그 방법이 어떻게 도움이 되나요?' WHERE id = 'prompt-problem-1115' AND is_active = 1;
UPDATE prompts SET question_en = 'What problem do you face when your progress feels slow, and what do you do about it?', question_ko = '진도가 느리다고 느낄 때 어떤 문제를 겪고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1116' AND is_active = 1;
UPDATE prompts SET question_en = 'What problem does comparing yourself to others cause for you, and what do you do about it?', question_ko = '자신을 다른 사람과 비교하면 어떤 문제가 생기고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1117' AND is_active = 1;
UPDATE prompts SET question_en = 'When hobbies and chores are hard to balance, what do you do, and how does that help?', question_ko = '취미와 집안일의 균형을 맞추기 어려울 때 무엇을 하고, 그 방법이 어떻게 도움이 되나요?' WHERE id = 'prompt-problem-1118' AND is_active = 1;
UPDATE prompts SET question_en = 'What makes it hard for you to say no politely, and what do you do about it?', question_ko = '정중하게 거절하기 어렵게 만드는 문제는 무엇이고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1119' AND is_active = 1;
UPDATE prompts SET question_en = 'What problem do you have when restarting a routine after missing it, and what do you do about it?', question_ko = '놓친 루틴을 다시 시작할 때 어떤 문제를 겪고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1120' AND is_active = 1;
UPDATE prompts SET question_en = 'When you lose focus while reading a long article, what do you do, and how does that help?', question_ko = '긴 글을 읽다가 집중력을 잃을 때 무엇을 하고, 그 방법이 어떻게 도움이 되나요?' WHERE id = 'prompt-problem-1121' AND is_active = 1;
UPDATE prompts SET question_en = 'What problem do you have when trying to keep your desk organized, and what do you do about it?', question_ko = '책상을 정돈된 상태로 유지할 때 어떤 문제를 겪고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1122' AND is_active = 1;
UPDATE prompts SET question_en = 'What problem do crowded places sometimes cause for you, and what do you do about it?', question_ko = '붐비는 장소가 가끔 어떤 문제를 일으키고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1123' AND is_active = 1;
UPDATE prompts SET question_en = 'When distracting messages interrupt you, what do you do, and how does that help?', question_ko = '방해되는 메시지가 집중을 끊을 때 무엇을 하고, 그 방법이 어떻게 도움이 되나요?' WHERE id = 'prompt-problem-1124' AND is_active = 1;
UPDATE prompts SET question_en = 'What makes it hard to summarize your ideas clearly, and what do you do about it?', question_ko = '생각을 짧고 분명하게 정리하기 어렵게 만드는 문제는 무엇이고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1125' AND is_active = 1;
UPDATE prompts SET question_en = 'What problem do you have when following new instructions, and what do you do about it?', question_ko = '새로운 지시를 따를 때 어떤 문제를 겪고, 그 문제에 어떻게 대처하나요?' WHERE id = 'prompt-problem-1126' AND is_active = 1;
UPDATE prompts SET question_en = 'When you have to wait in a long line, what do you do to stay patient, and how does that help?', question_ko = '긴 줄에서 기다릴 때 인내심을 유지하려고 무엇을 하고, 그 방법이 어떻게 도움이 되나요?' WHERE id = 'prompt-problem-1127' AND is_active = 1;

UPDATE prompt_hint_items
SET content = 'A commuting delay I sometimes experience is... ',
    example_en = 'A commuting delay I sometimes experience is a late train.',
    meaning_ko = '제가 가끔 겪는 통근 지연은 ...입니다.'
WHERE id = 'hint-problem-1108-1-item-1';

-- Opinion questions now ask for one concrete role or responsibility and its reason.
UPDATE prompts SET question_en = 'What is one important responsibility public transportation in big cities should have, and why?', question_ko = '대도시 대중교통이 맡아야 할 중요한 책임 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-06' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important responsibility schools have when teaching financial skills, and why?', question_ko = '학교가 금융 지식을 가르칠 때 맡아야 할 중요한 책임 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-11' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important role local volunteering should play in modern society, and why?', question_ko = '지역사회 봉사활동이 현대 사회에서 해야 할 중요한 역할 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-16' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important responsibility social media platforms should have, and why?', question_ko = '소셜 미디어 플랫폼이 맡아야 할 중요한 책임 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-21' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important role public libraries should play in modern society, and why?', question_ko = '공공도서관이 현대 사회에서 해야 할 중요한 역할 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-26' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important purpose school uniforms should serve in public schools, and why?', question_ko = '공립학교 교복이 가져야 할 중요한 목적 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-31' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important role recycling programs should play in modern society, and why?', question_ko = '재활용 프로그램이 현대 사회에서 해야 할 중요한 역할 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-36' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important role part-time jobs for teenagers should play, and why?', question_ko = '청소년 아르바이트가 해야 할 중요한 역할 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-41' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important role community arts programs should play, and why?', question_ko = '지역 예술 프로그램이 해야 할 중요한 역할 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-46' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important role neighborhood parks should play, and why?', question_ko = '동네 공원이 해야 할 중요한 역할 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1101' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important responsibility public museums should have in their communities, and why?', question_ko = '공공 박물관이 지역사회에서 맡아야 할 중요한 책임 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1102' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important service local bookstores should provide, and why?', question_ko = '동네 서점이 제공해야 할 중요한 서비스 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1103' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important role universities should play in modern society, and why?', question_ko = '대학교가 현대 사회에서 해야 할 중요한 역할 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1104' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important responsibility local news outlets should have, and why?', question_ko = '지역 뉴스 매체가 맡아야 할 중요한 책임 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1105' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important service convenience stores should provide, and why?', question_ko = '편의점이 제공해야 할 중요한 서비스 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1106' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important role sports clubs for teenagers should play, and why?', question_ko = '청소년 스포츠 클럽이 해야 할 중요한 역할 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1107' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important responsibility public health campaigns should have, and why?', question_ko = '공공 보건 캠페인이 맡아야 할 중요한 책임 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1108' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important responsibility companies using AI should have toward people, and why?', question_ko = 'AI를 활용하는 기업이 사람들에게 져야 할 중요한 책임 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1109' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important role animal shelters should play, and why?', question_ko = '동물 보호소가 해야 할 중요한 역할 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1110' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important responsibility public broadcasters should have, and why?', question_ko = '공영 방송이 맡아야 할 중요한 책임 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1111' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important service community centers should provide, and why?', question_ko = '주민 센터가 제공해야 할 중요한 서비스 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1112' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important role local farmers'' markets should play, and why?', question_ko = '지역 농산물 시장이 해야 할 중요한 역할 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1113' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important responsibility after-school programs should have, and why?', question_ko = '방과 후 프로그램이 맡아야 할 중요한 책임 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1114' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important service train stations should provide to people and communities, and why?', question_ko = '기차역이 사람과 지역사회에 제공해야 할 중요한 서비스 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1115' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important role city bike systems should play, and why?', question_ko = '공공 자전거 시스템이 해야 할 중요한 역할 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1116' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important responsibility employers offering internships should have toward interns, and why?', question_ko = '인턴십을 제공하는 기업이 인턴에게 져야 할 중요한 책임 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1117' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important action restaurants should take to reduce food waste, and why?', question_ko = '식당이 음식물 쓰레기를 줄이기 위해 해야 할 중요한 행동 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1118' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important responsibility schools should have when teaching online safety, and why?', question_ko = '학교가 온라인 안전을 가르칠 때 맡아야 할 중요한 책임 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1119' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important responsibility local governments should have when running heat shelters, and why?', question_ko = '지방자치단체가 폭염 쉼터를 운영할 때 맡아야 할 중요한 책임 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1120' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important role cultural festivals should play, and why?', question_ko = '문화 축제가 해야 할 중요한 역할 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1121' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important role volunteer matching platforms should play, and why?', question_ko = '봉사활동 연결 플랫폼이 해야 할 중요한 역할 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1122' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important purpose apartment recycling facilities should serve, and why?', question_ko = '아파트 분리수거 공간이 가져야 할 중요한 목적 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1123' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important role community gardens should play, and why?', question_ko = '공동체 정원이 해야 할 중요한 역할 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1124' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important role senior centers should play, and why?', question_ko = '노인 복지관이 해야 할 중요한 역할 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1125' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important responsibility public swimming pools should have, and why?', question_ko = '공공 수영장이 맡아야 할 중요한 책임 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1126' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important service neighborhood clinics should provide, and why?', question_ko = '동네 의원이 제공해야 할 중요한 서비스 하나는 무엇이며, 그 이유는 무엇인가요?' WHERE id = 'prompt-opinion-1127' AND is_active = 1;

-- Introductory questions: remove context-dependent wording and separate near-duplicates.
UPDATE prompts SET question_en = 'Why do you like your favorite food?', question_ko = '가장 좋아하는 음식을 왜 좋아하나요?' WHERE id = 'prompt-intro-v2-0042' AND is_active = 1;
UPDATE prompts SET question_en = 'Why do you respect someone important to you?', question_ko = '당신에게 중요한 사람을 왜 존경하나요?' WHERE id = 'prompt-intro-v2-0096' AND is_active = 1;
UPDATE prompts SET question_en = 'Why do you like your favorite room at home?', question_ko = '집에서 가장 좋아하는 방을 왜 좋아하나요?' WHERE id = 'prompt-intro-v2-0122' AND is_active = 1;
UPDATE prompts SET question_en = 'Where would you like to take your next trip?', question_ko = '다음 여행에서는 어디에 가고 싶나요?' WHERE id = 'prompt-intro-v2-0142' AND is_active = 1;
UPDATE prompts SET question_en = 'Which country would you like to visit for its culture?', question_ko = '문화를 경험하기 위해 어느 나라를 방문하고 싶나요?' WHERE id = 'prompt-intro-v2-0143' AND is_active = 1;
UPDATE prompts SET question_en = 'Which city would you like to explore on foot?', question_ko = '어느 도시를 걸어서 둘러보고 싶나요?' WHERE id = 'prompt-intro-v2-0144' AND is_active = 1;
UPDATE prompts SET question_en = 'Why was your most memorable trip special?', question_ko = '가장 기억에 남는 여행은 왜 특별했나요?' WHERE id = 'prompt-intro-v2-0150' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one travel memory you still remember clearly?', question_ko = '지금도 또렷하게 기억하는 여행의 순간 하나는 무엇인가요?' WHERE id = 'prompt-intro-v2-0152' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could travel tomorrow, where would you go, and what would you do first?', question_ko = '내일 여행을 떠날 수 있다면 어디로 가고, 가장 먼저 무엇을 하겠나요?' WHERE id = 'prompt-intro-v2-0160' AND is_active = 1;
UPDATE prompts SET question_en = 'What is your favorite bag or personal item?', question_ko = '가장 좋아하는 가방이나 개인 물건은 무엇인가요?' WHERE id = 'prompt-intro-v2-0209' AND is_active = 1;
UPDATE prompts SET question_ko = '가장 앉기 좋아하는 장소는 어디인가요?' WHERE id = 'prompt-intro-v2-0218' AND is_active = 1;
UPDATE prompts SET question_ko = '어린 시절에서 그리운 것 한 가지는 무엇인가요?' WHERE id = 'prompt-intro-v2-0239' AND is_active = 1;
UPDATE prompts SET question_ko = '구경 쇼핑을 좋아하시나요? 왜 그런가요, 아니면 왜 아닌가요?' WHERE id = 'prompt-intro-v2-0275' AND is_active = 1;
UPDATE prompts SET question_ko = '물건을 사기 전에 무엇을 확인하시나요?' WHERE id = 'prompt-intro-v2-0276' AND is_active = 1;
UPDATE prompts SET question_ko = '걷는 것을 좋아하시나요? 왜 그런가요, 아니면 왜 아닌가요?' WHERE id = 'prompt-intro-v2-0284' AND is_active = 1;
UPDATE prompts SET question_ko = '달리는 것을 좋아하시나요? 왜 그런가요, 아니면 왜 아닌가요?' WHERE id = 'prompt-intro-v2-0285' AND is_active = 1;
UPDATE prompts SET question_ko = '행복한 결말을 좋아하나요? 왜 그런가요, 아니면 왜 아닌가요?' WHERE id = 'prompt-intro-v2-0307' AND is_active = 1;
UPDATE prompts SET question_ko = '무서운 영화를 좋아하나요? 왜 그런가요, 아니면 왜 아닌가요?' WHERE id = 'prompt-intro-v2-0308' AND is_active = 1;
UPDATE prompts SET question_ko = '액션 영화를 좋아하나요? 왜 그런가요, 아니면 왜 아닌가요?' WHERE id = 'prompt-intro-v2-0309' AND is_active = 1;
UPDATE prompts SET question_ko = '로맨스 영화를 좋아하나요? 왜 그런가요, 아니면 왜 아닌가요?' WHERE id = 'prompt-intro-v2-0310' AND is_active = 1;
UPDATE prompts SET question_en = 'Do you prefer spending time at home or going out? Why?', question_ko = '집에서 시간을 보내는 것과 외출하는 것 중 무엇을 더 좋아하나요? 왜 그런가요?' WHERE id = 'prompt-intro-v2-0332' AND is_active = 1;
UPDATE prompts SET question_ko = '조용한 음악과 큰 소리의 음악 중 무엇을 더 좋아하나요? 왜 그런가요?' WHERE id = 'prompt-intro-v2-0333' AND is_active = 1;
UPDATE prompts SET question_en = 'Do you like fast food or home-cooked food? Why?', question_ko = '패스트푸드와 집에서 만든 음식 중 무엇을 더 좋아하나요? 왜 그런가요?' WHERE id = 'prompt-intro-v2-0338' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one money goal you have?', question_ko = '돈과 관련해 이루고 싶은 목표 하나는 무엇인가요?' WHERE id = 'prompt-intro-v2-0356' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one change you want to make at home?', question_ko = '집에서 바꾸고 싶은 것 하나는 무엇인가요?' WHERE id = 'prompt-intro-v2-0357' AND is_active = 1;
UPDATE prompts SET question_en = 'How would you like to use your free time better?', question_ko = '여가 시간을 어떻게 더 잘 활용하고 싶나요?' WHERE id = 'prompt-intro-v2-0358' AND is_active = 1;

-- Introductory preference questions now state the required reason explicitly.
UPDATE prompts SET question_en = 'What is one thing you like about where you live, and why?', question_ko = '사는 곳에서 좋아하는 점 하나는 무엇이고, 왜 좋아하나요?' WHERE id = 'prompt-intro-v2-0003' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you like to do alone, and why?', question_ko = '혼자서 무엇을 하는 것을 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0015' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you like to do with other people, and why?', question_ko = '다른 사람들과 무엇을 하는 것을 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0016' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you like to do on weekends, and why?', question_ko = '주말에는 무엇을 하는 것을 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0034' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you dislike doing every day, and why?', question_ko = '매일 하기 싫은 일은 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0035' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you like to eat with friends, and why?', question_ko = '친구들과 무엇을 먹는 것을 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0057' AND is_active = 1;
UPDATE prompts SET question_en = 'What kind of movies do you like, and why?', question_ko = '어떤 종류의 영화를 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0067' AND is_active = 1;
UPDATE prompts SET question_en = 'What kind of music do you like, and why?', question_ko = '어떤 종류의 음악을 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0069' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you like to do at home, and why?', question_ko = '집에서 무엇을 하는 것을 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0076' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you like to do outside, and why?', question_ko = '밖에서 무엇을 하는 것을 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0077' AND is_active = 1;
UPDATE prompts SET question_en = 'What did you enjoy doing as a child, and why?', question_ko = '어렸을 때 무엇을 하며 노는 것을 좋아했고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0079' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you like about your best friend, and why?', question_ko = '가장 친한 친구의 어떤 점이 좋고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0082' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you like to do with your friends, and why?', question_ko = '친구들과 무엇을 하는 것을 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0087' AND is_active = 1;
UPDATE prompts SET question_en = 'What kind of people do you like, and why?', question_ko = '어떤 사람을 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0092' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you like to learn, and why?', question_ko = '무엇을 배우는 것을 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0103' AND is_active = 1;
UPDATE prompts SET question_en = 'What kind of work do you like, and why?', question_ko = '어떤 일을 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0115' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you like to do at a cafe, and why?', question_ko = '카페에서 무엇을 하는 것을 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0131' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you like about your neighborhood, and why?', question_ko = '사는 동네의 어떤 점이 좋고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0133' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you like to do when you travel, and why?', question_ko = '여행할 때 무엇을 하는 것을 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0145' AND is_active = 1;
UPDATE prompts SET question_en = 'What was your best trip, and why was it special?', question_ko = '가장 좋았던 여행은 무엇이고, 왜 특별했나요?' WHERE id = 'prompt-intro-v2-0149' AND is_active = 1;
UPDATE prompts SET question_en = 'Do you like trying new things? Why or why not?', question_ko = '새로운 것을 시도하는 것을 좋아하나요? 왜 그런가요, 아니면 왜 아닌가요?' WHERE id = 'prompt-intro-v2-0174' AND is_active = 1;
UPDATE prompts SET question_en = 'Do you like making plans? Why or why not?', question_ko = '계획 세우는 것을 좋아하나요? 왜 그런가요, 아니면 왜 아닌가요?' WHERE id = 'prompt-intro-v2-0175' AND is_active = 1;
UPDATE prompts SET question_en = 'Do you like surprises? Why or why not?', question_ko = '깜짝 놀랄 일을 좋아하나요? 왜 그런가요, 아니면 왜 아닌가요?' WHERE id = 'prompt-intro-v2-0176' AND is_active = 1;
UPDATE prompts SET question_en = 'What did you like about your school, and why?', question_ko = '학교에서 무엇이 좋았고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0227' AND is_active = 1;
UPDATE prompts SET question_en = 'What did you not like about school, and why?', question_ko = '학교에서 무엇이 싫었고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0228' AND is_active = 1;
UPDATE prompts SET question_en = 'What was your favorite family trip, and why?', question_ko = '가장 좋아했던 가족 여행은 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0234' AND is_active = 1;
UPDATE prompts SET question_en = 'What did you like to do during vacation, and why?', question_ko = '방학 때 무엇을 하는 것을 좋아했고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0236' AND is_active = 1;
UPDATE prompts SET question_en = 'What is your favorite photo on your phone, and why?', question_ko = '휴대폰에서 가장 좋아하는 사진은 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0250' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you like to buy, and why?', question_ko = '무엇을 사는 것을 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0261' AND is_active = 1;
UPDATE prompts SET question_en = 'What would you buy for your room, and why?', question_ko = '방을 위해 무엇을 사고 싶고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0279' AND is_active = 1;
UPDATE prompts SET question_en = 'What would you buy for someone you love, and why?', question_ko = '사랑하는 사람을 위해 무엇을 사고 싶고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0280' AND is_active = 1;
UPDATE prompts SET question_en = 'What kind of stories do you like, and why?', question_ko = '어떤 종류의 이야기를 좋아하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0306' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could meet any animal, which animal would you choose, and why?', question_ko = '어떤 동물이든 만날 수 있다면 어떤 동물을 고르고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0383' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could live in a movie, which movie would you choose, and why?', question_ko = '영화 속에서 살 수 있다면 어떤 영화를 고르고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0384' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could eat dinner with anyone, who would you choose, and why?', question_ko = '누구와든 저녁 식사를 할 수 있다면 누구를 고르고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0385' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could have one superpower, what would you choose, and why?', question_ko = '초능력 하나를 가질 수 있다면 무엇을 고르고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0386' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could change your name, what name would you choose, and why?', question_ko = '이름을 바꿀 수 있다면 어떤 이름을 고르고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0387' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could open a small shop, what would you sell, and why?', question_ko = '작은 가게를 열 수 있다면 무엇을 팔고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0389' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could learn one skill in one day, what would it be, and why?', question_ko = '하루 만에 기술 하나를 배울 수 있다면 무엇을 배우고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0392' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could speak one more language, what would it be, and why?', question_ko = '다른 언어 하나를 더 말할 수 있다면 어떤 언어를 고르고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0393' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could have any pet, what would you choose, and why?', question_ko = '어떤 반려동물이든 키울 수 있다면 무엇을 고르고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0395' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could have a perfect breakfast, what would you eat, and why?', question_ko = '완벽한 아침 식사를 할 수 있다면 무엇을 먹고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0397' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could give yourself one gift, what would it be, and why?', question_ko = '자신에게 선물 하나를 줄 수 있다면 무엇을 고르고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0400' AND is_active = 1;

-- Introductory opinion questions now state the required justification explicitly.
UPDATE prompts SET question_en = 'What is a good meal for a rainy day, and why?', question_ko = '비 오는 날 먹기 좋은 식사는 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0056' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important quality of a good friend, and why?', question_ko = '좋은 친구에게 필요한 중요한 특징 하나는 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0088' AND is_active = 1;
UPDATE prompts SET question_en = 'What is a good gift for a friend, and why?', question_ko = '친구에게 좋은 선물은 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0094' AND is_active = 1;
UPDATE prompts SET question_en = 'What is a good way to say sorry, and why?', question_ko = '사과를 잘하는 방법은 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0097' AND is_active = 1;
UPDATE prompts SET question_en = 'What is a good way to say thank you, and why?', question_ko = '감사를 잘 표현하는 방법은 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0098' AND is_active = 1;
UPDATE prompts SET question_en = 'What is a good way to study, and why?', question_ko = '좋은 공부 방법은 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0109' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one important quality in a job, and why?', question_ko = '직업에서 중요한 조건 하나는 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0116' AND is_active = 1;
UPDATE prompts SET question_en = 'What is a good place to meet friends, and why?', question_ko = '친구를 만나기 좋은 곳은 어디이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0137' AND is_active = 1;
UPDATE prompts SET question_en = 'What is a good place to study, and why?', question_ko = '공부하기 좋은 곳은 어디이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0138' AND is_active = 1;
UPDATE prompts SET question_en = 'What is something cheap but useful, and why is it useful?', question_ko = '싸지만 유용한 것은 무엇이고, 왜 유용한가요?' WHERE id = 'prompt-intro-v2-0269' AND is_active = 1;
UPDATE prompts SET question_en = 'What is something expensive but worth the price, and why?', question_ko = '비싸지만 그만한 가치가 있는 것은 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0270' AND is_active = 1;
UPDATE prompts SET question_en = 'What is a good gift under 10,000 won, and why?', question_ko = '1만 원 이하의 좋은 선물은 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0273' AND is_active = 1;
UPDATE prompts SET question_en = 'What is a good gift under 50,000 won, and why?', question_ko = '5만 원 이하의 좋은 선물은 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0274' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one good habit for your health, and why?', question_ko = '건강에 좋은 습관 하나는 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0297' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one bad habit for your health, and why?', question_ko = '건강에 나쁜 습관 하나는 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0298' AND is_active = 1;

-- Introductory goal questions now ask for the reason directly.
UPDATE prompts SET question_en = 'What kind of person do you want to be, and why?', question_ko = '어떤 사람이 되고 싶고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0185' AND is_active = 1;
UPDATE prompts SET question_en = 'What goal would make you feel proud, and why?', question_ko = '어떤 목표를 이루면 자랑스러울 것 같고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0360' AND is_active = 1;

-- Introductory general-description questions now name the second required element.
UPDATE prompts SET question_en = 'What kind of person are you, and what is one example that shows it?', question_ko = '당신은 어떤 사람이고, 그것을 보여 주는 예시 하나는 무엇인가요?' WHERE id = 'prompt-intro-v2-0013' AND is_active = 1;
UPDATE prompts SET question_en = 'What is important to you these days, and why?', question_ko = '요즘 당신에게 중요한 것은 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0179' AND is_active = 1;
UPDATE prompts SET question_en = 'What would you do if you had more time, and why?', question_ko = '시간이 더 많다면 무엇을 하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0190' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could live in another country, where would you live, and what would you do there?', question_ko = '다른 나라에서 살 수 있다면 어디에서 살고, 그곳에서 무엇을 하겠나요?' WHERE id = 'prompt-intro-v2-0192' AND is_active = 1;
UPDATE prompts SET question_en = 'What would your perfect day look like, and what would you do?', question_ko = '완벽한 하루는 어떤 모습이고, 그날 무엇을 하겠나요?' WHERE id = 'prompt-intro-v2-0199' AND is_active = 1;
UPDATE prompts SET question_en = 'What was a good thing you bought recently, and why was it good?', question_ko = '최근에 산 것 중 좋았던 것은 무엇이고, 왜 좋았나요?' WHERE id = 'prompt-intro-v2-0277' AND is_active = 1;
UPDATE prompts SET question_en = 'What was a bad thing you bought recently, and why was it bad?', question_ko = '최근에 산 것 중 좋지 않았던 것은 무엇이고, 왜 좋지 않았나요?' WHERE id = 'prompt-intro-v2-0278' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could fly, where would you go, and why?', question_ko = '날 수 있다면 어디에 가고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0381' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could be invisible, what would you do, and why?', question_ko = '투명 인간이 될 수 있다면 무엇을 하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0382' AND is_active = 1;
UPDATE prompts SET question_en = 'What would your dream room look like, and what would you put in it?', question_ko = '꿈의 방은 어떤 모습이고, 그 안에 무엇을 두고 싶나요?' WHERE id = 'prompt-intro-v2-0388' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could make a new holiday, what would it be, and why?', question_ko = '새로운 공휴일을 만들 수 있다면 어떤 날로 만들고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0390' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could get one free ticket, where would you go, and why?', question_ko = '무료 티켓 하나를 받을 수 있다면 어디에 가고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0391' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could make a new app, what would it do, and what problem would it solve?', question_ko = '새 앱을 만들 수 있다면 어떤 기능을 하고, 어떤 문제를 해결하게 하겠나요?' WHERE id = 'prompt-intro-v2-0396' AND is_active = 1;

-- Introductory routine questions now make the hidden depth requirement visible.
UPDATE prompts SET question_en = 'What are two things you usually do in the morning?', question_ko = '보통 아침에 하는 일 두 가지는 무엇인가요?' WHERE id = 'prompt-intro-v2-0008' AND is_active = 1;
UPDATE prompts SET question_en = 'What are two things you usually do at night?', question_ko = '보통 밤에 하는 일 두 가지는 무엇인가요?' WHERE id = 'prompt-intro-v2-0009' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one thing you do on a busy day, and why?', question_ko = '바쁜 날에 하는 일 하나는 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0024' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one thing you do on a free day, and why?', question_ko = '여유로운 날에 하는 일 하나는 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0025' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one thing you do when you have free time, and why?', question_ko = '자유 시간이 있을 때 하는 일 하나는 무엇이고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0030' AND is_active = 1;
UPDATE prompts SET question_en = 'What are two things in your morning routine?', question_ko = '아침 일과에 포함된 일 두 가지는 무엇인가요?' WHERE id = 'prompt-intro-v2-0031' AND is_active = 1;
UPDATE prompts SET question_en = 'What are two things in your night routine?', question_ko = '밤 일과에 포함된 일 두 가지는 무엇인가요?' WHERE id = 'prompt-intro-v2-0032' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you usually do after work or school, and why?', question_ko = '일이나 학교가 끝난 뒤 보통 무엇을 하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0033' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you do for fun, and why do you enjoy it?', question_ko = '재미를 위해 무엇을 하고, 왜 그 활동을 즐기나요?' WHERE id = 'prompt-intro-v2-0064' AND is_active = 1;
UPDATE prompts SET question_en = 'What kind of videos do you watch online, and why?', question_ko = '온라인에서 어떤 종류의 영상을 보고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0072' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you usually talk about with your friends, and why?', question_ko = '친구들과 보통 무슨 이야기를 하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0089' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you usually do at home, and why?', question_ko = '집에서 보통 무엇을 하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0123' AND is_active = 1;
UPDATE prompts SET question_en = 'What did you often do after school, and why?', question_ko = '학교가 끝난 뒤 주로 무엇을 했고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0235' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you buy often, and why?', question_ko = '무엇을 자주 사고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0262' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you spend too much money on, and why?', question_ko = '무엇에 돈을 너무 많이 쓰고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0271' AND is_active = 1;
UPDATE prompts SET question_en = 'What is one thing you do to stay healthy, and how does it help?', question_ko = '건강을 위해 하는 일 하나는 무엇이고, 그 행동이 어떻게 도움이 되나요?' WHERE id = 'prompt-intro-v2-0281' AND is_active = 1;
UPDATE prompts SET question_en = 'What do you talk about with new people, and why is that topic useful?', question_ko = '처음 만난 사람과 무슨 이야기를 하고, 그 주제가 왜 유용한가요?' WHERE id = 'prompt-intro-v2-0373' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could live near the sea, what would you do every day, and why?', question_ko = '바닷가 근처에 살 수 있다면 매일 무엇을 하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0398' AND is_active = 1;
UPDATE prompts SET question_en = 'If you could live near a mountain, what would you do every day, and why?', question_ko = '산 근처에 살 수 있다면 매일 무엇을 하고, 그 이유는 무엇인가요?' WHERE id = 'prompt-intro-v2-0399' AND is_active = 1;

-- Enforce each newly explicit second obligation as REQUIRED.
-- The list is intentionally explicit; it is not inferred from IDs or wording.
DROP TEMPORARY TABLE IF EXISTS tmp_prompt_slot_promotions_094;
CREATE TEMPORARY TABLE tmp_prompt_slot_promotions_094 (
    prompt_id VARCHAR(64) NOT NULL PRIMARY KEY,
    slot_code VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_prompt_slot_promotions_094 (prompt_id, slot_code) VALUES
    ('prompt-opinion-06', 'REASON'),
    ('prompt-opinion-11', 'REASON'),
    ('prompt-opinion-16', 'REASON'),
    ('prompt-opinion-21', 'REASON'),
    ('prompt-opinion-26', 'REASON'),
    ('prompt-opinion-31', 'REASON'),
    ('prompt-opinion-36', 'REASON'),
    ('prompt-opinion-41', 'REASON'),
    ('prompt-opinion-46', 'REASON'),
    ('prompt-opinion-1101', 'REASON'),
    ('prompt-opinion-1102', 'REASON'),
    ('prompt-opinion-1103', 'REASON'),
    ('prompt-opinion-1104', 'REASON'),
    ('prompt-opinion-1105', 'REASON'),
    ('prompt-opinion-1106', 'REASON'),
    ('prompt-opinion-1107', 'REASON'),
    ('prompt-opinion-1108', 'REASON'),
    ('prompt-opinion-1109', 'REASON'),
    ('prompt-opinion-1110', 'REASON'),
    ('prompt-opinion-1111', 'REASON'),
    ('prompt-opinion-1112', 'REASON'),
    ('prompt-opinion-1113', 'REASON'),
    ('prompt-opinion-1114', 'REASON'),
    ('prompt-opinion-1115', 'REASON'),
    ('prompt-opinion-1116', 'REASON'),
    ('prompt-opinion-1117', 'REASON'),
    ('prompt-opinion-1118', 'REASON'),
    ('prompt-opinion-1119', 'REASON'),
    ('prompt-opinion-1120', 'REASON'),
    ('prompt-opinion-1121', 'REASON'),
    ('prompt-opinion-1122', 'REASON'),
    ('prompt-opinion-1123', 'REASON'),
    ('prompt-opinion-1124', 'REASON'),
    ('prompt-opinion-1125', 'REASON'),
    ('prompt-opinion-1126', 'REASON'),
    ('prompt-opinion-1127', 'REASON'),
    ('prompt-problem-1103', 'RESULT'),
    ('prompt-problem-1106', 'RESULT'),
    ('prompt-problem-1109', 'RESULT'),
    ('prompt-problem-1112', 'RESULT'),
    ('prompt-problem-1115', 'RESULT'),
    ('prompt-problem-1118', 'RESULT'),
    ('prompt-problem-1121', 'RESULT'),
    ('prompt-problem-1124', 'RESULT'),
    ('prompt-problem-1127', 'RESULT'),
    ('prompt-intro-v2-0003', 'REASON'),
    ('prompt-intro-v2-0015', 'REASON'),
    ('prompt-intro-v2-0016', 'REASON'),
    ('prompt-intro-v2-0034', 'REASON'),
    ('prompt-intro-v2-0035', 'REASON'),
    ('prompt-intro-v2-0057', 'REASON'),
    ('prompt-intro-v2-0067', 'REASON'),
    ('prompt-intro-v2-0069', 'REASON'),
    ('prompt-intro-v2-0076', 'REASON'),
    ('prompt-intro-v2-0077', 'REASON'),
    ('prompt-intro-v2-0079', 'REASON'),
    ('prompt-intro-v2-0082', 'REASON'),
    ('prompt-intro-v2-0087', 'REASON'),
    ('prompt-intro-v2-0092', 'REASON'),
    ('prompt-intro-v2-0103', 'REASON'),
    ('prompt-intro-v2-0115', 'REASON'),
    ('prompt-intro-v2-0131', 'REASON'),
    ('prompt-intro-v2-0133', 'REASON'),
    ('prompt-intro-v2-0145', 'REASON'),
    ('prompt-intro-v2-0149', 'REASON'),
    ('prompt-intro-v2-0174', 'REASON'),
    ('prompt-intro-v2-0175', 'REASON'),
    ('prompt-intro-v2-0176', 'REASON'),
    ('prompt-intro-v2-0227', 'REASON'),
    ('prompt-intro-v2-0228', 'REASON'),
    ('prompt-intro-v2-0234', 'REASON'),
    ('prompt-intro-v2-0236', 'REASON'),
    ('prompt-intro-v2-0250', 'REASON'),
    ('prompt-intro-v2-0261', 'REASON'),
    ('prompt-intro-v2-0279', 'REASON'),
    ('prompt-intro-v2-0280', 'REASON'),
    ('prompt-intro-v2-0306', 'REASON'),
    ('prompt-intro-v2-0383', 'REASON'),
    ('prompt-intro-v2-0384', 'REASON'),
    ('prompt-intro-v2-0385', 'REASON'),
    ('prompt-intro-v2-0386', 'REASON'),
    ('prompt-intro-v2-0387', 'REASON'),
    ('prompt-intro-v2-0389', 'REASON'),
    ('prompt-intro-v2-0392', 'REASON'),
    ('prompt-intro-v2-0393', 'REASON'),
    ('prompt-intro-v2-0395', 'REASON'),
    ('prompt-intro-v2-0397', 'REASON'),
    ('prompt-intro-v2-0400', 'REASON'),
    ('prompt-intro-v2-0056', 'REASON'),
    ('prompt-intro-v2-0088', 'REASON'),
    ('prompt-intro-v2-0094', 'REASON'),
    ('prompt-intro-v2-0097', 'REASON'),
    ('prompt-intro-v2-0098', 'REASON'),
    ('prompt-intro-v2-0109', 'REASON'),
    ('prompt-intro-v2-0116', 'REASON'),
    ('prompt-intro-v2-0137', 'REASON'),
    ('prompt-intro-v2-0138', 'REASON'),
    ('prompt-intro-v2-0269', 'REASON'),
    ('prompt-intro-v2-0270', 'REASON'),
    ('prompt-intro-v2-0273', 'REASON'),
    ('prompt-intro-v2-0274', 'REASON'),
    ('prompt-intro-v2-0297', 'REASON'),
    ('prompt-intro-v2-0298', 'REASON'),
    ('prompt-intro-v2-0185', 'REASON'),
    ('prompt-intro-v2-0360', 'REASON'),
    ('prompt-intro-v2-0013', 'EXAMPLE'),
    ('prompt-intro-v2-0179', 'REASON'),
    ('prompt-intro-v2-0190', 'REASON'),
    ('prompt-intro-v2-0192', 'PLACE'),
    ('prompt-intro-v2-0199', 'ACTION'),
    ('prompt-intro-v2-0277', 'REASON'),
    ('prompt-intro-v2-0278', 'REASON'),
    ('prompt-intro-v2-0381', 'REASON'),
    ('prompt-intro-v2-0382', 'REASON'),
    ('prompt-intro-v2-0388', 'ACTION'),
    ('prompt-intro-v2-0390', 'REASON'),
    ('prompt-intro-v2-0391', 'REASON'),
    ('prompt-intro-v2-0396', 'PROBLEM'),
    ('prompt-intro-v2-0008', 'ADDITIONAL_ACTION'),
    ('prompt-intro-v2-0009', 'ADDITIONAL_ACTION'),
    ('prompt-intro-v2-0024', 'REASON'),
    ('prompt-intro-v2-0025', 'REASON'),
    ('prompt-intro-v2-0030', 'REASON'),
    ('prompt-intro-v2-0031', 'ADDITIONAL_ACTION'),
    ('prompt-intro-v2-0032', 'ADDITIONAL_ACTION'),
    ('prompt-intro-v2-0033', 'REASON'),
    ('prompt-intro-v2-0064', 'REASON'),
    ('prompt-intro-v2-0072', 'REASON'),
    ('prompt-intro-v2-0089', 'REASON'),
    ('prompt-intro-v2-0123', 'REASON'),
    ('prompt-intro-v2-0235', 'REASON'),
    ('prompt-intro-v2-0262', 'REASON'),
    ('prompt-intro-v2-0271', 'REASON'),
    ('prompt-intro-v2-0281', 'RESULT'),
    ('prompt-intro-v2-0373', 'REASON'),
    ('prompt-intro-v2-0398', 'REASON'),
    ('prompt-intro-v2-0399', 'REASON');

INSERT INTO prompt_task_profile_slots (
    prompt_id,
    slot_id,
    slot_role,
    display_order,
    semantic_role_en,
    satisfied_when_en,
    semantic_role_ko,
    satisfied_when_ko,
    is_active
)
SELECT
    optional_assignment.prompt_id,
    optional_assignment.slot_id,
    'REQUIRED',
    2,
    optional_assignment.semantic_role_en,
    optional_assignment.satisfied_when_en,
    optional_assignment.semantic_role_ko,
    optional_assignment.satisfied_when_ko,
    1
FROM tmp_prompt_slot_promotions_094 promotion
JOIN prompt_task_slots slot
  ON slot.code = promotion.slot_code
JOIN prompt_task_profile_slots optional_assignment
  ON optional_assignment.prompt_id = promotion.prompt_id
 AND optional_assignment.slot_id = slot.id
 AND optional_assignment.slot_role = 'OPTIONAL'
ON DUPLICATE KEY UPDATE
    display_order = VALUES(display_order),
    semantic_role_en = VALUES(semantic_role_en),
    satisfied_when_en = VALUES(satisfied_when_en),
    semantic_role_ko = VALUES(semantic_role_ko),
    satisfied_when_ko = VALUES(satisfied_when_ko),
    is_active = VALUES(is_active);

UPDATE prompt_task_profile_slots optional_assignment
JOIN prompt_task_slots slot
  ON slot.id = optional_assignment.slot_id
JOIN tmp_prompt_slot_promotions_094 promotion
  ON promotion.prompt_id = optional_assignment.prompt_id
 AND promotion.slot_code = slot.code
SET optional_assignment.is_active = 0
WHERE optional_assignment.slot_role = 'OPTIONAL';

UPDATE prompt_task_profiles profile
JOIN tmp_prompt_slot_promotions_094 promotion
  ON promotion.prompt_id = profile.prompt_id
SET profile.minimum_depth_slots = 0,
    profile.review_rationale = '질문 문구를 실제 학습 요구와 일치시키고, 질문에서 직접 요구하는 두 번째 요소를 필수 슬롯으로 승격했으며 숨은 추가 깊이는 제거했다.';

DROP TEMPORARY TABLE IF EXISTS tmp_prompt_slot_promotions_094;

-- These questions already require both a concrete description and a reason.
-- Requiring another independent depth slot would exceed the wording.
UPDATE prompt_task_profiles
SET minimum_depth_slots = 0,
    review_rationale = '질문이 대상에 대한 구체적인 설명과 그 이유를 이미 직접 요구하므로 두 필수 슬롯으로 충분하며 별도의 추가 깊이는 요구하지 않는다.'
WHERE prompt_id IN (
    'prompt-general-1101',
    'prompt-general-1102',
    'prompt-general-1103',
    'prompt-general-1104',
    'prompt-general-1107',
    'prompt-general-1108',
    'prompt-general-1110',
    'prompt-general-1111',
    'prompt-general-1112',
    'prompt-general-1113',
    'prompt-general-1114',
    'prompt-general-1115',
    'prompt-general-1116',
    'prompt-general-1118',
    'prompt-general-1119',
    'prompt-general-1120'
)
  AND is_active = 1;

-- Question-specific contract corrections caused by wording changes.
UPDATE prompt_task_profile_slots assignment
JOIN prompt_task_slots slot ON slot.id = assignment.slot_id
SET assignment.semantic_role_en = 'The recurring commuting delay the learner personally experiences.',
    assignment.satisfied_when_en = 'The answer identifies a concrete delay in the learner''s commute, such as a late train, traffic jam, missed connection, or unusually long wait; a generic statement that commuting is difficult is insufficient.',
    assignment.semantic_role_ko = '학습자가 실제 통근 중 반복해서 겪는 지연 상황.',
    assignment.satisfied_when_ko = '늦게 오는 열차, 교통 체증, 연결편을 놓치는 상황, 평소보다 긴 대기처럼 학습자가 겪는 구체적인 통근 지연을 밝히면 충족한다. 통근이 어렵다고만 하면 충분하지 않다.'
WHERE assignment.prompt_id = 'prompt-problem-1108'
  AND slot.code = 'PROBLEM'
  AND assignment.slot_role = 'REQUIRED';

UPDATE prompt_task_profile_slots assignment
JOIN prompt_task_slots slot ON slot.id = assignment.slot_id
SET assignment.semantic_role_en = CASE slot.code
        WHEN 'CHOICE' THEN 'One concrete aspect of the place where the learner lives that they like.'
        WHEN 'REASON' THEN 'Why the learner likes the selected aspect of where they live.'
        WHEN 'DETAIL' THEN 'A concrete description of the liked feature of the learner''s home area.'
        WHEN 'EXAMPLE' THEN 'A specific local place or experience that demonstrates the liked feature.'
        WHEN 'FEELING' THEN 'The feeling the liked feature of the learner''s home area creates.'
        ELSE assignment.semantic_role_en
    END,
    assignment.satisfied_when_en = CASE slot.code
        WHEN 'CHOICE' THEN 'The answer identifies a concrete feature, place, quality, or experience connected to where the learner lives.'
        WHEN 'REASON' THEN 'The answer gives a specific benefit, quality, or personal connection that explains why the selected aspect is appealing.'
        WHEN 'DETAIL' THEN 'The answer adds a specific characteristic that makes the liked part of the learner''s home area understandable.'
        WHEN 'EXAMPLE' THEN 'The answer gives a concrete local place or personal experience that illustrates what the learner likes.'
        WHEN 'FEELING' THEN 'The answer conveys a distinct emotional response associated with experiencing the selected aspect.'
        ELSE assignment.satisfied_when_en
    END,
    assignment.semantic_role_ko = CASE slot.code
        WHEN 'CHOICE' THEN '학습자가 사는 곳에서 좋아하는 구체적인 측면.'
        WHEN 'REASON' THEN '학습자가 사는 곳의 선택한 측면을 좋아하는 이유.'
        WHEN 'DETAIL' THEN '학습자가 사는 지역에서 좋아하는 특징에 대한 구체적인 설명.'
        WHEN 'EXAMPLE' THEN '좋아하는 특징을 보여 주는 구체적인 지역 장소나 경험.'
        WHEN 'FEELING' THEN '사는 지역의 좋아하는 특징이 학습자에게 주는 감정.'
        ELSE assignment.semantic_role_ko
    END,
    assignment.satisfied_when_ko = CASE slot.code
        WHEN 'CHOICE' THEN '학습자가 사는 곳과 연결된 구체적인 특징, 장소, 성격 또는 경험을 하나 밝히면 충족한다.'
        WHEN 'REASON' THEN '선택한 측면을 좋아하는 이유가 되는 구체적인 이점, 특성 또는 개인적 관련성을 설명하면 충족한다.'
        WHEN 'DETAIL' THEN '사는 곳에서 좋아하는 부분을 이해할 수 있도록 구체적인 특성을 덧붙이면 충족한다.'
        WHEN 'EXAMPLE' THEN '좋아하는 점을 보여 주는 구체적인 지역 장소나 개인적 경험을 제시하면 충족한다.'
        WHEN 'FEELING' THEN '선택한 측면을 경험할 때 느끼는 뚜렷한 감정을 전달하면 충족한다.'
        ELSE assignment.satisfied_when_ko
    END
WHERE assignment.prompt_id = 'prompt-intro-v2-0003'
  AND slot.code IN ('CHOICE', 'REASON', 'DETAIL', 'EXAMPLE', 'FEELING')
  AND assignment.is_active = 1;
