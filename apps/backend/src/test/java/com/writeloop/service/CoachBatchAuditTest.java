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
            "for example",
            "for instance",
            "specifically"
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
                new PromptDto("audit-growth", "Growth", "MEDIUM",
                        "What is one skill you want to improve this year, and how will you practice it?",
                        "올해 향상시키고 싶은 기술 하나와 그것을 어떻게 연습할지 말해 보세요.",
                        "Share one skill and one clear practice plan."),
                new PromptDto("audit-travel", "Travel", "MEDIUM",
                        "Tell me about a place you want to visit and what you want to do there.",
                        "가 보고 싶은 곳과 그곳에서 하고 싶은 것을 말해 보세요.",
                        "Give one place and one simple reason."),
                new PromptDto("audit-daily", "Daily Life", "EASY",
                        "How do you usually spend your weekend?",
                        "주말을 보통 어떻게 보내나요?",
                        "Use a simple everyday answer."),
                new PromptDto("audit-tech", "Technology", "HARD",
                        "How has technology changed the way people build relationships, and is that change mostly positive?",
                        "기술은 사람들이 관계를 맺는 방식을 어떻게 바꾸었고, 그 변화가 대체로 긍정적인지 말해 보세요.",
                        "Discuss one clear change and your opinion."),
                new PromptDto("audit-society", "Society", "HARD",
                        "What kind of social responsibility should successful companies have in modern society?",
                        "성공한 기업은 현대 사회에서 어떤 사회적 책임을 가져야 하는지 말해 보세요.",
                        "State your opinion and support it."),
                new PromptDto("audit-habit", "Habits", "MEDIUM",
                        "What is one habit you want to build this year, and why is it important to you?",
                        "올해 만들고 싶은 습관 하나와 그 이유를 말해 보세요.",
                        "Share one habit and one reason."),
                new PromptDto("audit-work-study", "Work and Study", "MEDIUM",
                        "What is one challenge you often face at work or school, and how do you deal with it?",
                        "직장이나 학교에서 자주 겪는 어려움 하나와 대처 방법을 말해 보세요.",
                        "Explain the problem and one solution."),
                new PromptDto("audit-communication", "Communication", "MEDIUM",
                        "How do you stay in touch with people who are important to you?",
                        "중요한 사람들과 어떻게 연락을 이어 가는지 말해 보세요.",
                        "Use one or two clear examples."),
                new PromptDto("audit-health", "Health", "EASY",
                        "What do you do when you need to rest well after a busy day?",
                        "바쁜 하루 뒤에 잘 쉬어야 할 때 무엇을 하는지 말해 보세요.",
                        "Use short daily-life expressions."),
                new PromptDto("audit-general", "General Writing", "EASY",
                        "Share a short answer.",
                        "짧게 답해 보세요.",
                        "Write one or two simple sentences.")
        );
    }

    private List<AuditCase> generateAuditCases() {
        List<AuditCase> cases = new ArrayList<>(1000);
        cases.addAll(generateLearnLookupCases());
        cases.addAll(generateSocializeLookupCases());
        cases.addAll(generateSleepLookupCases());
        cases.addAll(generateStateChangeLookupCases());
        cases.addAll(generateVisitInterestLookupCases());
        cases.addAll(generateReasonSupportCases());
        cases.addAll(generateExampleSupportCases());
        cases.addAll(generateOpinionCompareCases());
        cases.addAll(generateStructureBalanceCases());
        cases.addAll(generateHybridAmbiguousCases());
        return cases;
    }

    private List<AuditCase> generateLearnLookupCases() {
        List<TargetPair> targets = List.of(
                new TargetPair("영어", "english"),
                new TargetPair("스페인어", "spanish"),
                new TargetPair("피아노", "piano"),
                new TargetPair("기타", "guitar"),
                new TargetPair("수영", "swimming"),
                new TargetPair("유도", "judo"),
                new TargetPair("코딩", "coding"),
                new TargetPair("요리", "cooking"),
                new TargetPair("농구", "basketball"),
                new TargetPair("중국어", "chinese")
        );
        List<VariantTemplate> templates = List.of(
                new VariantTemplate("%s를 배우고 싶다고 말하고 싶어", "well_formed"),
                new VariantTemplate("%s를 배우고 싶어 영어로", "well_formed"),
                new VariantTemplate("%s 배우고 싶을 때 뭐라고 말해?", "well_formed"),
                new VariantTemplate("%s를 배우고 싶다를 어떻게 표현해?", "well_formed"),
                new VariantTemplate("%s 배우는 게 목표라고 말하고 싶어", "well_formed"),
                new VariantTemplate("%s 배우고싶다고 말 하고싶어", "malformed"),
                new VariantTemplate("%s 배워야한다고 말 하고싶어", "malformed"),
                new VariantTemplate("%s 배우고싶어 영어로", "malformed"),
                new VariantTemplate("%s 배우는거 영어로 말해", "malformed"),
                new VariantTemplate("%s 배우고 싶다 그거 영어로", "malformed")
        );
        return generateCases("learn_lookup", "audit-growth", CoachQueryAnalyzer.QueryMode.MEANING_LOOKUP,
                CoachQueryAnalyzer.ActionFamily.LEARN, targets, templates,
                target -> List.of("learn", "practice", target.englishCue()));
    }

    private List<AuditCase> generateSocializeLookupCases() {
        List<TargetPair> targets = List.of(
                new TargetPair("친구를 만난다", "friend"),
                new TargetPair("친구들이랑 논다", "hang out"),
                new TargetPair("친구와 시간을 보낸다", "spend time"),
                new TargetPair("사람들과 어울린다", "socialize"),
                new TargetPair("친구와 대화한다", "talk"),
                new TargetPair("동료와 연락한다", "keep in touch"),
                new TargetPair("친한 사람과 만난다", "meet"),
                new TargetPair("친구를 다시 만난다", "catch up"),
                new TargetPair("사람들과 연결된다", "connect"),
                new TargetPair("반 친구와 어울린다", "friends")
        );
        List<VariantTemplate> templates = List.of(
                new VariantTemplate("%s고 말하고 싶어", "well_formed"),
                new VariantTemplate("%s를 영어로 어떻게 말해?", "well_formed"),
                new VariantTemplate("%s는 표현 뭐가 자연스러워?", "well_formed"),
                new VariantTemplate("%s를 직접 말하고 싶어", "well_formed"),
                new VariantTemplate("%s고 하고 싶어", "well_formed"),
                new VariantTemplate("%s고 말 하고싶어", "malformed"),
                new VariantTemplate("%s 영어로 말함", "malformed"),
                new VariantTemplate("%s 표현 알려줘", "malformed"),
                new VariantTemplate("%s고 하고싶어", "malformed"),
                new VariantTemplate("%s 영어로 뭐라해", "malformed")
        );
        return generateCases("socialize_lookup", "audit-communication", CoachQueryAnalyzer.QueryMode.MEANING_LOOKUP,
                CoachQueryAnalyzer.ActionFamily.SOCIALIZE, targets, templates,
                target -> List.of("meet", "friend", "hang out", "connect", "spend time"));
    }

    private List<AuditCase> generateSleepLookupCases() {
        List<TargetPair> targets = List.of(
                new TargetPair("잔다", "sleep"),
                new TargetPair("일찍 잔다", "sleep"),
                new TargetPair("잠든다", "asleep"),
                new TargetPair("푹 잔다", "sleep"),
                new TargetPair("침대에 바로 간다", "bed"),
                new TargetPair("잠을 좀 잔다", "sleep"),
                new TargetPair("잘 잔다", "sleep"),
                new TargetPair("낮잠 잔다", "sleep"),
                new TargetPair("잠이 빨리 든다", "asleep"),
                new TargetPair("바로 자러 간다", "bed")
        );
        List<VariantTemplate> templates = List.of(
                new VariantTemplate("%s고 말하고 싶어", "well_formed"),
                new VariantTemplate("%s를 영어로 어떻게 말해?", "well_formed"),
                new VariantTemplate("%s는 표현 뭐가 자연스러워?", "well_formed"),
                new VariantTemplate("%s를 직접 말하고 싶어", "well_formed"),
                new VariantTemplate("%s고 하고 싶어", "well_formed"),
                new VariantTemplate("%s고 말 하고싶어", "malformed"),
                new VariantTemplate("%s 영어로 말함", "malformed"),
                new VariantTemplate("%s 표현 알려줘", "malformed"),
                new VariantTemplate("%s고 하고싶어", "malformed"),
                new VariantTemplate("%s 영어로 뭐라해", "malformed")
        );
        return generateCases("sleep_lookup", "audit-health", CoachQueryAnalyzer.QueryMode.MEANING_LOOKUP,
                CoachQueryAnalyzer.ActionFamily.SLEEP, targets, templates,
                target -> List.of("sleep", "bed", "asleep"));
    }

    private List<AuditCase> generateStateChangeLookupCases() {
        List<TargetPair> targets = List.of(
                new TargetPair("인터넷에서의 만남이 자연스러워졌다", "natural"),
                new TargetPair("온라인에서 사람 만나는 게 편해졌다", "comfortable"),
                new TargetPair("온라인 관계가 자연스러워졌다", "relationship"),
                new TargetPair("온라인으로 친해지는 게 익숙해졌다", "online"),
                new TargetPair("인터넷으로 사람을 만나는 게 흔해졌다", "online"),
                new TargetPair("온라인 만남이 전보다 자연스럽다", "natural"),
                new TargetPair("인터넷에서 관계 맺는 게 쉬워졌다", "relationship"),
                new TargetPair("온라인에서 처음 대화하는 게 덜 어색하다", "comfortable"),
                new TargetPair("사람들이 온라인 만남에 더 익숙해졌다", "online"),
                new TargetPair("온라인에서 관계를 만드는 게 당연해졌다", "natural")
        );
        List<VariantTemplate> templates = List.of(
                new VariantTemplate("%s를 어떻게 말해?", "well_formed"),
                new VariantTemplate("%s고 표현하고 싶어", "well_formed"),
                new VariantTemplate("%s를 영어로 쓰고 싶어", "well_formed"),
                new VariantTemplate("%s고 말하고 싶어", "well_formed"),
                new VariantTemplate("%s 그거 영어로 뭐가 자연스러워?", "well_formed"),
                new VariantTemplate("%s 어떻게 말함", "malformed"),
                new VariantTemplate("%s고 말 하고싶어", "malformed"),
                new VariantTemplate("%s 영어로 무슨 표현", "malformed"),
                new VariantTemplate("%s 영어로 뭐라해", "malformed"),
                new VariantTemplate("%s를 말하고픈데 영어로", "malformed")
        );
        return generateCases("state_change_lookup", "audit-tech", CoachQueryAnalyzer.QueryMode.MEANING_LOOKUP,
                CoachQueryAnalyzer.ActionFamily.STATE_CHANGE, targets, templates,
                target -> List.of("online", "natural", "comfortable", "relationship", "meet"));
    }

    private List<AuditCase> generateVisitInterestLookupCases() {
        List<TargetPair> targets = List.of(
                new TargetPair("메이드카페에 가보고 싶다", "visit"),
                new TargetPair("박물관을 꼭 방문하고 싶다", "visit"),
                new TargetPair("그 문화를 직접 경험해 보고 싶다", "experience"),
                new TargetPair("그 장소를 천천히 둘러보고 싶다", "explore"),
                new TargetPair("메이드카페가 궁금하다", "curious"),
                new TargetPair("그 문화에 관심이 많다", "interested"),
                new TargetPair("스페인에 가보고 싶다", "visit"),
                new TargetPair("그 축제를 경험하고 싶다", "experience"),
                new TargetPair("그 전시를 둘러보고 싶다", "explore"),
                new TargetPair("그 장소가 흥미롭다", "interested")
        );
        List<VariantTemplate> templates = List.of(
                new VariantTemplate("%s고 말하고 싶어", "well_formed"),
                new VariantTemplate("%s를 영어로 어떻게 말해?", "well_formed"),
                new VariantTemplate("%s를 표현하고 싶어", "well_formed"),
                new VariantTemplate("%s를 직접 말하고 싶어", "well_formed"),
                new VariantTemplate("%s 그거 영어 표현 알려줘", "well_formed"),
                new VariantTemplate("%s고 말 하고싶어", "malformed"),
                new VariantTemplate("%s 영어로 말함", "malformed"),
                new VariantTemplate("%s 표현 알려줘", "malformed"),
                new VariantTemplate("%s고 하고싶어", "malformed"),
                new VariantTemplate("%s 영어로 뭐라해", "malformed")
        );
        return generateCases("visit_interest_lookup", "audit-travel", CoachQueryAnalyzer.QueryMode.MEANING_LOOKUP,
                CoachQueryAnalyzer.ActionFamily.VISIT_INTEREST, targets, templates,
                target -> List.of("visit", "experience", "explore", "curious", "interested"));
    }

    private List<AuditCase> generateReasonSupportCases() {
        List<String> questions = List.of(
                "이 질문에서 쓸 수 있는 이유 표현 알려줘",
                "이유를 자연스럽게 붙이는 표현 알려줘",
                "그걸 말할 때 쓸 이유 표현 추천해줘",
                "이유 한 개 붙일 때 좋은 표현 알려줘",
                "왜 그런지 설명하는 표현 알려줘",
                "이유 표현 알려줘",
                "이유 붙이는 표현 뭐있어?",
                "그래서 말할 때 표현 있어?",
                "그거 표현 추천좀",
                "이 질문 이유표현"
        );
        return generateSupportCases("reason_support", "audit-habit", questions,
                CoachQueryAnalyzer.QueryMode.WRITING_SUPPORT, CoachQueryAnalyzer.ActionFamily.UNKNOWN,
                List.of("reason", "because", "one reason is that", "this is because"));
    }

    private List<AuditCase> generateExampleSupportCases() {
        List<String> questions = List.of(
                "짧은 예시를 붙일 때 쓸 표현 알려줘",
                "예시 붙일 때 자연스러운 표현 추천해줘",
                "for example 말고 다른 예시 표현 알려줘",
                "예시 하나 붙이는 말 알려줘",
                "경험 예시 넣을 때 쓸 표현 알려줘",
                "예시 표현 알려줘",
                "예시 붙이는 말 뭐있어?",
                "샘플 넣을 때 표현 있어?",
                "for example 표현 추천좀",
                "이 질문 예시표현"
        );
        return generateSupportCases("example_support", "audit-travel", questions,
                CoachQueryAnalyzer.QueryMode.WRITING_SUPPORT, CoachQueryAnalyzer.ActionFamily.UNKNOWN,
                List.of("for example", "for instance", "specifically", "such as"));
    }

    private List<AuditCase> generateOpinionCompareCases() {
        List<AuditCase> cases = new ArrayList<>(100);
        List<String> opinionQuestions = List.of(
                "의견을 분명하게 말하는 표현 알려줘",
                "내 생각을 말할 때 쓸 표현 추천해줘",
                "찬성 의견을 밝히는 표현 알려줘",
                "내 입장을 자연스럽게 시작하는 표현 알려줘",
                "의견 표현 여러 개 알려줘",
                "의견 표현 알려줘",
                "내생각 말하는 표현 뭐있어?",
                "입장 밝히는 표현 있어?",
                "찬성의견 표현 추천좀",
                "의견 스타터"
        );
        List<String> compareQuestions = List.of(
                "비교하거나 반대 의견을 넣는 표현 알려줘",
                "장단점을 비교할 때 쓸 표현 추천해줘",
                "반대 의견 붙이는 표현 알려줘",
                "비교 흐름 만들 때 좋은 표현 알려줘",
                "다른 한편을 말할 때 표현 알려줘",
                "비교 표현 알려줘",
                "반대 의견 표현 뭐있어?",
                "장단점 말하는 표현 있어?",
                "on the other hand 표현 추천좀",
                "비교 스타터"
        );
        cases.addAll(generateSupportCasesWithRepeats("opinion_support", "audit-society", opinionQuestions,
                CoachQueryAnalyzer.QueryMode.WRITING_SUPPORT, CoachQueryAnalyzer.ActionFamily.UNKNOWN,
                List.of("i think", "in my opinion", "from my perspective", "personally"), 5));
        cases.addAll(generateSupportCasesWithRepeats("compare_support", "audit-society", compareQuestions,
                CoachQueryAnalyzer.QueryMode.WRITING_SUPPORT, CoachQueryAnalyzer.ActionFamily.UNKNOWN,
                List.of("on the other hand", "whereas", "compared with", "however"), 5));
        return cases;
    }

    private List<AuditCase> generateStructureBalanceCases() {
        List<AuditCase> cases = new ArrayList<>(100);
        List<String> structureQuestions = List.of(
                "답변 구조를 어떻게 쓰면 좋을지 알려줘",
                "무엇부터 쓰면 좋을지 가이드 줘",
                "짧은 답변 구조 추천해줘",
                "의견 이유 예시 순서 알려줘",
                "문장 흐름을 어떻게 만들지 알려줘",
                "구조 알려줘",
                "뭐부터 써야해?",
                "답변 흐름 있어?",
                "짧은 구조 추천좀",
                "구조 스타터"
        );
        List<String> balanceQuestions = List.of(
                "장단점을 같이 말하는 구조 알려줘",
                "한편 다른 한편 구조 표현 알려줘",
                "균형 있게 말할 때 쓰는 표현 알려줘",
                "찬반을 같이 쓰는 흐름 추천해줘",
                "overall 느낌으로 마무리하는 표현 알려줘",
                "장단점 구조 알려줘",
                "한편 다른한편 표현 뭐있어?",
                "균형답변 표현 있어?",
                "찬반 흐름 추천좀",
                "overall 표현"
        );
        cases.addAll(generateSupportCasesWithRepeats("structure_support", "audit-work-study", structureQuestions,
                CoachQueryAnalyzer.QueryMode.WRITING_SUPPORT, CoachQueryAnalyzer.ActionFamily.UNKNOWN,
                List.of("one reason is that", "for example", "first", "finally"), 5));
        cases.addAll(generateSupportCasesWithRepeats("balance_support", "audit-society", balanceQuestions,
                CoachQueryAnalyzer.QueryMode.WRITING_SUPPORT, CoachQueryAnalyzer.ActionFamily.UNKNOWN,
                List.of("on the one hand", "on the other hand", "overall", "however"), 5));
        return cases;
    }

    private List<AuditCase> generateHybridAmbiguousCases() {
        List<String> questions = List.of(
                "친구 만난다고 말하고 싶은데 예시 붙이는 표현도 알려줘",
                "유도를 배우고 싶다고 말하고 싶은데 이유 표현도 같이 알려줘",
                "온라인 만남이 자연스러워졌다고 말하고 싶은데 의견 표현도 필요해",
                "메이드카페에 가보고 싶다고 하고 싶은데 첫 문장도 추천해줘",
                "잔다고 말하고 싶은데 구조도 같이 알려줘",
                "친구 만난다 영어로랑 예시표현 같이",
                "유도 배우고싶다 말 하고싶고 이유표현도 줘",
                "온라인 만남 자연스러워졌단거 말하고 구조도 알려줘",
                "메이드카페 가보고싶음 영어로랑 스타터도",
                "잔다고 말하고싶고 예시도 같이"
        );
        List<String> promptIds = List.of(
                "audit-communication",
                "audit-growth",
                "audit-tech",
                "audit-travel",
                "audit-health"
        );
        List<AuditCase> cases = new ArrayList<>(100);
        int id = 901;
        for (int repeat = 0; repeat < 10; repeat++) {
            for (int i = 0; i < questions.size(); i++) {
                cases.add(new AuditCase(
                        String.format(Locale.ROOT, "Q%04d", id++),
                        "hybrid_ambiguous",
                        promptIds.get(i % promptIds.size()),
                        questions.get(i),
                        repeat < 5 ? "well_formed" : "malformed",
                        CoachQueryAnalyzer.QueryMode.MEANING_LOOKUP,
                        CoachQueryAnalyzer.ActionFamily.UNKNOWN,
                        List.of("learn", "meet", "visit", "example", "reason", "i think")
                ));
            }
        }
        return cases;
    }

    private List<AuditCase> generateSupportCases(
            String bucket,
            String promptId,
            List<String> questions,
            CoachQueryAnalyzer.QueryMode expectedMode,
            CoachQueryAnalyzer.ActionFamily expectedFamily,
            List<String> expectedKeywords
    ) {
        return generateSupportCasesWithRepeats(bucket, promptId, questions, expectedMode, expectedFamily, expectedKeywords, 10);
    }

    private List<AuditCase> generateSupportCasesWithRepeats(
            String bucket,
            String promptId,
            List<String> questions,
            CoachQueryAnalyzer.QueryMode expectedMode,
            CoachQueryAnalyzer.ActionFamily expectedFamily,
            List<String> expectedKeywords,
            int repeats
    ) {
        List<AuditCase> cases = new ArrayList<>(questions.size() * repeats);
        int start = switch (bucket) {
            case "reason_support" -> 501;
            case "example_support" -> 601;
            case "opinion_support" -> 701;
            case "compare_support" -> 751;
            case "structure_support" -> 801;
            case "balance_support" -> 851;
            default -> 1;
        };
        int id = start;
        for (int repeat = 0; repeat < repeats; repeat++) {
            for (String question : questions) {
                cases.add(new AuditCase(
                        String.format(Locale.ROOT, "Q%04d", id++),
                        bucket,
                        promptId,
                        question,
                        repeat < repeats / 2 ? "well_formed" : "malformed",
                        expectedMode,
                        expectedFamily,
                        expectedKeywords
                ));
            }
        }
        return cases;
    }

    private List<AuditCase> generateCases(
            String bucket,
            String promptId,
            CoachQueryAnalyzer.QueryMode expectedMode,
            CoachQueryAnalyzer.ActionFamily expectedFamily,
            List<TargetPair> targets,
            List<VariantTemplate> templates,
            java.util.function.Function<TargetPair, List<String>> expectedKeywordBuilder
    ) {
        List<AuditCase> cases = new ArrayList<>(targets.size() * templates.size());
        int start = switch (bucket) {
            case "learn_lookup" -> 1;
            case "socialize_lookup" -> 101;
            case "sleep_lookup" -> 201;
            case "state_change_lookup" -> 301;
            case "visit_interest_lookup" -> 401;
            default -> 1;
        };
        int id = start;
        for (TargetPair target : targets) {
            for (VariantTemplate template : templates) {
                cases.add(new AuditCase(
                        String.format(Locale.ROOT, "Q%04d", id++),
                        bucket,
                        promptId,
                        template.render(target.koreanText()),
                        template.quality(),
                        expectedMode,
                        expectedFamily,
                        expectedKeywordBuilder.apply(target)
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
        CoachQueryAnalyzer.QueryMode actualMode = analysis.lookup()
                .map(spec -> spec.detection().mode())
                .orElse(CoachQueryAnalyzer.QueryMode.WRITING_SUPPORT);
        CoachQueryAnalyzer.ActionFamily actualFamily = analysis.lookup()
                .map(spec -> spec.frame().family())
                .orElse(CoachQueryAnalyzer.ActionFamily.UNKNOWN);

        List<String> expressions = response.expressions().stream()
                .map(expression -> expression.expression())
                .toList();
        String joinedExpressions = expressions.stream()
                .map(expression -> expression.toLowerCase(Locale.ROOT))
                .collect(Collectors.joining(" | "));

        List<String> reasons = new ArrayList<>();
        if (actualMode != auditCase.expectedMode()) {
            reasons.add("mode_mismatch");
        }
        if (auditCase.expectedFamily() != CoachQueryAnalyzer.ActionFamily.UNKNOWN
                && actualFamily != auditCase.expectedFamily()) {
            reasons.add("family_mismatch");
        }
        if (!containsAnyCue(joinedExpressions, auditCase.expectedKeywords())) {
            reasons.add("missing_expected_keywords");
        }
        if (auditCase.expectedMode() == CoachQueryAnalyzer.QueryMode.MEANING_LOOKUP
                && genericLeakage(joinedExpressions)
                && !containsAnyCue(joinedExpressions, auditCase.expectedKeywords())) {
            reasons.add("generic_fallback_leakage");
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

    private boolean containsAnyCue(String joinedExpressions, List<String> expectedKeywords) {
        return expectedKeywords.stream()
                .map(keyword -> keyword.toLowerCase(Locale.ROOT))
                .anyMatch(joinedExpressions::contains);
    }

    private boolean genericLeakage(String joinedExpressions) {
        return GENERIC_STARTERS.stream().filter(joinedExpressions::contains).count() >= 2;
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
        for (Map.Entry<String, Long> entry : reasonCounts.entrySet()) {
            markdown.append("- ").append(entry.getKey()).append(": ").append(entry.getValue()).append('\n');
        }

        markdown.append("\n## Sample Suspicious Cases\n\n");
        suspiciousResults.stream().limit(40).forEach(result -> {
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

    private record AuditCase(
            String id,
            String bucket,
            String promptId,
            String question,
            String quality,
            CoachQueryAnalyzer.QueryMode expectedMode,
            CoachQueryAnalyzer.ActionFamily expectedFamily,
            List<String> expectedKeywords
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
