-- Reframe active intro/easy preference prompts around user experience instead of object picking.
-- Keeps routine prompts intact and updates preference-like prompts plus their starter hints.

-- prompt-a-2 | Preference / Quick Meal
UPDATE prompts
SET question_en = 'When do you like to make a quick meal at home, and what do you usually choose?',
    question_ko = '집에서 간단한 음식을 만들고 싶어지는 때는 언제이고, 보통 무엇을 선택하나요?',
    tip = '상황을 먼저 말하고, 그때 고르는 음식과 이유를 덧붙여 보세요.'
WHERE id = 'prompt-a-2';

UPDATE prompt_hint_items
SET content = 'When I need a quick meal at home, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need a quick meal at home, I usually choose fried rice because it is easy.'
WHERE id = 'hint-a-2-1-item-1';

-- prompt-preference-06 | Preference / Movie Genre
UPDATE prompts
SET question_en = 'When you watch a movie, what kind of story do you usually choose, and why does it fit your mood?',
    question_ko = '영화를 볼 때 보통 어떤 분위기의 이야기를 고르고, 왜 그때의 기분과 잘 맞나요?',
    tip = '영화를 보는 상황과 고르는 장르의 이유를 연결해 보세요.'
WHERE id = 'prompt-preference-06';

UPDATE prompt_hint_items
SET content = 'When I watch a movie, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I watch a movie, I usually choose comedy because it helps me relax.'
WHERE id = 'hint-pref-06-1-item-1';

-- prompt-preference-11 | Preference / Place to Relax
UPDATE prompts
SET question_en = 'When you need a break, where do you like to relax, and why does that place feel comfortable?',
    question_ko = '쉬고 싶을 때 어디에서 쉬는 것을 좋아하고, 왜 그곳이 편안하게 느껴지나요?',
    tip = '쉬고 싶은 상황과 장소의 느낌을 함께 말해 보세요.'
WHERE id = 'prompt-preference-11';

UPDATE prompt_hint_items
SET content = 'When I need a break, I like to relax ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need a break, I like to relax in my room because it is quiet.'
WHERE id = 'hint-pref-11-1-item-1';

-- prompt-preference-16 | Preference / Season
UPDATE prompts
SET question_en = 'What do you like to do during the season you like most, and why does that season feel good to you?',
    question_ko = '가장 좋아하는 계절에는 무엇을 하는 것을 좋아하고, 왜 그 계절이 좋게 느껴지나요?',
    tip = '계절 자체보다 그 계절에 하는 경험을 말해 보세요.'
WHERE id = 'prompt-preference-16';

UPDATE prompt_hint_items
SET content = 'During the season I like most, I like to ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'During the season I like most, I like to take walks because the weather feels nice.'
WHERE id = 'hint-pref-16-1-item-1';

-- prompt-preference-21 | Preference / Music Genre
UPDATE prompts
SET question_en = 'When do you like to listen to music, and what kind of music fits that moment?',
    question_ko = '언제 음악을 듣는 것을 좋아하고, 그 순간에는 어떤 음악이 잘 맞나요?',
    tip = '음악을 듣는 상황과 그때 어울리는 분위기를 연결해 보세요.'
WHERE id = 'prompt-preference-21';

UPDATE prompt_hint_items
SET content = 'When I listen to music, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I listen to music, I usually choose calm songs because they help me focus.'
WHERE id = 'hint-pref-21-1-item-1';

-- prompt-preference-26 | Preference / Cafe Drink
UPDATE prompts
SET question_en = 'When do you like to order a cafe drink, and what kind of drink fits that moment?',
    question_ko = '언제 카페 음료를 주문하고 싶고, 그 순간에는 어떤 음료가 잘 맞나요?',
    tip = '카페에 가는 상황과 음료 선택 이유를 말해 보세요.'
WHERE id = 'prompt-preference-26';

UPDATE prompt_hint_items
SET content = 'When I order a cafe drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I order a cafe drink, I usually choose iced latte because it feels refreshing.'
WHERE id = 'hint-pref-26-1-item-1';

-- prompt-preference-31 | Preference / Book Genre
UPDATE prompts
SET question_en = 'When you read for fun, what kind of book do you usually choose, and why?',
    question_ko = '재미로 책을 읽을 때 보통 어떤 종류의 책을 고르고, 왜 그렇게 고르나요?',
    tip = '책을 읽는 상황과 장르 선택 이유를 연결해 보세요.'
WHERE id = 'prompt-preference-31';

UPDATE prompt_hint_items
SET content = 'When I read for fun, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I read for fun, I usually choose mysteries because they keep me curious.'
WHERE id = 'hint-pref-31-1-item-1';

-- prompt-preference-36 | Preference / Dessert
UPDATE prompts
SET question_en = 'When do you like to eat dessert, and what makes it feel special?',
    question_ko = '언제 디저트를 먹고 싶고, 그 순간에 무엇이 특별하게 느껴지나요?',
    tip = '디저트를 먹는 상황과 기분을 함께 말해 보세요.'
WHERE id = 'prompt-preference-36';

UPDATE prompt_hint_items
SET content = 'When I eat dessert, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I eat dessert, I usually choose cake because it feels special.'
WHERE id = 'hint-pref-36-1-item-1';

-- prompt-preference-41 | Preference / Way to Exercise
UPDATE prompts
SET question_en = 'When do you like to exercise, and what kind of exercise feels good for you?',
    question_ko = '언제 운동하고 싶고, 어떤 운동이 나에게 잘 맞나요?',
    tip = '운동하는 상황과 몸이나 기분의 변화를 말해 보세요.'
WHERE id = 'prompt-preference-41';

UPDATE prompt_hint_items
SET content = 'When I exercise, I like to ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I exercise, I like to walk because it feels simple and calm.'
WHERE id = 'hint-pref-41-1-item-1';

-- prompt-preference-46 | Preference / Study Spot
UPDATE prompts
SET question_en = 'When do you need to focus, where do you like to study, and why?',
    question_ko = '집중해야 할 때 어디에서 공부하는 것을 좋아하고, 왜 그곳이 도움이 되나요?',
    tip = '공부하는 상황과 장소가 주는 도움을 말해 보세요.'
WHERE id = 'prompt-preference-46';

UPDATE prompt_hint_items
SET content = 'When I need to focus, I study ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need to focus, I study at my desk because it feels organized.'
WHERE id = 'hint-pref-46-1-item-1';

-- prompt-preference-1101 | Preference / Weekday Breakfast Menu
UPDATE prompts
SET question_en = 'Think about the weekday breakfast you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1101';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-1101-1-item-1';

-- prompt-preference-1102 | Preference / Summer Fruit
UPDATE prompts
SET question_en = 'Think about the summer fruit you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1102';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-1102-1-item-1';

-- prompt-preference-1103 | Preference / Rainy Day Drink
UPDATE prompts
SET question_en = 'Think about the rainy-day drink you like. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1103';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-1103-1-item-1';

-- prompt-preference-1104 | Preference / Phone Case Style
UPDATE prompts
SET question_en = 'Think about the phone case style you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1104';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-1104-1-item-1';

-- prompt-preference-1105 | Preference / Notebook Type
UPDATE prompts
SET question_en = 'Think about the notebook type you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1105';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-1105-1-item-1';

-- prompt-preference-1106 | Preference / Place to Read
UPDATE prompts
SET question_en = 'Think about a place you like to read. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1106';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-1106-1-item-1';

-- prompt-preference-1107 | Preference / Kind of Soup
UPDATE prompts
SET question_en = 'Think about the kind of soup you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1107';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-1107-1-item-1';

-- prompt-preference-1108 | Preference / Type of Bag
UPDATE prompts
SET question_en = 'Think about the type of bag you like. When would you carry or use it, and how would it make your day easier?',
    question_ko = '매일 들고 다니는 물건을 떠올려 보세요. 언제 그것을 쓰거나 챙기는지, 그리고 하루를 어떻게 편하게 해 주는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1108';

UPDATE prompt_hint_items
SET content = 'When I go out, I carry or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I carry a small pouch because it keeps my things together.'
WHERE id = 'hint-preference-1108-1-item-1';

-- prompt-preference-1109 | Preference / Board Game
UPDATE prompts
SET question_en = 'Think about the board game you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1109';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-1109-1-item-1';

-- prompt-preference-1110 | Preference / Way to Study Vocabulary
UPDATE prompts
SET question_en = 'When do you study vocabulary, and what method helps you remember words?',
    question_ko = '언제 단어를 공부하고, 어떤 방법이 단어를 기억하는 데 도움이 되나요?',
    tip = '공부하는 시간과 기억에 도움이 되는 방법을 연결해 보세요.'
WHERE id = 'prompt-preference-1110';

UPDATE prompt_hint_items
SET content = 'When I study vocabulary, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study vocabulary, I usually write example sentences because they help me remember.'
WHERE id = 'hint-preference-1110-1-item-1';

-- prompt-preference-1111 | Preference / Flower Scent
UPDATE prompts
SET question_en = 'Think about the flower scent you like. When would you use it, and how would it make you feel?',
    question_ko = '좋아하는 관리 제품이나 향을 떠올려 보세요. 언제 그것을 쓰는지, 그리고 그때 어떤 느낌이 드는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1111';

UPDATE prompt_hint_items
SET content = 'When I get ready or rest, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I get ready or rest, I use hand cream because it feels gentle.'
WHERE id = 'hint-preference-1111-1-item-1';

-- prompt-preference-1112 | Preference / Seat on the Bus
UPDATE prompts
SET question_en = 'Think about the seat on the bus you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1112';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-1112-1-item-1';

-- prompt-preference-1113 | Preference / Weather for Walking
UPDATE prompts
SET question_en = 'When do you like to walk outside, and what kind of weather makes the walk feel better?',
    question_ko = '언제 밖에서 걷는 것을 좋아하고, 어떤 날씨가 산책을 더 좋게 만들어 주나요?',
    tip = '걷는 상황과 날씨가 주는 느낌을 함께 말해 보세요.'
WHERE id = 'prompt-preference-1113';

UPDATE prompt_hint_items
SET content = 'When I walk outside, I like ... weather because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I walk outside, I like cool weather because it feels comfortable.'
WHERE id = 'hint-preference-1113-1-item-1';

-- prompt-preference-1114 | Preference / Type of Sandwich
UPDATE prompts
SET question_en = 'Think about the type of sandwich you like. When would you use or enjoy it, and why would it fit that moment?',
    question_ko = '좋아하는 대상을 떠올려 보세요. 언제 그것을 쓰거나 즐기는지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1114';

UPDATE prompt_hint_items
SET content = 'When I ..., I like ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I have free time, I like this because it feels useful.'
WHERE id = 'hint-preference-1114-1-item-1';

-- prompt-preference-1115 | Preference / Kitchen Tool
UPDATE prompts
SET question_en = 'Think about the kitchen tool you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1115';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-1115-1-item-1';

-- prompt-preference-1116 | Preference / Exercise Class
UPDATE prompts
SET question_en = 'When do you like to join an exercise class, and what kind of class helps you keep going?',
    question_ko = '언제 운동 수업에 참여하고 싶고, 어떤 수업이 꾸준히 하도록 도와주나요?',
    tip = '운동 수업을 듣는 상황과 지속하는 이유를 말해 보세요.'
WHERE id = 'prompt-preference-1116';

UPDATE prompt_hint_items
SET content = 'When I join an exercise class, I like ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I join an exercise class, I like yoga because it feels calm.'
WHERE id = 'hint-preference-1116-1-item-1';

-- prompt-preference-1117 | Preference / Online Creator
UPDATE prompts
SET question_en = 'Think about the online creator you like. When would you use or enjoy it, and why would it fit that moment?',
    question_ko = '좋아하는 대상을 떠올려 보세요. 언제 그것을 쓰거나 즐기는지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1117';

UPDATE prompt_hint_items
SET content = 'When I ..., I like ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I have free time, I like this because it feels useful.'
WHERE id = 'hint-preference-1117-1-item-1';

-- prompt-preference-1118 | Preference / Break Time Snack
UPDATE prompts
SET question_en = 'Think about the snack for work or study breaks you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1118';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-1118-1-item-1';

-- prompt-preference-1119 | Preference / Type of Pen
UPDATE prompts
SET question_en = 'Think about the type of pen you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1119';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-1119-1-item-1';

-- prompt-preference-1120 | Preference / Bakery Item
UPDATE prompts
SET question_en = 'Think about the bakery item you like. When would you use or enjoy it, and why would it fit that moment?',
    question_ko = '좋아하는 대상을 떠올려 보세요. 언제 그것을 쓰거나 즐기는지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1120';

UPDATE prompt_hint_items
SET content = 'When I ..., I like ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I have free time, I like this because it feels useful.'
WHERE id = 'hint-preference-1120-1-item-1';

-- prompt-preference-1121 | Preference / Movie Snack
UPDATE prompts
SET question_en = 'Think about the movie snack you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1121';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-1121-1-item-1';

-- prompt-preference-1122 | Preference / Travel Souvenir
UPDATE prompts
SET question_en = 'Think about the travel souvenir you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1122';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-1122-1-item-1';

-- prompt-preference-1123 | Preference / Candle Scent
UPDATE prompts
SET question_en = 'Think about the candle scent you like. When would you use it, and how would it make you feel?',
    question_ko = '좋아하는 관리 제품이나 향을 떠올려 보세요. 언제 그것을 쓰는지, 그리고 그때 어떤 느낌이 드는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1123';

UPDATE prompt_hint_items
SET content = 'When I get ready or rest, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I get ready or rest, I use hand cream because it feels gentle.'
WHERE id = 'hint-preference-1123-1-item-1';

-- prompt-preference-1124 | Preference / Way to Organize Photos
UPDATE prompts
SET question_en = 'Think about a way you like to organize photos. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1124';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-1124-1-item-1';

-- prompt-preference-1125 | Preference / Kind of Tea
UPDATE prompts
SET question_en = 'Think about the kind of tea you like. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1125';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-1125-1-item-1';

-- prompt-preference-1126 | Preference / Light Jacket
UPDATE prompts
SET question_en = 'Think about the light jacket you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-1126';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-1126-1-item-1';

-- prompt-preference-2201 | Intro Preference / Breakfast and Simple Meals
UPDATE prompts
SET question_en = 'Think about the kind of bread for breakfast you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2201';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2201-1-item-1';

-- prompt-preference-2202 | Intro Preference / Breakfast and Simple Meals
UPDATE prompts
SET question_en = 'Think about the fried eggs you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2202';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2202-1-item-1';

-- prompt-preference-2203 | Intro Preference / Breakfast and Simple Meals
UPDATE prompts
SET question_en = 'Think about a fruit you like to eat in the morning. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2203';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2203-1-item-1';

-- prompt-preference-2204 | Intro Preference / Breakfast and Simple Meals
UPDATE prompts
SET question_en = 'Think about the yogurt topping you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2204';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2204-1-item-1';

-- prompt-preference-2205 | Intro Preference / Breakfast and Simple Meals
UPDATE prompts
SET question_en = 'Think about the type of cereal you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2205';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2205-1-item-1';

-- prompt-preference-2206 | Intro Preference / Breakfast and Simple Meals
UPDATE prompts
SET question_en = 'Think about the jam flavor you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2206';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2206-1-item-1';

-- prompt-preference-2207 | Intro Preference / Breakfast and Simple Meals
UPDATE prompts
SET question_en = 'Think about the toast topping you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2207';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2207-1-item-1';

-- prompt-preference-2208 | Intro Preference / Breakfast and Simple Meals
UPDATE prompts
SET question_en = 'Think about the simple noodle dish you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2208';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2208-1-item-1';

-- prompt-preference-2209 | Intro Preference / Breakfast and Simple Meals
UPDATE prompts
SET question_en = 'Think about a side dish you like to pack in a lunchbox. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2209';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2209-1-item-1';

-- prompt-preference-2210 | Intro Preference / Breakfast and Simple Meals
UPDATE prompts
SET question_en = 'Think about a simple meal you like to make for yourself. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2210';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2210-1-item-1';

-- prompt-preference-2211 | Intro Preference / Breakfast and Simple Meals
UPDATE prompts
SET question_en = 'Think about a snack you like to eat with milk. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2211';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2211-1-item-1';

-- prompt-preference-2212 | Intro Preference / Breakfast and Simple Meals
UPDATE prompts
SET question_en = 'Think about a food you like to eat when you are in a hurry. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2212';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2212-1-item-1';

-- prompt-preference-2213 | Intro Preference / Breakfast and Simple Meals
UPDATE prompts
SET question_en = 'Think about the rice bowl topping you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2213';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2213-1-item-1';

-- prompt-preference-2214 | Intro Preference / Breakfast and Simple Meals
UPDATE prompts
SET question_en = 'Think about the porridge for a quiet morning you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2214';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2214-1-item-1';

-- prompt-preference-2215 | Intro Preference / Breakfast and Simple Meals
UPDATE prompts
SET question_en = 'Think about the quick meal for a late morning you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2215';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2215-1-item-1';

-- prompt-preference-2216 | Intro Preference / Snacks and Sweets
UPDATE prompts
SET question_en = 'Think about the cookie flavor you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2216';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2216-1-item-1';

-- prompt-preference-2217 | Intro Preference / Snacks and Sweets
UPDATE prompts
SET question_en = 'Think about the chip flavor you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2217';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2217-1-item-1';

-- prompt-preference-2218 | Intro Preference / Snacks and Sweets
UPDATE prompts
SET question_en = 'Think about the ice cream flavor you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2218';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2218-1-item-1';

-- prompt-preference-2219 | Intro Preference / Snacks and Sweets
UPDATE prompts
SET question_en = 'Think about the kind of chocolate bar you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2219';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2219-1-item-1';

-- prompt-preference-2220 | Intro Preference / Snacks and Sweets
UPDATE prompts
SET question_en = 'Think about the candy flavor you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2220';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2220-1-item-1';

-- prompt-preference-2221 | Intro Preference / Snacks and Sweets
UPDATE prompts
SET question_en = 'Think about the snack from a convenience store you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2221';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2221-1-item-1';

-- prompt-preference-2222 | Intro Preference / Snacks and Sweets
UPDATE prompts
SET question_en = 'Think about the type of cracker you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2222';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2222-1-item-1';

-- prompt-preference-2223 | Intro Preference / Snacks and Sweets
UPDATE prompts
SET question_en = 'Think about the popcorn flavor you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2223';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2223-1-item-1';

-- prompt-preference-2224 | Intro Preference / Snacks and Sweets
UPDATE prompts
SET question_en = 'Think about a sweet bread you like to grab on the go. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2224';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2224-1-item-1';

-- prompt-preference-2225 | Intro Preference / Snacks and Sweets
UPDATE prompts
SET question_en = 'Think about the yogurt drink flavor you like. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2225';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2225-1-item-1';

-- prompt-preference-2226 | Intro Preference / Snacks and Sweets
UPDATE prompts
SET question_en = 'Think about the fruit candy you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2226';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2226-1-item-1';

-- prompt-preference-2227 | Intro Preference / Snacks and Sweets
UPDATE prompts
SET question_en = 'Think about the late-night snack you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2227';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2227-1-item-1';

-- prompt-preference-2228 | Intro Preference / Snacks and Sweets
UPDATE prompts
SET question_en = 'Think about the salty snack you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2228';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2228-1-item-1';

-- prompt-preference-2229 | Intro Preference / Snacks and Sweets
UPDATE prompts
SET question_en = 'Think about the snack with a soft texture you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2229';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2229-1-item-1';

-- prompt-preference-2230 | Intro Preference / Snacks and Sweets
UPDATE prompts
SET question_en = 'Think about the small treat after a long day you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2230';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2230-1-item-1';

-- prompt-preference-2231 | Intro Preference / Stationery and Study Tools
UPDATE prompts
SET question_en = 'Think about the type of pencil you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2231';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2231-1-item-1';

-- prompt-preference-2232 | Intro Preference / Stationery and Study Tools
UPDATE prompts
SET question_en = 'Think about the kind of eraser you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2232';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2232-1-item-1';

-- prompt-preference-2233 | Intro Preference / Stationery and Study Tools
UPDATE prompts
SET question_en = 'Think about the highlighter color you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2233';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2233-1-item-1';

-- prompt-preference-2234 | Intro Preference / Stationery and Study Tools
UPDATE prompts
SET question_en = 'Think about the sticky note shape you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2234';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2234-1-item-1';

-- prompt-preference-2235 | Intro Preference / Stationery and Study Tools
UPDATE prompts
SET question_en = 'Think about the planner layout you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2235';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2235-1-item-1';

-- prompt-preference-2236 | Intro Preference / Stationery and Study Tools
UPDATE prompts
SET question_en = 'Think about the bookmark style you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2236';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2236-1-item-1';

-- prompt-preference-2237 | Intro Preference / Stationery and Study Tools
UPDATE prompts
SET question_en = 'Think about the desk organizer you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2237';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2237-1-item-1';

-- prompt-preference-2238 | Intro Preference / Stationery and Study Tools
UPDATE prompts
SET question_en = 'Think about the type of ruler you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2238';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2238-1-item-1';

-- prompt-preference-2239 | Intro Preference / Stationery and Study Tools
UPDATE prompts
SET question_en = 'Think about the file folder color you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2239';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2239-1-item-1';

-- prompt-preference-2240 | Intro Preference / Stationery and Study Tools
UPDATE prompts
SET question_en = 'Think about the small pouch for school or work you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2240';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2240-1-item-1';

-- prompt-preference-2241 | Intro Preference / Stationery and Study Tools
UPDATE prompts
SET question_en = 'Think about the keyboard style you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2241';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2241-1-item-1';

-- prompt-preference-2242 | Intro Preference / Stationery and Study Tools
UPDATE prompts
SET question_en = 'Think about the mouse shape you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2242';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2242-1-item-1';

-- prompt-preference-2243 | Intro Preference / Stationery and Study Tools
UPDATE prompts
SET question_en = 'Think about the desk timer you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2243';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2243-1-item-1';

-- prompt-preference-2244 | Intro Preference / Stationery and Study Tools
UPDATE prompts
SET question_en = 'Think about a way you like to keep papers organized. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2244';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2244-1-item-1';

-- prompt-preference-2245 | Intro Preference / Stationery and Study Tools
UPDATE prompts
SET question_en = 'Think about a study tool you like to keep near your notebook. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2245';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2245-1-item-1';

-- prompt-preference-2246 | Intro Preference / Clothes and Accessories
UPDATE prompts
SET question_en = 'Think about the T-shirt color you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2246';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2246-1-item-1';

-- prompt-preference-2247 | Intro Preference / Clothes and Accessories
UPDATE prompts
SET question_en = 'Think about the hoodie style you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2247';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2247-1-item-1';

-- prompt-preference-2248 | Intro Preference / Clothes and Accessories
UPDATE prompts
SET question_en = 'Think about the sock pattern you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2248';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2248-1-item-1';

-- prompt-preference-2249 | Intro Preference / Clothes and Accessories
UPDATE prompts
SET question_en = 'Think about the pair of sneakers for daily use you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2249';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2249-1-item-1';

-- prompt-preference-2250 | Intro Preference / Clothes and Accessories
UPDATE prompts
SET question_en = 'Think about the hat for sunny days you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2250';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2250-1-item-1';

-- prompt-preference-2251 | Intro Preference / Clothes and Accessories
UPDATE prompts
SET question_en = 'Think about the scarf for winter you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2251';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2251-1-item-1';

-- prompt-preference-2252 | Intro Preference / Clothes and Accessories
UPDATE prompts
SET question_en = 'Think about the watch strap color you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2252';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2252-1-item-1';

-- prompt-preference-2253 | Intro Preference / Clothes and Accessories
UPDATE prompts
SET question_en = 'Think about the pair of room slippers you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2253';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2253-1-item-1';

-- prompt-preference-2254 | Intro Preference / Clothes and Accessories
UPDATE prompts
SET question_en = 'Think about the raincoat style you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2254';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2254-1-item-1';

-- prompt-preference-2255 | Intro Preference / Clothes and Accessories
UPDATE prompts
SET question_en = 'Think about the pajama pattern you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2255';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2255-1-item-1';

-- prompt-preference-2256 | Intro Preference / Clothes and Accessories
UPDATE prompts
SET question_en = 'Think about the hair tie color you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2256';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2256-1-item-1';

-- prompt-preference-2257 | Intro Preference / Clothes and Accessories
UPDATE prompts
SET question_en = 'Think about the umbrella style you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2257';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2257-1-item-1';

-- prompt-preference-2258 | Intro Preference / Clothes and Accessories
UPDATE prompts
SET question_en = 'Think about the everyday jacket material you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2258';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2258-1-item-1';

-- prompt-preference-2259 | Intro Preference / Clothes and Accessories
UPDATE prompts
SET question_en = 'Think about a simple ring or bracelet you like to wear. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2259';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2259-1-item-1';

-- prompt-preference-2260 | Intro Preference / Clothes and Accessories
UPDATE prompts
SET question_en = 'Think about something you like to wear when you want to feel relaxed. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2260';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2260-1-item-1';

-- prompt-preference-2261 | Intro Preference / Home Comfort Items
UPDATE prompts
SET question_en = 'Think about the blanket at home you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2261';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2261-1-item-1';

-- prompt-preference-2262 | Intro Preference / Home Comfort Items
UPDATE prompts
SET question_en = 'Think about the pillow you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2262';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2262-1-item-1';

-- prompt-preference-2263 | Intro Preference / Home Comfort Items
UPDATE prompts
SET question_en = 'Think about the mug you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2263';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2263-1-item-1';

-- prompt-preference-2264 | Intro Preference / Home Comfort Items
UPDATE prompts
SET question_en = 'Think about a bowl you like to use at home. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2264';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2264-1-item-1';

-- prompt-preference-2265 | Intro Preference / Home Comfort Items
UPDATE prompts
SET question_en = 'Think about the lamp in your room you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2265';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2265-1-item-1';

-- prompt-preference-2266 | Intro Preference / Home Comfort Items
UPDATE prompts
SET question_en = 'Think about the water bottle you like. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2266';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2266-1-item-1';

-- prompt-preference-2267 | Intro Preference / Home Comfort Items
UPDATE prompts
SET question_en = 'Think about the desk mat you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2267';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2267-1-item-1';

-- prompt-preference-2268 | Intro Preference / Home Comfort Items
UPDATE prompts
SET question_en = 'Think about the chair cushion you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2268';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2268-1-item-1';

-- prompt-preference-2269 | Intro Preference / Home Comfort Items
UPDATE prompts
SET question_en = 'Think about the wall calendar design you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2269';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2269-1-item-1';

-- prompt-preference-2270 | Intro Preference / Home Comfort Items
UPDATE prompts
SET question_en = 'Think about the small fan for your room you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2270';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2270-1-item-1';

-- prompt-preference-2271 | Intro Preference / Home Comfort Items
UPDATE prompts
SET question_en = 'Think about a mirror you like to use while getting ready. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2271';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2271-1-item-1';

-- prompt-preference-2272 | Intro Preference / Home Comfort Items
UPDATE prompts
SET question_en = 'Think about the storage basket you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2272';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2272-1-item-1';

-- prompt-preference-2273 | Intro Preference / Home Comfort Items
UPDATE prompts
SET question_en = 'Think about a plate you like to use for a quick meal. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2273';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2273-1-item-1';

-- prompt-preference-2274 | Intro Preference / Home Comfort Items
UPDATE prompts
SET question_en = 'Think about the small item in your room that helps you relax you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2274';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2274-1-item-1';

-- prompt-preference-2275 | Intro Preference / Home Comfort Items
UPDATE prompts
SET question_en = 'Think about the small thing on your bedside table you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2275';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2275-1-item-1';

-- prompt-preference-2276 | Intro Preference / Personal Care and Scents
UPDATE prompts
SET question_en = 'Think about the hand cream scent you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2276';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2276-1-item-1';

-- prompt-preference-2277 | Intro Preference / Personal Care and Scents
UPDATE prompts
SET question_en = 'Think about the soap scent you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2277';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2277-1-item-1';

-- prompt-preference-2278 | Intro Preference / Personal Care and Scents
UPDATE prompts
SET question_en = 'Think about the shampoo scent you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2278';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2278-1-item-1';

-- prompt-preference-2279 | Intro Preference / Personal Care and Scents
UPDATE prompts
SET question_en = 'Think about the lip balm flavor or scent you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2279';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2279-1-item-1';

-- prompt-preference-2280 | Intro Preference / Personal Care and Scents
UPDATE prompts
SET question_en = 'Think about the body wash scent you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2280';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2280-1-item-1';

-- prompt-preference-2281 | Intro Preference / Personal Care and Scents
UPDATE prompts
SET question_en = 'Think about the lotion texture you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2281';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2281-1-item-1';

-- prompt-preference-2282 | Intro Preference / Personal Care and Scents
UPDATE prompts
SET question_en = 'Think about the scent of freshly washed towels you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2282';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2282-1-item-1';

-- prompt-preference-2283 | Intro Preference / Personal Care and Scents
UPDATE prompts
SET question_en = 'Think about the scent for bath salts you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2283';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2283-1-item-1';

-- prompt-preference-2284 | Intro Preference / Personal Care and Scents
UPDATE prompts
SET question_en = 'Think about the sunscreen type you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2284';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2284-1-item-1';

-- prompt-preference-2285 | Intro Preference / Personal Care and Scents
UPDATE prompts
SET question_en = 'Think about the type of sheet mask you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2285';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2285-1-item-1';

-- prompt-preference-2286 | Intro Preference / Personal Care and Scents
UPDATE prompts
SET question_en = 'Think about the toothpaste flavor you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2286';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2286-1-item-1';

-- prompt-preference-2287 | Intro Preference / Personal Care and Scents
UPDATE prompts
SET question_en = 'Think about the room spray scent you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2287';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2287-1-item-1';

-- prompt-preference-2288 | Intro Preference / Personal Care and Scents
UPDATE prompts
SET question_en = 'Think about the hair oil scent you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2288';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2288-1-item-1';

-- prompt-preference-2289 | Intro Preference / Personal Care and Scents
UPDATE prompts
SET question_en = 'Think about the laundry detergent scent you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2289';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2289-1-item-1';

-- prompt-preference-2290 | Intro Preference / Personal Care and Scents
UPDATE prompts
SET question_en = 'Before bed, what personal care product do you like to use, and how does it help you relax?',
    question_ko = '잠들기 전에 어떤 관리 제품을 쓰는 것을 좋아하고, 그것이 어떻게 편안하게 해 주나요?',
    tip = '잠들기 전 상황과 제품이 주는 느낌을 함께 말해 보세요.'
WHERE id = 'prompt-preference-2290';

UPDATE prompt_hint_items
SET content = 'Before bed, I like to use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'Before bed, I like to use hand cream because it feels gentle.'
WHERE id = 'hint-preference-2290-1-item-1';

-- prompt-preference-2291 | Intro Preference / Digital Features
UPDATE prompts
SET question_en = 'Think about the phone wallpaper style you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2291';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2291-1-item-1';

-- prompt-preference-2292 | Intro Preference / Digital Features
UPDATE prompts
SET question_en = 'Think about the alarm sound you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2292';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2292-1-item-1';

-- prompt-preference-2293 | Intro Preference / Digital Features
UPDATE prompts
SET question_en = 'Think about the calendar view on your phone you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2293';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2293-1-item-1';

-- prompt-preference-2294 | Intro Preference / Digital Features
UPDATE prompts
SET question_en = 'Think about the quick capture feature in a note-taking app you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2294';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2294-1-item-1';

-- prompt-preference-2295 | Intro Preference / Digital Features
UPDATE prompts
SET question_en = 'Think about the messaging sticker style you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2295';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2295-1-item-1';

-- prompt-preference-2296 | Intro Preference / Digital Features
UPDATE prompts
SET question_en = 'Think about the music app feature for making a queue you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2296';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2296-1-item-1';

-- prompt-preference-2297 | Intro Preference / Digital Features
UPDATE prompts
SET question_en = 'Think about the photo filter you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2297';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2297-1-item-1';

-- prompt-preference-2298 | Intro Preference / Digital Features
UPDATE prompts
SET question_en = 'Think about the map app feature for checking your route or arrival time you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2298';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2298-1-item-1';

-- prompt-preference-2299 | Intro Preference / Digital Features
UPDATE prompts
SET question_en = 'Think about the weather app view you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2299';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2299-1-item-1';

-- prompt-preference-2300 | Intro Preference / Digital Features
UPDATE prompts
SET question_en = 'Think about the keyboard theme you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2300';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2300-1-item-1';

-- prompt-preference-2301 | Intro Preference / Digital Features
UPDATE prompts
SET question_en = 'Think about the shortcut button on your phone you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2301';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2301-1-item-1';

-- prompt-preference-2302 | Intro Preference / Digital Features
UPDATE prompts
SET question_en = 'Think about the playlist cover style you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2302';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2302-1-item-1';

-- prompt-preference-2303 | Intro Preference / Digital Features
UPDATE prompts
SET question_en = 'Think about the reminder app feature for repeating or snoozing reminders you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2303';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2303-1-item-1';

-- prompt-preference-2304 | Intro Preference / Digital Features
UPDATE prompts
SET question_en = 'Think about the phone widget you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2304';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2304-1-item-1';

-- prompt-preference-2305 | Intro Preference / Digital Features
UPDATE prompts
SET question_en = 'Think about an app feature you like to use in the morning. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2305';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2305-1-item-1';

-- prompt-preference-2306 | Intro Preference / Nearby Places
UPDATE prompts
SET question_en = 'Think about the bench in a small park you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2306';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2306-1-item-1';

-- prompt-preference-2307 | Intro Preference / Nearby Places
UPDATE prompts
SET question_en = 'Think about the aisle in a convenience store you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2307';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2307-1-item-1';

-- prompt-preference-2308 | Intro Preference / Nearby Places
UPDATE prompts
SET question_en = 'Think about a street near your home you like to walk on. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2308';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2308-1-item-1';

-- prompt-preference-2309 | Intro Preference / Nearby Places
UPDATE prompts
SET question_en = 'Think about the flower stand near your home you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2309';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2309-1-item-1';

-- prompt-preference-2310 | Intro Preference / Nearby Places
UPDATE prompts
SET question_en = 'Think about the bus stop near your home you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2310';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2310-1-item-1';

-- prompt-preference-2311 | Intro Preference / Nearby Places
UPDATE prompts
SET question_en = 'Think about the seat near a train window you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2311';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2311-1-item-1';

-- prompt-preference-2312 | Intro Preference / Nearby Places
UPDATE prompts
SET question_en = 'Think about the fruit stand near home you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2312';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2312-1-item-1';

-- prompt-preference-2313 | Intro Preference / Nearby Places
UPDATE prompts
SET question_en = 'Think about a path you like to the grocery store. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2313';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2313-1-item-1';

-- prompt-preference-2314 | Intro Preference / Nearby Places
UPDATE prompts
SET question_en = 'Think about a part of a market you like to visit first. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2314';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2314-1-item-1';

-- prompt-preference-2315 | Intro Preference / Nearby Places
UPDATE prompts
SET question_en = 'Think about the vending machine near your home you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2315';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2315-1-item-1';

-- prompt-preference-2316 | Intro Preference / Nearby Places
UPDATE prompts
SET question_en = 'Think about the playground bench you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2316';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2316-1-item-1';

-- prompt-preference-2317 | Intro Preference / Nearby Places
UPDATE prompts
SET question_en = 'Think about a nearby place you like to watch the sunset. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2317';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2317-1-item-1';

-- prompt-preference-2318 | Intro Preference / Nearby Places
UPDATE prompts
SET question_en = 'Think about a place near a window you like to sit. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2318';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2318-1-item-1';

-- prompt-preference-2319 | Intro Preference / Nearby Places
UPDATE prompts
SET question_en = 'Think about a small place you like to stop by on the way home. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2319';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2319-1-item-1';

-- prompt-preference-2320 | Intro Preference / Nearby Places
UPDATE prompts
SET question_en = 'Think about the nearby place when you want a little fresh air you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2320';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2320-1-item-1';

-- prompt-preference-2321 | Intro Preference / Light Leisure
UPDATE prompts
SET question_en = 'Think about the kind of simple puzzle you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2321';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2321-1-item-1';

-- prompt-preference-2322 | Intro Preference / Light Leisure
UPDATE prompts
SET question_en = 'Think about a card game you like to play casually. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2322';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2322-1-item-1';

-- prompt-preference-2323 | Intro Preference / Light Leisure
UPDATE prompts
SET question_en = 'Think about a type of YouTube video you like to watch for fun. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2323';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2323-1-item-1';

-- prompt-preference-2324 | Intro Preference / Light Leisure
UPDATE prompts
SET question_en = 'Think about the podcast topic you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2324';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2324-1-item-1';

-- prompt-preference-2325 | Intro Preference / Light Leisure
UPDATE prompts
SET question_en = 'Think about the coloring tool you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2325';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2325-1-item-1';

-- prompt-preference-2326 | Intro Preference / Light Leisure
UPDATE prompts
SET question_en = 'Think about the craft material you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2326';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2326-1-item-1';

-- prompt-preference-2327 | Intro Preference / Light Leisure
UPDATE prompts
SET question_en = 'Think about the simple photo edit you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2327';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2327-1-item-1';

-- prompt-preference-2328 | Intro Preference / Light Leisure
UPDATE prompts
SET question_en = 'Think about the quick activity for a ten-minute break you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2328';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2328-1-item-1';

-- prompt-preference-2329 | Intro Preference / Light Leisure
UPDATE prompts
SET question_en = 'Think about the small hobby for rainy days you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2329';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2329-1-item-1';

-- prompt-preference-2330 | Intro Preference / Light Leisure
UPDATE prompts
SET question_en = 'Think about the relaxing sound you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2330';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2330-1-item-1';

-- prompt-preference-2331 | Intro Preference / Light Leisure
UPDATE prompts
SET question_en = 'Think about the indoor activity on hot days you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2331';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2331-1-item-1';

-- prompt-preference-2332 | Intro Preference / Light Leisure
UPDATE prompts
SET question_en = 'Think about a small thing you like to do while waiting in line. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2332';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2332-1-item-1';

-- prompt-preference-2333 | Intro Preference / Light Leisure
UPDATE prompts
SET question_en = 'Think about the kind of short video for learning something new you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2333';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2333-1-item-1';

-- prompt-preference-2334 | Intro Preference / Light Leisure
UPDATE prompts
SET question_en = 'Think about a simple activity you like to do with a friend at home. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2334';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2334-1-item-1';

-- prompt-preference-2335 | Intro Preference / Light Leisure
UPDATE prompts
SET question_en = 'Think about a hobby you like to start on a quiet evening at home. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2335';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2335-1-item-1';

-- prompt-preference-2501 | Intro Preference / Everyday Drinks and Water Bottles
UPDATE prompts
SET question_en = 'Think about the water bottle for daily use you like. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2501';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2501-1-item-1';

-- prompt-preference-2502 | Intro Preference / Everyday Drinks and Water Bottles
UPDATE prompts
SET question_en = 'Think about the tumbler for refilling during the day you like. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2502';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2502-1-item-1';

-- prompt-preference-2503 | Intro Preference / Everyday Drinks and Water Bottles
UPDATE prompts
SET question_en = 'Think about the sparkling water flavor you like. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2503';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2503-1-item-1';

-- prompt-preference-2504 | Intro Preference / Everyday Drinks and Water Bottles
UPDATE prompts
SET question_en = 'Think about a drink you like to carry on a walk. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2504';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2504-1-item-1';

-- prompt-preference-2505 | Intro Preference / Everyday Drinks and Water Bottles
UPDATE prompts
SET question_en = 'Think about a juice flavor you like to have with lunch. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2505';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2505-1-item-1';

-- prompt-preference-2506 | Intro Preference / Everyday Drinks and Water Bottles
UPDATE prompts
SET question_en = 'Think about a fruit you like to add to water. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2506';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2506-1-item-1';

-- prompt-preference-2507 | Intro Preference / Everyday Drinks and Water Bottles
UPDATE prompts
SET question_en = 'Think about a bottle you like to carry around. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2507';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2507-1-item-1';

-- prompt-preference-2508 | Intro Preference / Everyday Drinks and Water Bottles
UPDATE prompts
SET question_en = 'Think about a drink you like to enjoy with a straw on a hot day. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2508';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2508-1-item-1';

-- prompt-preference-2509 | Intro Preference / Everyday Drinks and Water Bottles
UPDATE prompts
SET question_en = 'Think about a drink you like to keep cold in summer. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2509';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2509-1-item-1';

-- prompt-preference-2510 | Intro Preference / Everyday Drinks and Water Bottles
UPDATE prompts
SET question_en = 'Think about a drink you like to sip during study time. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2510';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2510-1-item-1';

-- prompt-preference-2511 | Intro Preference / Everyday Drinks and Water Bottles
UPDATE prompts
SET question_en = 'Think about the reusable cup for going out you like. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2511';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2511-1-item-1';

-- prompt-preference-2512 | Intro Preference / Everyday Drinks and Water Bottles
UPDATE prompts
SET question_en = 'Think about the drink after light exercise you like. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2512';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2512-1-item-1';

-- prompt-preference-2513 | Intro Preference / Everyday Drinks and Water Bottles
UPDATE prompts
SET question_en = 'Think about the cold drink with ice on a hot day you like. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2513';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2513-1-item-1';

-- prompt-preference-2514 | Intro Preference / Everyday Drinks and Water Bottles
UPDATE prompts
SET question_en = 'Think about a bottle shape that feels comfortable in your hand. When would you choose that bottle, and how would it help you in that moment?',
    question_ko = '손에 잡기 편한 물병 모양을 떠올려 보세요. 언제 그 물병을 고르고, 그 순간에 어떻게 도움이 되나요?',
    tip = '물병의 모양 자체보다 실제로 들고 다니는 상황과 편한 이유를 말해 보세요.'
WHERE id = 'prompt-preference-2514';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2514-1-item-1';

-- prompt-preference-2515 | Intro Preference / Everyday Drinks and Water Bottles
UPDATE prompts
SET question_en = 'Think about the drink when you get home on a warm day you like. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2515';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2515-1-item-1';

-- prompt-preference-2516 | Intro Preference / Bags and Daily Carry Items
UPDATE prompts
SET question_en = 'Think about the backpack for daily use you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2516';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2516-1-item-1';

-- prompt-preference-2517 | Intro Preference / Bags and Daily Carry Items
UPDATE prompts
SET question_en = 'Think about the tote bag for a short trip you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2517';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2517-1-item-1';

-- prompt-preference-2518 | Intro Preference / Bags and Daily Carry Items
UPDATE prompts
SET question_en = 'Think about the small pouch in your bag you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2518';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2518-1-item-1';

-- prompt-preference-2519 | Intro Preference / Bags and Daily Carry Items
UPDATE prompts
SET question_en = 'Think about the wallet for daily use you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2519';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2519-1-item-1';

-- prompt-preference-2520 | Intro Preference / Bags and Daily Carry Items
UPDATE prompts
SET question_en = 'Think about a keychain you like to use every day. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2520';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2520-1-item-1';

-- prompt-preference-2521 | Intro Preference / Bags and Daily Carry Items
UPDATE prompts
SET question_en = 'Think about the bag pocket for carrying a water bottle you like. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2521';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2521-1-item-1';

-- prompt-preference-2522 | Intro Preference / Bags and Daily Carry Items
UPDATE prompts
SET question_en = 'Think about the bag zipper you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2522';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2522-1-item-1';

-- prompt-preference-2523 | Intro Preference / Bags and Daily Carry Items
UPDATE prompts
SET question_en = 'Think about the cardholder you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2523';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2523-1-item-1';

-- prompt-preference-2524 | Intro Preference / Bags and Daily Carry Items
UPDATE prompts
SET question_en = 'Think about the bag strap you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2524';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2524-1-item-1';

-- prompt-preference-2525 | Intro Preference / Bags and Daily Carry Items
UPDATE prompts
SET question_en = 'Think about the everyday bag you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2525';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2525-1-item-1';

-- prompt-preference-2526 | Intro Preference / Bags and Daily Carry Items
UPDATE prompts
SET question_en = 'Think about the foldable shopping bag you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2526';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2526-1-item-1';

-- prompt-preference-2527 | Intro Preference / Bags and Daily Carry Items
UPDATE prompts
SET question_en = 'Think about a portable charger you like to carry. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2527';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2527-1-item-1';

-- prompt-preference-2528 | Intro Preference / Bags and Daily Carry Items
UPDATE prompts
SET question_en = 'Think about the pouch for pens or cables you like. When would that choice be useful for studying or working, and how would it help?',
    question_ko = '좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2528';

UPDATE prompt_hint_items
SET content = 'When I study or work, I use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I study or work, I use sticky notes because they help me remember tasks.'
WHERE id = 'hint-preference-2528-1-item-1';

-- prompt-preference-2529 | Intro Preference / Bags and Daily Carry Items
UPDATE prompts
SET question_en = 'Think about a bag you like to use on rainy days. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2529';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2529-1-item-1';

-- prompt-preference-2530 | Intro Preference / Bags and Daily Carry Items
UPDATE prompts
SET question_en = 'Think about the small bag for a quick trip outside you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2530';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2530-1-item-1';

-- prompt-preference-2531 | Intro Preference / Storage and Organizing Tools
UPDATE prompts
SET question_en = 'Think about the storage box at home you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2531';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2531-1-item-1';

-- prompt-preference-2532 | Intro Preference / Storage and Organizing Tools
UPDATE prompts
SET question_en = 'Think about the hanger type for daily clothes you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2532';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2532-1-item-1';

-- prompt-preference-2533 | Intro Preference / Storage and Organizing Tools
UPDATE prompts
SET question_en = 'Think about the drawer organizer you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2533';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2533-1-item-1';

-- prompt-preference-2534 | Intro Preference / Storage and Organizing Tools
UPDATE prompts
SET question_en = 'Think about a wall hook you like to use at home. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2534';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2534-1-item-1';

-- prompt-preference-2535 | Intro Preference / Storage and Organizing Tools
UPDATE prompts
SET question_en = 'Think about the box for small items you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2535';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2535-1-item-1';

-- prompt-preference-2536 | Intro Preference / Storage and Organizing Tools
UPDATE prompts
SET question_en = 'Think about the cleaning cloth for your desk you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2536';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2536-1-item-1';

-- prompt-preference-2537 | Intro Preference / Storage and Organizing Tools
UPDATE prompts
SET question_en = 'Think about the spray bottle for easy cleaning you like. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2537';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2537-1-item-1';

-- prompt-preference-2538 | Intro Preference / Storage and Organizing Tools
UPDATE prompts
SET question_en = 'Think about the sponge for the kitchen you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2538';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2538-1-item-1';

-- prompt-preference-2539 | Intro Preference / Storage and Organizing Tools
UPDATE prompts
SET question_en = 'Think about the small shelf in your room you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2539';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2539-1-item-1';

-- prompt-preference-2540 | Intro Preference / Storage and Organizing Tools
UPDATE prompts
SET question_en = 'Think about a label you like to organizing. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2540';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2540-1-item-1';

-- prompt-preference-2541 | Intro Preference / Storage and Organizing Tools
UPDATE prompts
SET question_en = 'Think about the organizer for a bathroom drawer you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2541';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2541-1-item-1';

-- prompt-preference-2542 | Intro Preference / Storage and Organizing Tools
UPDATE prompts
SET question_en = 'Think about a shoe box you like to reuse at home. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2542';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2542-1-item-1';

-- prompt-preference-2543 | Intro Preference / Storage and Organizing Tools
UPDATE prompts
SET question_en = 'Think about a box you like to keep cables in. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2543';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2543-1-item-1';

-- prompt-preference-2544 | Intro Preference / Storage and Organizing Tools
UPDATE prompts
SET question_en = 'Think about a basket you like to hold towels. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2544';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2544-1-item-1';

-- prompt-preference-2545 | Intro Preference / Storage and Organizing Tools
UPDATE prompts
SET question_en = 'Think about the hook near the door for bags or keys you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2545';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2545-1-item-1';

-- prompt-preference-2546 | Intro Preference / Small Home Gadgets
UPDATE prompts
SET question_en = 'Think about the phone charger at home you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2546';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2546-1-item-1';

-- prompt-preference-2547 | Intro Preference / Small Home Gadgets
UPDATE prompts
SET question_en = 'Think about the cable length for daily use you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2547';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2547-1-item-1';

-- prompt-preference-2548 | Intro Preference / Small Home Gadgets
UPDATE prompts
SET question_en = 'Think about the small speaker for background music you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2548';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2548-1-item-1';

-- prompt-preference-2549 | Intro Preference / Small Home Gadgets
UPDATE prompts
SET question_en = 'Think about the desk fan for warm days you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2549';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2549-1-item-1';

-- prompt-preference-2550 | Intro Preference / Small Home Gadgets
UPDATE prompts
SET question_en = 'Think about the alarm clock style you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2550';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2550-1-item-1';

-- prompt-preference-2551 | Intro Preference / Small Home Gadgets
UPDATE prompts
SET question_en = 'Think about the phone stand on your desk you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2551';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2551-1-item-1';

-- prompt-preference-2552 | Intro Preference / Small Home Gadgets
UPDATE prompts
SET question_en = 'Think about the bedside lamp you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2552';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2552-1-item-1';

-- prompt-preference-2553 | Intro Preference / Small Home Gadgets
UPDATE prompts
SET question_en = 'Think about the timer for short tasks you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2553';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2553-1-item-1';

-- prompt-preference-2554 | Intro Preference / Small Home Gadgets
UPDATE prompts
SET question_en = 'Think about the compact humidifier you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2554';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2554-1-item-1';

-- prompt-preference-2555 | Intro Preference / Small Home Gadgets
UPDATE prompts
SET question_en = 'Think about the power strip at home you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2555';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2555-1-item-1';

-- prompt-preference-2556 | Intro Preference / Small Home Gadgets
UPDATE prompts
SET question_en = 'Think about the reading lamp you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2556';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2556-1-item-1';

-- prompt-preference-2557 | Intro Preference / Small Home Gadgets
UPDATE prompts
SET question_en = 'Think about a charger you like to keep by your bed. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2557';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2557-1-item-1';

-- prompt-preference-2558 | Intro Preference / Small Home Gadgets
UPDATE prompts
SET question_en = 'Think about the portable fan you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2558';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2558-1-item-1';

-- prompt-preference-2559 | Intro Preference / Small Home Gadgets
UPDATE prompts
SET question_en = 'Think about the tablet stand you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2559';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2559-1-item-1';

-- prompt-preference-2560 | Intro Preference / Small Home Gadgets
UPDATE prompts
SET question_en = 'Think about the clip-on lamp for a desk or bed you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2560';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2560-1-item-1';

-- prompt-preference-2561 | Intro Preference / Kitchen Tools and Food Containers
UPDATE prompts
SET question_en = 'Think about the food container for leftovers you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2561';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2561-1-item-1';

-- prompt-preference-2562 | Intro Preference / Kitchen Tools and Food Containers
UPDATE prompts
SET question_en = 'Think about a food container you like to keep in the fridge. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2562';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2562-1-item-1';

-- prompt-preference-2563 | Intro Preference / Kitchen Tools and Food Containers
UPDATE prompts
SET question_en = 'Think about the food container for lunch you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2563';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2563-1-item-1';

-- prompt-preference-2564 | Intro Preference / Kitchen Tools and Food Containers
UPDATE prompts
SET question_en = 'Think about a spoon you like to use for soup. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2564';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2564-1-item-1';

-- prompt-preference-2565 | Intro Preference / Kitchen Tools and Food Containers
UPDATE prompts
SET question_en = 'Think about a pair of chopsticks you like to use at home. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2565';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2565-1-item-1';

-- prompt-preference-2566 | Intro Preference / Kitchen Tools and Food Containers
UPDATE prompts
SET question_en = 'Think about the small tray for snacks you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2566';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2566-1-item-1';

-- prompt-preference-2567 | Intro Preference / Kitchen Tools and Food Containers
UPDATE prompts
SET question_en = 'Think about the easy-to-wash cutting board you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2567';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2567-1-item-1';

-- prompt-preference-2568 | Intro Preference / Kitchen Tools and Food Containers
UPDATE prompts
SET question_en = 'Think about the kitchen towel you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2568';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2568-1-item-1';

-- prompt-preference-2569 | Intro Preference / Kitchen Tools and Food Containers
UPDATE prompts
SET question_en = 'Think about the kettle at home you like. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2569';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2569-1-item-1';

-- prompt-preference-2570 | Intro Preference / Kitchen Tools and Food Containers
UPDATE prompts
SET question_en = 'Think about the thermos for a warm drink you like. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2570';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2570-1-item-1';

-- prompt-preference-2571 | Intro Preference / Kitchen Tools and Food Containers
UPDATE prompts
SET question_en = 'Think about a container you like to keep fruit in. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2571';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2571-1-item-1';

-- prompt-preference-2572 | Intro Preference / Kitchen Tools and Food Containers
UPDATE prompts
SET question_en = 'Think about the container for small frozen foods you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2572';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2572-1-item-1';

-- prompt-preference-2573 | Intro Preference / Kitchen Tools and Food Containers
UPDATE prompts
SET question_en = 'Think about a lunch box you like to use on a busy day. When would that choice feel comfortable or useful, and why?',
    question_ko = '좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2573';

UPDATE prompt_hint_items
SET content = 'When I go out, I like to wear or use ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I go out, I like to wear a hoodie because it feels comfortable.'
WHERE id = 'hint-preference-2573-1-item-1';

-- prompt-preference-2574 | Intro Preference / Kitchen Tools and Food Containers
UPDATE prompts
SET question_en = 'Think about a thermos you like to take with you when you go out. When would you usually choose it, and how would it help you in that moment?',
    question_ko = '좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2574';

UPDATE prompt_hint_items
SET content = 'When I need something to drink, I usually choose ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I need something to drink, I usually choose iced tea because it feels refreshing.'
WHERE id = 'hint-preference-2574-1-item-1';

-- prompt-preference-2575 | Intro Preference / Kitchen Tools and Food Containers
UPDATE prompts
SET question_en = 'Think about the little container for sauce or snacks you like. When would you usually choose it, and why would it fit that moment?',
    question_ko = '좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.',
    tip = '상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요.'
WHERE id = 'prompt-preference-2575';

UPDATE prompt_hint_items
SET content = 'When I want something simple, I like to have ... because ...',
    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',
    example_en = 'When I want something simple, I like to have toast because it is quick.'
WHERE id = 'hint-preference-2575-1-item-1';
