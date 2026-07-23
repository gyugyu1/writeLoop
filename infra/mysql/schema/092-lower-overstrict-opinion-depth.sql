-- Lower overstrict depth requirements for opinion questions that ask for one position.
-- Each reviewed question is adequately answered by the required OPINION plus one
-- concrete supporting slot. Explicit multi-part obligations remain required slots.

DROP TEMPORARY TABLE IF EXISTS tmp_opinion_depth_review;
CREATE TEMPORARY TABLE tmp_opinion_depth_review (
    prompt_id VARCHAR(64) NOT NULL PRIMARY KEY,
    review_rationale TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_opinion_depth_review (prompt_id, review_rationale) VALUES
    ('prompt-c-2', '질문은 성공한 기업의 사회적 책임에 대한 입장을 요구하지만 여러 뒷받침 항목을 별도로 요구하지 않는다. 구체적인 이유, 예시 또는 결과 중 하나면 입장을 충분히 뒷받침한다.'),
    ('prompt-opinion-01', '질문은 성공한 기업의 사회적 책임을 제안하게 하지만 여러 근거를 명시적으로 요구하지 않는다. 구체적인 이유, 예시, 결과 또는 문제 중 하나면 의견을 충분히 뒷받침한다.'),
    ('prompt-opinion-06', '질문은 대도시 대중교통의 책임을 묻지만 여러 뒷받침 항목을 요구하지 않는다. 구체적인 이유, 예시, 결과 또는 문제 중 하나면 의견을 충분히 발전시킨다.'),
    ('prompt-opinion-11', '질문은 금융 역량 교육 기관의 책임을 묻지만 여러 형태의 근거를 요구하지 않는다. 구체적인 이유, 예시, 결과 또는 문제 중 하나면 제안한 책임을 충분히 설명한다.'),
    ('prompt-opinion-1102', '질문은 공공 박물관의 지역사회 책임에 대한 판단을 요구하지만 별도의 뒷받침 항목들을 요구하지 않는다. 구체적인 이유, 예시, 결과 또는 세부 내용 중 하나면 답변을 충분히 발전시킨다.'),
    ('prompt-opinion-1104', '질문은 대학의 역할을 묻지만 교육, 연구, 공적 생활을 각각 논의하라고 요구하지 않는다. 구체적인 이유, 예시, 결과 또는 문제 중 하나면 의견을 충분히 뒷받침한다.'),
    ('prompt-opinion-1105', '학습자는 지역 뉴스 매체의 지역사회 책임을 제시해야 하지만 문항은 여러 근거를 요구하지 않는다. 구체적인 이유, 예시, 결과 또는 문제 중 하나면 그 책임을 충분히 뒷받침한다.'),
    ('prompt-opinion-1108', '질문은 공공 보건 캠페인의 책임을 묻지만 여러 뒷받침 항목을 명시적으로 요구하지 않는다. 구체적인 이유, 예시, 결과 또는 문제 중 하나면 제안을 충분히 설명한다.'),
    ('prompt-opinion-1109', '질문은 인공지능을 사용하는 기업이 무엇을 해야 하는지 묻지만 문제와 해결책을 모두 요구하지 않는다. 구체적인 이유, 문제, 해결책, 결과 또는 예시 중 하나면 입장을 충분히 발전시킨다.'),
    ('prompt-opinion-1111', '질문은 공영 방송사의 지역사회 책임을 묻지만 여러 뒷받침 항목을 명시적으로 요구하지 않는다. 구체적인 이유, 예시, 결과 또는 문제 중 하나면 그 책임을 충분히 설명한다.'),
    ('prompt-opinion-1114', '문항은 방과 후 프로그램의 지역사회 책임을 묻지만 여러 독립적인 근거를 요구하지 않는다. 구체적인 이유, 예시, 결과 또는 문제 중 하나면 그 책임을 아동의 필요와 충분히 연결한다.'),
    ('prompt-opinion-1115', '질문은 기차역이 사람과 지역사회를 어떻게 지원해야 하는지 묻지만 두 대상이 별도의 두 답변을 요구하는 것은 아니다. 구체적인 이유, 예시, 결과 또는 문제 중 하나면 제안을 충분히 뒷받침한다.'),
    ('prompt-opinion-1117', '질문은 인턴십 제공자의 책임을 묻지만 기준과 영향을 각각 요구하지 않는다. 구체적인 이유, 예시, 결과 또는 문제 중 하나면 제안한 책임을 충분히 뒷받침한다.'),
    ('prompt-opinion-1120', '질문은 지방 정부가 폭염 대피소를 운영할 때의 책임을 묻지만 여러 뒷받침 범주를 요구하지 않는다. 구체적인 이유, 문제, 해결책, 결과 또는 예시 중 하나면 의견을 충분히 발전시킨다.'),
    ('prompt-opinion-1126', '질문은 공공 수영장의 지역사회 책임을 묻지만 이용 기회, 안전, 서비스를 각각 요구하지 않는다. 구체적인 이유, 예시, 결과 또는 문제 중 하나면 판단을 충분히 뒷받침한다.'),
    ('prompt-opinion-21', '질문은 소셜 미디어 플랫폼의 책임에 대한 의견을 묻지만 여러 뒷받침 범주를 요구하지 않는다. 구체적인 이유, 문제, 해결책, 결과 또는 예시 중 하나면 제안한 책임을 충분히 발전시킨다.'),
    ('prompt-opinion-28', '질문은 공공 도서관의 중요성을 판단하게 하지만 근거와 영향을 각각 요구하지 않는다. 구체적인 이유, 결과, 예시 또는 세부 내용 중 하나면 판단을 충분히 뒷받침한다.'),
    ('prompt-opinion-33', '질문은 학교 교복의 중요성에 대한 판단을 요구하지만 여러 관점을 명시적으로 요구하지 않는다. 구체적인 이유, 결과, 예시, 장점 또는 단점 중 하나면 의견을 충분히 발전시킨다.'),
    ('prompt-opinion-38', '질문은 재활용 프로그램의 중요성을 묻지만 근거와 영향을 각각 요구하지 않는다. 구체적인 이유, 결과, 예시 또는 문제 중 하나면 평가를 충분히 뒷받침한다.'),
    ('prompt-opinion-43', '질문은 청소년 아르바이트의 중요성에 대한 판단을 요구하지만 여러 관점을 요구하지 않는다. 구체적인 이유, 결과, 예시, 장점 또는 단점 중 하나면 의견을 충분히 발전시킨다.'),
    ('prompt-opinion-48', '질문은 지역사회 예술 프로그램의 중요성을 판단하게 하지만 근거와 영향을 각각 요구하지 않는다. 구체적인 이유, 결과, 예시 또는 세부 내용 중 하나면 판단을 충분히 뒷받침한다.');

UPDATE prompt_task_profiles profile
JOIN tmp_opinion_depth_review reviewed
  ON reviewed.prompt_id = profile.prompt_id
SET profile.minimum_depth_slots = 1,
    profile.review_rationale = reviewed.review_rationale;

DROP TEMPORARY TABLE IF EXISTS tmp_opinion_depth_review;
