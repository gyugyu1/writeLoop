package com.writeloop.config;

import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.PromptCoachProfileRepository;
import com.writeloop.persistence.PromptHintEntity;
import com.writeloop.persistence.PromptHintRepository;
import com.writeloop.persistence.PromptRepository;
import com.writeloop.service.PromptCoachProfileSupport;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

@Configuration
public class PromptSeedConfig {

    @Bean
    ApplicationRunner promptSeeder(
            PromptRepository promptRepository,
            PromptCoachProfileRepository promptCoachProfileRepository,
            PromptHintRepository promptHintRepository,
            JdbcTemplate jdbcTemplate,
            PromptCoachProfileSupport promptCoachProfileSupport
    ) {
        return args -> {
            normalizeLegacyPrompts(jdbcTemplate);

            promptRepository.saveAll(List.of(
                    new PromptEntity(
                            "prompt-a-1",
                            "Daily Routine",
                            "A",
                            "What do you usually do after dinner?",
                            "저녁을 먹고 난 뒤에 보통 무엇을 하나요?",
                            "현재 시제를 사용해서 2~3문장으로 가볍게 답해 보세요.",
                            1,
                            true
                    ),
                    new PromptEntity(
                            "prompt-a-2",
                            "Favorite Things",
                            "A",
                            "What is your favorite food, and why do you like it?",
                            "가장 좋아하는 음식은 무엇이고, 왜 좋아하나요?",
                            "좋아하는 이유를 한 가지 이상 붙여 보세요.",
                            2,
                            true
                    ),
                    new PromptEntity(
                            "prompt-a-3",
                            "Weekend",
                            "A",
                            "How do you usually spend your weekend?",
                            "주말을 보통 어떻게 보내나요?",
                            "장소나 함께 있는 사람을 함께 말하면 더 좋아요.",
                            3,
                            true
                    ),
                    new PromptEntity(
                            "prompt-b-1",
                            "Work and Study",
                            "B",
                            "What is one challenge you often face at work or school, and how do you deal with it?",
                            "직장이나 학교에서 자주 겪는 어려움 한 가지와 그것을 어떻게 해결하는지 설명해 주세요.",
                            "문제 상황, 해결 방법, 느낀 점까지 연결해 보세요.",
                            4,
                            true
                    ),
                    new PromptEntity(
                            "prompt-b-2",
                            "Travel",
                            "B",
                            "Describe a city you want to visit and explain what you would like to do there.",
                            "가 보고 싶은 도시 하나를 설명하고, 그곳에서 무엇을 하고 싶은지 말해 주세요.",
                            "because, also, especially 같은 연결 표현을 써 보세요.",
                            5,
                            true
                    ),
                    new PromptEntity(
                            "prompt-b-3",
                            "Habits",
                            "B",
                            "What is one habit you want to build this year, and why is it important to you?",
                            "올해 만들고 싶은 습관 한 가지와 그것이 왜 중요한지 설명해 주세요.",
                            "목표와 이유, 실천 방법을 함께 넣어 보세요.",
                            6,
                            true
                    ),
                    new PromptEntity(
                            "prompt-c-1",
                            "Technology",
                            "C",
                            "How has technology changed the way people build relationships, and do you think that change is mostly positive?",
                            "기술이 사람들이 관계를 맺는 방식을 어떻게 바꾸었는지, 그리고 그 변화가 대체로 긍정적인지 설명해 주세요.",
                            "장점과 단점을 모두 다룬 뒤, 본인의 입장을 분명히 밝혀 보세요.",
                            7,
                            true
                    ),
                    new PromptEntity(
                            "prompt-c-2",
                            "Society",
                            "C",
                            "What kind of social responsibility should successful companies have in modern society?",
                            "현대 사회에서 성공한 기업이 어떤 사회적 책임을 가져야 하는지 설명해 주세요.",
                            "구체적인 사례와 기준을 함께 제시하면 더 설득력 있어집니다.",
                            8,
                            true
                    ),
                    new PromptEntity(
                            "prompt-c-3",
                            "Personal Growth",
                            "C",
                            "Describe a belief you have changed over time and explain what caused that change.",
                            "시간이 지나며 바뀐 생각이나 신념 한 가지와, 그 변화가 왜 일어났는지 설명해 주세요.",
                            "과거의 생각, 변화의 계기, 현재의 관점을 구조적으로 써 보세요.",
                            9,
                            true
                    )
            ));

            promptHintRepository.saveAll(List.of(
                    new PromptHintEntity("hint-a-1-1", "prompt-a-1", "STARTER", "\"After dinner, I usually...\"로 시작해 보세요.", 1, true),
                    new PromptHintEntity("hint-a-1-2", "prompt-a-1", "VOCAB", "활용 단어: relax, watch videos, clean up, take a walk", 2, true),
                    new PromptHintEntity("hint-a-1-3", "prompt-a-1", "STARTER", "\"In the evening, I usually...\"처럼 시작해도 자연스러워요.", 3, true),
                    new PromptHintEntity("hint-a-1-4", "prompt-a-1", "VOCAB", "활용 표현: after dinner, in the evening, before bed, every day", 4, true),
                    new PromptHintEntity("hint-a-2-1", "prompt-a-2", "STRUCTURE", "\"My favorite food is ... because ...\" 같은 단순한 구조로 써 보세요.", 1, true),
                    new PromptHintEntity("hint-a-2-2", "prompt-a-2", "DETAIL", "좋아하는 이유 1개와 짧은 예시 1개를 넣으면 답변이 더 분명해져요.", 2, true),
                    new PromptHintEntity("hint-a-2-3", "prompt-a-2", "STARTER", "\"My favorite food is ... because it is...\"로 시작해 보세요.", 3, true),
                    new PromptHintEntity("hint-a-2-4", "prompt-a-2", "VOCAB", "활용 단어: spicy, sweet, soft, delicious, comforting", 4, true),
                    new PromptHintEntity("hint-a-3-1", "prompt-a-3", "STARTER", "\"On weekends, I usually...\"로 시작하면 자연스러워요.", 1, true),
                    new PromptHintEntity("hint-a-3-2", "prompt-a-3", "VOCAB", "활용 단어: stay home, meet friends, rest, study, exercise", 2, true),
                    new PromptHintEntity("hint-a-3-3", "prompt-a-3", "STARTER", "\"I usually spend my weekend...\"처럼 시작해도 좋아요.", 3, true),
                    new PromptHintEntity("hint-a-3-4", "prompt-a-3", "VOCAB", "활용 표현: on Saturday, on Sunday, in the morning, in the afternoon", 4, true),
                    new PromptHintEntity("hint-b-1-1", "prompt-b-1", "STRUCTURE", "문제 상황 -> 나에게 미치는 영향 -> 해결 방법 순서로 써 보세요.", 1, true),
                    new PromptHintEntity("hint-b-1-2", "prompt-b-1", "STARTER", "\"One challenge I often face is...\"로 시작해도 좋아요.", 2, true),
                    new PromptHintEntity("hint-b-1-3", "prompt-b-1", "STARTER", "\"At work/school, I sometimes struggle with...\"도 좋은 시작이에요.", 3, true),
                    new PromptHintEntity("hint-b-1-4", "prompt-b-1", "VOCAB", "활용 단어: deadline, pressure, teamwork, schedule, solve", 4, true),
                    new PromptHintEntity("hint-b-2-1", "prompt-b-2", "DETAIL", "먼저 도시 이름을 말하고, 그곳에서 보고 싶은 것과 하고 싶은 일을 이어서 설명해 보세요.", 1, true),
                    new PromptHintEntity("hint-b-2-2", "prompt-b-2", "LINKER", "for example, also, especially 같은 연결 표현을 써 보세요.", 2, true),
                    new PromptHintEntity("hint-b-2-3", "prompt-b-2", "STARTER", "\"I want to visit ... because...\"로 시작하면 편해요.", 3, true),
                    new PromptHintEntity("hint-b-2-4", "prompt-b-2", "VOCAB", "활용 단어: explore, local food, historic place, culture, scenery", 4, true),
                    new PromptHintEntity("hint-b-3-1", "prompt-b-3", "STRUCTURE", "습관이 무엇인지, 왜 중요한지, 어떻게 유지할지 순서로 쓰면 좋아요.", 1, true),
                    new PromptHintEntity("hint-b-3-2", "prompt-b-3", "VOCAB", "활용 단어: routine, consistency, goal, improve, stick to", 2, true),
                    new PromptHintEntity("hint-b-3-3", "prompt-b-3", "STARTER", "\"One habit I want to build this year is...\"로 시작해 보세요.", 3, true),
                    new PromptHintEntity("hint-b-3-4", "prompt-b-3", "VOCAB", "활용 표현: every morning, little by little, in the long run, keep going", 4, true),
                    new PromptHintEntity("hint-c-1-1", "prompt-c-1", "BALANCE", "긍정적인 변화와 부정적인 변화를 모두 언급한 뒤 내 의견을 말해 보세요.", 1, true),
                    new PromptHintEntity("hint-c-1-2", "prompt-c-1", "LINKER", "활용 표현: on the one hand, on the other hand, overall", 2, true),
                    new PromptHintEntity("hint-c-1-3", "prompt-c-1", "STARTER", "\"Technology has changed relationships in many ways.\"로 시작해 보세요.", 3, true),
                    new PromptHintEntity("hint-c-1-4", "prompt-c-1", "VOCAB", "활용 단어: connection, distance, convenience, isolation, communication", 4, true),
                    new PromptHintEntity("hint-c-2-1", "prompt-c-2", "STRUCTURE", "기업의 책임 -> 구체적인 예시 -> 왜 중요한지 순서로 전개해 보세요.", 1, true),
                    new PromptHintEntity("hint-c-2-2", "prompt-c-2", "DETAIL", "환경, 직원, 소비자, 지역사회 관점 중 2개 이상을 넣으면 더 설득력 있어요.", 2, true),
                    new PromptHintEntity("hint-c-2-3", "prompt-c-2", "STARTER", "\"Successful companies should take responsibility for...\"로 시작해 보세요.", 3, true),
                    new PromptHintEntity("hint-c-2-4", "prompt-c-2", "VOCAB", "활용 단어: fairness, sustainability, employees, community, trust", 4, true),
                    new PromptHintEntity("hint-c-3-1", "prompt-c-3", "STRUCTURE", "과거의 생각과 현재의 생각이 어떻게 달라졌는지 분명하게 비교해 보세요.", 1, true),
                    new PromptHintEntity("hint-c-3-2", "prompt-c-3", "DETAIL", "생각이 바뀐 계기가 된 사건, 대화, 경험 중 하나를 꼭 넣어 보세요.", 2, true),
                    new PromptHintEntity("hint-c-3-3", "prompt-c-3", "STARTER", "\"I used to believe that..., but now I think...\"로 시작해 보세요.", 3, true),
                    new PromptHintEntity("hint-c-3-4", "prompt-c-3", "VOCAB", "활용 단어: perspective, realize, experience, change my mind, value", 4, true)
            ));

            promptRepository.findAllByOrderByDisplayOrderAsc().forEach(prompt -> {
                if (promptCoachProfileSupport.shouldRefreshSeededProfile(prompt)) {
                    promptCoachProfileRepository.save(
                            promptCoachProfileSupport.toEntity(
                                    prompt,
                                    promptCoachProfileSupport.defaultProfileForPrompt(prompt)
                            )
                    );
                }
            });
        };
    }

    private void normalizeLegacyPrompts(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.update("UPDATE prompts SET difficulty = 'A' WHERE difficulty IN ('A1', 'A2')");
        jdbcTemplate.update("UPDATE prompts SET difficulty = 'B' WHERE difficulty IN ('B1', 'B2')");
        jdbcTemplate.update("UPDATE prompts SET difficulty = 'C' WHERE difficulty IN ('C1', 'C2')");

        migrateLegacyPrompt(jdbcTemplate, "prompt-1", "prompt-a-4", "A", 10);
        migrateLegacyPrompt(jdbcTemplate, "prompt-2", "prompt-b-4", "B", 11);
        migrateLegacyPrompt(jdbcTemplate, "prompt-3", "prompt-b-5", "B", 12);
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
