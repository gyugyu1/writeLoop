package com.writeloop.config;

import com.writeloop.dto.PromptHintItemDto;
import com.writeloop.persistence.PromptCoachProfileEntity;
import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.PromptHintEntity;
import com.writeloop.persistence.PromptHintRepository;
import com.writeloop.persistence.PromptRepository;
import com.writeloop.service.PromptCoachProfileSupport;
import com.writeloop.service.PromptHintItemSupport;
import com.writeloop.service.PromptTopicSupport;
import jakarta.persistence.EntityManager;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

@Configuration
public class PromptSeedConfig {

    @Bean
    ApplicationRunner promptSeeder(
            PromptRepository promptRepository,
            PromptHintRepository promptHintRepository,
            JdbcTemplate jdbcTemplate,
            PromptCoachProfileSupport promptCoachProfileSupport,
            PromptHintItemSupport promptHintItemSupport,
            PromptTopicSupport promptTopicSupport,
            TransactionTemplate transactionTemplate,
            EntityManager entityManager
    ) {
        return args -> transactionTemplate.executeWithoutResult(status -> {
            normalizeLegacyPrompts(jdbcTemplate);
            promptTopicSupport.ensureCatalogSeeded();
            backfillNormalizedPromptTopicRefs(jdbcTemplate, promptTopicSupport);

            seededPrompts().forEach(prompt -> upsertSeedPrompt(promptRepository, entityManager, promptTopicSupport, prompt));
            seededHints().forEach(hint -> upsertSeedHint(promptHintRepository, promptHintItemSupport, entityManager, hint));

            promptRepository.findAllByOrderByDisplayOrderAsc().forEach(prompt -> {
                if (!promptCoachProfileSupport.shouldRefreshSeededProfile(prompt)) {
                    return;
                }

                PromptCoachProfileEntity profile = prompt.getCoachProfile();
                if (profile == null) {
                    PromptCoachProfileEntity seededProfile = promptCoachProfileSupport.toEntity(
                            prompt,
                            promptCoachProfileSupport.defaultProfileForPrompt(prompt)
                    );
                    prompt.upsertCoachProfile(seededProfile);
                    entityManager.persist(seededProfile);
                    return;
                }

                promptCoachProfileSupport.upsertProfile(
                        prompt,
                        promptCoachProfileSupport.defaultProfileForPrompt(prompt)
                );
            });

            backfillLegacyHintItemsFromRawContent(jdbcTemplate, promptHintItemSupport);

            entityManager.flush();
        });
    }

    private List<PromptEntity> seededPrompts() {
        return List.of(
                prompt(
                        "prompt-a-1",
                        "Routine - After Dinner",
                        "A",
                        "What do you usually do after dinner?",
                        "저녁을 먹고 난 뒤에는 보통 무엇을 하나요?",
                        "시간 순서와 자주 하는 행동을 함께 말해 보세요.",
                        1
                ),
                prompt(
                        "prompt-a-2",
                        "Preference - Favorite Food",
                        "A",
                        "What is your favorite food, and why do you like it?",
                        "가장 좋아하는 음식은 무엇이고, 왜 좋아하나요?",
                        "좋아하는 이유를 형용사와 함께 말해 보세요.",
                        2
                ),
                prompt(
                        "prompt-a-3",
                        "Routine - Weekend",
                        "A",
                        "How do you usually spend your weekend?",
                        "주말은 보통 어떻게 보내나요?",
                        "장소나 함께 있는 사람도 함께 덧붙여 보세요.",
                        3
                ),
                prompt(
                        "prompt-b-1",
                        "Problem Solving - Work or School Challenge",
                        "B",
                        "What is one challenge you often face at work or school, and how do you deal with it?",
                        "직장이나 학교에서 자주 겪는 어려움 한 가지와 그에 어떻게 대응하는지 말해 주세요.",
                        "문제와 대응 방법, 결과를 함께 설명해 보세요.",
                        4
                ),
                prompt(
                        "prompt-b-2",
                        "Goal Plan - Travel Destination",
                        "B",
                        "Describe a city you want to visit and explain what you would like to do there.",
                        "가 보고 싶은 도시 하나를 설명하고, 그곳에서 무엇을 하고 싶은지 말해 주세요.",
                        "가고 싶은 이유와 그곳에서 하고 싶은 활동을 함께 말해 보세요.",
                        5
                ),
                prompt(
                        "prompt-b-3",
                        "Goal Plan - Habit Building",
                        "B",
                        "What is one habit you want to build this year, and why is it important to you?",
                        "올해 만들고 싶은 습관 한 가지와 그것이 왜 중요한지 설명해 주세요.",
                        "목표와 이유, 실천 방법을 함께 넣어 보세요.",
                        6
                ),
                prompt(
                        "prompt-c-1",
                        "Balanced Opinion - Technology and Relationships",
                        "C",
                        "How has technology changed the way people build relationships, and do you think that change is mostly positive?",
                        "기술이 사람들이 관계를 맺는 방식을 어떻게 바꾸었고, 그 변화가 대체로 긍정적인지 말해 주세요.",
                        "장점과 단점을 모두 언급한 뒤 입장을 말해 보세요.",
                        7
                ),
                prompt(
                        "prompt-c-2",
                        "Opinion Reason - Corporate Responsibility",
                        "C",
                        "What kind of social responsibility should successful companies have in modern society?",
                        "현대 사회에서 성공한 기업이 어떤 사회적 책임을 가져야 하는지 말해 주세요.",
                        "입장과 근거를 함께 전개해 보세요.",
                        8
                ),
                prompt(
                        "prompt-c-3",
                        "Change Reflection - Personal Belief",
                        "C",
                        "Describe a belief you have changed over time and explain what caused that change.",
                        "시간이 지나며 바뀐 생각이나 신념 한 가지와, 그 변화가 왜 일어났는지 설명해 주세요.",
                        "과거와 현재의 차이, 변화의 계기를 함께 말해 보세요.",
                        9
                ),
                prompt(
                        "prompt-a-4",
                        "Routine - After-Work Evenings",
                        "A",
                        "What do you usually do after work, and why do you enjoy it?",
                        "보통 퇴근 후에 무엇을 하고, 왜 그것을 좋아하는지 이야기해 주세요.",
                        "퇴근 후 하는 일과 그 이유를 함께 말해 보세요.",
                        10
                ),
                prompt(
                        "prompt-b-4",
                        "Goal Plan - Travel Destination",
                        "B",
                        "Tell me about a place you want to visit and what you want to do there.",
                        "가고 싶은 장소와 그곳에서 무엇을 하고 싶은지 설명해 주세요.",
                        "가고 싶은 이유와 하고 싶은 활동을 연결 표현과 함께 말해 보세요.",
                        11
                ),
                prompt(
                        "prompt-b-5",
                        "Goal Plan - Skill Growth",
                        "B",
                        "What is one skill you want to improve this year, and how will you practice it?",
                        "올해 키우고 싶은 능력 한 가지와 그것을 어떻게 연습할지 말해 주세요.",
                        "목표, 연습 루틴, 개인적인 이유를 함께 말해 보세요.",
                        12
                )
        );
    }

    private List<PromptHintEntity> seededHints() {
        return List.of(
                hint("hint-a-1-1", "prompt-a-1", "STARTER", "\"After dinner, I usually...\"로 시작해 보세요.", 1),
                hint("hint-a-1-2", "prompt-a-1", "VOCAB_WORD", "활용 단어: relax, wash the dishes, watch videos, take a walk, get ready for bed", 2),
                hint("hint-a-1-3", "prompt-a-1", "VOCAB_PHRASE", "활용 표현: after dinner, in the evening, before bed, most days, right after I eat", 3),
                hint("hint-a-1-4", "prompt-a-1", "STRUCTURE", "저녁을 먹은 뒤 하는 일 2개와 하루를 마무리하는 행동을 순서대로 이어 보세요.", 4),

                hint("hint-a-2-1", "prompt-a-2", "STARTER", "\"My favorite food is ... because...\"로 시작해 보세요.", 1),
                hint("hint-a-2-2", "prompt-a-2", "VOCAB_WORD", "활용 단어: spicy, savory, sweet, comforting, delicious", 2),
                hint("hint-a-2-3", "prompt-a-2", "VOCAB_PHRASE", "활용 표현: my favorite food, one reason is, I especially like, it tastes, it reminds me of", 3),
                hint("hint-a-2-4", "prompt-a-2", "DETAIL", "맛, 느낌, 자주 먹는 상황 중 2가지를 넣으면 답변이 더 자연스러워져요.", 4),

                hint("hint-a-3-1", "prompt-a-3", "STARTER", "\"On weekends, I usually...\"로 시작해 보세요.", 1),
                hint("hint-a-3-2", "prompt-a-3", "VOCAB_WORD", "활용 단어: rest, meet friends, exercise, study, go out", 2),
                hint("hint-a-3-3", "prompt-a-3", "VOCAB_PHRASE", "활용 표현: on weekends, in the morning, in the afternoon, with my family, most of the time", 3),
                hint("hint-a-3-4", "prompt-a-3", "STRUCTURE", "주말에 하는 활동, 함께하는 사람, 자주 가는 장소를 순서대로 이어 보세요.", 4),

                hint("hint-b-1-1", "prompt-b-1", "STARTER", "\"One challenge I often face at work or school is...\"로 시작해 보세요.", 1),
                hint("hint-b-1-2", "prompt-b-1", "VOCAB_WORD", "활용 단어: deadline, pressure, teamwork, schedule, solution", 2),
                hint("hint-b-1-3", "prompt-b-1", "VOCAB_PHRASE", "활용 표현: I deal with it by, one thing I do is, when this happens, step by step, in the end", 3),
                hint("hint-b-1-4", "prompt-b-1", "STRUCTURE", "어떤 문제인지, 어떻게 대응하는지, 결과가 어땠는지를 순서대로 말해 보세요.", 4),

                hint("hint-b-2-1", "prompt-b-2", "STARTER", "\"One city I want to visit is...\"로 시작해 보세요.", 1),
                hint("hint-b-2-2", "prompt-b-2", "VOCAB_WORD", "활용 단어: culture, scenery, landmark, local food, explore", 2),
                hint("hint-b-2-3", "prompt-b-2", "VOCAB_PHRASE", "활용 표현: I want to visit, I would love to, once I get there, I also want to, because it looks", 3),
                hint("hint-b-2-4", "prompt-b-2", "DETAIL", "가고 싶은 이유 1개와 현지에서 하고 싶은 활동 2개를 함께 적어 보세요.", 4),

                hint("hint-b-3-1", "prompt-b-3", "STARTER", "\"One habit I want to build this year is...\"로 시작해 보세요.", 1),
                hint("hint-b-3-2", "prompt-b-3", "VOCAB_WORD", "활용 단어: consistency, routine, progress, habit, improve", 2),
                hint("hint-b-3-3", "prompt-b-3", "VOCAB_PHRASE", "활용 표현: every day, little by little, stick to it, make time for, because it helps me", 3),
                hint("hint-b-3-4", "prompt-b-3", "STRUCTURE", "만들고 싶은 습관, 중요한 이유, 실천 방법을 차례대로 말해 보세요.", 4),

                hint("hint-c-1-1", "prompt-c-1", "STARTER", "\"Technology has changed relationships in many ways.\"로 시작해 보세요.", 1),
                hint("hint-c-1-2", "prompt-c-1", "VOCAB_WORD", "활용 단어: connection, convenience, distance, misunderstanding, communication", 2),
                hint("hint-c-1-3", "prompt-c-1", "VOCAB_PHRASE", "활용 표현: on the one hand, on the other hand, in some ways, overall, at the same time", 3),
                hint("hint-c-1-4", "prompt-c-1", "STRUCTURE", "긍정적인 변화 1개, 부정적인 변화 1개, 마지막 입장을 순서대로 말해 보세요.", 4),

                hint("hint-c-2-1", "prompt-c-2", "STARTER", "\"Successful companies should take responsibility for...\"로 시작해 보세요.", 1),
                hint("hint-c-2-2", "prompt-c-2", "VOCAB_WORD", "활용 단어: responsibility, employees, community, trust, sustainability", 2),
                hint("hint-c-2-3", "prompt-c-2", "VOCAB_PHRASE", "활용 표현: in my opinion, for example, they should, this matters because, one important role is", 3),
                hint("hint-c-2-4", "prompt-c-2", "DETAIL", "어떤 책임이 필요한지와 그 이유를 구체적인 예 하나와 함께 적어 보세요.", 4),

                hint("hint-c-3-1", "prompt-c-3", "STARTER", "\"I used to believe that..., but now I think...\"로 시작해 보세요.", 1),
                hint("hint-c-3-2", "prompt-c-3", "VOCAB_WORD", "활용 단어: belief, perspective, realize, experience, change", 2),
                hint("hint-c-3-3", "prompt-c-3", "VOCAB_PHRASE", "활용 표현: over time, because of, after I experienced, now I see, what changed my mind was", 3),
                hint("hint-c-3-4", "prompt-c-3", "STRUCTURE", "예전 생각, 바뀐 계기, 지금의 생각을 순서대로 연결해 보세요.", 4),

                hint("hint-a-4-1", "prompt-a-4", "STARTER", "\"After work, I usually...\"로 시작해 보세요.", 1),
                hint("hint-a-4-2", "prompt-a-4", "VOCAB_WORD", "활용 단어: relax, grab dinner, work out, rest, unwind", 2),
                hint("hint-a-4-3", "prompt-a-4", "VOCAB_PHRASE", "활용 표현: after work, when I get home, in the evening, because it helps me, once I finish work", 3),
                hint("hint-a-4-4", "prompt-a-4", "STRUCTURE", "퇴근 후 하는 일과 그 활동을 좋아하는 이유를 한 문장씩 이어 보세요.", 4),

                hint("hint-b-4-1", "prompt-b-4", "STARTER", "\"One place I want to visit is...\"로 시작해 보세요.", 1),
                hint("hint-b-4-2", "prompt-b-4", "VOCAB_WORD", "활용 단어: destination, scenery, museum, food, experience", 2),
                hint("hint-b-4-3", "prompt-b-4", "VOCAB_PHRASE", "활용 표현: I want to go there because, I also want to, so I can, when I visit, one thing I would do", 3),
                hint("hint-b-4-4", "prompt-b-4", "LINKER", "because, also, so를 활용해 이유와 하고 싶은 활동을 자연스럽게 연결해 보세요.", 4),

                hint("hint-b-5-1", "prompt-b-5", "STARTER", "\"One skill I want to improve this year is...\"로 시작해 보세요.", 1),
                hint("hint-b-5-2", "prompt-b-5", "VOCAB_WORD", "활용 단어: practice, improve, routine, confidence, goal", 2),
                hint("hint-b-5-3", "prompt-b-5", "VOCAB_PHRASE", "활용 표현: I plan to, every week, little by little, to get better at, because it will help me", 3),
                hint("hint-b-5-4", "prompt-b-5", "STRUCTURE", "키우고 싶은 능력, 연습 루틴, 개인적인 이유를 한 흐름으로 이어 보세요.", 4)
        );
    }

    private PromptEntity prompt(
            String id,
            String topic,
            String difficulty,
            String questionEn,
            String questionKo,
            String tip,
            int displayOrder
    ) {
        return new PromptEntity(
                id,
                topic,
                difficulty,
                questionEn,
                questionKo,
                tip,
                displayOrder,
                true
        );
    }

    private PromptHintEntity hint(
            String id,
            String promptId,
            String hintType,
            String content,
            int displayOrder
    ) {
        return new PromptHintEntity(
                id,
                promptId,
                hintType,
                null,
                content,
                displayOrder,
                true
        );
    }

    private void upsertSeedPrompt(
            PromptRepository promptRepository,
            EntityManager entityManager,
            PromptTopicSupport promptTopicSupport,
            PromptEntity seededPrompt
    ) {
        seededPrompt.assignTopicDetail(
                promptTopicSupport.requireTopicDetail(seededPrompt.getTopicCategory(), seededPrompt.getTopicDetail())
        );
        PromptEntity existing = promptRepository.findById(seededPrompt.getId()).orElse(null);
        if (existing == null) {
            entityManager.persist(seededPrompt);
            return;
        }

        existing.update(
                seededPrompt.getTopic(),
                seededPrompt.getDifficulty(),
                seededPrompt.getQuestionEn(),
                seededPrompt.getQuestionKo(),
                seededPrompt.getTip(),
                seededPrompt.getDisplayOrder(),
                seededPrompt.getActive()
        );
        existing.assignTopicDetail(
                promptTopicSupport.requireTopicDetail(seededPrompt.getTopicCategory(), seededPrompt.getTopicDetail())
        );
    }

    private void upsertSeedHint(
            PromptHintRepository promptHintRepository,
            PromptHintItemSupport promptHintItemSupport,
            EntityManager entityManager,
            PromptHintEntity seededHint
    ) {
        String resolvedTitle = promptHintItemSupport.resolveTitle(
                seededHint.getTitle(),
                seededHint.getHintType(),
                seededHint.getContent()
        );
        List<String> itemContents = promptHintItemSupport.deriveDtos(seededHint).stream()
                .map(PromptHintItemDto::content)
                .toList();
        String normalizedHintType = promptHintItemSupport.normalizeHintType(
                seededHint.getHintType(),
                resolvedTitle,
                itemContents
        );
        PromptHintEntity existing = promptHintRepository.findById(seededHint.getId()).orElse(null);
        if (existing == null) {
            PromptHintEntity normalizedHint = new PromptHintEntity(
                    seededHint.getId(),
                    seededHint.getPromptId(),
                    normalizedHintType,
                    resolvedTitle,
                    null,
                    seededHint.getDisplayOrder(),
                    seededHint.getActive()
            );
            entityManager.persist(normalizedHint);
            promptHintItemSupport.syncHintItems(normalizedHint, itemContents);
            return;
        }

        existing.update(
                normalizedHintType,
                resolvedTitle,
                null,
                seededHint.getDisplayOrder(),
                seededHint.getActive()
        );
        promptHintItemSupport.syncHintItems(existing, itemContents);
    }

    private void backfillLegacyHintItemsFromRawContent(
            JdbcTemplate jdbcTemplate,
            PromptHintItemSupport promptHintItemSupport
    ) {
        Integer contentColumnExists = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'prompt_hints'
                  AND COLUMN_NAME = 'content'
                """,
                Integer.class
        );

        if (contentColumnExists == null || contentColumnExists == 0) {
            return;
        }

        List<PromptHintEntity> legacyHints = jdbcTemplate.query(
                """
                SELECT id, prompt_id, hint_type, title, content, display_order, is_active
                FROM prompt_hints
                ORDER BY prompt_id, display_order, id
                """,
                (rs, rowNum) -> new PromptHintEntity(
                        rs.getString("id"),
                        rs.getString("prompt_id"),
                        rs.getString("hint_type"),
                        rs.getString("title"),
                        rs.getString("content"),
                        rs.getInt("display_order"),
                        rs.getBoolean("is_active")
                )
        );
        promptHintItemSupport.backfillMissingItems(legacyHints);
    }

    private void normalizeLegacyPrompts(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.update("UPDATE prompts SET difficulty = 'A' WHERE difficulty IN ('A1', 'A2')");
        jdbcTemplate.update("UPDATE prompts SET difficulty = 'B' WHERE difficulty IN ('B1', 'B2')");
        jdbcTemplate.update("UPDATE prompts SET difficulty = 'C' WHERE difficulty IN ('C1', 'C2')");

        migrateLegacyPrompt(jdbcTemplate, "prompt-1", "prompt-a-4", "A", 10);
        migrateLegacyPrompt(jdbcTemplate, "prompt-2", "prompt-b-4", "B", 11);
        migrateLegacyPrompt(jdbcTemplate, "prompt-3", "prompt-b-5", "B", 12);
    }

    private void backfillNormalizedPromptTopicRefs(
            JdbcTemplate jdbcTemplate,
            PromptTopicSupport promptTopicSupport
    ) {
        if (!columnExists(jdbcTemplate, "prompts", "topic_detail_id")) {
            return;
        }

        boolean hasLegacyTopic = columnExists(jdbcTemplate, "prompts", "topic");
        boolean hasSplitTopicCategory = columnExists(jdbcTemplate, "prompts", "topic_category");
        boolean hasSplitTopicDetail = columnExists(jdbcTemplate, "prompts", "topic_detail");

        if (!hasLegacyTopic && !(hasSplitTopicCategory && hasSplitTopicDetail)) {
            return;
        }

        StringBuilder sql = new StringBuilder("""
                SELECT id, topic_detail_id
                """);
        if (hasLegacyTopic) {
            sql.append(", topic");
        }
        if (hasSplitTopicCategory) {
            sql.append(", topic_category");
        }
        if (hasSplitTopicDetail) {
            sql.append(", topic_detail");
        }
        sql.append("""
                
                FROM prompts
                WHERE topic_detail_id IS NULL
                ORDER BY display_order, id
                """);

        jdbcTemplate.query(
                sql.toString(),
                rs -> {
                    if (rs.getObject("topic_detail_id") != null) {
                        return;
                    }

                    String topicCategory = hasSplitTopicCategory ? rs.getString("topic_category") : "";
                    String topicDetail = hasSplitTopicDetail ? rs.getString("topic_detail") : "";
                    if (!hasText(topicCategory) || !hasText(topicDetail)) {
                        PromptEntity.TopicParts topicParts = PromptEntity.splitTopic(hasLegacyTopic ? rs.getString("topic") : "");
                        topicCategory = topicParts.category();
                        topicDetail = topicParts.detail();
                    }

                    String promptId = rs.getString("id");
                    promptTopicSupport.findTopicDetail(topicCategory, topicDetail)
                            .ifPresent(detail -> jdbcTemplate.update(
                                    "UPDATE prompts SET topic_detail_id = ? WHERE id = ?",
                                    detail.getId(),
                                    promptId
                            ));
                }
        );
    }

    private boolean columnExists(JdbcTemplate jdbcTemplate, String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                  AND COLUMN_NAME = ?
                """,
                Integer.class,
                tableName,
                columnName
        );
        return count != null && count > 0;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isBlank();
    }

    private void migrateLegacyPrompt(
            JdbcTemplate jdbcTemplate,
            String oldId,
            String newId,
            String difficulty,
            int displayOrder
    ) {
        Integer oldCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM prompts WHERE id = ?",
                Integer.class,
                oldId
        );
        if (oldCount == null || oldCount == 0) {
            return;
        }

        Integer newCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM prompts WHERE id = ?",
                Integer.class,
                newId
        );

        jdbcTemplate.update("UPDATE answer_sessions SET prompt_id = ? WHERE prompt_id = ?", newId, oldId);
        jdbcTemplate.update("UPDATE coach_interactions SET prompt_id = ? WHERE prompt_id = ?", newId, oldId);

        if (newCount != null && newCount > 0) {
            jdbcTemplate.update("DELETE FROM prompts WHERE id = ?", oldId);
            return;
        }

        jdbcTemplate.update(
                "UPDATE prompts SET id = ?, difficulty = ?, display_order = ? WHERE id = ?",
                newId,
                difficulty,
                displayOrder,
                oldId
        );
    }
}
