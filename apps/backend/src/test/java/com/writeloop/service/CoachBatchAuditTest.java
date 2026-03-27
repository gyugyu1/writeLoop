package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.CoachHelpRequestDto;
import com.writeloop.dto.CoachHelpResponseDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.CoachInteractionRepository;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CoachBatchAuditTest {

    private static final List<String> GENERIC_STARTERS = List.of(
            "i think",
            "in my opinion",
            "one reason is that",
            "this is because",
            "for example",
            "for instance",
            "specifically",
            "i usually"
    );

    @Test
    void generate_batch_audit_report_for_1000_mixed_coach_questions() throws Exception {
        PromptService promptService = mock(PromptService.class);
        OpenAiCoachClient openAiCoachClient = mock(OpenAiCoachClient.class);
        AnswerAttemptRepository answerAttemptRepository = mock(AnswerAttemptRepository.class);
        CoachInteractionRepository coachInteractionRepository = mock(CoachInteractionRepository.class);
        ObjectMapper objectMapper = new ObjectMapper();
        CoachQueryAnalyzer coachQueryAnalyzer = new CoachQueryAnalyzer();
        CoachService coachService = new CoachService(
                promptService,
                openAiCoachClient,
                answerAttemptRepository,
                coachInteractionRepository,
                objectMapper,
                coachQueryAnalyzer
        );

        List<PromptDto> prompts = createPrompts();
        Map<String, PromptDto> promptById = prompts.stream()
                .collect(Collectors.toMap(PromptDto::id, prompt -> prompt, (left, right) -> left, LinkedHashMap::new));

        when(promptService.findAll()).thenReturn(prompts);
        when(promptService.findHintsByPromptId(anyString())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(false);
        when(coachInteractionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        List<AuditCase> auditCases = generateAuditCases();
        assertThat(auditCases).hasSize(1000);

        List<AuditResult> results = new ArrayList<>();
        for (AuditCase auditCase : auditCases) {
            PromptDto prompt = promptById.get(auditCase.promptId());
            CoachQueryAnalyzer.CoachQueryAnalysis analysis = coachQueryAnalyzer.analyze(prompt, auditCase.question());
            CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), auditCase.question()));
            results.add(evaluateCase(auditCase, analysis, response));
        }

        writeReports(results, objectMapper);
        assertThat(results).hasSize(1000);
    }

    private List<PromptDto> createPrompts() {
        return List.of(
                new PromptDto(
                        "audit-growth",
                        "Growth",
                        "MEDIUM",
                        "What is one skill you want to improve this year, and how will you practice it?",
                        "올해 향상시키고 싶은 기술 하나와 그것을 어떻게 연습할지 말해 보세요.",
                        "Share one skill and one clear practice plan."
                ),
                new PromptDto(
                        "audit-travel",
                        "Travel",
                        "MEDIUM",
                        "Tell me about a place you want to visit and what you want to do there.",
                        "가 보고 싶은 곳과 그곳에서 하고 싶은 것을 말해 보세요.",
                        "Give one place and one simple reason."
                ),
                new PromptDto(
                        "audit-daily",
                        "Daily Life",
                        "EASY",
                        "How do you usually spend your weekend?",
                        "주말을 보통 어떻게 보내나요?",
                        "Use a simple everyday answer."
                ),
                new PromptDto(
                        "audit-tech",
                        "Technology",
                        "HARD",
                        "How has technology changed the way people build relationships, and is that change mostly positive?",
                        "기술은 사람들이 관계를 맺는 방식을 어떻게 바꾸었고, 그 변화가 대체로 긍정적인지 말해 보세요.",
                        "Discuss one clear change and your opinion."
                ),
                new PromptDto(
                        "audit-society",
                        "Society",
                        "HARD",
                        "What kind of social responsibility should successful companies have in modern society?",
                        "성공한 기업은 현대 사회에서 어떤 사회적 책임을 가져야 하는지 말해 보세요.",
                        "State your opinion and support it."
                ),
                new PromptDto(
                        "audit-habit",
                        "Habits",
                        "MEDIUM",
                        "What is one habit you want to build this year, and why is it important to you?",
                        "올해 만들고 싶은 습관 하나와 그 이유를 말해 보세요.",
                        "Share one habit and one reason."
                ),
                new PromptDto(
                        "audit-work-study",
                        "Work and Study",
                        "MEDIUM",
                        "What is one challenge you often face at work or school, and how do you deal with it?",
                        "직장이나 학교에서 자주 겪는 어려움 하나와 대처 방법을 말해 보세요.",
                        "Explain the problem and one solution."
                ),
                new PromptDto(
                        "audit-communication",
                        "Communication",
                        "MEDIUM",
                        "How do you stay in touch with people who are important to you?",
                        "중요한 사람들과 어떻게 연락을 이어 가는지 말해 보세요.",
                        "Use one or two clear examples."
                ),
                new PromptDto(
                        "audit-health",
                        "Health",
                        "EASY",
                        "What do you do when you need to rest well after a busy day?",
                        "바쁜 하루 뒤에 잘 쉬어야 할 때 무엇을 하는지 말해 보세요.",
                        "Use short daily-life expressions."
                ),
                new PromptDto(
                        "audit-self-improve",
                        "Self Improvement",
                        "MEDIUM",
                        "What is one ability or quality you want to improve, and why?",
                        "키우고 싶은 능력이나 성향 하나와 그 이유를 말해 보세요.",
                        "Name one quality and explain why it matters."
                ),
                new PromptDto(
                        "audit-lifestyle",
                        "Lifestyle",
                        "MEDIUM",
                        "What is one thing you want to reduce or manage better in your daily life?",
                        "일상에서 줄이거나 더 잘 관리하고 싶은 것 하나를 말해 보세요.",
                        "Give one target and one simple reason."
                )
        );
    }

    private List<AuditCase> generateAuditCases() {
        List<AuditCase> cases = new ArrayList<>(1000);
        cases.addAll(generateLearnLookupCases());
        cases.addAll(generateSocializeLookupCases());
        cases.addAll(generateSleepLookupCases());
        cases.addAll(generateStateChangeLookupCases());
        cases.addAll(generateVisitInterestLookupCases());
        cases.addAll(generateGrowthLookupCases());
        cases.addAll(generateReduceLookupCases());
        cases.addAll(generateReasonSupportCases());
        cases.addAll(generateExampleSupportCases());
        cases.addAll(generateReasonIdeaSupportCases());
        cases.addAll(generateExampleIdeaSupportCases());
        cases.addAll(generateOpinionSupportCases());
        cases.addAll(generateCompareSupportCases());
        cases.addAll(generateStructureSupportCases());
        cases.addAll(generateBalanceSupportCases());
        cases.addAll(generateHybridAmbiguousCases());
        return cases;
    }

    private List<AuditCase> generateLearnLookupCases() {
        List<TargetPair> targets = List.of(
                new TargetPair("영어를 배우고 싶다", "english"),
                new TargetPair("스페인어를 배우고 싶다", "spanish"),
                new TargetPair("피아노를 배우고 싶다", "piano"),
                new TargetPair("기타를 배우고 싶다", "guitar"),
                new TargetPair("수영을 배우고 싶다", "swimming"),
                new TargetPair("유도를 배우고 싶다", "judo"),
                new TargetPair("코딩을 배우고 싶다", "coding"),
                new TargetPair("요리를 배우고 싶다", "cooking"),
                new TargetPair("농구를 배우고 싶다", "basketball"),
                new TargetPair("중국어를 배우고 싶다", "chinese")
        );
        return generateLookupCases(
                "learn_lookup",
                "audit-growth",
                1,
                CoachQueryAnalyzer.ActionFamily.LEARN,
                targets,
                target -> List.of("learn", "practice", target.englishCue())
        );
    }

    private List<AuditCase> generateSocializeLookupCases() {
        List<TargetPair> targets = List.of(
                new TargetPair("친구를 만나고 싶다", "friend"),
                new TargetPair("친구들이랑 놀고 싶다", "hang out"),
                new TargetPair("친구와 시간을 보내고 싶다", "spend time"),
                new TargetPair("사람들과 어울리고 싶다", "socialize"),
                new TargetPair("친구와 대화하고 싶다", "talk"),
                new TargetPair("동료와 계속 연락하고 싶다", "keep in touch"),
                new TargetPair("친한 사람을 다시 만나고 싶다", "catch up"),
                new TargetPair("사람들과 연결되고 싶다", "connect"),
                new TargetPair("반 친구와 어울리고 싶다", "friend"),
                new TargetPair("사람들과 더 가까워지고 싶다", "connect")
        );
        return generateLookupCases(
                "socialize_lookup",
                "audit-communication",
                101,
                CoachQueryAnalyzer.ActionFamily.SOCIALIZE,
                targets,
                target -> List.of("meet", "friend", "hang out", "connect", "spend time")
        );
    }

    private List<AuditCase> generateSleepLookupCases() {
        List<TargetPair> targets = List.of(
                new TargetPair("일찍 자고 싶다", "sleep"),
                new TargetPair("바로 자러 가고 싶다", "bed"),
                new TargetPair("푹 자고 싶다", "sleep"),
                new TargetPair("잠이 빨리 들고 싶다", "asleep"),
                new TargetPair("잠을 좀 더 자고 싶다", "sleep"),
                new TargetPair("침대에 바로 가고 싶다", "bed"),
                new TargetPair("잘 자고 싶다", "sleep"),
                new TargetPair("낮잠을 자고 싶다", "sleep"),
                new TargetPair("잠들고 싶다", "asleep"),
                new TargetPair("빨리 잠들고 싶다", "asleep")
        );
        return generateLookupCases(
                "sleep_lookup",
                "audit-health",
                201,
                CoachQueryAnalyzer.ActionFamily.SLEEP,
                targets,
                target -> List.of("sleep", "bed", "asleep")
        );
    }

    private List<AuditCase> generateStateChangeLookupCases() {
        List<TargetPair> targets = List.of(
                new TargetPair("온라인에서 사람 만나는 게 자연스러워졌다", "online"),
                new TargetPair("인터넷에서 관계 맺는 게 쉬워졌다", "relationship"),
                new TargetPair("온라인 대화가 더 편해졌다", "comfortable"),
                new TargetPair("온라인 만남이 더 자연스럽다", "natural"),
                new TargetPair("사람들이 온라인 관계에 익숙해졌다", "online"),
                new TargetPair("온라인에서 처음 말 거는 게 덜 어색하다", "comfortable"),
                new TargetPair("멀리 사는 사람과도 자연스럽게 친해진다", "relationship"),
                new TargetPair("온라인으로 사람을 만나는 게 흔해졌다", "online"),
                new TargetPair("인터넷 만남이 예전보다 편하다", "comfortable"),
                new TargetPair("온라인에서 관계를 만드는 게 당연해졌다", "natural")
        );
        return generateLookupCases(
                "state_change_lookup",
                "audit-tech",
                301,
                CoachQueryAnalyzer.ActionFamily.STATE_CHANGE,
                targets,
                target -> List.of("online", "natural", "comfortable", "relationship", "meet")
        );
    }

    private List<AuditCase> generateVisitInterestLookupCases() {
        List<TargetPair> targets = List.of(
                new TargetPair("메이드카페에 가보고 싶다", "visit"),
                new TargetPair("박물관을 방문하고 싶다", "visit"),
                new TargetPair("그 문화를 직접 경험하고 싶다", "experience"),
                new TargetPair("그 도시를 둘러보고 싶다", "explore"),
                new TargetPair("메이드카페가 궁금하다", "curious"),
                new TargetPair("그 장소에 관심이 많다", "interested"),
                new TargetPair("스페인에 가보고 싶다", "visit"),
                new TargetPair("그 축제를 경험하고 싶다", "experience"),
                new TargetPair("그 전시를 천천히 둘러보고 싶다", "explore"),
                new TargetPair("그 문화가 흥미롭다", "interested")
        );
        return generateLookupCases(
                "visit_interest_lookup",
                "audit-travel",
                401,
                CoachQueryAnalyzer.ActionFamily.VISIT_INTEREST,
                targets,
                target -> List.of("visit", "experience", "explore", "curious", "interested")
        );
    }

    private List<AuditCase> generateGrowthLookupCases() {
        List<TargetPair> targets = List.of(
                new TargetPair("근력을 키우고 싶다", "strength"),
                new TargetPair("체력을 키우고 싶다", "stamina"),
                new TargetPair("지구력을 늘리고 싶다", "endurance"),
                new TargetPair("유연성을 높이고 싶다", "flexibility"),
                new TargetPair("자신감을 키우고 싶다", "confidence"),
                new TargetPair("집중력을 높이고 싶다", "focus"),
                new TargetPair("영향력을 키우고 싶다", "influence"),
                new TargetPair("면역력을 높이고 싶다", "immunity"),
                new TargetPair("근육을 키우고 싶다", "muscle"),
                new TargetPair("발음을 더 좋게 만들고 싶다", "pronunciation")
        );
        return generateLookupCases(
                "growth_lookup",
                "audit-self-improve",
                501,
                CoachQueryAnalyzer.ActionFamily.GROWTH_CAPABILITY,
                targets,
                target -> List.of("improve", "work on", "develop", "build up", target.englishCue())
        );
    }

    private List<AuditCase> generateReduceLookupCases() {
        List<TargetPair> targets = List.of(
                new TargetPair("스트레스를 줄이고 싶다", "stress"),
                new TargetPair("불안을 줄이고 싶다", "anxiety"),
                new TargetPair("걱정을 줄이고 싶다", "worry"),
                new TargetPair("지출을 줄이고 싶다", "spending"),
                new TargetPair("소비를 줄이고 싶다", "spending"),
                new TargetPair("스크린 타임을 줄이고 싶다", "screen time"),
                new TargetPair("체지방을 줄이고 싶다", "body fat"),
                new TargetPair("체중을 줄이고 싶다", "weight"),
                new TargetPair("피로를 줄이고 싶다", "fatigue"),
                new TargetPair("압박감을 관리하고 싶다", "pressure")
        );
        return generateLookupCases(
                "reduce_lookup",
                "audit-lifestyle",
                601,
                CoachQueryAnalyzer.ActionFamily.REDUCE_MANAGE,
                targets,
                target -> List.of("reduce", "manage", "cut down", target.englishCue())
        );
    }

    private List<AuditCase> generateReasonSupportCases() {
        return generateSupportCasesWithRepeats(
                "reason_support",
                "audit-habit",
                701,
                List.of(
                        "이 질문에서 쓸 수 있는 이유 표현 알려줘",
                        "이유를 자연스럽게 붙이는 표현 알려줘",
                        "그걸 말할 때 쓸 이유 표현 추천해줘",
                        "이유 한 개 붙일 때 좋은 표현 알려줘",
                        "왜 그런지 설명하는 표현 알려줘",
                        "이유 표현 알려줘",
                        "이유 붙이는 표현 뭐 있어?",
                        "because 말고 다른 이유 표현 있어?",
                        "짧게 이유 말하는 표현 추천해줘",
                        "이 질문 이유표현"
                ),
                List.of("reason", "because", "one reason is that", "this is because"),
                List.of()
        );
    }

    private List<AuditCase> generateExampleSupportCases() {
        return generateSupportCasesWithRepeats(
                "example_support",
                "audit-travel",
                741,
                List.of(
                        "짧은 예시를 붙일 때 쓸 표현 알려줘",
                        "예시 붙일 때 자연스러운 표현 추천해줘",
                        "for example 말고 다른 예시 표현 알려줘",
                        "예시 하나 붙이는 말 알려줘",
                        "경험 예시 넣을 때 쓸 표현 알려줘",
                        "예시 표현 알려줘",
                        "예시 붙이는 말 뭐 있어?",
                        "샘플 넣을 때 표현 있어?",
                        "for example 표현 추천좀",
                        "이 질문 예시표현"
                ),
                List.of("for example", "for instance", "specifically", "a good example is"),
                List.of()
        );
    }

    private List<AuditCase> generateReasonIdeaSupportCases() {
        return generateSupportCasesWithRepeats(
                "reason_idea_support",
                "audit-society",
                781,
                List.of(
                        "이 질문에 쓸 수 있는 이유가 뭐가 있을까",
                        "답으로 쓸 만한 이유 아이디어 알려줘",
                        "성공한 기업 책임에 대한 이유 포인트 뭐가 있어?",
                        "이 질문에서 들 수 있는 근거가 뭐가 있을까",
                        "어떤 이유를 쓰면 좋을지 먼저 알려줘",
                        "이 질문 이유 아이디어",
                        "쓸 수 있는 이유가 뭐 있어?",
                        "이 질문에서 근거 뭐 넣을까",
                        "답에 넣을 이유 포인트 추천해줘",
                        "성공한 기업 책임 이유 뭐가 좋을까"
                ),
                List.of("educational", "job", "environment", "community", "workers"),
                List.of()
        );
    }

    private List<AuditCase> generateExampleIdeaSupportCases() {
        return generateSupportCasesWithRepeats(
                "example_idea_support",
                "audit-tech",
                821,
                List.of(
                        "이 질문에 넣을 만한 예시가 뭐가 있을까",
                        "답에 쓸 예시 아이디어 알려줘",
                        "기술과 관계 질문에서 들 수 있는 예시가 뭐 있어?",
                        "어떤 사례를 넣으면 좋을까",
                        "이 질문에서 쓸 수 있는 포인트 예시 추천해줘",
                        "이 질문 예시 아이디어",
                        "넣을 만한 사례가 뭐 있어?",
                        "답에 붙일 예시 포인트 뭐가 좋을까",
                        "기술이 관계 바꾼 예시 추천해줘",
                        "이 질문에서 들 수 있는 사례 아이디어"
                ),
                List.of("stay in touch", "online", "communities", "long-distance", "meet"),
                List.of()
        );
    }

    private List<AuditCase> generateOpinionSupportCases() {
        return generateSupportCasesWithRepeats(
                "opinion_support",
                "audit-society",
                861,
                List.of(
                        "의견을 분명하게 말하는 표현 알려줘",
                        "내 생각을 말할 때 쓸 표현 추천해줘",
                        "찬성 의견을 밝히는 표현 알려줘",
                        "내 입장을 자연스럽게 시작하는 표현 알려줘",
                        "의견 표현 여러 개 알려줘",
                        "의견 표현 알려줘",
                        "내 생각 말하는 표현 뭐 있어?",
                        "입장 밝히는 표현 있어?",
                        "찬성의견 표현 추천좀",
                        "의견 스타터"
                ),
                List.of("i think", "in my opinion", "from my perspective", "i believe"),
                List.of()
        );
    }

    private List<AuditCase> generateCompareSupportCases() {
        return generateSupportCasesWithRepeats(
                "compare_support",
                "audit-society",
                901,
                List.of(
                        "비교하거나 반대 의견을 넣는 표현 알려줘",
                        "장단점을 비교할 때 쓸 표현 추천해줘",
                        "반대 의견 붙이는 표현 알려줘",
                        "비교 흐름 만들 때 좋은 표현 알려줘",
                        "다른 한편을 말할 때 표현 알려줘",
                        "비교 표현 알려줘",
                        "반대 의견 표현 뭐 있어?",
                        "장단점 말하는 표현 있어?",
                        "on the other hand 표현 추천좀",
                        "비교 스타터"
                ),
                List.of("on the other hand", "in contrast", "compared with", "however"),
                List.of()
        );
    }

    private List<AuditCase> generateStructureSupportCases() {
        return generateSupportCasesWithRepeats(
                "structure_support",
                "audit-work-study",
                941,
                List.of(
                        "답변 구조를 어떻게 쓰면 좋을지 알려줘",
                        "무엇부터 쓰면 좋을지 가이드 줘",
                        "짧은 답변 구조 추천해줘",
                        "의견 이유 예시 순서 알려줘",
                        "문장 흐름을 어떻게 만들지 알려줘",
                        "구조 알려줘",
                        "뭐부터 써야 해?",
                        "답변 흐름 있어?",
                        "짧은 구조 추천좀",
                        "구조 스타터"
                ),
                List.of("first", "another point is that", "as a result"),
                List.of()
        );
    }

    private List<AuditCase> generateBalanceSupportCases() {
        return generateSupportCasesWithRepeats(
                "balance_support",
                "audit-society",
                981,
                List.of(
                        "장단점을 같이 말하는 구조 알려줘",
                        "한편 다른 한편 구조 표현 알려줘",
                        "균형 있게 말할 때 쓰는 표현 알려줘",
                        "찬반을 같이 쓰는 흐름 추천해줘",
                        "overall 느낌으로 마무리하는 표현 알려줘",
                        "장단점 구조 알려줘",
                        "한편 다른한편 표현 뭐 있어?",
                        "균형답변 표현 있어?",
                        "찬반 흐름 추천좀",
                        "overall 표현"
                ),
                List.of("on the one hand", "on the other hand", "overall", "however"),
                List.of()
        );
    }

    private List<AuditCase> generateHybridAmbiguousCases() {
        List<HybridCaseSeed> seeds = List.of(
                new HybridCaseSeed("audit-communication", "친구를 만나고 싶다고 말하고 싶은데 예시 표현도 같이 알려줘", CoachQueryAnalyzer.ActionFamily.SOCIALIZE, List.of("meet", "friend", "hang out"), List.of("for example", "for instance")),
                new HybridCaseSeed("audit-growth", "유도를 배우고 싶다고 말하고 싶은데 이유 표현도 같이 알려줘", CoachQueryAnalyzer.ActionFamily.LEARN, List.of("learn", "practice", "judo"), List.of("one reason is that", "this is because")),
                new HybridCaseSeed("audit-tech", "온라인 만남이 자연스러워졌다고 말하고 싶은데 의견 표현도 필요해", CoachQueryAnalyzer.ActionFamily.STATE_CHANGE, List.of("online", "natural", "relationship"), List.of("i think", "in my opinion")),
                new HybridCaseSeed("audit-travel", "메이드카페에 가보고 싶다고 하고 싶은데 첫 문장도 추천해줘", CoachQueryAnalyzer.ActionFamily.VISIT_INTEREST, List.of("visit", "maid cafe", "interested"), List.of("i think", "first")),
                new HybridCaseSeed("audit-health", "일찍 자고 싶다고 말하고 싶은데 예시도 같이 알려줘", CoachQueryAnalyzer.ActionFamily.SLEEP, List.of("sleep", "bed", "asleep"), List.of("for example", "for instance")),
                new HybridCaseSeed("audit-self-improve", "근력을 키우고 싶다고 말하고 싶은데 이유도 하나 붙이고 싶어", CoachQueryAnalyzer.ActionFamily.GROWTH_CAPABILITY, List.of("improve", "strength", "build up"), List.of("one reason is that", "this is because")),
                new HybridCaseSeed("audit-lifestyle", "스트레스를 줄이고 싶다고 말하고 싶은데 비교 표현도 같이 알고 싶어", CoachQueryAnalyzer.ActionFamily.REDUCE_MANAGE, List.of("reduce", "stress", "manage"), List.of("on the other hand", "however")),
                new HybridCaseSeed("audit-communication", "친구랑 어울리고 싶다는 말을 영어로 하고 싶고 예시도 한 줄 필요해", CoachQueryAnalyzer.ActionFamily.SOCIALIZE, List.of("friend", "hang out", "meet"), List.of("for example", "for instance")),
                new HybridCaseSeed("audit-growth", "스페인어 배우고 싶다는 뜻도 필요하고 구조 표현도 같이 알려줘", CoachQueryAnalyzer.ActionFamily.LEARN, List.of("learn", "spanish", "practice"), List.of("first", "another point is that")),
                new HybridCaseSeed("audit-tech", "온라인 관계가 더 자연스럽다고 말하고 싶은데 반대 의견 표현도 있으면 좋겠어", CoachQueryAnalyzer.ActionFamily.STATE_CHANGE, List.of("online", "natural", "relationship"), List.of("on the other hand", "however")),
                new HybridCaseSeed("audit-travel", "박물관을 방문하고 싶다고 말하고 싶은데 이유 아이디어도 같이 주면 좋겠어", CoachQueryAnalyzer.ActionFamily.VISIT_INTEREST, List.of("visit", "museum", "experience"), List.of("because", "one reason is that")),
                new HybridCaseSeed("audit-self-improve", "자신감을 키우고 싶다고 말하고 싶은데 첫 문장 표현도 같이 보고 싶어", CoachQueryAnalyzer.ActionFamily.GROWTH_CAPABILITY, List.of("confidence", "improve", "develop"), List.of("i think", "first")),
                new HybridCaseSeed("audit-lifestyle", "지출을 줄이고 싶다는 말을 영어로 하고 싶고 예시도 같이 붙이고 싶어", CoachQueryAnalyzer.ActionFamily.REDUCE_MANAGE, List.of("reduce", "spending", "manage"), List.of("for example", "for instance")),
                new HybridCaseSeed("audit-health", "잠이 빨리 든다고 말하고 싶은데 이유 표현도 같이 필요해", CoachQueryAnalyzer.ActionFamily.SLEEP, List.of("sleep", "asleep", "bed"), List.of("one reason is that", "this is because")),
                new HybridCaseSeed("audit-communication", "중요한 사람과 계속 연락한다고 말하고 싶은데 연결 표현도 같이 알려줘", CoachQueryAnalyzer.ActionFamily.SOCIALIZE, List.of("keep in touch", "contact", "friend"), List.of("as a result", "another point is that"))
        );

        List<AuditCase> cases = new ArrayList<>(120);
        int id = 1021;
        for (int repeat = 0; repeat < 8; repeat++) {
            for (HybridCaseSeed seed : seeds) {
                cases.add(new AuditCase(
                        String.format(Locale.ROOT, "Q%04d", id++),
                        "hybrid_ambiguous",
                        seed.promptId(),
                        seed.question(),
                        repeat < 4 ? "well_formed" : "malformed",
                        CoachQueryAnalyzer.QueryMode.MEANING_LOOKUP,
                        seed.expectedFamily(),
                        seed.primaryKeywords(),
                        seed.secondaryKeywords()
                ));
            }
        }
        return cases;
    }

    private List<AuditCase> generateLookupCases(
            String bucket,
            String promptId,
            int startId,
            CoachQueryAnalyzer.ActionFamily expectedFamily,
            List<TargetPair> targets,
            Function<TargetPair, List<String>> expectedKeywordBuilder
    ) {
        List<VariantTemplate> templates = List.of(
                new VariantTemplate("%s", "well_formed"),
                new VariantTemplate("%s 영어로 어떻게 말해?", "well_formed"),
                new VariantTemplate("%s라고 말하고 싶어", "well_formed"),
                new VariantTemplate("이 뜻을 영어로 바꾸면 뭐가 좋아: %s", "well_formed"),
                new VariantTemplate("%s 말 하고싶어", "malformed"),
                new VariantTemplate("%s 영어로 뭐라함", "malformed"),
                new VariantTemplate("%s 어케 말해", "malformed"),
                new VariantTemplate("%s 표현 좀", "malformed")
        );

        List<AuditCase> cases = new ArrayList<>(targets.size() * templates.size());
        int id = startId;
        for (TargetPair target : targets) {
            for (VariantTemplate template : templates) {
                cases.add(new AuditCase(
                        String.format(Locale.ROOT, "Q%04d", id++),
                        bucket,
                        promptId,
                        template.render(target.koreanText()),
                        template.quality(),
                        CoachQueryAnalyzer.QueryMode.MEANING_LOOKUP,
                        expectedFamily,
                        expectedKeywordBuilder.apply(target),
                        List.of()
                ));
            }
        }
        return cases;
    }

    private List<AuditCase> generateSupportCasesWithRepeats(
            String bucket,
            String promptId,
            int startId,
            List<String> questions,
            List<String> primaryKeywords,
            List<String> secondaryKeywords
    ) {
        List<AuditCase> cases = new ArrayList<>(questions.size() * 4);
        int id = startId;
        CoachQueryAnalyzer.QueryMode expectedMode = bucket.contains("idea_")
                ? CoachQueryAnalyzer.QueryMode.IDEA_SUPPORT
                : CoachQueryAnalyzer.QueryMode.WRITING_SUPPORT;

        for (int repeat = 0; repeat < 4; repeat++) {
            for (String question : questions) {
                cases.add(new AuditCase(
                        String.format(Locale.ROOT, "Q%04d", id++),
                        bucket,
                        promptId,
                        question,
                        repeat < 2 ? "well_formed" : "malformed",
                        expectedMode,
                        CoachQueryAnalyzer.ActionFamily.UNKNOWN,
                        primaryKeywords,
                        secondaryKeywords
                ));
            }
        }
        return cases;
    }

    private AuditResult evaluateCase(
            AuditCase auditCase,
            CoachQueryAnalyzer.CoachQueryAnalysis analysis,
            CoachHelpResponseDto response
    ) {
        CoachQueryAnalyzer.QueryMode actualMode = analysis.queryMode();
        CoachQueryAnalyzer.ActionFamily actualFamily = analysis.lookup()
                .map(spec -> spec.frame().family())
                .orElse(CoachQueryAnalyzer.ActionFamily.UNKNOWN);

        List<String> expressions = response.expressions().stream()
                .map(expression -> expression.expression())
                .toList();
        String joinedExpressions = expressions.stream()
                .map(this::normalizeKey)
                .collect(Collectors.joining(" | "));

        List<String> reasons = new ArrayList<>();
        if (actualMode != auditCase.expectedMode()) {
            reasons.add("mode_mismatch");
        }
        if (auditCase.expectedFamily() != CoachQueryAnalyzer.ActionFamily.UNKNOWN
                && actualFamily != auditCase.expectedFamily()) {
            reasons.add("family_mismatch");
        }
        if (!containsAnyCue(joinedExpressions, auditCase.primaryKeywords())) {
            reasons.add("missing_primary_keywords");
        }
        if (!auditCase.secondaryKeywords().isEmpty()
                && !containsAnyCue(joinedExpressions, auditCase.secondaryKeywords())) {
            reasons.add("missing_secondary_keywords");
        }
        if (auditCase.expectedMode() == CoachQueryAnalyzer.QueryMode.MEANING_LOOKUP
                && genericLeakage(joinedExpressions)
                && !containsAnyCue(joinedExpressions, auditCase.primaryKeywords())) {
            reasons.add("generic_fallback_leakage");
        }
        if (auditCase.expectedMode() == CoachQueryAnalyzer.QueryMode.IDEA_SUPPORT
                && genericLeakage(joinedExpressions)) {
            reasons.add("generic_idea_fallback");
        }

        return new AuditResult(
                auditCase.id(),
                auditCase.bucket(),
                auditCase.promptId(),
                auditCase.question(),
                auditCase.quality(),
                auditCase.expectedMode().name(),
                auditCase.expectedFamily().name(),
                actualMode.name(),
                actualFamily.name(),
                response.coachReply(),
                expressions,
                reasons
        );
    }

    private boolean containsAnyCue(String haystack, List<String> cues) {
        return cues.stream()
                .map(this::normalizeKey)
                .filter(value -> !value.isBlank())
                .anyMatch(haystack::contains);
    }

    private boolean genericLeakage(String joinedExpressions) {
        return GENERIC_STARTERS.stream()
                .map(this::normalizeKey)
                .filter(joinedExpressions::contains)
                .count() >= 2;
    }

    private String normalizeKey(String text) {
        return text == null ? "" : text.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private void writeReports(List<AuditResult> results, ObjectMapper objectMapper) throws Exception {
        Path reportDir = Path.of("build", "reports", "coach-batch-audit");
        Files.createDirectories(reportDir);

        Map<String, Long> reasonCounts = results.stream()
                .flatMap(result -> result.suspiciousReasons().stream())
                .collect(Collectors.groupingBy(reason -> reason, LinkedHashMap::new, Collectors.counting()));

        Map<String, List<AuditResult>> byBucket = results.stream()
                .collect(Collectors.groupingBy(AuditResult::bucket, LinkedHashMap::new, Collectors.toList()));

        List<AuditResult> suspiciousResults = results.stream()
                .filter(result -> !result.suspiciousReasons().isEmpty())
                .toList();

        StringBuilder markdown = new StringBuilder();
        markdown.append("# Coach Batch Audit\n\n");
        markdown.append("- Date: ").append(LocalDate.now()).append('\n');
        markdown.append("- Total cases: ").append(results.size()).append('\n');
        markdown.append("- Suspicious cases: ").append(suspiciousResults.size()).append('\n');
        markdown.append("- Suspicious rate: ")
                .append(String.format(Locale.ROOT, "%.1f%%", (suspiciousResults.size() * 100.0) / results.size()))
                .append("\n\n");

        markdown.append("## Bucket Summary\n\n");
        markdown.append("| Bucket | Total | Suspicious | Rate |\n");
        markdown.append("| --- | ---: | ---: | ---: |\n");
        for (Map.Entry<String, List<AuditResult>> entry : byBucket.entrySet()) {
            long suspicious = entry.getValue().stream().filter(result -> !result.suspiciousReasons().isEmpty()).count();
            markdown.append("| ").append(entry.getKey()).append(" | ")
                    .append(entry.getValue().size()).append(" | ")
                    .append(suspicious).append(" | ")
                    .append(String.format(Locale.ROOT, "%.1f%%", (suspicious * 100.0) / entry.getValue().size()))
                    .append(" |\n");
        }

        markdown.append("\n## Top Suspicious Reasons\n\n");
        if (reasonCounts.isEmpty()) {
            markdown.append("- none\n");
        } else {
            for (Map.Entry<String, Long> entry : reasonCounts.entrySet()) {
                markdown.append("- ").append(entry.getKey()).append(": ").append(entry.getValue()).append('\n');
            }
        }

        markdown.append("\n## Sample Suspicious Cases\n\n");
        suspiciousResults.stream().limit(60).forEach(result -> {
            markdown.append("### ").append(result.id()).append(" - ").append(result.bucket()).append('\n');
            markdown.append("- Question: ").append(result.question()).append('\n');
            markdown.append("- Expected: ").append(result.expectedMode()).append(" / ").append(result.expectedFamily()).append('\n');
            markdown.append("- Actual: ").append(result.actualMode()).append(" / ").append(result.actualFamily()).append('\n');
            markdown.append("- Reasons: ").append(String.join(", ", result.suspiciousReasons())).append('\n');
            markdown.append("- Expressions: ").append(result.expressions()).append("\n\n");
        });

        Files.writeString(reportDir.resolve("summary.md"), markdown.toString());
        objectMapper.writerWithDefaultPrettyPrinter()
                .writeValue(reportDir.resolve("results.json").toFile(), results);
    }

    private record TargetPair(String koreanText, String englishCue) {
    }

    private record VariantTemplate(String template, String quality) {
        String render(String target) {
            return template.formatted(target);
        }
    }

    private record HybridCaseSeed(
            String promptId,
            String question,
            CoachQueryAnalyzer.ActionFamily expectedFamily,
            List<String> primaryKeywords,
            List<String> secondaryKeywords
    ) {
    }

    private record AuditCase(
            String id,
            String bucket,
            String promptId,
            String question,
            String quality,
            CoachQueryAnalyzer.QueryMode expectedMode,
            CoachQueryAnalyzer.ActionFamily expectedFamily,
            List<String> primaryKeywords,
            List<String> secondaryKeywords
    ) {
    }

    private record AuditResult(
            String id,
            String bucket,
            String promptId,
            String question,
            String quality,
            String expectedMode,
            String expectedFamily,
            String actualMode,
            String actualFamily,
            String coachReply,
            List<String> expressions,
            List<String> suspiciousReasons
    ) {
    }
}
