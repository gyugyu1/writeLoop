-- Focus ambiguous intro preference prompts that mixed several situations in one question.
-- Keep beginner prompts answerable with one clear scene, one action, and one reason.

START TRANSACTION;

CREATE TEMPORARY TABLE prompt_focused_reframes (
    id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
    question_en TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    question_ko TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    tip TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
);

INSERT INTO prompt_focused_reframes (id, question_en, question_ko, tip) VALUES
    ('prompt-preference-1101', 'What breakfast do you usually eat on a busy morning, and why?', '바쁜 아침에는 보통 어떤 아침을 먹나요? 이유도 말해 주세요.', '아침 메뉴만 말하지 말고, 바쁜 아침에 왜 그 선택이 편한지 말해 보세요.'),
    ('prompt-preference-1102', 'What fruit do you like to eat on a hot day, and why?', '더운 날에는 어떤 과일을 먹는 것을 좋아하나요? 이유도 말해 주세요.', '과일 이름보다 더운 날 먹고 싶은 이유나 느낌을 함께 말해 보세요.'),
    ('prompt-preference-1103', 'What drink do you like on a rainy day, and why?', '비 오는 날에는 어떤 음료를 좋아하나요? 이유도 말해 주세요.', '비 오는 날의 기분이나 상황에 맞춰 음료와 이유를 말해 보세요.'),
    ('prompt-preference-1104', 'What matters most when you choose a phone case, and why?', '휴대폰 케이스를 고를 때 가장 중요하게 보는 것은 무엇인가요? 이유도 말해 주세요.', '색이나 모양만 말하지 말고, 보호나 사용감처럼 실제 이유를 붙여 보세요.'),
    ('prompt-preference-1105', 'What do you usually write in a notebook, and why?', '공책에는 보통 무엇을 쓰나요? 이유도 말해 주세요.', '공책 종류보다 내가 실제로 적는 내용과 도움이 되는 이유를 말해 보세요.'),
    ('prompt-preference-1107', 'What soup do you like when you want something warm, and why?', '따뜻한 것이 먹고 싶을 때 어떤 수프를 좋아하나요? 이유도 말해 주세요.', '수프 이름과 함께 언제 먹고 싶은지, 왜 좋은지 말해 보세요.'),
    ('prompt-preference-1108', 'What do you carry in your everyday bag, and why?', '평소 가방에는 무엇을 가지고 다니나요? 이유도 말해 주세요.', '가방 종류보다 실제로 챙기는 물건과 필요한 이유를 말해 보세요.'),
    ('prompt-preference-1109', 'When do you like to play board games, and why?', '언제 보드게임을 하는 것을 좋아하나요? 이유도 말해 주세요.', '게임 이름만 말하지 말고, 누구와 언제 하는지와 이유를 붙여 보세요.'),
    ('prompt-preference-1111', 'What scent helps your room feel comfortable, and why?', '방을 편안하게 느끼게 해 주는 향은 무엇인가요? 이유도 말해 주세요.', '향 이름보다 그 향을 맡는 상황과 느낌을 함께 말해 보세요.'),
    ('prompt-preference-1112', 'Where do you like to sit on the bus, and why?', '버스에서는 어디에 앉는 것을 좋아하나요? 이유도 말해 주세요.', '자리 위치와 함께 편하거나 안전하다고 느끼는 이유를 말해 보세요.'),
    ('prompt-preference-1114', 'What sandwich do you like for a quick meal, and why?', '간단히 먹을 때 어떤 샌드위치를 좋아하나요? 이유도 말해 주세요.', '샌드위치 종류와 함께 빠르게 먹기 좋은 이유를 말해 보세요.'),
    ('prompt-preference-1115', 'What kitchen tool do you use often, and why?', '자주 사용하는 주방 도구는 무엇인가요? 이유도 말해 주세요.', '도구 이름만 말하지 말고, 어떤 요리나 정리에 도움이 되는지 말해 보세요.'),
    ('prompt-preference-1117', 'What kind of online creator do you watch, and why?', '어떤 온라인 크리에이터를 즐겨 보나요? 이유도 말해 주세요.', '채널 이름보다 어떤 내용을 보는지와 좋아하는 이유를 말해 보세요.'),
    ('prompt-preference-1118', 'What snack do you like during study or work breaks, and why?', '공부나 일 중간에 쉬는 시간에는 어떤 간식을 좋아하나요? 이유도 말해 주세요.', '간식 이름과 함께 쉬는 시간에 먹기 좋은 이유를 말해 보세요.'),
    ('prompt-preference-1119', 'What kind of pen feels comfortable when you write, and why?', '글을 쓸 때 어떤 펜이 편하게 느껴지나요? 이유도 말해 주세요.', '펜의 색보다 쓰는 느낌이나 오래 쓸 때 편한 이유를 말해 보세요.'),
    ('prompt-preference-1120', 'What do you like to buy at a bakery, and why?', '빵집에서는 무엇을 사는 것을 좋아하나요? 이유도 말해 주세요.', '빵이나 디저트 이름과 함께 언제 먹고 싶은지 말해 보세요.'),
    ('prompt-preference-1121', 'What snack do you like during a movie, and why?', '영화를 볼 때 어떤 간식을 좋아하나요? 이유도 말해 주세요.', '간식 이름과 함께 영화 볼 때 잘 맞는 이유를 말해 보세요.'),
    ('prompt-preference-1122', 'What souvenir do you like to bring back from a trip, and why?', '여행에서 어떤 기념품을 가져오는 것을 좋아하나요? 이유도 말해 주세요.', '기념품 종류와 함께 추억이나 실용성 같은 이유를 말해 보세요.'),
    ('prompt-preference-1123', 'When do you use a candle at home, and why?', '집에서 언제 초를 사용하나요? 이유도 말해 주세요.', '향이나 색보다 사용하는 순간과 그때 좋은 이유를 말해 보세요.'),
    ('prompt-preference-1125', 'When do you drink tea, and why?', '언제 차를 마시나요? 이유도 말해 주세요.', '차 종류와 함께 마시는 시간이나 기분을 말해 보세요.'),
    ('prompt-preference-1126', 'When do you bring a light jacket, and why?', '언제 얇은 재킷을 챙기나요? 이유도 말해 주세요.', '날씨나 장소를 함께 말하면서 재킷이 필요한 이유를 말해 보세요.'),
    ('prompt-preference-2219', 'What snack do you like after studying, and why?', '공부를 마친 뒤 어떤 간식을 좋아하나요? 이유도 말해 주세요.', '공부를 마친 상황에 맞춰 간식과 이유를 한 문장으로 말해 보세요.'),
    ('prompt-preference-2231', 'What tool helps you start studying smoothly, and why?', '공부를 부드럽게 시작하는 데 도움이 되는 도구는 무엇인가요? 이유도 말해 주세요.', '도구 이름만 말하지 말고, 공부를 시작할 때 어떤 점이 편해지는지 말해 보세요.'),
    ('prompt-preference-2232', 'When you make mistakes while studying, what helps you fix them without losing focus?', '공부하다가 실수했을 때 집중을 잃지 않고 고치는 데 도움이 되는 것은 무엇인가요?', '실수하는 상황과 다시 집중하는 방법을 함께 말해 보세요.'),
    ('prompt-preference-2233', 'How do you mark important information when you study, and why does that help?', '공부할 때 중요한 내용을 어떻게 표시하나요? 그 방법이 왜 도움이 되나요?', '표시하는 방법과 기억이나 정리에 도움이 되는 이유를 말해 보세요.'),
    ('prompt-preference-2234', 'What do you write down so you do not forget a small study task?', '작은 공부 할 일을 잊지 않기 위해 무엇을 적어 두나요?', '무엇을 적는지와 그것이 기억에 도움이 되는 이유를 말해 보세요.'),
    ('prompt-preference-2235', 'How do you plan your study time on a busy day?', '바쁜 날 공부 시간을 어떻게 계획하나요?', '공부 시간을 나누거나 정하는 방법을 간단히 말해 보세요.'),
    ('prompt-preference-2237', 'What do you keep on your desk to stay organized, and why?', '책상을 정리된 상태로 유지하기 위해 무엇을 올려 두나요? 이유도 말해 주세요.', '책상 위 물건과 정리가 공부에 도움이 되는 이유를 함께 말해 보세요.'),
    ('prompt-preference-2238', 'When accuracy matters in studying, what tool or habit helps you?', '공부할 때 정확함이 중요하다면 어떤 도구나 습관이 도움이 되나요?', '정확함이 필요한 상황과 도움이 되는 이유를 함께 말해 보세요.'),
    ('prompt-preference-2240', 'What do you carry so studying outside home feels easier?', '집 밖에서 공부할 때 더 편하게 느껴지도록 무엇을 챙기나요?', '어디에서 공부하는지와 챙기면 편한 이유를 함께 말해 보세요.'),
    ('prompt-preference-2241', 'What tool helps you type more comfortably while studying?', '공부할 때 더 편하게 타이핑하도록 도와주는 도구는 무엇인가요?', '도구 이름과 함께 손이나 자세가 어떻게 편해지는지 말해 보세요.'),
    ('prompt-preference-2242', 'What setup helps you use a computer more comfortably for studying?', '공부할 때 컴퓨터를 더 편하게 쓰도록 도와주는 환경은 무엇인가요?', '컴퓨터를 쓰는 상황과 더 편해지는 이유를 말해 보세요.'),
    ('prompt-preference-2243', 'How do you manage short study sessions so you can stay focused?', '짧은 공부 시간을 집중해서 보내기 위해 어떻게 관리하나요?', '공부 시간을 나누거나 집중을 유지하는 방법을 간단히 말해 보세요.'),
    ('prompt-preference-2265', 'When you study in your room, what lighting do you like, and why?', '방에서 공부할 때 어떤 조명을 좋아하나요? 이유도 말해 주세요.', '공부할 때 조명이 집중이나 편안함에 어떤 영향을 주는지 말해 보세요.'),
    ('prompt-preference-2267', 'What makes your desk easier to use when you study at home?', '집에서 공부할 때 책상을 더 쓰기 편하게 만드는 것은 무엇인가요?', '책상에서 공부하는 상황과 편해지는 이유를 함께 말해 보세요.'),
    ('prompt-preference-2268', 'When you read at home, where do you like to sit, and why?', '집에서 책을 읽을 때 어디에 앉는 것을 좋아하나요? 이유도 말해 주세요.', '읽는 상황 하나에 집중해서 무엇이 편한지와 이유를 말해 보세요.'),
    ('prompt-preference-2291', 'What app do you check first in the morning, and why?', '아침에 가장 먼저 확인하는 앱은 무엇인가요? 이유도 말해 주세요.', '앱 이름과 함께 하루를 시작할 때 어떤 도움이 되는지 말해 보세요.'),
    ('prompt-preference-2292', 'What alarm sound helps you wake up in the morning, and why?', '아침에 일어나는 데 도움이 되는 알람 소리는 어떤 것인가요? 이유도 말해 주세요.', '알람의 느낌과 아침에 잘 맞는 이유를 함께 말해 보세요.'),
    ('prompt-preference-2295', 'How do you use stickers when you message friends?', '친구에게 메시지를 보낼 때 스티커를 어떻게 사용하나요?', '스티커를 쓰는 순간과 감정을 더 잘 전하는 이유를 말해 보세요.'),
    ('prompt-preference-2296', 'When you study, what kind of music do you choose, and why?', '공부할 때 어떤 음악을 고르나요? 이유도 말해 주세요.', '여러 상황을 한꺼번에 말하지 말고, 공부할 때 어떤 음악을 고르는지와 이유를 말해 보세요.'),
    ('prompt-preference-2297', 'When do you use a photo filter, and why do you like it?', '언제 사진 필터를 사용하나요? 왜 좋아하나요?', '필터를 쓰는 상황과 사진이 어떻게 달라지는지 말해 보세요.'),
    ('prompt-preference-2302', 'What music do you play when you want to relax, and why?', '쉬고 싶을 때 어떤 음악을 틀어 두나요? 이유도 말해 주세요.', '특정 기분이나 순간 전체가 아니라 쉬는 상황 하나에 맞춰 말해 보세요.'),
    ('prompt-preference-2519', 'What do you keep close when you run errands, and why?', '볼일을 보러 다닐 때 무엇을 가까이 두나요? 이유도 말해 주세요.', '결제나 이동처럼 한 가지 외출 상황에 맞춰 필요한 물건과 이유를 말해 보세요.'),
    ('prompt-preference-2528', 'How do you keep small things in your bag from getting lost?', '가방 속 작은 물건이 없어지지 않게 어떻게 보관하나요?', '작은 물건을 잃어버리지 않게 하는 방법을 한 가지 장면으로 말해 보세요.'),
    ('prompt-preference-2536', 'What helps you clean your desk quickly before studying?', '공부를 시작하기 전에 책상을 빠르게 정리하는 데 도움이 되는 것은 무엇인가요?', '공부 전 책상 정리 상황에 맞춰 무엇이 도움이 되는지 말해 보세요.'),
    ('prompt-preference-2538', 'What do you use to clean up after cooking?', '요리한 뒤 정리할 때 무엇을 사용하나요?', '요리 후 정리하는 장면에 집중해서 사용하는 것과 이유를 말해 보세요.'),
    ('prompt-preference-2551', 'How do you keep your phone easy to see while studying?', '공부할 때 휴대폰을 보기 쉽게 두려면 어떻게 하나요?', '공부 중 휴대폰을 확인해야 하는 상황과 편한 이유를 말해 보세요.'),
    ('prompt-preference-2552', 'What kind of light helps you read at night?', '밤에 책을 읽을 때 도움이 되는 조명은 어떤 것인가요?', '밤에 읽는 상황에 집중해서 조명의 특징과 이유를 말해 보세요.'),
    ('prompt-preference-2558', 'What do you use to stay cool when you walk outside, and why?', '밖에서 걸을 때 시원하게 지내기 위해 무엇을 사용하나요? 이유도 말해 주세요.', '이동하거나 외출하는 상황 하나를 골라 도움이 되는 이유를 말해 보세요.'),
    ('prompt-preference-2572', 'How do you carry small snacks neatly when you go out?', '외출할 때 작은 간식을 깔끔하게 어떻게 챙기나요?', '간식을 챙기는 한 가지 상황과 정리하기 쉬운 이유를 말해 보세요.');

UPDATE prompts p
JOIN prompt_focused_reframes r ON r.id = p.id
SET p.question_en = r.question_en,
    p.question_ko = r.question_ko,
    p.tip = r.tip;

DROP TEMPORARY TABLE prompt_focused_reframes;

COMMIT;
