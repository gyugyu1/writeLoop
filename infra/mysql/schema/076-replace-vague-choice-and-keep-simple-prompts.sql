-- Replace vague "Think about ... that choice" and "keep simple" prompts with direct, answerable questions.
-- These updates intentionally avoid abstract template wording so learners know exactly what to answer.

START TRANSACTION;

CREATE TEMPORARY TABLE prompt_question_polish_076 (
    id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
    question_en TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    question_ko TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    tip TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
);

INSERT INTO prompt_question_polish_076 (id, question_en, question_ko, tip) VALUES
    ('prompt-preference-1106', 'Where do you like to read, and why is that place comfortable?', '어디에서 책 읽는 것을 좋아하나요? 그곳이 왜 편한가요?', '장소를 하나 말하고, 조용함이나 자세처럼 읽기 편한 이유를 덧붙여 보세요.'),
    ('prompt-preference-1124', 'How do you organize photos on your phone, and why does it help?', '휴대폰 사진을 어떻게 정리하나요? 왜 도움이 되나요?', '앨범, 즐겨찾기, 삭제처럼 실제로 하는 행동을 말해 보세요.'),
    ('prompt-preference-2203', 'What fruit do you like to eat in the morning, and why?', '아침에 어떤 과일을 먹는 것을 좋아하나요? 이유도 말해 주세요.', '과일 이름과 아침에 먹기 좋은 이유를 함께 말해 보세요.'),
    ('prompt-preference-2209', 'What side dish do you like to pack in a lunchbox, and why?', '도시락에 어떤 반찬을 넣는 것을 좋아하나요? 이유도 말해 주세요.', '반찬 이름과 도시락에 잘 맞는 이유를 말해 보세요.'),
    ('prompt-preference-2210', 'What simple meal do you like to make for yourself, and when do you make it?', '혼자 있을 때 어떤 간단한 음식을 만들어 먹나요? 언제 만드나요?', '음식 이름과 만드는 상황을 함께 말해 보세요.'),
    ('prompt-preference-2211', 'What snack do you like to eat with milk, and why?', '우유와 함께 어떤 간식을 먹는 것을 좋아하나요? 이유도 말해 주세요.', '간식 이름과 우유와 잘 어울리는 이유를 덧붙여 보세요.'),
    ('prompt-preference-2212', 'What food do you eat when you are in a hurry, and why?', '바쁠 때 어떤 음식을 먹나요? 이유도 말해 주세요.', '빨리 먹을 수 있는 이유나 준비하기 쉬운 점을 말해 보세요.'),
    ('prompt-preference-2224', 'What sweet bread do you like to grab on the go, and why?', '이동 중에 어떤 달콤한 빵을 사 먹는 것을 좋아하나요? 이유도 말해 주세요.', '빵 이름과 들고 먹기 편한 이유를 함께 말해 보세요.'),
    ('prompt-preference-2244', 'How do you keep papers organized for school or work?', '학교나 일에서 종이를 어떻게 정리하나요?', '폴더, 클립, 파일 이름처럼 실제 정리 방법을 말해 보세요.'),
    ('prompt-preference-2245', 'What study tool do you keep near your notebook, and how does it help?', '공책 옆에 어떤 공부 도구를 두나요? 어떻게 도움이 되나요?', '도구 이름과 필기나 확인에 도움이 되는 점을 말해 보세요.'),
    ('prompt-preference-2259', 'What ring or bracelet do you like to wear, and when do you wear it?', '어떤 반지나 팔찌를 즐겨 착용하나요? 언제 착용하나요?', '액세서리 이름과 착용하는 상황을 함께 말해 보세요.'),
    ('prompt-preference-2260', 'What do you wear when you want to feel relaxed, and why?', '편하게 쉬고 싶을 때 무엇을 입나요? 이유도 말해 주세요.', '옷의 특징과 몸이 편해지는 이유를 말해 보세요.'),
    ('prompt-preference-2264', 'What bowl do you like to use at home, and what do you put in it?', '집에서 어떤 그릇을 즐겨 사용하나요? 무엇을 담나요?', '그릇의 용도와 자주 담는 음식을 함께 말해 보세요.'),
    ('prompt-preference-2271', 'When do you use a mirror while getting ready?', '준비할 때 거울을 언제 사용하나요?', '외출 전 확인하는 부분과 거울이 도움이 되는 이유를 말해 보세요.'),
    ('prompt-preference-2273', 'What plate do you use for a quick meal, and why?', '간단히 먹을 때 어떤 접시를 사용하나요? 이유도 말해 주세요.', '접시의 크기나 씻기 쉬운 점처럼 실제 이유를 말해 보세요.'),
    ('prompt-preference-2305', 'What app feature do you use in the morning, and how does it help you?', '아침에 어떤 앱 기능을 사용하나요? 어떻게 도움이 되나요?', '알람, 날씨, 일정처럼 기능 하나를 고르고 아침에 도움이 되는 점을 말해 보세요.'),
    ('prompt-preference-2308', 'What street near your home do you like to walk on, and why?', '집 근처에서 걷기 좋아하는 길은 어디인가요? 이유도 말해 주세요.', '길의 위치와 걷기 좋은 이유를 함께 말해 보세요.'),
    ('prompt-preference-2313', 'Which route do you take to the grocery store, and why do you like it?', '식료품점에 갈 때 어떤 길로 가나요? 왜 그 길이 좋나요?', '길이 빠른지, 조용한지, 보기 편한지 같은 이유를 말해 보세요.'),
    ('prompt-preference-2314', 'Where do you go first in a market, and why?', '시장에 가면 어디를 먼저 가나요? 이유도 말해 주세요.', '먼저 들르는 코너나 가게와 그 이유를 말해 보세요.'),
    ('prompt-preference-2317', 'Where do you like to watch the sunset near you, and why?', '집 근처에서 해질 무렵 어디를 보는 것을 좋아하나요? 이유도 말해 주세요.', '장소와 그 시간이 좋게 느껴지는 이유를 함께 말해 보세요.'),
    ('prompt-preference-2318', 'Where do you like to sit near a window, and why?', '창가 근처에서는 어디에 앉는 것을 좋아하나요? 이유도 말해 주세요.', '앉는 장소와 빛, 풍경, 조용함 같은 이유를 말해 보세요.'),
    ('prompt-preference-2319', 'Where do you like to stop by on the way home, and why?', '집에 가는 길에 어디에 잠깐 들르는 것을 좋아하나요? 이유도 말해 주세요.', '장소와 들르는 상황을 함께 말해 보세요.'),
    ('prompt-preference-2322', 'What card game do you like to play casually, and when do you play it?', '가볍게 즐기는 카드게임은 무엇인가요? 언제 하나요?', '게임 이름과 함께 하는 상황을 말해 보세요.'),
    ('prompt-preference-2323', 'What kind of YouTube video do you watch for fun, and why?', '재미로 어떤 유튜브 영상을 보나요? 이유도 말해 주세요.', '영상 주제와 보는 상황을 함께 말해 보세요.'),
    ('prompt-preference-2332', 'What do you usually do while waiting in line, and why does it help?', '줄을 서서 기다릴 때 보통 무엇을 하나요? 그것이 왜 도움이 되나요?', '기다리는 상황과 지루함을 줄이는 행동을 함께 말해 보세요.'),
    ('prompt-preference-2334', 'What simple activity do you like to do with a friend at home?', '친구와 집에서 어떤 간단한 활동을 하는 것을 좋아하나요?', '활동 이름과 함께하면 좋은 이유를 말해 보세요.'),
    ('prompt-preference-2335', 'What hobby do you like to start on a quiet evening at home?', '조용한 저녁에 집에서 어떤 취미를 시작하는 것을 좋아하나요?', '취미 이름과 저녁에 잘 맞는 이유를 함께 말해 보세요.'),
    ('prompt-preference-2504', 'What drink do you like to carry on a walk, and why?', '산책할 때 어떤 음료를 들고 가는 것을 좋아하나요? 이유도 말해 주세요.', '음료 이름과 산책 중 도움이 되는 이유를 말해 보세요.'),
    ('prompt-preference-2505', 'What juice do you like to drink with lunch, and why?', '점심과 함께 어떤 주스를 마시는 것을 좋아하나요? 이유도 말해 주세요.', '주스 맛과 점심에 잘 어울리는 이유를 말해 보세요.'),
    ('prompt-preference-2506', 'What fruit do you like to add to water, and why?', '물에 어떤 과일을 넣는 것을 좋아하나요? 이유도 말해 주세요.', '과일 이름과 맛이나 기분이 달라지는 점을 말해 보세요.'),
    ('prompt-preference-2507', 'What bottle do you like to carry around, and why?', '외출할 때 어떤 물병을 들고 다니는 것을 좋아하나요? 이유도 말해 주세요.', '물병의 크기나 들고 다니기 편한 점을 말해 보세요.'),
    ('prompt-preference-2508', 'What cold drink do you like on a hot day, and why?', '더운 날 어떤 차가운 음료를 좋아하나요? 이유도 말해 주세요.', '음료 이름과 더운 날 시원하게 느껴지는 이유를 말해 보세요.'),
    ('prompt-preference-2509', 'What drink do you like to keep cold in summer, and why?', '여름에 차갑게 보관해 두고 싶은 음료는 무엇인가요? 이유도 말해 주세요.', '음료 이름과 차갑게 마시면 좋은 이유를 말해 보세요.'),
    ('prompt-preference-2510', 'What drink do you sip while studying, and why?', '공부할 때 어떤 음료를 조금씩 마시나요? 이유도 말해 주세요.', '음료 이름과 집중하거나 쉬는 데 도움이 되는 이유를 말해 보세요.'),
    ('prompt-preference-2514', 'What bottle feels easy to hold, and when do you use it?', '손에 잡기 쉬운 물병은 어떤 것인가요? 언제 사용하나요?', '모양보다 실제로 들고 다니는 상황과 편한 이유를 말해 보세요.'),
    ('prompt-preference-2520', 'What keychain do you use every day, and why?', '매일 사용하는 키링은 무엇인가요? 이유도 말해 주세요.', '키링에 달린 물건이나 찾기 쉬운 이유를 말해 보세요.'),
    ('prompt-preference-2527', 'When do you carry a portable charger, and why?', '보조배터리는 언제 들고 다니나요? 이유도 말해 주세요.', '배터리가 필요한 상황과 안심되는 이유를 말해 보세요.'),
    ('prompt-preference-2529', 'What bag do you use on rainy days, and why?', '비 오는 날 어떤 가방을 사용하나요? 이유도 말해 주세요.', '젖지 않는 점이나 들고 다니기 편한 점을 말해 보세요.'),
    ('prompt-preference-2534', 'Where do you use a wall hook at home, and what do you hang on it?', '집에서 벽걸이 후크를 어디에 쓰나요? 무엇을 걸어 두나요?', '후크 위치와 걸어 두는 물건을 함께 말해 보세요.'),
    ('prompt-preference-2540', 'What do you label at home, and why is it useful?', '집에서 무엇에 라벨을 붙이나요? 왜 유용한가요?', '라벨을 붙이는 물건과 찾기 쉬워지는 이유를 말해 보세요.'),
    ('prompt-preference-2542', 'How do you reuse a shoe box at home?', '집에서 신발 상자를 어떻게 다시 사용하나요?', '무엇을 넣어 두는지와 정리에 도움이 되는 이유를 말해 보세요.'),
    ('prompt-preference-2543', 'Where do you keep cables at home, and why?', '집에서 케이블을 어디에 보관하나요? 이유도 말해 주세요.', '보관 장소와 엉키지 않거나 찾기 쉬운 이유를 말해 보세요.'),
    ('prompt-preference-2544', 'What do you keep in a towel basket, and where do you put it?', '수건 바구니에는 무엇을 넣고 어디에 두나요?', '넣어 두는 수건이나 물건과 두는 장소를 함께 말해 보세요.'),
    ('prompt-preference-2557', 'Why do you keep a charger by your bed?', '침대 옆에 충전기를 두는 이유는 무엇인가요?', '언제 충전하는지와 편한 이유를 함께 말해 보세요.'),
    ('prompt-preference-2562', 'What food container do you keep in the fridge, and what do you put in it?', '냉장고에 어떤 음식 용기를 두나요? 무엇을 담나요?', '담는 음식과 보관하기 좋은 이유를 말해 보세요.'),
    ('prompt-preference-2564', 'What spoon do you use for soup, and why?', '국이나 수프를 먹을 때 어떤 숟가락을 사용하나요? 이유도 말해 주세요.', '숟가락의 크기나 먹기 편한 이유를 말해 보세요.'),
    ('prompt-preference-2565', 'What chopsticks do you use at home, and why?', '집에서 어떤 젓가락을 사용하나요? 이유도 말해 주세요.', '잡기 편한 점이나 자주 쓰는 이유를 말해 보세요.'),
    ('prompt-preference-2571', 'What container do you use for fruit, and why?', '과일을 담을 때 어떤 용기를 사용하나요? 이유도 말해 주세요.', '과일을 보관하거나 먹기 편한 이유를 말해 보세요.'),
    ('prompt-preference-2573', 'What lunch box do you use on a busy day, and why?', '바쁜 날 어떤 도시락통을 사용하나요? 이유도 말해 주세요.', '빨리 챙기기 쉬운 점이나 들고 다니기 편한 점을 말해 보세요.'),
    ('prompt-preference-2574', 'When do you take a thermos with you, and what do you put in it?', '보온병은 언제 들고 나가나요? 무엇을 담나요?', '들고 나가는 상황과 담는 음료를 함께 말해 보세요.'),
    ('prompt-routine-2004', 'What do you do to get ready faster in the morning?', '아침에 더 빨리 준비하려고 무엇을 하나요?', '아침 행동 하나를 말하고, 시간이 줄어드는 이유를 덧붙여 보세요.'),
    ('prompt-routine-2019', 'What do you do to make moving from one place to another easier?', '한 장소에서 다른 장소로 이동할 때 더 쉽게 하려고 무엇을 하나요?', '이동 전후의 행동과 편해지는 이유를 말해 보세요.'),
    ('prompt-routine-2034', 'What do you do during a short break so you can rest quickly?', '짧은 휴식 시간에 빨리 쉬려고 무엇을 하나요?', '짧게 하는 행동과 몸이나 마음이 편해지는 이유를 말해 보세요.'),
    ('prompt-routine-2050', 'What do you choose for a quick lunch or snack, and why?', '간단한 점심이나 간식으로 무엇을 고르나요? 이유도 말해 주세요.', '음식이나 간식 이름과 빨리 먹기 좋은 이유를 말해 보세요.'),
    ('prompt-routine-2064', 'What do you do first when you come home, and why?', '집에 오면 무엇을 먼저 하나요? 이유도 말해 주세요.', '첫 행동과 집에 온 느낌이 드는 이유를 말해 보세요.'),
    ('prompt-routine-2079', 'What small chore do you do first at home, and why?', '집에서 어떤 작은 집안일을 먼저 하나요? 이유도 말해 주세요.', '집안일 하나와 먼저 하는 이유를 말해 보세요.'),
    ('prompt-routine-2095', 'What do you do to rest in the evening, and why?', '저녁에 쉬기 위해 무엇을 하나요? 이유도 말해 주세요.', '쉬는 행동과 저녁에 잘 맞는 이유를 말해 보세요.'),
    ('prompt-routine-2112', 'What do you do at home on the weekend, and why do you like it?', '주말에 집에서 무엇을 하나요? 왜 좋아하나요?', '주말 활동과 집에서 하기 좋은 이유를 함께 말해 보세요.'),
    ('prompt-routine-2124', 'What phone feature do you use often, and why?', '자주 사용하는 휴대폰 기능은 무엇인가요? 이유도 말해 주세요.', '기능 하나를 고르고 언제 도움이 되는지 말해 보세요.'),
    ('prompt-routine-2403', 'What do you prepare when the weather changes, and why?', '날씨가 바뀔 때 무엇을 준비하나요? 이유도 말해 주세요.', '옷, 우산, 음료처럼 준비하는 것과 이유를 말해 보세요.'),
    ('prompt-routine-2418', 'What do you do to finish a quick store errand faster?', '가게에 잠깐 들를 때 더 빨리 끝내려고 무엇을 하나요?', '사는 것, 결제, 동선 중 하나를 말하고 왜 빨라지는지 덧붙여 보세요.'),
    ('prompt-routine-2433', 'What do you do first when you visit a cafe or bakery, and why?', '카페나 빵집에 가면 무엇을 먼저 하나요? 이유도 말해 주세요.', '메뉴 보기, 자리 잡기, 주문하기처럼 첫 행동을 말해 보세요.'),
    ('prompt-routine-2448', 'What do you prepare before a walk or light exercise, and why?', '산책이나 가벼운 운동 전에 무엇을 준비하나요? 이유도 말해 주세요.', '신발, 물, 스트레칭처럼 준비하는 것과 이유를 말해 보세요.'),
    ('prompt-routine-2463', 'What do you do to get ready for bed more easily, and why?', '잠자리에 들 준비를 더 쉽게 하려고 무엇을 하나요? 이유도 말해 주세요.', '씻기, 정리하기, 알람 맞추기처럼 잠들기 전 행동을 말해 보세요.');

UPDATE prompts p
JOIN prompt_question_polish_076 r ON r.id = p.id
SET p.question_en = r.question_en,
    p.question_ko = r.question_ko,
    p.tip = r.tip
WHERE p.is_active = 1;

DROP TEMPORARY TABLE prompt_question_polish_076;

COMMIT;
