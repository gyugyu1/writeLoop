-- Make three active questions state every required content obligation explicitly.

SET NAMES utf8mb4;

START TRANSACTION;

UPDATE prompts
SET question_en = 'What do you usually do after dinner, and why do you do it?',
    question_ko = '저녁 식사 후에 보통 무엇을 하며, 왜 그 일을 하나요?',
    tip = '저녁 식사 후에 하는 활동과 그 이유를 함께 말해 보세요.'
WHERE id = 'prompt-a-1'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'What do you usually do on weekends, and where do you usually do it?',
    question_ko = '주말에는 보통 무엇을 하며, 주로 어디에서 하나요?',
    tip = '주말에 하는 활동과 그 활동을 하는 장소를 함께 말해 보세요.'
WHERE id = 'prompt-a-3'
  AND is_active = 1;

UPDATE prompts
SET question_en = 'Describe how your view of friendship has changed over time and explain what caused the change.',
    question_ko = '우정에 대한 생각이 시간이 지나며 어떻게 바뀌었는지, 그리고 무엇이 그 변화를 일으켰는지 설명해 주세요.',
    tip = '과거와 현재의 생각을 비교하고, 생각이 바뀐 구체적인 계기를 함께 설명해 보세요.'
WHERE id = 'prompt-reflection-26'
  AND is_active = 1;

DROP TEMPORARY TABLE IF EXISTS tmp_prompt_slot_promotions_095;
CREATE TEMPORARY TABLE tmp_prompt_slot_promotions_095 (
    prompt_id VARCHAR(64) NOT NULL,
    slot_code VARCHAR(64) NOT NULL,
    required_order INT NOT NULL,
    PRIMARY KEY (prompt_id, slot_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_prompt_slot_promotions_095 (prompt_id, slot_code, required_order)
VALUES
    ('prompt-a-1', 'REASON', 2),
    ('prompt-a-3', 'PLACE', 2),
    ('prompt-reflection-26', 'CHANGE_CAUSE', 3);

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
    promotion.required_order,
    optional_assignment.semantic_role_en,
    optional_assignment.satisfied_when_en,
    optional_assignment.semantic_role_ko,
    optional_assignment.satisfied_when_ko,
    1
FROM tmp_prompt_slot_promotions_095 promotion
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
JOIN tmp_prompt_slot_promotions_095 promotion
  ON promotion.prompt_id = optional_assignment.prompt_id
 AND promotion.slot_code = slot.code
SET optional_assignment.is_active = 0
WHERE optional_assignment.slot_role = 'OPTIONAL';

UPDATE prompt_task_profiles
SET minimum_depth_slots = 0,
    review_rationale = CASE prompt_id
        WHEN 'prompt-a-1' THEN '질문에서 저녁 식사 후의 활동과 이유를 직접 요구하므로 ACTION과 REASON을 필수 슬롯으로 사용하고 별도의 숨은 깊이 슬롯은 요구하지 않는다.'
        WHEN 'prompt-a-3' THEN '질문에서 주말 활동과 그 장소를 직접 요구하므로 ACTION과 PLACE를 필수 슬롯으로 사용하고 별도의 숨은 깊이 슬롯은 요구하지 않는다.'
        WHEN 'prompt-reflection-26' THEN '질문에서 과거 관점, 현재 관점, 변화 원인을 직접 요구하므로 BEFORE_STATE, NOW_STATE, CHANGE_CAUSE를 필수 슬롯으로 사용하고 별도의 숨은 깊이 슬롯은 요구하지 않는다.'
        ELSE review_rationale
    END
WHERE prompt_id IN ('prompt-a-1', 'prompt-a-3', 'prompt-reflection-26')
  AND is_active = 1;

UPDATE prompt_hint_items
SET content = 'After dinner, I usually ... because ...',
    meaning_ko = '저녁 식사 후에 저는 보통 ...해요. 왜냐하면 ...이기 때문이에요.',
    usage_tip_ko = '저녁 식사 후에 하는 활동과 그 이유를 한 문장으로 연결할 때 사용하세요.',
    example_en = 'After dinner, I usually take a walk because it helps me relax.'
WHERE id = 'hint-a-1-1-item-1';

UPDATE prompt_hint_items
SET content = '저녁 식사 후에 하는 활동을 말한 뒤, 그 활동을 하는 구체적인 이유를 이어 보세요.'
WHERE id = 'hint-a-1-4-item-1';

UPDATE prompt_hint_items
SET content = 'On weekends, I usually ... at ...',
    meaning_ko = '주말에 저는 보통 ...에서 ...해요.',
    usage_tip_ko = '주말에 하는 활동과 그 활동을 하는 장소를 한 문장으로 연결할 때 사용하세요.',
    example_en = 'On weekends, I usually exercise at the gym.'
WHERE id = 'hint-a-3-1-item-1';

UPDATE prompt_hint_items
SET content = '주말에 하는 활동을 말한 뒤, 그 활동을 하는 장소를 이어 보세요.'
WHERE id = 'hint-a-3-4-item-1';

UPDATE prompt_hint_items
SET content = 'I used to think ..., but now I think ... because ...',
    meaning_ko = '예전에는 ...라고 생각했지만, 지금은 ...라고 생각해요. 왜냐하면 ...이기 때문이에요.',
    usage_tip_ko = '과거와 현재의 우정관을 비교하고 생각이 바뀐 계기를 연결할 때 사용하세요.',
    example_en = 'I used to think friends had to talk every day, but now I think trust matters more because a close friend supported me during a difficult time.'
WHERE id = 'hint-refl-26-1-item-1';

UPDATE prompt_hint_items
SET content = 'I used to think ..., but now I think ... because ...',
    meaning_ko = '예전에는 ...라고 생각했지만, 지금은 ...라고 생각해요. 왜냐하면 ...이기 때문이에요.',
    usage_tip_ko = '과거 생각, 현재 생각, 변화의 원인을 순서대로 이어 보세요.',
    example_en = 'I used to think having many friends was important, but now I think a few trusted friends are enough because one difficult experience showed me who truly cared.'
WHERE id = 'hint-refl-26-4-item-1';

DROP TEMPORARY TABLE IF EXISTS tmp_prompt_slot_promotions_095;

COMMIT;
