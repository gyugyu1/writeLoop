-- Seed 200 operational prompts and matching coach profiles without CTEs for wider MySQL compatibility.

INSERT INTO prompts (
    id,
    question_en,
    question_ko,
    difficulty,
    topic,
    tip,
    display_order,
    is_active
)
VALUES
    ('prompt-routine-01', 'How do you usually spend your weekday mornings?', '평일 아침은 보통 어떻게 보내나요?', 'A', 'Routine - Weekday Mornings', '시간 표현과 순서를 함께 넣어 보세요.', 1001, TRUE),
    ('prompt-routine-02', 'What do you usually do during your weekday mornings?', '평일 아침에는 보통 무엇을 하나요?', 'A', 'Routine - Weekday Mornings', '시간 표현과 순서를 함께 넣어 보세요.', 1002, TRUE),
    ('prompt-routine-03', 'Describe your routine for your weekday mornings.', '평일 아침 루틴을 설명해 주세요.', 'A', 'Routine - Weekday Mornings', '시간 표현과 순서를 함께 넣어 보세요.', 1003, TRUE),
    ('prompt-routine-04', 'What do you often do in your weekday mornings?', '평일 아침에 자주 하는 일을 말해 주세요.', 'A', 'Routine - Weekday Mornings', '시간 표현과 순서를 함께 넣어 보세요.', 1004, TRUE),
    ('prompt-routine-05', 'How do you typically use your weekday mornings?', '평일 아침을 보통 어떻게 활용하나요?', 'A', 'Routine - Weekday Mornings', '시간 표현과 순서를 함께 넣어 보세요.', 1005, TRUE),
    ('prompt-routine-06', 'How do you usually spend your evenings after work or class?', '퇴근이나 하교 후 저녁 시간은 보통 어떻게 보내나요?', 'A', 'Routine - After-Work Evenings', '집, 공부, 운동 중 무엇을 하는지 이어 보세요.', 1006, TRUE),
    ('prompt-routine-07', 'What do you usually do during your evenings after work or class?', '퇴근이나 하교 후 저녁 시간에는 보통 무엇을 하나요?', 'A', 'Routine - After-Work Evenings', '집, 공부, 운동 중 무엇을 하는지 이어 보세요.', 1007, TRUE),
    ('prompt-routine-08', 'Describe your routine for your evenings after work or class.', '퇴근이나 하교 후 저녁 시간 루틴을 설명해 주세요.', 'A', 'Routine - After-Work Evenings', '집, 공부, 운동 중 무엇을 하는지 이어 보세요.', 1008, TRUE),
    ('prompt-routine-09', 'What do you often do in your evenings after work or class?', '퇴근이나 하교 후 저녁 시간에 자주 하는 일을 말해 주세요.', 'A', 'Routine - After-Work Evenings', '집, 공부, 운동 중 무엇을 하는지 이어 보세요.', 1009, TRUE),
    ('prompt-routine-10', 'How do you typically use your evenings after work or class?', '퇴근이나 하교 후 저녁 시간을 보통 어떻게 활용하나요?', 'A', 'Routine - After-Work Evenings', '집, 공부, 운동 중 무엇을 하는지 이어 보세요.', 1010, TRUE),
    ('prompt-routine-11', 'How do you usually spend your Sunday afternoons?', '일요일 오후는 보통 어떻게 보내나요?', 'A', 'Routine - Sunday Afternoons', '여유 시간에 하는 활동을 구체적으로 말해 보세요.', 1011, TRUE),
    ('prompt-routine-12', 'What do you usually do during your Sunday afternoons?', '일요일 오후에는 보통 무엇을 하나요?', 'A', 'Routine - Sunday Afternoons', '여유 시간에 하는 활동을 구체적으로 말해 보세요.', 1012, TRUE),
    ('prompt-routine-13', 'Describe your routine for your Sunday afternoons.', '일요일 오후 루틴을 설명해 주세요.', 'A', 'Routine - Sunday Afternoons', '여유 시간에 하는 활동을 구체적으로 말해 보세요.', 1013, TRUE),
    ('prompt-routine-14', 'What do you often do in your Sunday afternoons?', '일요일 오후에 자주 하는 일을 말해 주세요.', 'A', 'Routine - Sunday Afternoons', '여유 시간에 하는 활동을 구체적으로 말해 보세요.', 1014, TRUE),
    ('prompt-routine-15', 'How do you typically use your Sunday afternoons?', '일요일 오후를 보통 어떻게 활용하나요?', 'A', 'Routine - Sunday Afternoons', '여유 시간에 하는 활동을 구체적으로 말해 보세요.', 1015, TRUE),
    ('prompt-routine-16', 'How do you usually spend your free time at home?', '집에서 보내는 여유 시간은 보통 어떻게 보내나요?', 'A', 'Routine - Free Time at Home', '장소와 활동을 함께 넣으면 자연스럽습니다.', 1016, TRUE),
    ('prompt-routine-17', 'What do you usually do during your free time at home?', '집에서 보내는 여유 시간에는 보통 무엇을 하나요?', 'A', 'Routine - Free Time at Home', '장소와 활동을 함께 넣으면 자연스럽습니다.', 1017, TRUE),
    ('prompt-routine-18', 'Describe your routine for your free time at home.', '집에서 보내는 여유 시간 루틴을 설명해 주세요.', 'A', 'Routine - Free Time at Home', '장소와 활동을 함께 넣으면 자연스럽습니다.', 1018, TRUE),
    ('prompt-routine-19', 'What do you often do in your free time at home?', '집에서 보내는 여유 시간에 자주 하는 일을 말해 주세요.', 'A', 'Routine - Free Time at Home', '장소와 활동을 함께 넣으면 자연스럽습니다.', 1019, TRUE),
    ('prompt-routine-20', 'How do you typically use your free time at home?', '집에서 보내는 여유 시간을 보통 어떻게 활용하나요?', 'A', 'Routine - Free Time at Home', '장소와 활동을 함께 넣으면 자연스럽습니다.', 1020, TRUE),
    ('prompt-routine-21', 'How do you usually spend the start of your Saturday?', '토요일을 시작하는 방식은 보통 어떻게 보내나요?', 'A', 'Routine - The Start of Saturday', '아침 루틴이나 첫 활동을 묘사해 보세요.', 1021, TRUE),
    ('prompt-routine-22', 'What do you usually do during the start of your Saturday?', '토요일을 시작하는 방식에는 보통 무엇을 하나요?', 'A', 'Routine - The Start of Saturday', '아침 루틴이나 첫 활동을 묘사해 보세요.', 1022, TRUE),
    ('prompt-routine-23', 'Describe your routine for the start of your Saturday.', '토요일을 시작하는 방식 루틴을 설명해 주세요.', 'A', 'Routine - The Start of Saturday', '아침 루틴이나 첫 활동을 묘사해 보세요.', 1023, TRUE),
    ('prompt-routine-24', 'What do you often do in the start of your Saturday?', '토요일을 시작하는 방식에 자주 하는 일을 말해 주세요.', 'A', 'Routine - The Start of Saturday', '아침 루틴이나 첫 활동을 묘사해 보세요.', 1024, TRUE),
    ('prompt-routine-25', 'How do you typically use the start of your Saturday?', '토요일을 시작하는 방식을 보통 어떻게 활용하나요?', 'A', 'Routine - The Start of Saturday', '아침 루틴이나 첫 활동을 묘사해 보세요.', 1025, TRUE)
ON DUPLICATE KEY UPDATE
    question_en = VALUES(question_en),
    question_ko = VALUES(question_ko),
    difficulty = VALUES(difficulty),
    topic = VALUES(topic),
    tip = VALUES(tip),
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);
INSERT INTO prompts (
    id,
    question_en,
    question_ko,
    difficulty,
    topic,
    tip,
    display_order,
    is_active
)
VALUES
    ('prompt-preference-01', 'What is your favorite kind of food, and why do you like it?', '가장 좋아하는 음식은 무엇이고, 왜 좋아하나요?', 'A', 'Preference - Favorite Food', '좋아하는 이유를 형용사와 함께 말해 보세요.', 1026, TRUE),
    ('prompt-preference-02', 'Tell me about your favorite kind of food and explain why it appeals to you.', '가장 좋아하는 음식에 대해 말하고, 왜 끌리는지 설명해 주세요.', 'A', 'Preference - Favorite Food', '좋아하는 이유를 형용사와 함께 말해 보세요.', 1027, TRUE),
    ('prompt-preference-03', 'Describe your favorite kind of food and give two reasons you enjoy it.', '가장 좋아하는 음식을 설명하고, 좋아하는 이유 두 가지를 말해 주세요.', 'A', 'Preference - Favorite Food', '좋아하는 이유를 형용사와 함께 말해 보세요.', 1028, TRUE),
    ('prompt-preference-04', 'What do you like most about your favorite kind of food, and why?', '가장 좋아하는 음식에서 가장 마음에 드는 점은 무엇이고, 왜 그런가요?', 'A', 'Preference - Favorite Food', '좋아하는 이유를 형용사와 함께 말해 보세요.', 1029, TRUE),
    ('prompt-preference-05', 'Introduce your favorite kind of food and explain what makes it special to you.', '가장 좋아하는 음식을 소개하고, 무엇이 특별한지 설명해 주세요.', 'A', 'Preference - Favorite Food', '좋아하는 이유를 형용사와 함께 말해 보세요.', 1030, TRUE),
    ('prompt-preference-06', 'What is your favorite movie genre, and why do you like it?', '가장 좋아하는 영화 장르는 무엇이고, 왜 좋아하나요?', 'A', 'Preference - Movie Genre', '좋아하는 장면이나 느낌을 덧붙이면 더 좋아요.', 1031, TRUE),
    ('prompt-preference-07', 'Tell me about your favorite movie genre and explain why it appeals to you.', '가장 좋아하는 영화 장르에 대해 말하고, 왜 끌리는지 설명해 주세요.', 'A', 'Preference - Movie Genre', '좋아하는 장면이나 느낌을 덧붙이면 더 좋아요.', 1032, TRUE),
    ('prompt-preference-08', 'Describe your favorite movie genre and give two reasons you enjoy it.', '가장 좋아하는 영화 장르를 설명하고, 좋아하는 이유 두 가지를 말해 주세요.', 'A', 'Preference - Movie Genre', '좋아하는 장면이나 느낌을 덧붙이면 더 좋아요.', 1033, TRUE),
    ('prompt-preference-09', 'What do you like most about your favorite movie genre, and why?', '가장 좋아하는 영화 장르에서 가장 마음에 드는 점은 무엇이고, 왜 그런가요?', 'A', 'Preference - Movie Genre', '좋아하는 장면이나 느낌을 덧붙이면 더 좋아요.', 1034, TRUE),
    ('prompt-preference-10', 'Introduce your favorite movie genre and explain what makes it special to you.', '가장 좋아하는 영화 장르를 소개하고, 무엇이 특별한지 설명해 주세요.', 'A', 'Preference - Movie Genre', '좋아하는 장면이나 느낌을 덧붙이면 더 좋아요.', 1035, TRUE),
    ('prompt-preference-11', 'What is your favorite place to relax, and why do you like it?', '편하게 쉬기 좋은 장소는 무엇이고, 왜 좋아하나요?', 'A', 'Preference - Place to Relax', '그 장소가 주는 느낌을 함께 설명해 보세요.', 1036, TRUE),
    ('prompt-preference-12', 'Tell me about your favorite place to relax and explain why it appeals to you.', '편하게 쉬기 좋은 장소에 대해 말하고, 왜 끌리는지 설명해 주세요.', 'A', 'Preference - Place to Relax', '그 장소가 주는 느낌을 함께 설명해 보세요.', 1037, TRUE),
    ('prompt-preference-13', 'Describe your favorite place to relax and give two reasons you enjoy it.', '편하게 쉬기 좋은 장소를 설명하고, 좋아하는 이유 두 가지를 말해 주세요.', 'A', 'Preference - Place to Relax', '그 장소가 주는 느낌을 함께 설명해 보세요.', 1038, TRUE),
    ('prompt-preference-14', 'What do you like most about your favorite place to relax, and why?', '편하게 쉬기 좋은 장소에서 가장 마음에 드는 점은 무엇이고, 왜 그런가요?', 'A', 'Preference - Place to Relax', '그 장소가 주는 느낌을 함께 설명해 보세요.', 1039, TRUE),
    ('prompt-preference-15', 'Introduce your favorite place to relax and explain what makes it special to you.', '편하게 쉬기 좋은 장소를 소개하고, 무엇이 특별한지 설명해 주세요.', 'A', 'Preference - Place to Relax', '그 장소가 주는 느낌을 함께 설명해 보세요.', 1040, TRUE),
    ('prompt-preference-16', 'What is your favorite season, and why do you like it?', '가장 좋아하는 계절은 무엇이고, 왜 좋아하나요?', 'A', 'Preference - Season', '날씨나 분위기를 이유로 붙여 보세요.', 1041, TRUE),
    ('prompt-preference-17', 'Tell me about your favorite season and explain why it appeals to you.', '가장 좋아하는 계절에 대해 말하고, 왜 끌리는지 설명해 주세요.', 'A', 'Preference - Season', '날씨나 분위기를 이유로 붙여 보세요.', 1042, TRUE),
    ('prompt-preference-18', 'Describe your favorite season and give two reasons you enjoy it.', '가장 좋아하는 계절을 설명하고, 좋아하는 이유 두 가지를 말해 주세요.', 'A', 'Preference - Season', '날씨나 분위기를 이유로 붙여 보세요.', 1043, TRUE),
    ('prompt-preference-19', 'What do you like most about your favorite season, and why?', '가장 좋아하는 계절에서 가장 마음에 드는 점은 무엇이고, 왜 그런가요?', 'A', 'Preference - Season', '날씨나 분위기를 이유로 붙여 보세요.', 1044, TRUE),
    ('prompt-preference-20', 'Introduce your favorite season and explain what makes it special to you.', '가장 좋아하는 계절을 소개하고, 무엇이 특별한지 설명해 주세요.', 'A', 'Preference - Season', '날씨나 분위기를 이유로 붙여 보세요.', 1045, TRUE),
    ('prompt-preference-21', 'What is your favorite type of music, and why do you like it?', '가장 좋아하는 음악 종류는 무엇이고, 왜 좋아하나요?', 'A', 'Preference - Music Genre', '구체적인 예 하나를 덧붙이면 자연스럽습니다.', 1046, TRUE),
    ('prompt-preference-22', 'Tell me about your favorite type of music and explain why it appeals to you.', '가장 좋아하는 음악 종류에 대해 말하고, 왜 끌리는지 설명해 주세요.', 'A', 'Preference - Music Genre', '구체적인 예 하나를 덧붙이면 자연스럽습니다.', 1047, TRUE),
    ('prompt-preference-23', 'Describe your favorite type of music and give two reasons you enjoy it.', '가장 좋아하는 음악 종류를 설명하고, 좋아하는 이유 두 가지를 말해 주세요.', 'A', 'Preference - Music Genre', '구체적인 예 하나를 덧붙이면 자연스럽습니다.', 1048, TRUE),
    ('prompt-preference-24', 'What do you like most about your favorite type of music, and why?', '가장 좋아하는 음악 종류에서 가장 마음에 드는 점은 무엇이고, 왜 그런가요?', 'A', 'Preference - Music Genre', '구체적인 예 하나를 덧붙이면 자연스럽습니다.', 1049, TRUE),
    ('prompt-preference-25', 'Introduce your favorite type of music and explain what makes it special to you.', '가장 좋아하는 음악 종류를 소개하고, 무엇이 특별한지 설명해 주세요.', 'A', 'Preference - Music Genre', '구체적인 예 하나를 덧붙이면 자연스럽습니다.', 1050, TRUE)
ON DUPLICATE KEY UPDATE
    question_en = VALUES(question_en),
    question_ko = VALUES(question_ko),
    difficulty = VALUES(difficulty),
    topic = VALUES(topic),
    tip = VALUES(tip),
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);
INSERT INTO prompts (
    id,
    question_en,
    question_ko,
    difficulty,
    topic,
    tip,
    display_order,
    is_active
)
VALUES
    ('prompt-goal-01', 'What is one skill you want to improve this year, and how will you work on it?', '올해 더 키우고 싶은 기술 하나는 무엇이고, 어떻게 실천할 건가요?', 'B', 'Goal Plan - Skill Growth', '목표와 실천 계획을 함께 말해 보세요.', 1051, TRUE),
    ('prompt-goal-02', 'Describe one skill you want to improve this year and explain your plan.', '올해 더 키우고 싶은 기술 하나를 설명하고, 어떤 계획이 있는지 말해 주세요.', 'B', 'Goal Plan - Skill Growth', '목표와 실천 계획을 함께 말해 보세요.', 1052, TRUE),
    ('prompt-goal-03', 'Tell me about one skill you want to improve this year and how you will make progress.', '올해 더 키우고 싶은 기술 하나에 대해 말하고, 어떻게 발전시킬지 설명해 주세요.', 'B', 'Goal Plan - Skill Growth', '목표와 실천 계획을 함께 말해 보세요.', 1053, TRUE),
    ('prompt-goal-04', 'What steps will you take for one skill you want to improve this year?', '올해 더 키우고 싶은 기술 하나를 위해 어떤 단계를 밟을지 말해 주세요.', 'B', 'Goal Plan - Skill Growth', '목표와 실천 계획을 함께 말해 보세요.', 1054, TRUE),
    ('prompt-goal-05', 'Explain one skill you want to improve this year and why it matters to you.', '올해 더 키우고 싶은 기술 하나가 왜 중요한지도 함께 설명해 주세요.', 'B', 'Goal Plan - Skill Growth', '목표와 실천 계획을 함께 말해 보세요.', 1055, TRUE),
    ('prompt-goal-06', 'What is one habit you want to build this year, and how will you work on it?', '올해 만들고 싶은 습관 하나는 무엇이고, 어떻게 실천할 건가요?', 'B', 'Goal Plan - Habit Building', '얼마나 자주 할지까지 이어 보세요.', 1056, TRUE),
    ('prompt-goal-07', 'Describe one habit you want to build this year and explain your plan.', '올해 만들고 싶은 습관 하나를 설명하고, 어떤 계획이 있는지 말해 주세요.', 'B', 'Goal Plan - Habit Building', '얼마나 자주 할지까지 이어 보세요.', 1057, TRUE),
    ('prompt-goal-08', 'Tell me about one habit you want to build this year and how you will make progress.', '올해 만들고 싶은 습관 하나에 대해 말하고, 어떻게 발전시킬지 설명해 주세요.', 'B', 'Goal Plan - Habit Building', '얼마나 자주 할지까지 이어 보세요.', 1058, TRUE),
    ('prompt-goal-09', 'What steps will you take for one habit you want to build this year?', '올해 만들고 싶은 습관 하나를 위해 어떤 단계를 밟을지 말해 주세요.', 'B', 'Goal Plan - Habit Building', '얼마나 자주 할지까지 이어 보세요.', 1059, TRUE),
    ('prompt-goal-10', 'Explain one habit you want to build this year and why it matters to you.', '올해 만들고 싶은 습관 하나가 왜 중요한지도 함께 설명해 주세요.', 'B', 'Goal Plan - Habit Building', '얼마나 자주 할지까지 이어 보세요.', 1060, TRUE),
    ('prompt-goal-11', 'What is one health goal you want to reach this year, and how will you work on it?', '올해 이루고 싶은 건강 목표 하나는 무엇이고, 어떻게 실천할 건가요?', 'B', 'Goal Plan - Health Goal', '구체적인 실천 방법을 넣어 보세요.', 1061, TRUE),
    ('prompt-goal-12', 'Describe one health goal you want to reach this year and explain your plan.', '올해 이루고 싶은 건강 목표 하나를 설명하고, 어떤 계획이 있는지 말해 주세요.', 'B', 'Goal Plan - Health Goal', '구체적인 실천 방법을 넣어 보세요.', 1062, TRUE),
    ('prompt-goal-13', 'Tell me about one health goal you want to reach this year and how you will make progress.', '올해 이루고 싶은 건강 목표 하나에 대해 말하고, 어떻게 발전시킬지 설명해 주세요.', 'B', 'Goal Plan - Health Goal', '구체적인 실천 방법을 넣어 보세요.', 1063, TRUE),
    ('prompt-goal-14', 'What steps will you take for one health goal you want to reach this year?', '올해 이루고 싶은 건강 목표 하나를 위해 어떤 단계를 밟을지 말해 주세요.', 'B', 'Goal Plan - Health Goal', '구체적인 실천 방법을 넣어 보세요.', 1064, TRUE),
    ('prompt-goal-15', 'Explain one health goal you want to reach this year and why it matters to you.', '올해 이루고 싶은 건강 목표 하나가 왜 중요한지도 함께 설명해 주세요.', 'B', 'Goal Plan - Health Goal', '구체적인 실천 방법을 넣어 보세요.', 1065, TRUE),
    ('prompt-goal-16', 'What is one language goal you want to work on this year, and how will you work on it?', '올해 노력하고 싶은 언어 목표 하나는 무엇이고, 어떻게 실천할 건가요?', 'B', 'Goal Plan - Language Practice', '연습 방법과 이유를 같이 적어 보세요.', 1066, TRUE),
    ('prompt-goal-17', 'Describe one language goal you want to work on this year and explain your plan.', '올해 노력하고 싶은 언어 목표 하나를 설명하고, 어떤 계획이 있는지 말해 주세요.', 'B', 'Goal Plan - Language Practice', '연습 방법과 이유를 같이 적어 보세요.', 1067, TRUE),
    ('prompt-goal-18', 'Tell me about one language goal you want to work on this year and how you will make progress.', '올해 노력하고 싶은 언어 목표 하나에 대해 말하고, 어떻게 발전시킬지 설명해 주세요.', 'B', 'Goal Plan - Language Practice', '연습 방법과 이유를 같이 적어 보세요.', 1068, TRUE),
    ('prompt-goal-19', 'What steps will you take for one language goal you want to work on this year?', '올해 노력하고 싶은 언어 목표 하나를 위해 어떤 단계를 밟을지 말해 주세요.', 'B', 'Goal Plan - Language Practice', '연습 방법과 이유를 같이 적어 보세요.', 1069, TRUE),
    ('prompt-goal-20', 'Explain one language goal you want to work on this year and why it matters to you.', '올해 노력하고 싶은 언어 목표 하나가 왜 중요한지도 함께 설명해 주세요.', 'B', 'Goal Plan - Language Practice', '연습 방법과 이유를 같이 적어 보세요.', 1070, TRUE),
    ('prompt-goal-21', 'What is one area where you want to build more confidence this year, and how will you work on it?', '올해 더 자신감을 키우고 싶은 분야 하나는 무엇이고, 어떻게 실천할 건가요?', 'B', 'Goal Plan - Confidence Goal', '작은 단계부터 어떻게 해볼지 이어 보세요.', 1071, TRUE),
    ('prompt-goal-22', 'Describe one area where you want to build more confidence this year and explain your plan.', '올해 더 자신감을 키우고 싶은 분야 하나를 설명하고, 어떤 계획이 있는지 말해 주세요.', 'B', 'Goal Plan - Confidence Goal', '작은 단계부터 어떻게 해볼지 이어 보세요.', 1072, TRUE),
    ('prompt-goal-23', 'Tell me about one area where you want to build more confidence this year and how you will make progress.', '올해 더 자신감을 키우고 싶은 분야 하나에 대해 말하고, 어떻게 발전시킬지 설명해 주세요.', 'B', 'Goal Plan - Confidence Goal', '작은 단계부터 어떻게 해볼지 이어 보세요.', 1073, TRUE),
    ('prompt-goal-24', 'What steps will you take for one area where you want to build more confidence this year?', '올해 더 자신감을 키우고 싶은 분야 하나를 위해 어떤 단계를 밟을지 말해 주세요.', 'B', 'Goal Plan - Confidence Goal', '작은 단계부터 어떻게 해볼지 이어 보세요.', 1074, TRUE),
    ('prompt-goal-25', 'Explain one area where you want to build more confidence this year and why it matters to you.', '올해 더 자신감을 키우고 싶은 분야 하나가 왜 중요한지도 함께 설명해 주세요.', 'B', 'Goal Plan - Confidence Goal', '작은 단계부터 어떻게 해볼지 이어 보세요.', 1075, TRUE)
ON DUPLICATE KEY UPDATE
    question_en = VALUES(question_en),
    question_ko = VALUES(question_ko),
    difficulty = VALUES(difficulty),
    topic = VALUES(topic),
    tip = VALUES(tip),
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);
INSERT INTO prompts (
    id,
    question_en,
    question_ko,
    difficulty,
    topic,
    tip,
    display_order,
    is_active
)
VALUES
    ('prompt-problem-01', 'What is one challenge you often face with time management, and how do you handle it?', '시간 관리에서 자주 겪는 어려움 하나와 그 대응 방법을 말해 주세요.', 'B', 'Problem Solving - Time Management', '문제와 대응 방법을 같이 설명해 보세요.', 1076, TRUE),
    ('prompt-problem-02', 'Describe a problem you have with time management and explain how you deal with it.', '시간 관리와 관련한 문제를 설명하고, 어떻게 해결하는지 말해 주세요.', 'B', 'Problem Solving - Time Management', '문제와 대응 방법을 같이 설명해 보세요.', 1077, TRUE),
    ('prompt-problem-03', 'Tell me about a difficulty related to time management and what you do about it.', '시간 관리에서 겪는 어려움과 그에 대해 무엇을 하는지 말해 주세요.', 'B', 'Problem Solving - Time Management', '문제와 대응 방법을 같이 설명해 보세요.', 1078, TRUE),
    ('prompt-problem-04', 'What is challenging about time management for you, and how do you respond?', '시간 관리가 왜 어려운지와, 그때 어떻게 대응하는지 말해 주세요.', 'B', 'Problem Solving - Time Management', '문제와 대응 방법을 같이 설명해 보세요.', 1079, TRUE),
    ('prompt-problem-05', 'Explain a common problem you face with time management and how you try to solve it.', '시간 관리에서 자주 겪는 문제와 해결 노력을 설명해 주세요.', 'B', 'Problem Solving - Time Management', '문제와 대응 방법을 같이 설명해 보세요.', 1080, TRUE),
    ('prompt-problem-06', 'What is one challenge you often face with staying motivated, and how do you handle it?', '동기 유지에서 자주 겪는 어려움 하나와 그 대응 방법을 말해 주세요.', 'B', 'Problem Solving - Staying Motivated', '어려울 때 어떻게 다시 시작하는지 붙여 보세요.', 1081, TRUE),
    ('prompt-problem-07', 'Describe a problem you have with staying motivated and explain how you deal with it.', '동기 유지와 관련한 문제를 설명하고, 어떻게 해결하는지 말해 주세요.', 'B', 'Problem Solving - Staying Motivated', '어려울 때 어떻게 다시 시작하는지 붙여 보세요.', 1082, TRUE),
    ('prompt-problem-08', 'Tell me about a difficulty related to staying motivated and what you do about it.', '동기 유지에서 겪는 어려움과 그에 대해 무엇을 하는지 말해 주세요.', 'B', 'Problem Solving - Staying Motivated', '어려울 때 어떻게 다시 시작하는지 붙여 보세요.', 1083, TRUE),
    ('prompt-problem-09', 'What is challenging about staying motivated for you, and how do you respond?', '동기 유지가 왜 어려운지와, 그때 어떻게 대응하는지 말해 주세요.', 'B', 'Problem Solving - Staying Motivated', '어려울 때 어떻게 다시 시작하는지 붙여 보세요.', 1084, TRUE),
    ('prompt-problem-10', 'Explain a common problem you face with staying motivated and how you try to solve it.', '동기 유지에서 자주 겪는 문제와 해결 노력을 설명해 주세요.', 'B', 'Problem Solving - Staying Motivated', '어려울 때 어떻게 다시 시작하는지 붙여 보세요.', 1085, TRUE),
    ('prompt-problem-11', 'What is one challenge you often face with speaking in front of people, and how do you handle it?', '사람들 앞에서 말하기에서 자주 겪는 어려움 하나와 그 대응 방법을 말해 주세요.', 'B', 'Problem Solving - Public Speaking', '긴장과 해결 방법을 함께 말해 보세요.', 1086, TRUE),
    ('prompt-problem-12', 'Describe a problem you have with speaking in front of people and explain how you deal with it.', '사람들 앞에서 말하기와 관련한 문제를 설명하고, 어떻게 해결하는지 말해 주세요.', 'B', 'Problem Solving - Public Speaking', '긴장과 해결 방법을 함께 말해 보세요.', 1087, TRUE),
    ('prompt-problem-13', 'Tell me about a difficulty related to speaking in front of people and what you do about it.', '사람들 앞에서 말하기에서 겪는 어려움과 그에 대해 무엇을 하는지 말해 주세요.', 'B', 'Problem Solving - Public Speaking', '긴장과 해결 방법을 함께 말해 보세요.', 1088, TRUE),
    ('prompt-problem-14', 'What is challenging about speaking in front of people for you, and how do you respond?', '사람들 앞에서 말하기가 왜 어려운지와, 그때 어떻게 대응하는지 말해 주세요.', 'B', 'Problem Solving - Public Speaking', '긴장과 해결 방법을 함께 말해 보세요.', 1089, TRUE),
    ('prompt-problem-15', 'Explain a common problem you face with speaking in front of people and how you try to solve it.', '사람들 앞에서 말하기에서 자주 겪는 문제와 해결 노력을 설명해 주세요.', 'B', 'Problem Solving - Public Speaking', '긴장과 해결 방법을 함께 말해 보세요.', 1090, TRUE),
    ('prompt-problem-16', 'What is one challenge you often face with balancing work and rest, and how do you handle it?', '일과 휴식의 균형에서 자주 겪는 어려움 하나와 그 대응 방법을 말해 주세요.', 'B', 'Problem Solving - Work-Life Balance', '무엇이 어려운지 먼저 분명하게 적어 보세요.', 1091, TRUE),
    ('prompt-problem-17', 'Describe a problem you have with balancing work and rest and explain how you deal with it.', '일과 휴식의 균형과 관련한 문제를 설명하고, 어떻게 해결하는지 말해 주세요.', 'B', 'Problem Solving - Work-Life Balance', '무엇이 어려운지 먼저 분명하게 적어 보세요.', 1092, TRUE),
    ('prompt-problem-18', 'Tell me about a difficulty related to balancing work and rest and what you do about it.', '일과 휴식의 균형에서 겪는 어려움과 그에 대해 무엇을 하는지 말해 주세요.', 'B', 'Problem Solving - Work-Life Balance', '무엇이 어려운지 먼저 분명하게 적어 보세요.', 1093, TRUE),
    ('prompt-problem-19', 'What is challenging about balancing work and rest for you, and how do you respond?', '일과 휴식의 균형이 왜 어려운지와, 그때 어떻게 대응하는지 말해 주세요.', 'B', 'Problem Solving - Work-Life Balance', '무엇이 어려운지 먼저 분명하게 적어 보세요.', 1094, TRUE),
    ('prompt-problem-20', 'Explain a common problem you face with balancing work and rest and how you try to solve it.', '일과 휴식의 균형에서 자주 겪는 문제와 해결 노력을 설명해 주세요.', 'B', 'Problem Solving - Work-Life Balance', '무엇이 어려운지 먼저 분명하게 적어 보세요.', 1095, TRUE),
    ('prompt-problem-21', 'What is one challenge you often face with working in a team, and how do you handle it?', '팀으로 일하기에서 자주 겪는 어려움 하나와 그 대응 방법을 말해 주세요.', 'B', 'Problem Solving - Teamwork', '실제 대응 방법을 한 가지 이상 적어 보세요.', 1096, TRUE),
    ('prompt-problem-22', 'Describe a problem you have with working in a team and explain how you deal with it.', '팀으로 일하기와 관련한 문제를 설명하고, 어떻게 해결하는지 말해 주세요.', 'B', 'Problem Solving - Teamwork', '실제 대응 방법을 한 가지 이상 적어 보세요.', 1097, TRUE),
    ('prompt-problem-23', 'Tell me about a difficulty related to working in a team and what you do about it.', '팀으로 일하기에서 겪는 어려움과 그에 대해 무엇을 하는지 말해 주세요.', 'B', 'Problem Solving - Teamwork', '실제 대응 방법을 한 가지 이상 적어 보세요.', 1098, TRUE),
    ('prompt-problem-24', 'What is challenging about working in a team for you, and how do you respond?', '팀으로 일하기가 왜 어려운지와, 그때 어떻게 대응하는지 말해 주세요.', 'B', 'Problem Solving - Teamwork', '실제 대응 방법을 한 가지 이상 적어 보세요.', 1099, TRUE),
    ('prompt-problem-25', 'Explain a common problem you face with working in a team and how you try to solve it.', '팀으로 일하기에서 자주 겪는 문제와 해결 노력을 설명해 주세요.', 'B', 'Problem Solving - Teamwork', '실제 대응 방법을 한 가지 이상 적어 보세요.', 1100, TRUE)
ON DUPLICATE KEY UPDATE
    question_en = VALUES(question_en),
    question_ko = VALUES(question_ko),
    difficulty = VALUES(difficulty),
    topic = VALUES(topic),
    tip = VALUES(tip),
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);
INSERT INTO prompts (
    id,
    question_en,
    question_ko,
    difficulty,
    topic,
    tip,
    display_order,
    is_active
)
VALUES
    ('prompt-balance-01', 'How has social media changed daily life, and do you think the change is mostly positive?', '소셜 미디어가 일상을 어떻게 바꿨고, 그 변화가 대체로 긍정적인지 말해 주세요.', 'C', 'Balanced Opinion - Social Media', '장점과 단점을 모두 언급한 뒤 입장을 말해 보세요.', 1101, TRUE),
    ('prompt-balance-02', 'What are the benefits and drawbacks of social media, and what is your view?', '소셜 미디어의 장점과 단점은 무엇이며, 당신의 입장은 어떤가요?', 'C', 'Balanced Opinion - Social Media', '장점과 단점을 모두 언급한 뒤 입장을 말해 보세요.', 1102, TRUE),
    ('prompt-balance-03', 'In what ways has social media affected people, and is that effect mostly good?', '소셜 미디어가 사람들에게 어떤 영향을 미쳤고, 그 영향이 대체로 좋은지 말해 주세요.', 'C', 'Balanced Opinion - Social Media', '장점과 단점을 모두 언급한 뒤 입장을 말해 보세요.', 1103, TRUE),
    ('prompt-balance-04', 'Do you think social media has helped people more than it has harmed them? Why?', '소셜 미디어가 사람들에게 해보다 도움이 더 컸다고 보나요? 이유도 말해 주세요.', 'C', 'Balanced Opinion - Social Media', '장점과 단점을 모두 언급한 뒤 입장을 말해 보세요.', 1104, TRUE),
    ('prompt-balance-05', 'How has social media changed the way people live or connect, and what is your overall opinion?', '소셜 미디어가 사람들의 생활이나 관계 방식을 어떻게 바꿨고, 전반적인 의견은 어떤가요?', 'C', 'Balanced Opinion - Social Media', '장점과 단점을 모두 언급한 뒤 입장을 말해 보세요.', 1105, TRUE),
    ('prompt-balance-06', 'How has remote work changed daily life, and do you think the change is mostly positive?', '원격 근무가 일상을 어떻게 바꿨고, 그 변화가 대체로 긍정적인지 말해 주세요.', 'C', 'Balanced Opinion - Remote Work', '조건에 따라 달라질 수 있다는 점도 넣어 보세요.', 1106, TRUE),
    ('prompt-balance-07', 'What are the benefits and drawbacks of remote work, and what is your view?', '원격 근무의 장점과 단점은 무엇이며, 당신의 입장은 어떤가요?', 'C', 'Balanced Opinion - Remote Work', '조건에 따라 달라질 수 있다는 점도 넣어 보세요.', 1107, TRUE),
    ('prompt-balance-08', 'In what ways has remote work affected people, and is that effect mostly good?', '원격 근무가 사람들에게 어떤 영향을 미쳤고, 그 영향이 대체로 좋은지 말해 주세요.', 'C', 'Balanced Opinion - Remote Work', '조건에 따라 달라질 수 있다는 점도 넣어 보세요.', 1108, TRUE),
    ('prompt-balance-09', 'Do you think remote work has helped people more than it has harmed them? Why?', '원격 근무가 사람들에게 해보다 도움이 더 컸다고 보나요? 이유도 말해 주세요.', 'C', 'Balanced Opinion - Remote Work', '조건에 따라 달라질 수 있다는 점도 넣어 보세요.', 1109, TRUE),
    ('prompt-balance-10', 'How has remote work changed the way people live or connect, and what is your overall opinion?', '원격 근무가 사람들의 생활이나 관계 방식을 어떻게 바꿨고, 전반적인 의견은 어떤가요?', 'C', 'Balanced Opinion - Remote Work', '조건에 따라 달라질 수 있다는 점도 넣어 보세요.', 1110, TRUE),
    ('prompt-balance-11', 'How has artificial intelligence in education changed daily life, and do you think the change is mostly positive?', '교육에서의 인공지능이 일상을 어떻게 바꿨고, 그 변화가 대체로 긍정적인지 말해 주세요.', 'C', 'Balanced Opinion - AI in Education', '찬반을 균형 있게 다루면 좋아요.', 1111, TRUE),
    ('prompt-balance-12', 'What are the benefits and drawbacks of artificial intelligence in education, and what is your view?', '교육에서의 인공지능의 장점과 단점은 무엇이며, 당신의 입장은 어떤가요?', 'C', 'Balanced Opinion - AI in Education', '찬반을 균형 있게 다루면 좋아요.', 1112, TRUE),
    ('prompt-balance-13', 'In what ways has artificial intelligence in education affected people, and is that effect mostly good?', '교육에서의 인공지능이 사람들에게 어떤 영향을 미쳤고, 그 영향이 대체로 좋은지 말해 주세요.', 'C', 'Balanced Opinion - AI in Education', '찬반을 균형 있게 다루면 좋아요.', 1113, TRUE),
    ('prompt-balance-14', 'Do you think artificial intelligence in education has helped people more than it has harmed them? Why?', '교육에서의 인공지능이 사람들에게 해보다 도움이 더 컸다고 보나요? 이유도 말해 주세요.', 'C', 'Balanced Opinion - AI in Education', '찬반을 균형 있게 다루면 좋아요.', 1114, TRUE),
    ('prompt-balance-15', 'How has artificial intelligence in education changed the way people live or connect, and what is your overall opinion?', '교육에서의 인공지능이 사람들의 생활이나 관계 방식을 어떻게 바꿨고, 전반적인 의견은 어떤가요?', 'C', 'Balanced Opinion - AI in Education', '찬반을 균형 있게 다루면 좋아요.', 1115, TRUE),
    ('prompt-balance-16', 'How has online shopping changed daily life, and do you think the change is mostly positive?', '온라인 쇼핑이 일상을 어떻게 바꿨고, 그 변화가 대체로 긍정적인지 말해 주세요.', 'C', 'Balanced Opinion - Online Shopping', '생활 변화와 부작용을 함께 언급해 보세요.', 1116, TRUE),
    ('prompt-balance-17', 'What are the benefits and drawbacks of online shopping, and what is your view?', '온라인 쇼핑의 장점과 단점은 무엇이며, 당신의 입장은 어떤가요?', 'C', 'Balanced Opinion - Online Shopping', '생활 변화와 부작용을 함께 언급해 보세요.', 1117, TRUE),
    ('prompt-balance-18', 'In what ways has online shopping affected people, and is that effect mostly good?', '온라인 쇼핑이 사람들에게 어떤 영향을 미쳤고, 그 영향이 대체로 좋은지 말해 주세요.', 'C', 'Balanced Opinion - Online Shopping', '생활 변화와 부작용을 함께 언급해 보세요.', 1118, TRUE),
    ('prompt-balance-19', 'Do you think online shopping has helped people more than it has harmed them? Why?', '온라인 쇼핑이 사람들에게 해보다 도움이 더 컸다고 보나요? 이유도 말해 주세요.', 'C', 'Balanced Opinion - Online Shopping', '생활 변화와 부작용을 함께 언급해 보세요.', 1119, TRUE),
    ('prompt-balance-20', 'How has online shopping changed the way people live or connect, and what is your overall opinion?', '온라인 쇼핑이 사람들의 생활이나 관계 방식을 어떻게 바꿨고, 전반적인 의견은 어떤가요?', 'C', 'Balanced Opinion - Online Shopping', '생활 변화와 부작용을 함께 언급해 보세요.', 1120, TRUE),
    ('prompt-balance-21', 'How has daily smartphone use changed people''s lives, and do you think the change is mostly positive?', '일상 속 스마트폰 사용이 일상을 어떻게 바꿨고, 그 변화가 대체로 긍정적인지 말해 주세요.', 'C', 'Balanced Opinion - Smartphones', '전반적인 평가를 마지막에 정리해 보세요.', 1121, TRUE),
    ('prompt-balance-22', 'What are the benefits and drawbacks of daily smartphone use, and what is your view?', '일상 속 스마트폰 사용의 장점과 단점은 무엇이며, 당신의 입장은 어떤가요?', 'C', 'Balanced Opinion - Smartphones', '전반적인 평가를 마지막에 정리해 보세요.', 1122, TRUE),
    ('prompt-balance-23', 'In what ways has daily smartphone use affected people, and is that effect mostly good?', '일상 속 스마트폰 사용이 사람들에게 어떤 영향을 미쳤고, 그 영향이 대체로 좋은지 말해 주세요.', 'C', 'Balanced Opinion - Smartphones', '전반적인 평가를 마지막에 정리해 보세요.', 1123, TRUE),
    ('prompt-balance-24', 'Do you think daily smartphone use has helped people more than it has harmed them? Why?', '일상 속 스마트폰 사용이 사람들에게 해보다 도움이 더 컸다고 보나요? 이유도 말해 주세요.', 'C', 'Balanced Opinion - Smartphones', '전반적인 평가를 마지막에 정리해 보세요.', 1124, TRUE),
    ('prompt-balance-25', 'How has daily smartphone use changed the way people live or connect, and what is your overall opinion?', '일상 속 스마트폰 사용이 사람들의 생활이나 관계 방식을 어떻게 바꿨고, 전반적인 의견은 어떤가요?', 'C', 'Balanced Opinion - Smartphones', '전반적인 평가를 마지막에 정리해 보세요.', 1125, TRUE)
ON DUPLICATE KEY UPDATE
    question_en = VALUES(question_en),
    question_ko = VALUES(question_ko),
    difficulty = VALUES(difficulty),
    topic = VALUES(topic),
    tip = VALUES(tip),
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);
INSERT INTO prompts (
    id,
    question_en,
    question_ko,
    difficulty,
    topic,
    tip,
    display_order,
    is_active
)
VALUES
    ('prompt-opinion-01', 'What responsibility should successful companies have in modern society?', '성공한 기업이 현대 사회에서 어떤 책임을 가져야 하는지 말해 주세요.', 'C', 'Opinion Reason - Corporate Responsibility', '입장과 근거를 함께 전개해 보세요.', 1126, TRUE),
    ('prompt-opinion-02', 'Do you think successful companies should do more for society? Why or why not?', '성공한 기업이 사회를 위해 더 많은 역할을 해야 한다고 보나요? 이유도 말해 주세요.', 'C', 'Opinion Reason - Corporate Responsibility', '입장과 근거를 함께 전개해 보세요.', 1127, TRUE),
    ('prompt-opinion-03', 'What is one important role that successful companies should play, and why?', '성공한 기업이 해야 할 중요한 역할 하나와 그 이유를 말해 주세요.', 'C', 'Opinion Reason - Corporate Responsibility', '입장과 근거를 함께 전개해 보세요.', 1128, TRUE),
    ('prompt-opinion-04', 'In your opinion, what duties do successful companies have, and what makes them important?', '성공한 기업에 어떤 책임이 있고, 그것이 왜 중요한지 당신의 의견을 말해 주세요.', 'C', 'Opinion Reason - Corporate Responsibility', '입장과 근거를 함께 전개해 보세요.', 1129, TRUE),
    ('prompt-opinion-05', 'What kind of social responsibility should successful companies have, and why?', '성공한 기업이 어떤 사회적 책임을 져야 하는지와 그 이유를 말해 주세요.', 'C', 'Opinion Reason - Corporate Responsibility', '입장과 근거를 함께 전개해 보세요.', 1130, TRUE),
    ('prompt-opinion-06', 'What responsibility should public transportation in big cities have in modern society?', '대도시의 대중교통이 현대 사회에서 어떤 책임을 가져야 하는지 말해 주세요.', 'C', 'Opinion Reason - Public Transportation', '사회적 가치와 실질적 효과를 같이 넣어 보세요.', 1131, TRUE),
    ('prompt-opinion-07', 'Do you think public transportation in big cities should do more for society? Why or why not?', '대도시의 대중교통이 사회를 위해 더 많은 역할을 해야 한다고 보나요? 이유도 말해 주세요.', 'C', 'Opinion Reason - Public Transportation', '사회적 가치와 실질적 효과를 같이 넣어 보세요.', 1132, TRUE),
    ('prompt-opinion-08', 'What is one important role that public transportation in big cities should play, and why?', '대도시의 대중교통이 해야 할 중요한 역할 하나와 그 이유를 말해 주세요.', 'C', 'Opinion Reason - Public Transportation', '사회적 가치와 실질적 효과를 같이 넣어 보세요.', 1133, TRUE),
    ('prompt-opinion-09', 'In your opinion, what duty does public transportation in big cities have, and what makes it important?', '대도시의 대중교통에 어떤 책임이 있고, 그것이 왜 중요한지 당신의 의견을 말해 주세요.', 'C', 'Opinion Reason - Public Transportation', '사회적 가치와 실질적 효과를 같이 넣어 보세요.', 1134, TRUE),
    ('prompt-opinion-10', 'What kind of social responsibility should public transportation in big cities have, and why?', '대도시의 대중교통이 어떤 사회적 책임을 져야 하는지와 그 이유를 말해 주세요.', 'C', 'Opinion Reason - Public Transportation', '사회적 가치와 실질적 효과를 같이 넣어 보세요.', 1135, TRUE),
    ('prompt-opinion-11', 'What responsibility should schools that teach financial skills have in modern society?', '학교의 금융 교육이 현대 사회에서 어떤 책임을 가져야 하는지 말해 주세요.', 'C', 'Opinion Reason - Financial Education', '왜 필요한지 구체적으로 말해 보세요.', 1136, TRUE),
    ('prompt-opinion-12', 'Do you think schools that teach financial skills should do more for society? Why or why not?', '학교의 금융 교육이 사회를 위해 더 많은 역할을 해야 한다고 보나요? 이유도 말해 주세요.', 'C', 'Opinion Reason - Financial Education', '왜 필요한지 구체적으로 말해 보세요.', 1137, TRUE),
    ('prompt-opinion-13', 'What is one important role that schools that teach financial skills should play, and why?', '학교의 금융 교육이 해야 할 중요한 역할 하나와 그 이유를 말해 주세요.', 'C', 'Opinion Reason - Financial Education', '왜 필요한지 구체적으로 말해 보세요.', 1138, TRUE),
    ('prompt-opinion-14', 'In your opinion, what duties do schools that teach financial skills have, and what makes them important?', '학교의 금융 교육에 어떤 책임이 있고, 그것이 왜 중요한지 당신의 의견을 말해 주세요.', 'C', 'Opinion Reason - Financial Education', '왜 필요한지 구체적으로 말해 보세요.', 1139, TRUE),
    ('prompt-opinion-15', 'What kind of social responsibility should schools that teach financial skills have, and why?', '학교의 금융 교육이 어떤 사회적 책임을 져야 하는지와 그 이유를 말해 주세요.', 'C', 'Opinion Reason - Financial Education', '왜 필요한지 구체적으로 말해 보세요.', 1140, TRUE),
    ('prompt-opinion-16', 'What responsibility should local volunteering have in modern society?', '지역사회 봉사활동이 현대 사회에서 어떤 책임을 가져야 하는지 말해 주세요.', 'C', 'Opinion Reason - Local Volunteering', '예시를 하나 넣으면 설득력이 올라갑니다.', 1141, TRUE),
    ('prompt-opinion-17', 'Do you think local volunteering should do more for society? Why or why not?', '지역사회 봉사활동이 사회를 위해 더 많은 역할을 해야 한다고 보나요? 이유도 말해 주세요.', 'C', 'Opinion Reason - Local Volunteering', '예시를 하나 넣으면 설득력이 올라갑니다.', 1142, TRUE),
    ('prompt-opinion-18', 'What is one important role that local volunteering should play, and why?', '지역사회 봉사활동이 해야 할 중요한 역할 하나와 그 이유를 말해 주세요.', 'C', 'Opinion Reason - Local Volunteering', '예시를 하나 넣으면 설득력이 올라갑니다.', 1143, TRUE),
    ('prompt-opinion-19', 'In your opinion, what duties does local volunteering have, and what makes them important?', '지역사회 봉사활동에 어떤 책임이 있고, 그것이 왜 중요한지 당신의 의견을 말해 주세요.', 'C', 'Opinion Reason - Local Volunteering', '예시를 하나 넣으면 설득력이 올라갑니다.', 1144, TRUE),
    ('prompt-opinion-20', 'What kind of social responsibility should local volunteering have, and why?', '지역사회 봉사활동이 어떤 사회적 책임을 져야 하는지와 그 이유를 말해 주세요.', 'C', 'Opinion Reason - Local Volunteering', '예시를 하나 넣으면 설득력이 올라갑니다.', 1145, TRUE),
    ('prompt-opinion-21', 'What responsibility should social media platforms have in modern society?', '소셜 미디어 플랫폼이 현대 사회에서 어떤 책임을 가져야 하는지 말해 주세요.', 'C', 'Opinion Reason - Platform Responsibility', '책임의 범위를 분명하게 말해 보세요.', 1146, TRUE),
    ('prompt-opinion-22', 'Do you think social media platforms should do more for society? Why or why not?', '소셜 미디어 플랫폼이 사회를 위해 더 많은 역할을 해야 한다고 보나요? 이유도 말해 주세요.', 'C', 'Opinion Reason - Platform Responsibility', '책임의 범위를 분명하게 말해 보세요.', 1147, TRUE),
    ('prompt-opinion-23', 'What is one important role that social media platforms should play, and why?', '소셜 미디어 플랫폼이 해야 할 중요한 역할 하나와 그 이유를 말해 주세요.', 'C', 'Opinion Reason - Platform Responsibility', '책임의 범위를 분명하게 말해 보세요.', 1148, TRUE),
    ('prompt-opinion-24', 'In your opinion, what duties do social media platforms have, and what makes them important?', '소셜 미디어 플랫폼에 어떤 책임이 있고, 그것이 왜 중요한지 당신의 의견을 말해 주세요.', 'C', 'Opinion Reason - Platform Responsibility', '책임의 범위를 분명하게 말해 보세요.', 1149, TRUE),
    ('prompt-opinion-25', 'What kind of social responsibility should social media platforms have, and why?', '소셜 미디어 플랫폼이 어떤 사회적 책임을 져야 하는지와 그 이유를 말해 주세요.', 'C', 'Opinion Reason - Platform Responsibility', '책임의 범위를 분명하게 말해 보세요.', 1150, TRUE)
ON DUPLICATE KEY UPDATE
    question_en = VALUES(question_en),
    question_ko = VALUES(question_ko),
    difficulty = VALUES(difficulty),
    topic = VALUES(topic),
    tip = VALUES(tip),
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);
INSERT INTO prompts (
    id,
    question_en,
    question_ko,
    difficulty,
    topic,
    tip,
    display_order,
    is_active
)
VALUES
    ('prompt-reflection-01', 'Describe how your idea of success has changed over time and explain why.', '성공에 대한 생각이 시간이 지나며 어떻게 바뀌었는지와 그 이유를 설명해 주세요.', 'C', 'Change Reflection - Success', '과거와 현재의 차이를 분명하게 적어 보세요.', 1151, TRUE),
    ('prompt-reflection-02', 'What did you use to believe about your idea of success, and what changed your mind?', '성공에 대한 생각에 대해 예전에 어떻게 생각했는지와, 무엇이 생각을 바꿨는지 말해 주세요.', 'C', 'Change Reflection - Success', '과거와 현재의 차이를 분명하게 적어 보세요.', 1152, TRUE),
    ('prompt-reflection-03', 'How has your idea of success changed, and what caused that change?', '성공에 대한 생각이 어떻게 바뀌었고, 그 변화의 원인이 무엇인지 말해 주세요.', 'C', 'Change Reflection - Success', '과거와 현재의 차이를 분명하게 적어 보세요.', 1153, TRUE),
    ('prompt-reflection-04', 'Tell me about a belief you changed about your idea of success and explain the reason.', '성공에 대한 생각에 대해 바뀐 생각 하나와 그 이유를 말해 주세요.', 'C', 'Change Reflection - Success', '과거와 현재의 차이를 분명하게 적어 보세요.', 1154, TRUE),
    ('prompt-reflection-05', 'In what way has your idea of success changed over time?', '성공에 대한 관점이 시간이 지나며 어떻게 바뀌었는지 말해 주세요.', 'C', 'Change Reflection - Success', '과거와 현재의 차이를 분명하게 적어 보세요.', 1155, TRUE),
    ('prompt-reflection-06', 'Describe how your study habits have changed over time and explain why.', '공부 습관에 대한 생각이 시간이 지나며 어떻게 바뀌었는지와 그 이유를 설명해 주세요.', 'C', 'Change Reflection - Study Habits', '무엇이 계기가 되었는지 꼭 넣어 보세요.', 1156, TRUE),
    ('prompt-reflection-07', 'What did you use to believe about your study habits, and what changed your mind?', '공부 습관에 대한 생각에 대해 예전에 어떻게 생각했는지와, 무엇이 생각을 바꿨는지 말해 주세요.', 'C', 'Change Reflection - Study Habits', '무엇이 계기가 되었는지 꼭 넣어 보세요.', 1157, TRUE),
    ('prompt-reflection-08', 'How have your study habits changed, and what caused that change?', '공부 습관에 대한 생각이 어떻게 바뀌었고, 그 변화의 원인이 무엇인지 말해 주세요.', 'C', 'Change Reflection - Study Habits', '무엇이 계기가 되었는지 꼭 넣어 보세요.', 1158, TRUE),
    ('prompt-reflection-09', 'Tell me about a belief you changed about your study habits and explain the reason.', '공부 습관에 대한 생각에 대해 바뀐 생각 하나와 그 이유를 말해 주세요.', 'C', 'Change Reflection - Study Habits', '무엇이 계기가 되었는지 꼭 넣어 보세요.', 1159, TRUE),
    ('prompt-reflection-10', 'In what way have your study habits changed over time?', '공부 습관에 대한 관점이 시간이 지나며 어떻게 바뀌었는지 말해 주세요.', 'C', 'Change Reflection - Study Habits', '무엇이 계기가 되었는지 꼭 넣어 보세요.', 1160, TRUE),
    ('prompt-reflection-11', 'Describe how your view of social media has changed over time and explain why.', '소셜 미디어에 대한 생각이 시간이 지나며 어떻게 바뀌었는지와 그 이유를 설명해 주세요.', 'C', 'Change Reflection - Social Media', '경험이나 사건을 넣으면 설득력이 생깁니다.', 1161, TRUE),
    ('prompt-reflection-12', 'What did you use to believe about your view of social media, and what changed your mind?', '소셜 미디어에 대한 생각에 대해 예전에 어떻게 생각했는지와, 무엇이 생각을 바꿨는지 말해 주세요.', 'C', 'Change Reflection - Social Media', '경험이나 사건을 넣으면 설득력이 생깁니다.', 1162, TRUE),
    ('prompt-reflection-13', 'How has your view of social media changed, and what caused that change?', '소셜 미디어에 대한 생각이 어떻게 바뀌었고, 그 변화의 원인이 무엇인지 말해 주세요.', 'C', 'Change Reflection - Social Media', '경험이나 사건을 넣으면 설득력이 생깁니다.', 1163, TRUE),
    ('prompt-reflection-14', 'Tell me about a belief you changed about your view of social media and explain the reason.', '소셜 미디어에 대한 생각에 대해 바뀐 생각 하나와 그 이유를 말해 주세요.', 'C', 'Change Reflection - Social Media', '경험이나 사건을 넣으면 설득력이 생깁니다.', 1164, TRUE),
    ('prompt-reflection-15', 'In what way has your view of social media changed over time?', '소셜 미디어에 대한 관점이 시간이 지나며 어떻게 바뀌었는지 말해 주세요.', 'C', 'Change Reflection - Social Media', '경험이나 사건을 넣으면 설득력이 생깁니다.', 1165, TRUE),
    ('prompt-reflection-16', 'Describe how your opinion about money has changed over time and explain why.', '돈에 대한 생각이 시간이 지나며 어떻게 바뀌었는지와 그 이유를 설명해 주세요.', 'C', 'Change Reflection - Money', '예전과 지금의 기준을 비교해 보세요.', 1166, TRUE),
    ('prompt-reflection-17', 'What did you use to believe about your opinion about money, and what changed your mind?', '돈에 대한 생각에 대해 예전에 어떻게 생각했는지와, 무엇이 생각을 바꿨는지 말해 주세요.', 'C', 'Change Reflection - Money', '예전과 지금의 기준을 비교해 보세요.', 1167, TRUE),
    ('prompt-reflection-18', 'How has your opinion about money changed, and what caused that change?', '돈에 대한 생각이 어떻게 바뀌었고, 그 변화의 원인이 무엇인지 말해 주세요.', 'C', 'Change Reflection - Money', '예전과 지금의 기준을 비교해 보세요.', 1168, TRUE),
    ('prompt-reflection-19', 'Tell me about a belief you changed about your opinion about money and explain the reason.', '돈에 대한 생각에 대해 바뀐 생각 하나와 그 이유를 말해 주세요.', 'C', 'Change Reflection - Money', '예전과 지금의 기준을 비교해 보세요.', 1169, TRUE),
    ('prompt-reflection-20', 'In what way has your opinion about money changed over time?', '돈에 대한 관점이 시간이 지나며 어떻게 바뀌었는지 말해 주세요.', 'C', 'Change Reflection - Money', '예전과 지금의 기준을 비교해 보세요.', 1170, TRUE),
    ('prompt-reflection-21', 'Describe how your understanding of leadership has changed over time and explain why.', '리더십에 대한 이해가 시간이 지나며 어떻게 바뀌었는지와 그 이유를 설명해 주세요.', 'C', 'Change Reflection - Leadership', '생각이 바뀐 이유를 구체적으로 적어 보세요.', 1171, TRUE),
    ('prompt-reflection-22', 'What did you use to believe about your understanding of leadership, and what changed your mind?', '리더십에 대한 이해에 대해 예전에 어떻게 생각했는지와, 무엇이 생각을 바꿨는지 말해 주세요.', 'C', 'Change Reflection - Leadership', '생각이 바뀐 이유를 구체적으로 적어 보세요.', 1172, TRUE),
    ('prompt-reflection-23', 'How has your understanding of leadership changed, and what caused that change?', '리더십에 대한 이해가 어떻게 바뀌었고, 그 변화의 원인이 무엇인지 말해 주세요.', 'C', 'Change Reflection - Leadership', '생각이 바뀐 이유를 구체적으로 적어 보세요.', 1173, TRUE),
    ('prompt-reflection-24', 'Tell me about a belief you changed about your understanding of leadership and explain the reason.', '리더십에 대한 이해에 대해 바뀐 생각 하나와 그 이유를 말해 주세요.', 'C', 'Change Reflection - Leadership', '생각이 바뀐 이유를 구체적으로 적어 보세요.', 1174, TRUE),
    ('prompt-reflection-25', 'In what way has your understanding of leadership changed over time?', '리더십에 대한 관점이 시간이 지나며 어떻게 바뀌었는지 말해 주세요.', 'C', 'Change Reflection - Leadership', '생각이 바뀐 이유를 구체적으로 적어 보세요.', 1175, TRUE)
ON DUPLICATE KEY UPDATE
    question_en = VALUES(question_en),
    question_ko = VALUES(question_ko),
    difficulty = VALUES(difficulty),
    topic = VALUES(topic),
    tip = VALUES(tip),
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);
INSERT INTO prompts (
    id,
    question_en,
    question_ko,
    difficulty,
    topic,
    tip,
    display_order,
    is_active
)
VALUES
    ('prompt-general-01', 'Describe a useful app you use often and explain why it is meaningful to you.', '자주 쓰는 유용한 앱을 설명하고, 왜 의미 있는지 말해 주세요.', 'B', 'General - Useful App', '무엇이 편리한지와 구체적 사용 예를 적어 보세요.', 1176, TRUE),
    ('prompt-general-02', 'Talk about a useful app you use often and tell me what stands out about it.', '자주 쓰는 유용한 앱에 대해 말하고, 무엇이 특히 두드러지는지 설명해 주세요.', 'B', 'General - Useful App', '무엇이 편리한지와 구체적 사용 예를 적어 보세요.', 1177, TRUE),
    ('prompt-general-03', 'Introduce a useful app you use often and explain why you would recommend it.', '자주 쓰는 유용한 앱을 소개하고, 왜 추천할 만한지 설명해 주세요.', 'B', 'General - Useful App', '무엇이 편리한지와 구체적 사용 예를 적어 보세요.', 1178, TRUE),
    ('prompt-general-04', 'What is special about a useful app you use often, and why do you remember it?', '자주 쓰는 유용한 앱의 특별한 점은 무엇이고, 왜 기억에 남나요?', 'B', 'General - Useful App', '무엇이 편리한지와 구체적 사용 예를 적어 보세요.', 1179, TRUE),
    ('prompt-general-05', 'Tell me about a useful app you use often and explain why it matters in your life.', '자주 쓰는 유용한 앱에 대해 말하고, 왜 삶에서 중요했는지 설명해 주세요.', 'B', 'General - Useful App', '무엇이 편리한지와 구체적 사용 예를 적어 보세요.', 1180, TRUE),
    ('prompt-general-06', 'Describe a place in your town that you like and explain why it is meaningful to you.', '내가 좋아하는 동네의 장소를 설명하고, 왜 의미 있는지 말해 주세요.', 'B', 'General - Place in Your Town', '장소의 분위기와 이유를 함께 설명해 보세요.', 1181, TRUE),
    ('prompt-general-07', 'Talk about a place in your town that you like and tell me what stands out about it.', '내가 좋아하는 동네의 장소에 대해 말하고, 무엇이 특히 두드러지는지 설명해 주세요.', 'B', 'General - Place in Your Town', '장소의 분위기와 이유를 함께 설명해 보세요.', 1182, TRUE),
    ('prompt-general-08', 'Introduce a place in your town that you like and explain why you would recommend it.', '내가 좋아하는 동네의 장소를 소개하고, 왜 추천할 만한지 설명해 주세요.', 'B', 'General - Place in Your Town', '장소의 분위기와 이유를 함께 설명해 보세요.', 1183, TRUE),
    ('prompt-general-09', 'What is special about a place in your town that you like, and why do you remember it?', '내가 좋아하는 동네의 장소의 특별한 점은 무엇이고, 왜 기억에 남나요?', 'B', 'General - Place in Your Town', '장소의 분위기와 이유를 함께 설명해 보세요.', 1184, TRUE),
    ('prompt-general-10', 'Tell me about a place in your town that you like and explain why it matters in your life.', '내가 좋아하는 동네의 장소에 대해 말하고, 왜 삶에서 중요했는지 설명해 주세요.', 'B', 'General - Place in Your Town', '장소의 분위기와 이유를 함께 설명해 보세요.', 1185, TRUE),
    ('prompt-general-11', 'Describe a teacher or mentor who influenced you and explain why it is meaningful to you.', '영향을 준 선생님이나 멘토를 설명하고, 왜 의미 있는지 말해 주세요.', 'B', 'General - Teacher or Mentor', '무엇을 배웠는지 한 문장으로 정리해 보세요.', 1186, TRUE),
    ('prompt-general-12', 'Talk about a teacher or mentor who influenced you and tell me what stands out about it.', '영향을 준 선생님이나 멘토에 대해 말하고, 무엇이 특히 두드러지는지 설명해 주세요.', 'B', 'General - Teacher or Mentor', '무엇을 배웠는지 한 문장으로 정리해 보세요.', 1187, TRUE),
    ('prompt-general-13', 'Introduce a teacher or mentor who influenced you and explain why you would recommend it.', '영향을 준 선생님이나 멘토를 소개하고, 왜 추천할 만한지 설명해 주세요.', 'B', 'General - Teacher or Mentor', '무엇을 배웠는지 한 문장으로 정리해 보세요.', 1188, TRUE),
    ('prompt-general-14', 'What is special about a teacher or mentor who influenced you, and why do you remember it?', '영향을 준 선생님이나 멘토의 특별한 점은 무엇이고, 왜 기억에 남나요?', 'B', 'General - Teacher or Mentor', '무엇을 배웠는지 한 문장으로 정리해 보세요.', 1189, TRUE),
    ('prompt-general-15', 'Tell me about a teacher or mentor who influenced you and explain why it matters in your life.', '영향을 준 선생님이나 멘토에 대해 말하고, 왜 삶에서 중요했는지 설명해 주세요.', 'B', 'General - Teacher or Mentor', '무엇을 배웠는지 한 문장으로 정리해 보세요.', 1190, TRUE),
    ('prompt-general-16', 'Describe a hobby you would recommend to others and explain why it is meaningful to you.', '다른 사람에게 추천하고 싶은 취미를 설명하고, 왜 의미 있는지 말해 주세요.', 'B', 'General - Recommended Hobby', '추천 이유와 장점을 구체적으로 적어 보세요.', 1191, TRUE),
    ('prompt-general-17', 'Talk about a hobby you would recommend to others and tell me what stands out about it.', '다른 사람에게 추천하고 싶은 취미에 대해 말하고, 무엇이 특히 두드러지는지 설명해 주세요.', 'B', 'General - Recommended Hobby', '추천 이유와 장점을 구체적으로 적어 보세요.', 1192, TRUE),
    ('prompt-general-18', 'Introduce a hobby you would recommend to others and explain why you would recommend it.', '다른 사람에게 추천하고 싶은 취미를 소개하고, 왜 추천할 만한지 설명해 주세요.', 'B', 'General - Recommended Hobby', '추천 이유와 장점을 구체적으로 적어 보세요.', 1193, TRUE),
    ('prompt-general-19', 'What is special about a hobby you would recommend to others, and why do you remember it?', '다른 사람에게 추천하고 싶은 취미의 특별한 점은 무엇이고, 왜 기억에 남나요?', 'B', 'General - Recommended Hobby', '추천 이유와 장점을 구체적으로 적어 보세요.', 1194, TRUE),
    ('prompt-general-20', 'Tell me about a hobby you would recommend to others and explain why it matters in your life.', '다른 사람에게 추천하고 싶은 취미에 대해 말하고, 왜 삶에서 중요했는지 설명해 주세요.', 'B', 'General - Recommended Hobby', '추천 이유와 장점을 구체적으로 적어 보세요.', 1195, TRUE),
    ('prompt-general-21', 'Describe a memory that still matters to you and explain why it is meaningful to you.', '지금도 의미 있는 기억을 설명하고, 왜 의미 있는지 말해 주세요.', 'B', 'General - Meaningful Memory', '왜 기억에 남는지 감정과 함께 말해 보세요.', 1196, TRUE),
    ('prompt-general-22', 'Talk about a memory that still matters to you and tell me what stands out about it.', '지금도 의미 있는 기억에 대해 말하고, 무엇이 특히 두드러지는지 설명해 주세요.', 'B', 'General - Meaningful Memory', '왜 기억에 남는지 감정과 함께 말해 보세요.', 1197, TRUE),
    ('prompt-general-23', 'Introduce a memory that still matters to you and explain why you would recommend it.', '지금도 의미 있는 기억을 소개하고, 왜 추천할 만한지 설명해 주세요.', 'B', 'General - Meaningful Memory', '왜 기억에 남는지 감정과 함께 말해 보세요.', 1198, TRUE),
    ('prompt-general-24', 'What is special about a memory that still matters to you, and why do you remember it?', '지금도 의미 있는 기억의 특별한 점은 무엇이고, 왜 기억에 남나요?', 'B', 'General - Meaningful Memory', '왜 기억에 남는지 감정과 함께 말해 보세요.', 1199, TRUE),
    ('prompt-general-25', 'Tell me about a memory that still matters to you and explain why it matters in your life.', '지금도 의미 있는 기억에 대해 말하고, 왜 삶에서 중요했는지 설명해 주세요.', 'B', 'General - Meaningful Memory', '왜 기억에 남는지 감정과 함께 말해 보세요.', 1200, TRUE)
ON DUPLICATE KEY UPDATE
    question_en = VALUES(question_en),
    question_ko = VALUES(question_ko),
    difficulty = VALUES(difficulty),
    topic = VALUES(topic),
    tip = VALUES(tip),
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'ROUTINE',
    '["habit","daily_life","leisure"]',
    '["starter_routine","frequency","activity","companion","time_marker"]',
    '["generic_example_marker","formal_conclusion","compare_balance"]',
    'DIRECT',
    '루틴형 질문입니다. 빈도와 시간표지, 활동 표현을 우선 추천합니다.'
FROM prompts
WHERE id LIKE 'prompt-routine-%'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'PREFERENCE',
    '["preference","reason","personal"]',
    '["favorite","reason","adjective","example"]',
    '["compare_balance","formal_conclusion"]',
    'DIRECT',
    '선호형 질문입니다. favorite, because, 형용사 표현을 우선 추천합니다.'
FROM prompts
WHERE id LIKE 'prompt-preference-%'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'GOAL_PLAN',
    '["goal","plan","growth"]',
    '["goal","plan","process","result","reason"]',
    '["generic_example_marker","formal_conclusion"]',
    'DIRECT',
    '목표형 질문입니다. 목표, 계획, 실행 과정을 살리는 표현을 우선 추천합니다.'
FROM prompts
WHERE id LIKE 'prompt-goal-%'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'PROBLEM_SOLUTION',
    '["experience","problem","solution"]',
    '["problem","response","sequence","result"]',
    '["generic_example_marker"]',
    'REFLECTIVE',
    '문제 해결형 질문입니다. 문제-대응-결과 흐름을 우선 추천합니다.'
FROM prompts
WHERE id LIKE 'prompt-problem-%'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'BALANCED_OPINION',
    '["opinion","balance","issue"]',
    '["starter_topic","contrast","opinion","qualification"]',
    '["generic_example_marker"]',
    'BALANCED',
    '균형형 질문입니다. 장단점 비교와 조건부 평가 표현을 우선 추천합니다.'
FROM prompts
WHERE id LIKE 'prompt-balance-%'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'OPINION_REASON',
    '["opinion","reason","society"]',
    '["opinion","responsibility","reason","example"]',
    '["generic_example_marker","casual_habit"]',
    'DIRECT',
    '입장형 질문입니다. 주장과 근거, 구체 예시 표현을 우선 추천합니다.'
FROM prompts
WHERE id LIKE 'prompt-opinion-%'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'CHANGE_REFLECTION',
    '["reflection","change","cause"]',
    '["past_present","change","cause","realization"]',
    '["generic_example_marker"]',
    'REFLECTIVE',
    '변화 회고형 질문입니다. 과거-현재 대비와 변화 계기 표현을 우선 추천합니다.'
FROM prompts
WHERE id LIKE 'prompt-reflection-%'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'GENERAL',
    '["general","description","detail"]',
    '["starter","detail","example","reason"]',
    '["formal_conclusion"]',
    'DIRECT',
    '일반 설명형 질문입니다. 기본 starter와 detail, example 표현을 우선 추천합니다.'
FROM prompts
WHERE id LIKE 'prompt-general-%'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);
