package com.writeloop.service;

import com.writeloop.dto.CoachExpressionDto;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.CoachHelpRequestDto;
import com.writeloop.dto.CoachHelpResponseDto;
import com.writeloop.dto.CoachUsageCheckRequestDto;
import com.writeloop.dto.CoachUsageCheckResponseDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class CoachService {

    private static final Pattern QUOTED_PHRASE_PATTERN = Pattern.compile("\"([^\"]+)\"");
    private static final Pattern ENGLISH_PHRASE_PATTERN = Pattern.compile("[A-Za-z][A-Za-z0-9' -]{2,}");
    private static final Pattern NON_WORD_PATTERN = Pattern.compile("[^\\p{L}\\p{N}\\s']");
    private static final List<ExpressionTopicBundle> EXPRESSION_TOPIC_BUNDLES = List.of(
            new ExpressionTopicBundle(
                    "sleep",
                    "잠",
                    Set.of("잠", "자다", "잔다", "잠들", "취침", "수면", "sleep", "asleep", "bed"),
                    List.of(
                            new CoachExpressionDto("go to bed", "잠자리에 들 때 가장 기본적으로 쓸 수 있는 표현이에요.", "몇 시에 자러 가는지 말할 때 제일 무난하게 쓸 수 있어요.", "I usually go to bed around eleven.", "COACH"),
                            new CoachExpressionDto("go to sleep", "자러 가거나 잠이 들기 직전 상황을 말할 때 좋아요.", "go to bed보다 실제로 잠드는 느낌이 더 가까워요.", "I go to sleep right after reading.", "COACH"),
                            new CoachExpressionDto("fall asleep", "잠이 드는 순간이나 과정 자체를 말할 때 쓰는 표현이에요.", "쉽게 잠드는지, 늦게 잠드는지 말할 때 특히 잘 맞아요.", "I fall asleep quickly after a shower.", "COACH"),
                            new CoachExpressionDto("get some sleep", "잠을 좀 자야 한다는 느낌으로 말할 때 유용해요.", "조언하거나 피곤한 상황을 말할 때 자연스럽게 들려요.", "I need to get some sleep tonight.", "COACH"),
                            new CoachExpressionDto("sleep well", "푹 자다, 잠을 잘 자다를 말할 때 쓰는 표현이에요.", "잠의 질이나 컨디션과 연결해서 말하기 좋아요.", "I sleep well when the room is quiet.", "COACH")
                    )
            ),
            new ExpressionTopicBundle(
                    "study",
                    "공부",
                    Set.of("공부", "공부하다", "배우다", "학습", "study", "learn", "practice"),
                    List.of(
                            new CoachExpressionDto("study for", "무엇을 위해 공부하는지 말할 때 좋아요.", "시험, 목표, 과목과 함께 붙이면 자연스러워요.", "I study for my English test every night.", "COACH"),
                            new CoachExpressionDto("work on", "어떤 부분을 집중해서 연습하거나 다듬는다는 뜻으로 좋아요.", "skills, pronunciation, writing 같은 말과 잘 어울려요.", "I work on my pronunciation every day.", "COACH"),
                            new CoachExpressionDto("practice by ...ing", "어떤 방식으로 연습하는지 구체적으로 말할 때 유용해요.", "공부 방법을 함께 말하고 싶을 때 자연스러워요.", "I practice by rewriting my answers.", "COACH"),
                            new CoachExpressionDto("review", "복습하다를 짧고 자연스럽게 말할 때 쓰는 표현이에요.", "notes, words, mistakes와 함께 쓰면 좋아요.", "I review new words before bed.", "COACH"),
                            new CoachExpressionDto("keep studying", "계속 공부한다는 흐름을 말할 때 좋아요.", "습관이나 꾸준함을 강조할 때 잘 맞아요.", "I want to keep studying every day.", "COACH")
                    )
            ),
            new ExpressionTopicBundle(
                    "rest",
                    "쉬다",
                    Set.of("쉬다", "휴식", "휴가", "rest", "relax", "break"),
                    List.of(
                            new CoachExpressionDto("take a break", "잠깐 쉬다를 가장 자연스럽게 말할 때 쓰는 표현이에요.", "공부나 일 사이에 쉬는 상황에 특히 잘 맞아요.", "I take a short break after lunch.", "COACH"),
                            new CoachExpressionDto("get some rest", "충분히 쉬다, 좀 쉬다를 말할 때 좋아요.", "피곤한 상황이나 건강과 연결해 말하기 좋아요.", "I need to get some rest this weekend.", "COACH"),
                            new CoachExpressionDto("relax at home", "집에서 편하게 쉰다는 느낌을 줄 때 쓰는 표현이에요.", "주말 루틴을 말할 때 잘 어울려요.", "I usually relax at home on Sundays.", "COACH"),
                            new CoachExpressionDto("rest for a while", "잠깐 쉬고 있다는 흐름을 말할 때 자연스러워요.", "짧은 휴식을 설명할 때 부담 없이 쓸 수 있어요.", "I rest for a while before dinner.", "COACH"),
                            new CoachExpressionDto("unwind", "긴장을 풀고 쉬다를 조금 더 자연스럽게 말할 때 좋아요.", "하루를 마무리하며 쉬는 장면에 잘 맞아요.", "I unwind by listening to music.", "COACH")
                    )
            )
    );

    private final PromptService promptService;
    private final OpenAiCoachClient openAiCoachClient;

    public CoachHelpResponseDto help(CoachHelpRequestDto request) {
        PromptDto prompt = requirePrompt(request.promptId());
        String userQuestion = normalizeText(request.question());
        ExpressionTopicBundle expressionTopic = resolveExpressionTopic(userQuestion);
        List<PromptHintDto> hints = promptService.findHintsByPromptId(prompt.id());
        Set<String> intentCategories = resolveIntentCategories(prompt, userQuestion);

        if (openAiCoachClient.isConfigured()) {
            try {
                CoachHelpResponseDto response = openAiCoachClient.help(prompt, userQuestion, hints);
                List<CoachExpressionDto> normalized = normalizeHelpExpressions(response.expressions());
                List<CoachExpressionDto> prioritized = filterExpressionsByIntent(normalized, intentCategories);
                if (prioritized.size() >= 3) {
                    String coachReply = response.coachReply() == null || response.coachReply().isBlank()
                            ? buildCoachReply(prompt, userQuestion, prioritized)
                            : response.coachReply();
                    return new CoachHelpResponseDto(
                            prompt.id(),
                            userQuestion,
                            coachReply,
                            limitExpressions(prioritized)
                    );
                }
            } catch (RuntimeException ignored) {
                // Fall back to the local suggestion builder.
            }
        }

        if (expressionTopic != null) {
            return new CoachHelpResponseDto(
                    prompt.id(),
                    userQuestion,
                    buildTopicCoachReply(expressionTopic),
                    limitExpressions(new ArrayList<>(expressionTopic.expressions()))
            );
        }

        List<CoachExpressionDto> expressions = buildLocalExpressions(prompt, userQuestion, hints, intentCategories);
        return new CoachHelpResponseDto(
                prompt.id(),
                userQuestion,
                buildCoachReply(prompt, userQuestion, expressions),
                expressions
        );
    }

    public CoachUsageCheckResponseDto checkUsage(CoachUsageCheckRequestDto request) {
        PromptDto prompt = requirePrompt(request.promptId());
        String answer = request.answer();
        String normalizedAnswer = normalizeText(answer);
        List<String> expressions = normalizeExpressions(request.expressions());

        if (expressions.isEmpty()) {
            throw new IllegalArgumentException("expressions is required");
        }

        List<CoachExpressionUsageDto> usedExpressions = new ArrayList<>();
        List<CoachExpressionUsageDto> unusedExpressions = new ArrayList<>();
        Set<String> usedCategories = new LinkedHashSet<>();

        for (String expression : expressions) {
            ExpressionMatch match = matchExpression(answer, expression);
            CoachExpressionUsageDto usage = new CoachExpressionUsageDto(
                    expression,
                    match.matched(),
                    match.matchType(),
                    match.matchedText()
            );

            if (match.matched()) {
                usedExpressions.add(usage);
                usedCategories.addAll(inferCategories(expression));
            } else {
                unusedExpressions.add(usage);
            }
        }

        if (usedCategories.isEmpty()) {
            usedCategories.addAll(inferCategories(prompt.questionEn() + " " + prompt.questionKo() + " " + prompt.tip()));
        }

        List<String> suggestedPromptIds = suggestPromptIds(prompt, normalizedAnswer, usedCategories);
        String coachReply = buildUsageReply(usedExpressions, unusedExpressions);

        return new CoachUsageCheckResponseDto(
                prompt.id(),
                coachReply,
                usedExpressions,
                unusedExpressions,
                suggestedPromptIds
        );
    }

    private PromptDto requirePrompt(String promptId) {
        String normalizedPromptId = promptId == null ? "" : promptId.trim();
        if (normalizedPromptId.isEmpty()) {
            throw new IllegalArgumentException("promptId is required");
        }

        return promptService.findAll().stream()
                .filter(prompt -> prompt.id().equals(normalizedPromptId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Prompt not found"));
    }

    private List<CoachExpressionDto> buildLocalExpressions(
            PromptDto prompt,
            String userQuestion,
            List<PromptHintDto> hints,
            Set<String> intentCategories
    ) {
        List<CoachExpressionDto> expressions = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();

        if (intentCategories.isEmpty()) {
            appendHintExpressions(expressions, seen, hints, intentCategories);
        } else {
            appendExpressions(expressions, seen, buildGenericExpressions(prompt, userQuestion));
            appendHintExpressions(expressions, seen, hints, intentCategories);
        }

        if (expressions.size() < 3) {
            appendExpressions(
                    expressions,
                    seen,
                    intentCategories.isEmpty() ? fallbackExpressions() : fallbackExpressionsForIntent(intentCategories)
            );
        }

        return limitExpressions(expressions);
    }

    private void appendHintExpressions(
            List<CoachExpressionDto> expressions,
            Set<String> seen,
            List<PromptHintDto> hints,
            Set<String> intentCategories
    ) {
        for (PromptHintDto hint : hints) {
            for (CoachExpressionDto expression : buildExpressionsFromHint(hint)) {
                if (!intentCategories.isEmpty() && !matchesIntent(expression, intentCategories)) {
                    continue;
                }
                if (seen.add(normalizeKey(expression.expression()))) {
                    expressions.add(expression);
                }
                if (expressions.size() >= 5) {
                    return;
                }
            }
        }
    }

    private void appendExpressions(
            List<CoachExpressionDto> expressions,
            Set<String> seen,
            List<CoachExpressionDto> candidates
    ) {
        for (CoachExpressionDto expression : candidates) {
            if (seen.add(normalizeKey(expression.expression()))) {
                expressions.add(expression);
            }
            if (expressions.size() >= 5) {
                return;
            }
        }
    }

    private List<CoachExpressionDto> buildExpressionsFromHint(PromptHintDto hint) {
        List<String> phrases = new ArrayList<>();
        String content = hint.content() == null ? "" : hint.content().trim();
        String hintType = hint.hintType() == null ? "COACH" : hint.hintType().trim().toUpperCase(Locale.ROOT);

        Matcher quotedMatcher = QUOTED_PHRASE_PATTERN.matcher(content);
        while (quotedMatcher.find()) {
            String phrase = normalizeText(quotedMatcher.group(1));
            if (!phrase.isBlank()) {
                phrases.add(phrase);
            }
        }

        if (phrases.isEmpty() && (hintType.contains("VOCAB") || hintType.contains("LINKER"))) {
            String hintText = content.replaceFirst("^[^:]*:\\s*", "");
            for (String part : hintText.split(",")) {
                String phrase = normalizeText(part);
                if (!phrase.isBlank()) {
                    phrases.add(phrase);
                }
            }
        }

        List<CoachExpressionDto> expressions = new ArrayList<>();
        for (String phrase : phrases) {
            if (phrase.length() < 3) {
                continue;
            }
            expressions.add(new CoachExpressionDto(
                    phrase,
                    buildMeaningForHintType(hintType),
                    buildUsageTipForHintType(hintType, content),
                    buildExampleForPhrase(phrase),
                    hintType
            ));
        }

        if (expressions.isEmpty() && (hintType.contains("STARTER") || hintType.contains("STRUCTURE") || hintType.contains("DETAIL"))) {
            String generic = genericExpressionForHintType(hintType, content);
            if (!generic.isBlank()) {
                expressions.add(new CoachExpressionDto(
                        generic,
                        buildMeaningForHintType(hintType),
                        buildUsageTipForHintType(hintType, content),
                        buildExampleForPhrase(generic),
                        hintType
                ));
            }
        }

        return expressions;
    }

    private List<CoachExpressionDto> buildGenericExpressions(PromptDto prompt, String userQuestion) {
        Set<String> categories = new LinkedHashSet<>();
        categories.addAll(resolveIntentCategories(prompt, userQuestion));

        List<CoachExpressionDto> expressions = new ArrayList<>();
        for (String category : categories) {
            CoachExpressionDto expression = switch (category) {
                case "reason" -> new CoachExpressionDto(
                        "One reason is that ...",
                        "이유를 자연스럽게 말할 때 쓰는 표현이에요.",
                        "내 생각의 이유를 이어서 설명할 때 좋아요.",
                        "One reason is that it helps me stay focused.",
                        "COACH"
                );
                case "example" -> new CoachExpressionDto(
                        "For example, ...",
                        "구체적인 예시를 붙일 때 쓰는 표현이에요.",
                        "짧은 예시를 하나 붙이면 답변이 더 설득력 있어져요.",
                        "For example, I usually study after dinner.",
                        "COACH"
                );
                case "opinion" -> new CoachExpressionDto(
                        "I think ...",
                        "의견을 분명하게 말할 때 쓰는 표현이에요.",
                        "내 입장을 먼저 말하고 싶을 때 가장 기본적으로 좋아요.",
                        "I think this habit is important.",
                        "COACH"
                );
                case "comparison" -> new CoachExpressionDto(
                        "On the other hand, ...",
                        "반대되는 점이나 비교를 이어갈 때 쓰는 표현이에요.",
                        "장단점을 비교하는 질문에서 특히 잘 맞아요.",
                        "On the other hand, it can be tiring sometimes.",
                        "COACH"
                );
                case "habit" -> new CoachExpressionDto(
                        "I usually ...",
                        "습관이나 반복 행동을 말할 때 쓰는 표현이에요.",
                        "일상 습관이나 루틴을 설명할 때 잘 어울려요.",
                        "I usually answer one question every day.",
                        "COACH"
                );
                case "future" -> new CoachExpressionDto(
                        "In the long run, ...",
                        "장기적인 결과를 말할 때 쓰는 표현이에요.",
                        "지금 행동이 나중에 어떤 효과를 줄지 말할 때 좋아요.",
                        "In the long run, this will help me improve.",
                        "COACH"
                );
                case "detail" -> new CoachExpressionDto(
                        "Specifically, ...",
                        "더 구체적으로 설명할 때 쓰는 표현이에요.",
                        "추상적인 말을 한 번 더 풀어줄 때 자연스러워요.",
                        "Specifically, I practice by rewriting my answer.",
                        "COACH"
                );
                default -> null;
            };

            if (expression != null) {
                expressions.add(expression);
            }
        }

        return expressions;
    }

    private List<CoachExpressionDto> fallbackExpressions() {
        return List.of(
                new CoachExpressionDto(
                        "One reason is that ...",
                        "이유를 자연스럽게 말할 때 쓰는 표현이에요.",
                        "가장 기본적인 이유 연결 표현으로 편하게 써 보세요.",
                        "One reason is that it makes me more confident.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "For example, ...",
                        "예시를 덧붙일 때 쓰는 표현이에요.",
                        "짧은 예시 하나만 붙여도 답변이 훨씬 구체적이 됩니다.",
                        "For example, I study while listening to music.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "I think ...",
                        "의견을 분명하게 말할 때 쓰는 표현이에요.",
                        "답변의 시작을 잡아주기 좋은 기본 표현이에요.",
                        "I think this is a good habit.",
                        "COACH"
                )
        );
    }

    private List<CoachExpressionDto> fallbackExpressionsForIntent(Set<String> intentCategories) {
        List<CoachExpressionDto> expressions = new ArrayList<>();

        if (intentCategories.contains("reason")) {
            expressions.add(new CoachExpressionDto(
                    "This is because ...",
                    "이유를 바로 이어서 설명할 때 쓰는 표현이에요.",
                    "짧고 직접적으로 이유를 붙일 때 좋아요.",
                    "This is because it helps me focus better.",
                    "COACH"
            ));
            expressions.add(new CoachExpressionDto(
                    "The main reason is that ...",
                    "핵심 이유를 먼저 말할 때 쓰는 표현이에요.",
                    "한 가지 이유를 더 강조하고 싶을 때 좋아요.",
                    "The main reason is that it saves time.",
                    "COACH"
            ));
        }

        if (intentCategories.contains("example")) {
            expressions.add(new CoachExpressionDto(
                    "For instance, ...",
                    "예시를 자연스럽게 덧붙일 때 쓰는 표현이에요.",
                    "For example 대신 조금 더 다양하게 바꿀 때 좋아요.",
                    "For instance, I study with a friend.",
                    "COACH"
            ));
            expressions.add(new CoachExpressionDto(
                    "A good example is ...",
                    "예시를 하나 들어 설명할 때 쓰는 표현이에요.",
                    "짧은 예시를 앞에 두고 말하고 싶을 때 좋아요.",
                    "A good example is my weekend routine.",
                    "COACH"
            ));
        }

        if (intentCategories.contains("opinion")) {
            expressions.add(new CoachExpressionDto(
                    "I believe ...",
                    "내 생각을 조금 더 분명하게 말할 때 쓰는 표현이에요.",
                    "I think보다 살짝 더 자신 있게 들릴 수 있어요.",
                    "I believe this habit is important.",
                    "COACH"
            ));
            expressions.add(new CoachExpressionDto(
                    "In my opinion, ...",
                    "의견을 자연스럽게 시작할 때 쓰는 표현이에요.",
                    "질문의 답을 부드럽게 열고 싶을 때 좋아요.",
                    "In my opinion, it is a useful habit.",
                    "COACH"
            ));
        }

        if (intentCategories.contains("comparison")) {
            expressions.add(new CoachExpressionDto(
                    "In contrast, ...",
                    "비교할 때 반대되는 점을 말하는 표현이에요.",
                    "On the other hand와 비슷하게 쓸 수 있어요.",
                    "In contrast, some people prefer quiet places.",
                    "COACH"
            ));
            expressions.add(new CoachExpressionDto(
                    "Compared with that, ...",
                    "앞의 내용과 비교해서 말할 때 쓰는 표현이에요.",
                    "두 가지를 나란히 비교할 때 좋아요.",
                    "Compared with that, this option is easier.",
                    "COACH"
            ));
        }

        if (intentCategories.contains("habit")) {
            expressions.add(new CoachExpressionDto(
                    "I often ...",
                    "자주 하는 습관을 말할 때 쓰는 표현이에요.",
                    "usually와 비슷하게 조금 더 다양하게 말할 수 있어요.",
                    "I often study after dinner.",
                    "COACH"
            ));
            expressions.add(new CoachExpressionDto(
                    "My routine is to ...",
                    "일상적인 패턴을 설명할 때 쓰는 표현이에요.",
                    "습관을 한 번에 정리해서 말하고 싶을 때 좋아요.",
                    "My routine is to read before sleeping.",
                    "COACH"
            ));
        }

        if (intentCategories.contains("future")) {
            expressions.add(new CoachExpressionDto(
                    "In the future, ...",
                    "앞으로의 계획을 말할 때 쓰는 표현이에요.",
                    "미래 계획을 더 직접적으로 말하고 싶을 때 좋아요.",
                    "In the future, I want to travel more.",
                    "COACH"
            ));
            expressions.add(new CoachExpressionDto(
                    "My goal is to ...",
                    "앞으로 이루고 싶은 목표를 말할 때 쓰는 표현이에요.",
                    "계획과 목표를 선명하게 만들고 싶을 때 좋아요.",
                    "My goal is to speak more confidently.",
                    "COACH"
            ));
        }

        if (intentCategories.contains("detail")) {
            expressions.add(new CoachExpressionDto(
                    "To be more specific, ...",
                    "조금 더 자세히 설명할 때 쓰는 표현이에요.",
                    "구체적인 예를 바로 이어서 붙이기 좋아요.",
                    "To be more specific, I review my notes every night.",
                    "COACH"
            ));
            expressions.add(new CoachExpressionDto(
                    "For more detail, ...",
                    "설명을 더 덧붙일 때 쓰는 표현이에요.",
                    "상대가 더 알고 싶어 할 때 이어서 말하기 좋아요.",
                    "For more detail, I usually explain my routine.",
                    "COACH"
            ));
        }

        if (intentCategories.contains("balance")) {
            expressions.add(new CoachExpressionDto(
                    "On the one hand, ...",
                    "균형 있게 말할 때 앞부분을 여는 표현이에요.",
                    "반대 의견을 함께 보여 주고 싶을 때 좋아요.",
                    "On the one hand, it saves time.",
                    "COACH"
            ));
            expressions.add(new CoachExpressionDto(
                    "Overall, ...",
                    "전체적으로 정리해서 말할 때 쓰는 표현이에요.",
                    "마무리 느낌을 만들고 싶을 때 좋아요.",
                    "Overall, it is a useful habit.",
                    "COACH"
            ));
        }

        return expressions;
    }

    private String buildMeaningForHintType(String hintType) {
        return switch (hintType) {
            case "STARTER" -> "답변을 자연스럽게 시작할 때 쓰기 좋아요.";
            case "VOCAB" -> "이 주제에서 활용하기 좋은 표현이에요.";
            case "STRUCTURE" -> "답변의 틀을 잡아주는 표현이에요.";
            case "DETAIL" -> "내용을 더 구체적으로 만들 때 좋아요.";
            case "LINKER" -> "문장을 매끄럽게 이어주는 표현이에요.";
            case "BALANCE" -> "의견을 균형 있게 펼칠 때 좋아요.";
            default -> "답변을 더 자연스럽게 만드는 표현이에요.";
        };
    }

    private String buildUsageTipForHintType(String hintType, String content) {
        return switch (hintType) {
            case "STARTER" -> "첫 문장을 시작할 때 바로 써 보세요.";
            case "VOCAB" -> "핵심 단어를 자연스럽게 넣고 싶을 때 좋아요.";
            case "STRUCTURE" -> "이유와 예시를 붙이는 흐름에 잘 맞아요.";
            case "DETAIL" -> "짧은 답변에 구체성을 더하고 싶을 때 쓰세요.";
            case "LINKER" -> "이유, 예시, 추가 설명을 연결할 때 좋아요.";
            case "BALANCE" -> "장단점을 함께 말해야 할 때 잘 맞아요.";
            default -> content;
        };
    }

    private String genericExpressionForHintType(String hintType, String content) {
        return switch (hintType) {
            case "STARTER" -> extractEnglishFragment(content);
            case "STRUCTURE" -> "One reason is that ...";
            case "DETAIL" -> "For example, ...";
            case "BALANCE" -> "On the other hand, ...";
            default -> "";
        };
    }

    private String extractEnglishFragment(String content) {
        Matcher matcher = QUOTED_PHRASE_PATTERN.matcher(content == null ? "" : content);
        if (matcher.find()) {
            return normalizeText(matcher.group(1));
        }

        Matcher englishMatcher = ENGLISH_PHRASE_PATTERN.matcher(content == null ? "" : content);
        if (englishMatcher.find()) {
            return normalizeText(englishMatcher.group());
        }

        return "";
    }

    private String buildExampleForPhrase(String expression) {
        String cleanExpression = expression.replace("...", "").trim();
        if (cleanExpression.isBlank()) {
            cleanExpression = "I think";
        }
        if (cleanExpression.endsWith(",")) {
            cleanExpression = cleanExpression.substring(0, cleanExpression.length() - 1);
        }
        return cleanExpression + " it helps me speak more clearly.";
    }

    private List<CoachExpressionDto> normalizeHelpExpressions(List<CoachExpressionDto> expressions) {
        Set<String> seen = new LinkedHashSet<>();
        List<CoachExpressionDto> normalized = new ArrayList<>();
        for (CoachExpressionDto expression : expressions == null ? List.<CoachExpressionDto>of() : expressions) {
            String key = normalizeKey(expression.expression());
            if (!key.isBlank() && seen.add(key)) {
                normalized.add(expression);
            }
        }
        return normalized;
    }

    private List<CoachExpressionDto> limitExpressions(List<CoachExpressionDto> expressions) {
        if (expressions.size() <= 5) {
            return expressions;
        }
        return new ArrayList<>(expressions.subList(0, 5));
    }

    private List<String> normalizeExpressions(List<String> expressions) {
        if (expressions == null) {
            return List.of();
        }

        return expressions.stream()
                .map(this::normalizeText)
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
    }

    private String buildCoachReply(PromptDto prompt, String userQuestion, List<CoachExpressionDto> expressions) {
        List<String> categories = new ArrayList<>(resolveIntentCategories(prompt, userQuestion));

        if (looksLikeExpressionLookup(normalizeText(userQuestion))) {
            return "표현하고 싶은 뜻에 바로 가까운 표현을 먼저 골랐어요. 예문을 같이 보면서 내 문장에 맞는 걸 골라보세요.";
        }

        if (categories.contains("reason") || categories.contains("opinion")) {
            return "이 질문에서는 이유와 내 의견을 같이 말하면 자연스러워요. 아래 표현을 그대로 참고해서 답을 만들어 보세요.";
        }
        if (categories.contains("comparison") || categories.contains("balance")) {
            return "이 질문에서는 비교나 균형 잡힌 의견을 말하는 표현이 잘 어울려요.";
        }
        if (categories.contains("habit") || categories.contains("future")) {
            return "일상 습관이나 앞으로의 계획을 말하는 표현을 중심으로 준비했어요.";
        }
        if (expressions.stream().anyMatch(expression -> "STARTER".equalsIgnoreCase(expression.sourceHintType()))) {
            return "질문에 바로 붙여 쓸 수 있는 시작 표현을 먼저 골라뒀어요.";
        }
        return "지금 질문에 바로 써 볼 수 있는 표현을 골라봤어요. 하나만 골라도 충분히 도움이 될 거예요.";
    }

    private String buildTopicCoachReply(ExpressionTopicBundle topicBundle) {
        return topicBundle.labelKo() + "을(를) 말할 때 바로 가져다 쓸 수 있는 표현을 중심으로 골랐어요. "
                + "비슷해 보여도 쓰임이 조금씩 다르니 예문까지 같이 보고 골라보세요.";
    }

    private List<CoachExpressionDto> filterExpressionsByIntent(
            List<CoachExpressionDto> expressions,
            Set<String> intentCategories
    ) {
        if (intentCategories.isEmpty()) {
            return expressions;
        }

        Set<String> seen = new LinkedHashSet<>();
        List<CoachExpressionDto> filtered = new ArrayList<>();
        for (CoachExpressionDto expression : expressions) {
            if (!matchesIntent(expression, intentCategories)) {
                continue;
            }
            if (seen.add(normalizeKey(expression.expression()))) {
                filtered.add(expression);
            }
        }
        return filtered;
    }

    private boolean matchesIntent(CoachExpressionDto expression, Set<String> intentCategories) {
        if (intentCategories.isEmpty()) {
            return true;
        }

        Set<String> expressionCategories = inferCategories(expression.expression() + " " + expression.example());
        for (String category : expressionCategories) {
            if (intentCategories.contains(category)) {
                return true;
            }
        }
        return false;
    }

    private Set<String> resolveIntentCategories(PromptDto prompt, String userQuestion) {
        Set<String> userCategories = inferCategories(userQuestion);
        if (!userCategories.isEmpty()) {
            return userCategories;
        }

        return inferCategories(prompt.questionEn() + " " + prompt.questionKo() + " " + prompt.tip());
    }

    private ExpressionTopicBundle resolveExpressionTopic(String userQuestion) {
        if (userQuestion == null || userQuestion.isBlank()) {
            return null;
        }

        String normalized = normalizeText(userQuestion);
        if (!looksLikeExpressionLookup(normalized)) {
            return null;
        }

        for (ExpressionTopicBundle bundle : EXPRESSION_TOPIC_BUNDLES) {
            for (String keyword : bundle.keywords()) {
                if (normalized.contains(keyword)) {
                    return bundle;
                }
            }
        }

        return null;
    }

    private boolean looksLikeExpressionLookup(String normalizedQuestion) {
        if (containsAny(
                normalizedQuestion,
                "영어로", "표현", "말하고 싶", "어떻게 말", "뭐라고", "라고 말", "라고 하고", "단어",
                "how do i say", "want to say", "expression", "phrase", "word")) {
            return true;
        }

        return normalizedQuestion.split("\\s+").length <= 2;
    }

    private String buildUsageReply(List<CoachExpressionUsageDto> usedExpressions, List<CoachExpressionUsageDto> unusedExpressions) {
        if (!usedExpressions.isEmpty()) {
            String highlight = usedExpressions.stream()
                    .limit(2)
                    .map(CoachExpressionUsageDto::expression)
                    .toList()
                    .toString();
            return "좋아요. 추천한 표현을 실제로 썼어요: " + highlight + ". 다음엔 같은 흐름으로 다른 표현도 하나 더 붙여볼 수 있어요.";
        }

        if (!unusedExpressions.isEmpty()) {
            return "아직 추천 표현이 잘 보이지 않아요. 다음 답변에서는 표현 하나를 먼저 넣고 문장을 이어가 보세요.";
        }

        return "좋아요. 표현을 자연스럽게 써볼 준비가 잘 되어 있어요.";
    }

    private List<String> suggestPromptIds(PromptDto currentPrompt, String answer, Set<String> usedCategories) {
        List<PromptDto> prompts = promptService.findAll();
        List<ScoredPrompt> scoredPrompts = new ArrayList<>();

        Set<String> currentCategories = new LinkedHashSet<>(inferCategories(
                currentPrompt.questionEn() + " " + currentPrompt.questionKo() + " " + currentPrompt.tip() + " " + currentPrompt.topic()
        ));
        currentCategories.addAll(usedCategories);

        Set<String> answerTokens = tokenize(answer);
        Set<String> currentTokens = tokenize(
                currentPrompt.topic() + " " + currentPrompt.questionEn() + " " + currentPrompt.questionKo() + " " + currentPrompt.tip()
        );

        for (int i = 0; i < prompts.size(); i++) {
            PromptDto prompt = prompts.get(i);
            if (prompt.id().equals(currentPrompt.id())) {
                continue;
            }

            int score = 0;
            if (prompt.difficulty().equalsIgnoreCase(currentPrompt.difficulty())) {
                score += 4;
            }

            Set<String> promptCategories = inferCategories(
                    prompt.questionEn() + " " + prompt.questionKo() + " " + prompt.tip() + " " + prompt.topic()
            );
            for (String category : promptCategories) {
                if (currentCategories.contains(category)) {
                    score += 5;
                }
            }

            Set<String> promptTokens = tokenize(
                    prompt.topic() + " " + prompt.questionEn() + " " + prompt.questionKo() + " " + prompt.tip()
            );
            for (String token : promptTokens) {
                if (answerTokens.contains(token)) {
                    score += 2;
                }
                if (currentTokens.contains(token)) {
                    score += 1;
                }
            }

            if (score > 0) {
                scoredPrompts.add(new ScoredPrompt(prompt.id(), score, i));
            }
        }

        scoredPrompts.sort(Comparator
                .comparingInt(ScoredPrompt::score).reversed()
                .thenComparingInt(ScoredPrompt::order));

        List<String> suggested = new ArrayList<>();
        for (ScoredPrompt scoredPrompt : scoredPrompts) {
            if (!suggested.contains(scoredPrompt.promptId())) {
                suggested.add(scoredPrompt.promptId());
            }
            if (suggested.size() >= 3) {
                break;
            }
        }

        if (suggested.size() < 3) {
            for (PromptDto prompt : prompts) {
                if (!prompt.id().equals(currentPrompt.id()) && !suggested.contains(prompt.id())) {
                    suggested.add(prompt.id());
                }
                if (suggested.size() >= 3) {
                    break;
                }
            }
        }

        return suggested;
    }

    private ExpressionMatch matchExpression(String answer, String expression) {
        String normalizedExpression = normalizeExpressionCore(expression);
        if (normalizedExpression.isBlank()) {
            return new ExpressionMatch(false, "UNUSED", null);
        }

        if (answer.contains(normalizedExpression)) {
            return new ExpressionMatch(true, "EXACT", normalizedExpression);
        }

        String normalizedAnswer = normalizeText(answer);
        if (normalizedAnswer.contains(normalizedExpression)) {
            return new ExpressionMatch(true, "NORMALIZED", normalizedExpression);
        }

        Set<String> answerTokens = tokenize(answer);
        Set<String> expressionTokens = tokenize(normalizedExpression);
        if (!expressionTokens.isEmpty()) {
            long overlap = expressionTokens.stream().filter(answerTokens::contains).count();
            double ratio = (double) overlap / (double) expressionTokens.size();
            if (ratio >= 0.6) {
                return new ExpressionMatch(true, "PARAPHRASED", normalizedExpression);
            }
        }

        return new ExpressionMatch(false, "UNUSED", null);
    }

    private String normalizeExpressionCore(String expression) {
        String normalized = normalizeText(expression);
        normalized = normalized.replace("...", "");
        normalized = normalized.replace("…", "");
        return normalized.replaceAll("\\s+", " ").trim();
    }

    private String normalizeKey(String value) {
        return normalizeExpressionCore(value);
    }

    private String normalizeText(String value) {
        if (value == null) {
            return "";
        }

        String normalized = Normalizer.normalize(value, Normalizer.Form.NFKC);
        normalized = normalized.toLowerCase(Locale.ROOT);
        normalized = NON_WORD_PATTERN.matcher(normalized).replaceAll(" ");
        normalized = normalized.replaceAll("\\s+", " ").trim();
        return normalized;
    }

    private Set<String> inferCategories(String text) {
        String normalized = normalizeText(text);
        Set<String> categories = new LinkedHashSet<>();

        if (containsAny(normalized,
                "why", "reason", "because", "since", "so that", "one reason is that",
                "이유", "왜", "왜냐하면", "때문", "근거")) {
            categories.add("reason");
        }
        if (containsAny(normalized,
                "example", "for instance", "for example", "such as", "specifically",
                "예시", "예를 들어", "예를들어", "예로", "경험")) {
            categories.add("example");
        }
        if (containsAny(normalized,
                "think", "opinion", "believe", "i feel", "in my opinion", "i think",
                "의견", "생각", "입장", "주장")) {
            categories.add("opinion");
        }
        if (containsAny(normalized,
                "compare", "different", "similar", "on the other hand", "whereas",
                "비교", "차이", "반면", "반대로")) {
            categories.add("comparison");
        }
        if (containsAny(normalized,
                "usually", "every day", "habit", "routine", "often",
                "습관", "루틴", "평소", "주말", "보통", "자주", "매일")) {
            categories.add("habit");
        }
        if (containsAny(normalized,
                "future", "plan", "goal", "long run", "in the long run", "this year",
                "계획", "목표", "앞으로", "장기", "장기적")) {
            categories.add("future");
        }
        if (containsAny(normalized,
                "detail", "specific", "specifically", "more clearly", "explain",
                "구체", "자세히", "설명", "풀어서")) {
            categories.add("detail");
        }
        if (containsAny(normalized,
                "balance", "on the one hand", "on the other hand", "overall",
                "균형", "한편", "다른 한편", "전체적으로", "종합")) {
            categories.add("balance");
        }

        return categories;
    }

    private boolean containsAny(String source, String... tokens) {
        for (String token : tokens) {
            if (source.contains(token)) {
                return true;
            }
        }
        return false;
    }

    private Set<String> tokenize(String value) {
        String normalized = normalizeText(value);
        if (normalized.isBlank()) {
            return Set.of();
        }

        return new LinkedHashSet<>(Arrays.asList(normalized.split("\\s+")));
    }

    private record ExpressionMatch(boolean matched, String matchType, String matchedText) {
    }

    private record ScoredPrompt(String promptId, int score, int order) {
    }

    private record ExpressionTopicBundle(
            String key,
            String labelKo,
            Set<String> keywords,
            List<CoachExpressionDto> expressions
    ) {
    }
}
