package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.CoachExpressionDto;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.CoachHelpRequestDto;
import com.writeloop.dto.CoachHelpResponseDto;
import com.writeloop.dto.CoachSelfDiscoveredCandidateDto;
import com.writeloop.dto.CoachUsageCheckRequestDto;
import com.writeloop.dto.CoachUsageCheckResponseDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.AnswerHistoryUsedExpressionDto;
import com.writeloop.persistence.AnswerAttemptEntity;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AttemptType;
import com.writeloop.persistence.CoachInteractionEntity;
import com.writeloop.persistence.CoachInteractionRepository;
import com.writeloop.persistence.CoachResponseSource;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class CoachService {

    private static final Pattern QUOTED_PHRASE_PATTERN = Pattern.compile("\"([^\"]+)\"");
    private static final Pattern ENGLISH_PHRASE_PATTERN = Pattern.compile("[A-Za-z][A-Za-z0-9' -]{2,}");
    private static final Pattern NON_WORD_PATTERN = Pattern.compile("[^\\p{L}\\p{N}\\s']");
    private static final Pattern SELF_DISCOVERED_CLAUSE_BREAK_PATTERN = Pattern.compile(
            "\\b(?:because|since|so|which|while|although)\\b",
            Pattern.CASE_INSENSITIVE
    );
    private static final String LETTER_TOKEN = "[\\p{L}][\\p{L}'-]*";
    private static final String EXPRESSION_SOURCE_RECOMMENDED = "RECOMMENDED";
    private static final String EXPRESSION_SOURCE_SELF_DISCOVERED = "SELF_DISCOVERED";
    private static final String SELF_DISCOVERED_USAGE_TIP = "답변 안에서 스스로 자연스럽게 살린 표현이에요.";
    private static final List<Pattern> SELF_DISCOVERED_EXPRESSION_PATTERNS = List.of(
            Pattern.compile("\\b(?:in my opinion|i think|one reason is that|this is because|for example|for instance|on the other hand|in the long run|as a result|at the same time|these days)\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\b(?:i(?:'d| would)? like to|i would love to|i want to|i plan to|i hope to|i need to)(?: " + LETTER_TOKEN + "){1,7}\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\b(?:i )?want to (?:learn|study|practice|improve|meet|visit|experience|explore|enjoy|connect with|communicate with)(?: " + LETTER_TOKEN + "){1,5}\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\b(?:learn|study|practice|improve|visit|experience|explore|enjoy)(?: " + LETTER_TOKEN + "){1,5}\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\b(?:meet|connect with|communicate with|spend time with|keep in touch with)(?: " + LETTER_TOKEN + "){1,5}\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\b(?:i(?:'m| am)? )?(?:curious about|interested in)(?: " + LETTER_TOKEN + "){1,5}\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\b(?:get used to|got used to|have gotten used to|has gotten used to|be used to)(?: " + LETTER_TOKEN + "){1,6}\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\b(?:meet people online|build relationships online|feel more comfortable(?: with)?(?: " + LETTER_TOKEN + "){0,3}|become more natural(?: to)?(?: " + LETTER_TOKEN + "){0,3}|get used to(?: " + LETTER_TOKEN + "){1,5})\\b", Pattern.CASE_INSENSITIVE)
    );
    private static final Set<String> TRAILING_WEAK_TOKENS = Set.of(
            "a", "an", "and", "are", "as", "at", "be", "because", "for", "from", "if",
            "in", "into", "is", "of", "on", "or", "that", "the", "to", "with"
    );
    private static final Set<String> PARAPHRASE_STOPWORDS = Set.of(
            "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by",
            "can", "could", "did", "do", "does", "for", "from", "get", "go", "had",
            "has", "have", "i", "if", "in", "into", "is", "it", "its", "just", "keep",
            "lot", "make", "many", "may", "might", "more", "most", "much", "my", "of",
            "often", "on", "one", "or", "our", "really", "say", "should", "so", "some",
            "stay", "still", "take", "tell", "than", "that", "the", "their", "them",
            "there", "these", "they", "this", "those", "to", "too", "use", "very",
            "want", "was", "we", "were", "what", "when", "which", "while", "will",
            "with", "would", "you", "your"
    );
    private static final Map<String, String> LEARN_TARGET_TRANSLATIONS = Map.ofEntries(
            Map.entry("\uC720\uB3C4", "judo"),
            Map.entry("\uD0DC\uAD8C\uB3C4", "taekwondo"),
            Map.entry("\uAC80\uB3C4", "kendo"),
            Map.entry("\uC218\uC601", "swimming"),
            Map.entry("\uD53C\uC544\uB178", "piano"),
            Map.entry("\uAE30\uD0C0", "guitar"),
            Map.entry("\uCF54\uB529", "coding"),
            Map.entry("\uD504\uB85C\uADF8\uB798\uBC0D", "programming"),
            Map.entry("\uC601\uC5B4", "English"),
            Map.entry("\uC77C\uBCF8\uC5B4", "Japanese"),
            Map.entry("\uC911\uAD6D\uC5B4", "Chinese"),
            Map.entry("\uC694\uB9AC", "cooking"),
            Map.entry("\uCD95\uAD6C", "soccer"),
            Map.entry("\uB18D\uAD6C", "basketball"),
            Map.entry("\uD14C\uB2C8\uC2A4", "tennis")
    );
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
    private final AnswerAttemptRepository answerAttemptRepository;
    private final CoachInteractionRepository coachInteractionRepository;
    private final ObjectMapper objectMapper;
    private final CoachQueryAnalyzer coachQueryAnalyzer;
    private final Map<String, CoachQueryAnalyzer.TranslationResult> slotTranslationCache = new ConcurrentHashMap<>();

    public CoachHelpResponseDto help(CoachHelpRequestDto request) {
        return help(request, null, null);
    }

    public CoachHelpResponseDto help(CoachHelpRequestDto request, Long currentUserId, String httpSessionId) {
        PromptDto prompt = requirePrompt(request.promptId());
        String userQuestion = request.question() == null ? "" : request.question().trim();
        String answerSnapshot = request.answer() == null ? "" : request.answer().trim();
        List<PromptHintDto> hints = promptService.findHintsByPromptId(prompt.id());
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = coachQueryAnalyzer.analyze(prompt, userQuestion);
        Set<String> intentCategories = analysis.intentKeys();
        boolean expressionLookup = analysis.lookup().isPresent();
        CoachQueryAnalyzer.MeaningLookupSpec effectiveLookupSpec = analysis.lookup().orElse(null);
        CoachHelpBuildResult buildResult;

        if (expressionLookup) {
            SlotEnrichmentResult enrichmentResult = enrichLookupSpecWithFallback(
                    prompt,
                    userQuestion,
                    analysis.lookup().orElseThrow()
            );
            effectiveLookupSpec = enrichmentResult.lookupSpec();
            List<CoachExpressionDto> expressions = buildMeaningLookupExpressions(effectiveLookupSpec);
            if (!expressions.isEmpty()) {
                buildResult = new CoachHelpBuildResult(
                        buildCoachReply(prompt, userQuestion, expressions),
                        expressions,
                        enrichmentResult.usedSlotTranslation()
                                ? CoachResponseSource.DETERMINISTIC_WITH_SLOT_TRANSLATION
                                : CoachResponseSource.DETERMINISTIC,
                        enrichmentResult.usedSlotTranslation() ? openAiCoachClient.configuredModel() : null
                );
            } else {
                CoachHelpBuildResult openAiResult = tryOpenAiHelp(prompt, userQuestion, hints, intentCategories, true);
                if (openAiResult != null) {
                    buildResult = openAiResult;
                } else {
                    List<CoachExpressionDto> fallbackExpressions = limitExpressions(fallbackExpressions());
                    buildResult = new CoachHelpBuildResult(
                            buildCoachReply(prompt, userQuestion, fallbackExpressions),
                            fallbackExpressions,
                            CoachResponseSource.LOCAL_FALLBACK,
                            null
                    );
                }
            }
        } else {
            CoachHelpBuildResult openAiResult = tryOpenAiHelp(prompt, userQuestion, hints, intentCategories, false);
            if (openAiResult != null) {
                buildResult = openAiResult;
            } else {
                List<CoachExpressionDto> expressions = buildLocalExpressions(prompt, userQuestion, hints, intentCategories);
                buildResult = new CoachHelpBuildResult(
                        buildCoachReply(prompt, userQuestion, expressions),
                        expressions,
                        CoachResponseSource.LOCAL_FALLBACK,
                        null
                );
            }
        }

        String interactionId = persistCoachInteraction(
                request,
                prompt,
                hints,
                currentUserId,
                httpSessionId,
                analysis,
                effectiveLookupSpec,
                answerSnapshot,
                buildResult
        );

        return new CoachHelpResponseDto(
                prompt.id(),
                userQuestion,
                buildResult.coachReply(),
                buildResult.expressions(),
                interactionId
        );
    }

    private CoachHelpBuildResult tryOpenAiHelp(
            PromptDto prompt,
            String userQuestion,
            List<PromptHintDto> hints,
            Set<String> intentCategories,
            boolean meaningLookup
    ) {
        if (!openAiCoachClient.isConfigured()) {
            return null;
        }

        try {
            CoachHelpResponseDto response = openAiCoachClient.help(prompt, userQuestion, hints);
            List<CoachExpressionDto> normalized = normalizeHelpExpressions(response.expressions());
            List<CoachExpressionDto> prioritized = meaningLookup
                    ? normalized
                    : filterExpressionsByIntent(normalized, intentCategories);
            if (prioritized.size() < 3) {
                return null;
            }

            String coachReply = response.coachReply() == null || response.coachReply().isBlank()
                    ? buildCoachReply(prompt, userQuestion, prioritized)
                    : response.coachReply();
            return new CoachHelpBuildResult(
                    coachReply,
                    limitExpressions(prioritized),
                    CoachResponseSource.OPENAI,
                    openAiCoachClient.configuredModel()
            );
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private SlotEnrichmentResult enrichLookupSpecWithFallback(
            PromptDto prompt,
            String userQuestion,
            CoachQueryAnalyzer.MeaningLookupSpec lookupSpec
    ) {
        if (lookupSpec.frame().sourceSlots().isEmpty()) {
            return new SlotEnrichmentResult(lookupSpec, false);
        }

        EnumMap<CoachQueryAnalyzer.MeaningSlot, CoachQueryAnalyzer.TranslationResult> translations =
                new java.util.EnumMap<>(lookupSpec.translations());
        boolean changed = false;
        boolean usedSlotTranslation = false;

        for (Map.Entry<CoachQueryAnalyzer.MeaningSlot, String> slotEntry : lookupSpec.frame().sourceSlots().entrySet()) {
            String sourceText = slotEntry.getValue() == null ? "" : slotEntry.getValue().trim();
            if (sourceText.isBlank()) {
                continue;
            }

            CoachQueryAnalyzer.TranslationResult existing = translations.get(slotEntry.getKey());
            if (existing != null && existing.resolved() && !existing.englishText().isBlank()) {
                continue;
            }

            String cacheKey = buildSlotTranslationCacheKey(lookupSpec.frame().family(), slotEntry.getKey(), sourceText);
            CoachQueryAnalyzer.TranslationResult cached = slotTranslationCache.get(cacheKey);
            if (cached != null && cached.resolved() && !cached.englishText().isBlank()) {
                translations.put(slotEntry.getKey(), cached);
                changed = true;
                continue;
            }

            if (!openAiCoachClient.isConfigured()) {
                continue;
            }

            String translated = openAiCoachClient.translateMeaningSlot(
                    prompt,
                    userQuestion,
                    lookupSpec.frame().family(),
                    slotEntry.getKey(),
                    sourceText
            );
            if (translated == null || translated.isBlank()) {
                continue;
            }

            CoachQueryAnalyzer.TranslationResult resolved = new CoachQueryAnalyzer.TranslationResult(
                    sourceText,
                    translated,
                    true
            );
            slotTranslationCache.put(cacheKey, resolved);
            translations.put(slotEntry.getKey(), resolved);
            changed = true;
            usedSlotTranslation = true;
        }

        if (!changed) {
            return new SlotEnrichmentResult(lookupSpec, false);
        }

        return new SlotEnrichmentResult(
                new CoachQueryAnalyzer.MeaningLookupSpec(
                        lookupSpec.detection(),
                        lookupSpec.frame(),
                        translations
                ),
                usedSlotTranslation
        );
    }

    private String buildSlotTranslationCacheKey(
            CoachQueryAnalyzer.ActionFamily family,
            CoachQueryAnalyzer.MeaningSlot slot,
            String sourceText
    ) {
        return family.name() + "|" + slot.name() + "|" + normalizeKey(sourceText);
    }

    private String persistCoachInteraction(
            CoachHelpRequestDto request,
            PromptDto prompt,
            List<PromptHintDto> hints,
            Long currentUserId,
            String httpSessionId,
            CoachQueryAnalyzer.CoachQueryAnalysis analysis,
            CoachQueryAnalyzer.MeaningLookupSpec effectiveLookupSpec,
            String answerSnapshot,
            CoachHelpBuildResult buildResult
    ) {
        String interactionId = UUID.randomUUID().toString();
        String analysisPayloadJson = writeJson(buildAnalysisPayload(analysis, effectiveLookupSpec));
        String promptHintsJson = writeJson(hints);
        String expressionsJson = writeJson(buildResult.expressions());
        String meaningFamily = effectiveLookupSpec == null ? null : effectiveLookupSpec.frame().family().name();
        AttemptType attemptContextType = normalizeAttemptContextType(request.attemptType());

        CoachInteractionEntity interaction = new CoachInteractionEntity(
                interactionId,
                currentUserId,
                blankToNull(httpSessionId),
                blankToNull(request.sessionId()),
                attemptContextType,
                prompt.id(),
                prompt.topic(),
                prompt.difficulty(),
                prompt.questionEn(),
                prompt.questionKo(),
                prompt.tip(),
                promptHintsJson,
                request.question().trim(),
                analysis.normalizedQuestion(),
                blankToNull(answerSnapshot),
                effectiveLookupSpec != null
                        ? effectiveLookupSpec.detection().mode().name()
                        : CoachQueryAnalyzer.QueryMode.WRITING_SUPPORT.name(),
                meaningFamily,
                analysisPayloadJson,
                buildResult.coachReply(),
                expressionsJson,
                buildResult.responseSource(),
                blankToNull(buildResult.responseModel())
        );

        coachInteractionRepository.save(interaction);
        return interactionId;
    }

    private Map<String, Object> buildAnalysisPayload(
            CoachQueryAnalyzer.CoachQueryAnalysis analysis,
            CoachQueryAnalyzer.MeaningLookupSpec effectiveLookupSpec
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("rawQuestion", analysis.rawQuestion());
        payload.put("normalizedQuestion", analysis.normalizedQuestion());
        payload.put("intents", analysis.intentKeys());

        CoachQueryAnalyzer.MeaningLookupSpec lookupSpec = effectiveLookupSpec != null
                ? effectiveLookupSpec
                : analysis.lookup().orElse(null);
        if (lookupSpec == null) {
            payload.put("queryMode", CoachQueryAnalyzer.QueryMode.WRITING_SUPPORT.name());
            return payload;
        }

        payload.put("queryMode", lookupSpec.detection().mode().name());
        payload.put("lookupCue", lookupSpec.detection().cue());
        payload.put("meaningFamily", lookupSpec.frame().family().name());
        payload.put("surfaceMeaning", lookupSpec.frame().surfaceMeaning());
        payload.put("sourceSlots", lookupSpec.frame().sourceSlots());
        payload.put("translations", lookupSpec.translations());
        return payload;
    }

    private void updateCoachInteractionUsage(
            CoachUsageCheckRequestDto request,
            List<CoachExpressionUsageDto> usedExpressions,
            List<CoachExpressionUsageDto> unusedExpressions,
            List<String> suggestedPromptIds,
            String coachReply
    ) {
        String interactionId = blankToNull(request.interactionId());
        if (interactionId == null) {
            return;
        }

        CoachInteractionEntity interaction = coachInteractionRepository.findByRequestId(interactionId)
                .orElse(null);
        if (interaction == null) {
            return;
        }

        Map<String, Object> usagePayload = new LinkedHashMap<>();
        usagePayload.put("promptId", request.promptId());
        usagePayload.put("coachReply", coachReply);
        usagePayload.put("usedExpressions", usedExpressions);
        usagePayload.put("unusedExpressions", unusedExpressions);
        usagePayload.put("suggestedPromptIds", suggestedPromptIds);

        interaction.updateUsage(
                blankToNull(request.sessionId()),
                request.attemptNo(),
                writeJson(usedExpressions),
                writeJson(usagePayload)
        );
        coachInteractionRepository.save(interaction);
    }

    private AttemptType normalizeAttemptContextType(String attemptType) {
        if (attemptType == null || attemptType.isBlank()) {
            return null;
        }

        try {
            return AttemptType.valueOf(attemptType.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize coach interaction payload", exception);
        }
    }

    public CoachUsageCheckResponseDto checkUsage(CoachUsageCheckRequestDto request) {
        PromptDto prompt = requirePrompt(request.promptId());
        String answer = request.answer();
        String normalizedAnswer = normalizeText(answer);
        List<String> expressions = normalizeExpressions(request.expressions());
        AnswerAttemptEntity attempt = findAttempt(request);

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
                    match.matchedText(),
                    EXPRESSION_SOURCE_RECOMMENDED,
                    null
            );

            if (match.matched()) {
                usedExpressions.add(usage);
                usedCategories.addAll(inferCategories(expression));
            } else {
                unusedExpressions.add(usage);
            }
        }

        List<CoachExpressionUsageDto> selfDiscoveredExpressions = findSelfDiscoveredExpressions(
                prompt,
                answer,
                attempt,
                expressions,
                usedExpressions
        );
        usedExpressions.addAll(selfDiscoveredExpressions);
        selfDiscoveredExpressions.forEach(expression -> usedCategories.addAll(inferCategories(expression.expression())));

        if (usedCategories.isEmpty()) {
            usedCategories.addAll(inferCategories(prompt.questionEn() + " " + prompt.questionKo() + " " + prompt.tip()));
        }

        List<String> suggestedPromptIds = suggestPromptIds(prompt, normalizedAnswer, usedCategories);
        String coachReply = buildUsageReply(usedExpressions, unusedExpressions);
        persistUsedExpressions(attempt, usedExpressions);
        updateCoachInteractionUsage(request, usedExpressions, unusedExpressions, suggestedPromptIds, coachReply);

        return new CoachUsageCheckResponseDto(
                prompt.id(),
                coachReply,
                usedExpressions,
                unusedExpressions,
                suggestedPromptIds
        );
    }

    private void persistUsedExpressions(
            AnswerAttemptEntity attempt,
            List<CoachExpressionUsageDto> usedExpressions
    ) {
        if (attempt == null) {
            return;
        }

        try {
            List<AnswerHistoryUsedExpressionDto> historyExpressions = usedExpressions.stream()
                    .map(expression -> new AnswerHistoryUsedExpressionDto(
                            expression.expression(),
                            expression.matchType(),
                            expression.matchedText(),
                            expression.source()
                    ))
                    .toList();
            attempt.updateUsedCoachExpressions(objectMapper.writeValueAsString(historyExpressions));
            answerAttemptRepository.save(attempt);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize used coach expressions", exception);
        }
    }

    private AnswerAttemptEntity findAttempt(CoachUsageCheckRequestDto request) {
        String sessionId = request.sessionId() == null ? "" : request.sessionId().trim();
        Integer attemptNo = request.attemptNo();

        if (sessionId.isBlank() || attemptNo == null || attemptNo < 1) {
            return null;
        }

        return answerAttemptRepository.findBySessionIdAndAttemptNo(sessionId, attemptNo)
                .orElse(null);
    }

    private List<CoachExpressionUsageDto> findSelfDiscoveredExpressions(
            PromptDto prompt,
            String answer,
            AnswerAttemptEntity attempt,
            List<String> recommendedExpressions,
            List<CoachExpressionUsageDto> usedExpressions
    ) {
        Set<String> excludedExpressions = new LinkedHashSet<>();
        recommendedExpressions.stream()
                .map(this::normalizeExpressionCore)
                .filter(candidate -> !candidate.isBlank())
                .forEach(excludedExpressions::add);
        usedExpressions.stream()
                .map(CoachExpressionUsageDto::expression)
                .map(this::normalizeExpressionCore)
                .filter(candidate -> !candidate.isBlank())
                .forEach(excludedExpressions::add);

        List<String> preservedSegments = extractPreservedSegments(attempt);
        List<CoachExpressionUsageDto> selfDiscoveredExpressions = new ArrayList<>();
        selfDiscoveredExpressions.addAll(
                extractSelfDiscoveredExpressionsWithOpenAi(
                        prompt,
                        answer,
                        recommendedExpressions,
                        preservedSegments,
                        excludedExpressions
                )
        );
        selfDiscoveredExpressions.forEach(expression ->
                excludedExpressions.add(normalizeExpressionCore(expression.expression()))
        );

        if (selfDiscoveredExpressions.size() < 3) {
            List<String> preferredCandidates = buildSelfDiscoveredCandidates(answer, preservedSegments);
            for (String candidate : preferredCandidates) {
                CoachExpressionUsageDto usage = createSelfDiscoveredUsage(candidate, SELF_DISCOVERED_USAGE_TIP);
                if (usage == null) {
                    continue;
                }

                String normalizedCandidate = normalizeExpressionCore(usage.expression());
                if (normalizedCandidate.isBlank() || excludedExpressions.contains(normalizedCandidate)) {
                    continue;
                }

                selfDiscoveredExpressions.add(usage);
                excludedExpressions.add(normalizedCandidate);

                if (selfDiscoveredExpressions.size() >= 3) {
                    break;
                }
            }
        }

        return selfDiscoveredExpressions;
    }

    private List<CoachExpressionUsageDto> extractSelfDiscoveredExpressionsWithOpenAi(
            PromptDto prompt,
            String answer,
            List<String> recommendedExpressions,
            List<String> preservedSegments,
            Set<String> excludedExpressions
    ) {
        if (!openAiCoachClient.isConfigured()) {
            return List.of();
        }

        List<CoachSelfDiscoveredCandidateDto> candidates = openAiCoachClient.extractSelfDiscoveredExpressions(
                prompt,
                answer,
                recommendedExpressions,
                preservedSegments
        );
        if (candidates.isEmpty()) {
            return List.of();
        }

        String normalizedAnswer = normalizeText(answer);
        List<CoachExpressionUsageDto> validated = new ArrayList<>();
        for (CoachSelfDiscoveredCandidateDto candidate : candidates) {
            if (!isAcceptableSelfDiscoveredConfidence(candidate.confidence())) {
                continue;
            }

            CoachExpressionUsageDto usage = createSelfDiscoveredUsage(candidate.matchedSpan(), candidate.usageTip());
            if (usage == null) {
                continue;
            }

            String normalizedCandidate = normalizeExpressionCore(usage.expression());
            if (normalizedCandidate.isBlank()
                    || excludedExpressions.contains(normalizedCandidate)
                    || !normalizedAnswer.contains(normalizedCandidate)) {
                continue;
            }

            validated.add(usage);
            excludedExpressions.add(normalizedCandidate);
            if (validated.size() >= 3) {
                break;
            }
        }

        return validated;
    }

    private List<String> buildSelfDiscoveredCandidates(String answer, List<String> preservedSegments) {
        List<String> directCandidates = extractSelfExpressionCandidates(answer);
        List<String> filteredDirectCandidates = directCandidates.stream()
                .filter(candidate -> isPreservedCandidate(candidate, preservedSegments))
                .toList();
        List<String> preservedCandidates = extractSelfExpressionCandidatesFromSegments(preservedSegments);

        LinkedHashSet<String> orderedCandidates = new LinkedHashSet<>();
        filteredDirectCandidates.forEach(orderedCandidates::add);
        preservedCandidates.forEach(orderedCandidates::add);
        directCandidates.forEach(orderedCandidates::add);

        if (orderedCandidates.isEmpty()) {
            preservedSegments.stream()
                    .map(this::sanitizeExtractedExpression)
                    .filter(this::isValidSelfDiscoveredFallbackSegment)
                    .forEach(orderedCandidates::add);
        }

        return List.copyOf(orderedCandidates);
    }

    private CoachExpressionUsageDto createSelfDiscoveredUsage(String candidate, String usageTip) {
        String sanitizedCandidate = sanitizeExtractedExpression(candidate);
        if (!isValidSelfDiscoveredFallbackSegment(sanitizedCandidate)) {
            return null;
        }

        return new CoachExpressionUsageDto(
                sanitizedCandidate,
                true,
                EXPRESSION_SOURCE_SELF_DISCOVERED,
                sanitizedCandidate,
                EXPRESSION_SOURCE_SELF_DISCOVERED,
                usageTip == null || usageTip.isBlank() ? SELF_DISCOVERED_USAGE_TIP : usageTip
        );
    }

    private List<String> extractPreservedSegments(AnswerAttemptEntity attempt) {
        if (attempt == null || attempt.getFeedbackPayloadJson() == null || attempt.getFeedbackPayloadJson().isBlank()) {
            return List.of();
        }

        try {
            FeedbackResponseDto feedback = objectMapper.readValue(attempt.getFeedbackPayloadJson(), FeedbackResponseDto.class);
            if (feedback.inlineFeedback() == null || feedback.inlineFeedback().isEmpty()) {
                return List.of();
            }

            return feedback.inlineFeedback().stream()
                    .filter(segment -> "KEEP".equalsIgnoreCase(segment.type()))
                    .map(InlineFeedbackSegmentDto::originalText)
                    .map(text -> text == null ? "" : text.trim())
                    .filter(text -> text.split("\\s+").length >= 2)
                    .toList();
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private boolean isPreservedCandidate(String candidate, List<String> preservedSegments) {
        if (preservedSegments.isEmpty()) {
            return true;
        }

        String normalizedCandidate = normalizeExpressionCore(candidate);
        if (normalizedCandidate.isBlank()) {
            return false;
        }

        for (String segment : preservedSegments) {
            if (normalizeText(segment).contains(normalizedCandidate)) {
                return true;
            }
        }

        return false;
    }

    private List<String> extractSelfExpressionCandidatesFromSegments(List<String> preservedSegments) {
        if (preservedSegments.isEmpty()) {
            return List.of();
        }

        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        for (String segment : preservedSegments) {
            extractSelfExpressionCandidates(segment).forEach(candidates::add);
        }
        return List.copyOf(candidates);
    }

    private List<String> extractSelfExpressionCandidates(String answer) {
        if (answer == null || answer.isBlank()) {
            return List.of();
        }

        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        for (Pattern pattern : SELF_DISCOVERED_EXPRESSION_PATTERNS) {
            Matcher matcher = pattern.matcher(answer);
            while (matcher.find()) {
                String candidate = sanitizeExtractedExpression(matcher.group());
                if (candidate.isBlank()) {
                    continue;
                }

                if (!isValidSelfDiscoveredFallbackSegment(candidate)) {
                    continue;
                }

                candidates.add(candidate);
            }
        }

        return List.copyOf(candidates);
    }

    private String sanitizeExtractedExpression(String candidate) {
        if (candidate == null) {
            return "";
        }

        String sanitized = candidate.trim()
                .replaceAll("\\s+", " ")
                .replaceAll("^[^\\p{L}\\p{N}']+|[^\\p{L}\\p{N}']+$", "");
        Matcher clauseBreakMatcher = SELF_DISCOVERED_CLAUSE_BREAK_PATTERN.matcher(sanitized);
        if (clauseBreakMatcher.find()) {
            String prefix = sanitized.substring(0, clauseBreakMatcher.start()).trim();
            if (extractMeaningfulTokens(normalizeExpressionCore(prefix)).size() >= 2) {
                sanitized = prefix;
            }
        }

        String[] tokens = sanitized.split("\\s+");
        int end = tokens.length;
        while (end > 0 && TRAILING_WEAK_TOKENS.contains(tokens[end - 1].toLowerCase(Locale.ROOT))) {
            end -= 1;
        }

        if (end <= 0) {
            return "";
        }

        return String.join(" ", Arrays.copyOf(tokens, end)).trim();
    }

    private boolean isValidSelfDiscoveredFallbackSegment(String candidate) {
        String normalizedCandidate = normalizeExpressionCore(candidate);
        if (normalizedCandidate.isBlank()) {
            return false;
        }

        int meaningfulTokenCount = extractMeaningfulTokens(normalizedCandidate).size();
        int totalTokenCount = normalizedCandidate.split("\\s+").length;
        if (meaningfulTokenCount >= 2) {
            return true;
        }

        return meaningfulTokenCount >= 1 && totalTokenCount >= 4 && totalTokenCount <= 10;
    }

    private boolean isAcceptableSelfDiscoveredConfidence(String confidence) {
        if (confidence == null || confidence.isBlank()) {
            return true;
        }

        return !"LOW".equalsIgnoreCase(confidence.trim());
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
                case "structure" -> new CoachExpressionDto(
                        "First, ...",
                        "답변 흐름을 차례대로 열 때 쓰기 좋은 표현이에요.",
                        "생각을 정리해서 하나씩 이어 말하고 싶을 때 가장 무난해요.",
                        "First, I want to explain my main reason.",
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

        if (intentCategories.contains("structure")) {
            expressions.add(new CoachExpressionDto(
                    "First, ...",
                    "답변 흐름을 차례대로 열 때 쓰기 좋은 표현이에요.",
                    "생각을 정리해서 첫 포인트를 꺼낼 때 자연스럽습니다.",
                    "First, I want to explain my main idea.",
                    "COACH"
            ));
            expressions.add(new CoachExpressionDto(
                    "Another point is that ...",
                    "다음 포인트를 이어서 말할 때 쓰기 좋아요.",
                    "한 가지를 말한 뒤 다음 이유나 포인트를 덧붙일 때 잘 맞아요.",
                    "Another point is that it helps me stay focused.",
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
                .map(value -> value == null ? "" : Normalizer.normalize(value, Normalizer.Form.NFKC).trim())
                .filter(value -> !value.isBlank())
                .map(value -> value.replaceAll("\\s+", " "))
                .distinct()
                .toList();
    }

    private String buildCoachReply(PromptDto prompt, String userQuestion, List<CoachExpressionDto> expressions) {
        List<String> categories = new ArrayList<>(resolveIntentCategories(prompt, userQuestion));

        if (coachQueryAnalyzer.analyze(prompt, userQuestion).lookup().isPresent()) {
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
        return coachQueryAnalyzer.resolveIntentCategories(prompt, userQuestion).stream()
                .map(CoachQueryAnalyzer.IntentCategory::key)
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
    }

    private List<CoachExpressionDto> buildMeaningLookupExpressions(CoachQueryAnalyzer.MeaningLookupSpec lookupSpec) {
        List<CoachExpressionDto> expressions = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();

        switch (lookupSpec.frame().family()) {
            case SOCIALIZE -> appendExpressions(expressions, seen, buildSocializeExpressions());
            case LEARN -> appendExpressions(expressions, seen, buildLearnTargetExpressions(lookupSpec));
            case SLEEP -> appendExpressions(expressions, seen, expressionsForTopicKey("sleep"));
            case STUDY -> appendExpressions(expressions, seen, expressionsForTopicKey("study"));
            case REST -> appendExpressions(expressions, seen, expressionsForTopicKey("rest"));
            case STATE_CHANGE -> appendExpressions(expressions, seen, buildStateChangeExpressions(lookupSpec));
            case VISIT_INTEREST -> appendExpressions(expressions, seen, buildVisitInterestExpressions(lookupSpec));
            case UNKNOWN -> {
            }
        }

        return limitExpressions(expressions);
    }

    private List<CoachExpressionDto> buildLearnTargetExpressions(CoachQueryAnalyzer.MeaningLookupSpec lookupSpec) {
        CoachQueryAnalyzer.TranslationResult targetTranslation = lookupSpec.translations()
                .get(CoachQueryAnalyzer.MeaningSlot.TARGET);
        if (targetTranslation == null || !targetTranslation.resolved() || targetTranslation.englishText().isBlank()) {
            return List.of();
        }

        String translatedTarget = targetTranslation.englishText();

        return List.of(
                new CoachExpressionDto(
                        "I want to learn " + translatedTarget + ".",
                        "'~\uB97C \uBC30\uC6B0\uACE0 \uC2F6\uB2E4'\uB97C \uAC00\uC7A5 \uC9C1\uC811\uC801\uC73C\uB85C \uB9D0\uD560 \uB54C \uC4F0\uAE30 \uC88B\uC544\uC694.",
                        "\uC62C\uD574 \uC0C8\ub85c \uBC30\uC6B0\uACE0 \uC2F6\uC740 \uAE30\uC220\uC774\uB098 \uCDE8\uBBF8\uB97C \uB9D0\uD560 \uB54C \uBC14\uB85C \uC4F0\uAE30 \uC88B\uC2B5\uB2C8\uB2E4.",
                        "I want to learn " + translatedTarget + " this year.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "I want to start learning " + translatedTarget + ".",
                        "\uC9C0\uAE08\uBD80\uD130 \uBC30\uC6B0\uAE30 \uC2DC\uC791\uD558\uACE0 \uC2F6\uB2E4\uB294 \uB290\uB08C\uC744 \uC8FC\uAE30 \uC88B\uC544\uC694.",
                        "\uCC98\uC74C \uC2DC\uC791\uD558\uB294 \uBAA9\uD45C\uB098 \uACC4\uD68D\uC744 \uB9D0\uD560 \uB54C \uC790\uC5F0\uC2A4\uB7FD\uC2B5\uB2C8\uB2E4.",
                        "I want to start learning " + translatedTarget + " after work.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        translatedTarget,
                        "\uD575\uC2EC \uB2E8\uC5B4 \uC790\uCCB4\uB97C \uC544\uB294 \uAC8C \uBA3C\uC800 \uD544\uC694\uD560 \uB54C \uD655\uC778\uD558\uAE30 \uC88B\uC544\uC694.",
                        "\uC774 \uB2E8\uC5B4\uB97C \uC4F0\uACE0 \uC55E\uC5D0 want to learn, practice, improve \uAC19\uC740 \uD45C\uD604\uC744 \uBD99\uC5EC \uBCF4\uC138\uC694.",
                        translatedTarget.substring(0, 1).toUpperCase(Locale.ROOT) + translatedTarget.substring(1) + " is a skill I want to learn.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "practice " + translatedTarget,
                        "\uBC30\uC6B4 \uAC83\uC744 \uC5F0\uC2B5\uD558\uACE0 \uC788\uB2E4\uB294 \uD750\uB984\uC73C\uB85C \uC774\uC5B4 \uB9D0\uD560 \uB54C \uC88B\uC544\uC694.",
                        "\uBC30\uC6B0\uACE0 \uC2F6\uB2E4\uB294 \uB9D0 \uB2E4\uC74C\uC5D0 \uC5B4\uB5BB\uAC8C \uC2E4\uCC9C\uD560\uC9C0 \uBD99\uC77C \uB54C \uC798 \uB9DE\uC2B5\uB2C8\uB2E4.",
                        "I plan to practice " + translatedTarget + " every weekend.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "get better at " + translatedTarget,
                        "\uC2E4\uB825\uC744 \uB298\uB9AC\uACE0 \uC2F6\uB2E4\uB294 \uB290\uB08C\uAE4C\uC9C0 \uD568\uAED8 \uB2F4\uACE0 \uC2F6\uC744 \uB54C \uC720\uC6A9\uD574\uC694.",
                        "\uB2E8\uC21C\uD788 \uBC30\uC6B0\uB294 \uAC83\uC744 \uB118\uC5B4 \uB298\uACE0 \uC2F6\uB2E4\uB294 \uBAA9\uD45C\uB97C \uB9D0\uD558\uAE30 \uC88B\uC2B5\uB2C8\uB2E4.",
                        "I want to get better at " + translatedTarget + " this year.",
                        "COACH"
                )
        );
    }

    private List<CoachExpressionDto> buildVisitInterestExpressions(CoachQueryAnalyzer.MeaningLookupSpec lookupSpec) {
        CoachQueryAnalyzer.TranslationResult targetTranslation = lookupSpec.translations()
                .get(CoachQueryAnalyzer.MeaningSlot.TARGET);
        if (targetTranslation == null || !targetTranslation.resolved() || targetTranslation.englishText().isBlank()) {
            return List.of();
        }

        String translatedTarget = targetTranslation.englishText();

        return List.of(
                new CoachExpressionDto(
                        "I want to visit " + translatedTarget + ".",
                        "'~\uC5D0 \uAC00 \uBCF4\uACE0 \uC2F6\uB2E4'\uB97C \uC9C1\uC811\uC801\uC73C\uB85C \uB9D0\uD560 \uB54C \uC4F0\uAE30 \uC88B\uC544\uC694.",
                        "\uAC00 \uBCF4\uACE0 \uC2F6\uC740 \uC7A5\uC18C\uB098 \uBAA9\uC801\uC9C0\uB97C \uBC14\uB85C \uB9D0\uD558\uAE30 \uC88B\uC2B5\uB2C8\uB2E4.",
                        "I want to visit " + translatedTarget + " someday.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "I'd like to visit " + translatedTarget + ".",
                        "\uC870\uAE08 \uB354 \uBD80\uB4DC\uB7FD\uACE0 \uC815\uC911\uD55C \uB290\uB08C\uC73C\uB85C \uB9D0\uD560 \uB54C \uC798 \uB9DE\uC544\uC694.",
                        "\uC5EC\uD589\uC9C0\uB098 \uAC00 \uBCF4\uACE0 \uC2F6\uC740 \uACF3\uC744 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uB3C4\uC785\uD560 \uC218 \uC788\uC5B4\uC694.",
                        "I'd like to visit " + translatedTarget + " next year.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "I'm curious about " + translatedTarget + ".",
                        "'~\uAC00 \uAD81\uAE08\uD558\uB2E4'\uB294 \uB290\uB08C\uC744 \uC9C1\uC811 \uBCF4\uC5EC\uC8FC\uAE30 \uC88B\uC544\uC694.",
                        "\uC544\uC9C1 \uAC00 \uBCF4\uC9C0 \uC54A\uC558\uC9C0\uB9CC \uAD00\uC2EC\uC774 \uAC00\uB294 \uC0C1\uD0DC\uB97C \uB9D0\uD558\uAE30 \uC88B\uC2B5\uB2C8\uB2E4.",
                        "I'm curious about " + translatedTarget + " because it looks unique.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "I'm interested in " + translatedTarget + ".",
                        "'~\uC5D0 \uAD00\uC2EC\uC774 \uC788\uB2E4'\uB97C \uD06C\uAC8C \uBB34\uB9AC \uC5C6\uC774 \uB9D0\uD560 \uB54C \uC720\uC6A9\uD574\uC694.",
                        "\uC9C1\uC811 \uAC00\uACE0 \uC2F6\uB2E4\uB294 \uB9D0 \uC804\uC5D0 \uD765\uBBF8\uB97C \uC774\uC57C\uAE30\uD560 \uB54C \uC798 \uC5B4\uC6B8\uB824\uC694.",
                        "I'm interested in " + translatedTarget + " these days.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "I want to experience " + translatedTarget + ".",
                        "\uB2E8\uC21C\uD788 \uBC29\uBB38\uD558\uB294 \uAC83\uBCF4\uB2E4 \uCCB4\uD5D8\uD558\uACE0 \uC2F6\uB2E4\uB294 \uB290\uB08C\uC744 \uC904 \uB54C \uC88B\uC544\uC694.",
                        "\uCD95\uC81C, \uBB38\uD654, \uD65C\uB3D9 \uAC19\uC774 \uBB34\uC5B8\uAC00\uB97C \uACAA\uC5B4 \uBCF4\uACE0 \uC2F6\uB2E4\uB294 \uD750\uB984\uC5D0 \uB9DE\uC2B5\uB2C8\uB2E4.",
                        "I want to experience " + translatedTarget + " in person.",
                        "COACH"
                )
        );
    }

    private List<CoachExpressionDto> buildStateChangeExpressions(CoachQueryAnalyzer.MeaningLookupSpec lookupSpec) {
        CoachQueryAnalyzer.TranslationResult topicTranslation = lookupSpec.translations()
                .get(CoachQueryAnalyzer.MeaningSlot.TOPIC);
        CoachQueryAnalyzer.TranslationResult qualifierTranslation = lookupSpec.translations()
                .get(CoachQueryAnalyzer.MeaningSlot.QUALIFIER);

        if (topicTranslation == null || !topicTranslation.resolved() || topicTranslation.englishText().isBlank()) {
            return List.of();
        }

        String topic = topicTranslation.englishText();
        String qualifier = qualifierTranslation == null || qualifierTranslation.englishText().isBlank()
                ? "natural"
                : qualifierTranslation.englishText();

        return List.of(
                new CoachExpressionDto(
                        topic.substring(0, 1).toUpperCase(Locale.ROOT) + topic.substring(1) + " has become more " + qualifier + ".",
                        "'~가 더 자연스러워졌다'처럼 변화된 상태를 말할 때 쓰기 좋아요.",
                        "지금은 예전보다 더 익숙하거나 자연스럽다는 흐름을 바로 보여줄 수 있습니다.",
                        topic.substring(0, 1).toUpperCase(Locale.ROOT) + topic.substring(1) + " has become more " + qualifier + " these days.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "It has become more " + qualifier + " to " + toInfinitiveTopic(topic) + ".",
                        "'~하는 게 더 자연스러워졌다'를 조금 더 직접적으로 말할 때 유용해요.",
                        "행동 자체가 이제는 더 익숙하다고 말하고 싶을 때 자연스럽습니다.",
                        "It has become more " + qualifier + " to " + toInfinitiveTopic(topic) + ".",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "People have become more comfortable with " + topic + ".",
                        "사람들의 인식이 바뀌었다는 느낌까지 함께 주고 싶을 때 좋아요.",
                        "개인 경험보다 사회적 변화나 분위기를 설명할 때 잘 맞습니다.",
                        "People have become more comfortable with " + topic + ".",
                        "COACH"
                ),
                new CoachExpressionDto(
                        topic.substring(0, 1).toUpperCase(Locale.ROOT) + topic.substring(1) + " feels more " + qualifier + " now.",
                        "요즘은 그렇게 하는 게 더 자연스럽다는 인상을 부드럽게 전할 수 있어요.",
                        "조금 더 말하듯이 가볍게 쓰고 싶을 때 잘 어울립니다.",
                        topic.substring(0, 1).toUpperCase(Locale.ROOT) + topic.substring(1) + " feels more " + qualifier + " now.",
                        "COACH"
                )
        );
    }

    private List<CoachExpressionDto> expressionsForTopicKey(String key) {
        return EXPRESSION_TOPIC_BUNDLES.stream()
                .filter(bundle -> bundle.key().equals(key))
                .findFirst()
                .map(ExpressionTopicBundle::expressions)
                .orElse(List.of());
    }

    private String toInfinitiveTopic(String topic) {
        if ("meeting people online".equalsIgnoreCase(topic)) {
            return "meet people online";
        }
        if ("building relationships online".equalsIgnoreCase(topic)) {
            return "build relationships online";
        }
        if ("talking to people online".equalsIgnoreCase(topic)) {
            return "talk to people online";
        }
        if ("keeping in touch online".equalsIgnoreCase(topic)) {
            return "keep in touch online";
        }
        return topic;
    }

    private List<CoachExpressionDto> buildSocializeExpressions() {
        return List.of(
                new CoachExpressionDto(
                        "meet my friends",
                        "친구들을 만난다고 가장 기본적으로 말할 때 쓰기 좋아요.",
                        "일정이나 평소 루틴을 담백하게 말할 때 자연스럽습니다.",
                        "I usually meet my friends after work.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "hang out with my friends",
                        "친구들과 어울리거나 같이 시간을 보낸다고 말할 때 잘 맞아요.",
                        "조금 더 편하고 일상적인 분위기로 말하고 싶을 때 써 보세요.",
                        "I like to hang out with my friends on weekends.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "catch up with my friends",
                        "오랜만에 친구들과 만나 근황을 나눈다는 느낌이 있을 때 좋아요.",
                        "그냥 만나는 것보다 대화와 근황 공유를 강조할 때 자연스럽습니다.",
                        "I catch up with my friends over coffee.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "get together with my friends",
                        "친구들과 한자리에 모인다고 말할 때 쓰기 좋아요.",
                        "약속을 잡거나 같이 모이는 상황을 설명할 때 잘 어울립니다.",
                        "I get together with my friends once or twice a month.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "spend time with my friends",
                        "친구들과 시간을 보낸다는 의미를 가장 넓게 담을 수 있어요.",
                        "꼭 만나기뿐 아니라 같이 놀고 이야기하는 느낌까지 폭넓게 담습니다.",
                        "I spend time with my friends after class.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "keep in touch with my friends",
                        "'\uCE5C\uAD6C\uB4E4\uACFC \uACC4\uC18D \uC5F0\uB77D\uD558\uB2E4'\uB294 \uB9D0\uC744 \uD560 \uB54C \uC4F0\uAE30 \uC88B\uC544\uC694.",
                        "\uC9C1\uC811 \uB9CC\uB098\uC9C0 \uBABB\uD574\uB3C4 \uAD00\uACC4\uB97C \uC774\uC5B4 \uAC00\uB294 \uB290\uB08C\uC744 \uC8FC\uAE30 \uC88B\uC2B5\uB2C8\uB2E4.",
                        "I keep in touch with my friends by texting them often.",
                        "COACH"
                ),
                new CoachExpressionDto(
                        "talk with my friends",
                        "\uCE5C\uAD6C\uC640 \uC774\uC57C\uAE30\uD558\uB294 \uAC83 \uC790\uCCB4\uB97C \uC27D\uAC8C \uB9D0\uD560 \uB54C \uC720\uC6A9\uD574\uC694.",
                        "\uB300\uD654\uD558\uAC70\uB098 \uC18C\uD1B5\uD55C\uB2E4\uB294 \uB9D0\uC744 \uC9E7\uACE0 \uB2F4\uBC31\uD558\uAC8C \uB123\uC744 \uC218 \uC788\uC5B4\uC694.",
                        "I like to talk with my friends after dinner.",
                        "COACH"
                )
        );
    }

    private boolean looksLikeMeetFriendsLookup(String question) {
        return question != null
                && question.matches(".*(\\uCE5C\\uAD6C|friend|friends).*(\\uB9CC\\uB098|\\uB9CC\\uB0A0|\\uB9CC\\uB09C|\\uC5B4\\uC6B8|\\uB180|meet|see|hang out|catch up|get together).*");
    }

    private boolean isMeetFriendsMeaning(String normalizedTarget) {
        if (normalizedTarget.isBlank()) {
            return false;
        }

        boolean hasFriend = containsAny(
                normalizedTarget,
                "\uCE5C\uAD6C", "friend", "friends", "buddy", "buddies"
        );
        boolean hasMeet = containsAny(
                normalizedTarget,
                "\uB9CC\uB098", "\uB9CC\uB0A0", "\uB9CC\uB0A8", "\uC5B4\uC6B8", "\uB180", "\uBCF4\uB7EC", "\uBCF4\uB2E4",
                "meet", "see", "hang out", "catch up", "get together"
        );

        return hasFriend && hasMeet;
    }

    private boolean looksLikeLearningMeaning(String normalizedTarget) {
        if (normalizedTarget.isBlank()) {
            return false;
        }

        return containsAny(
                normalizedTarget,
                "\uBC30\uC6B0\uACE0 \uC2F6", "\uBC30\uC6B0\uACE0", "\uBC30\uC6B0\uB2E4",
                "want to learn", "learn", "start learning"
        );
    }

    private String resolveLearnTargetTranslation(String normalizedTarget) {
        String candidate = normalizedTarget
                .replace("\uBC30\uC6B0\uACE0 \uC2F6\uB2E4\uACE0", " ")
                .replace("\uBC30\uC6B0\uACE0 \uC2F6\uC5B4\uC11C", " ")
                .replace("\uBC30\uC6B0\uACE0 \uC2F6\uC5B4", " ")
                .replace("\uBC30\uC6B0\uACE0 \uC2F6", " ")
                .replace("\uBC30\uC6B0\uACE0", " ")
                .replace("\uBC30\uC6B0\uB2E4", " ")
                .replace("want to learn", " ")
                .replace("start learning", " ")
                .replace("learn", " ")
                .replaceAll("\\s+", " ")
                .trim();

        candidate = candidate
                .replaceAll("(\uC744|\uB97C|\uC740|\uB294|\uC774|\uAC00|\uACFC|\uC640)$", "")
                .replaceAll("\\s+", " ")
                .trim();

        for (Map.Entry<String, String> entry : LEARN_TARGET_TRANSLATIONS.entrySet()) {
            if (candidate.contains(entry.getKey())) {
                return entry.getValue();
            }
        }

        Matcher englishMatcher = ENGLISH_PHRASE_PATTERN.matcher(candidate);
        if (englishMatcher.find()) {
            return englishMatcher.group().trim();
        }

        return "";
    }

    private String extractMeaningLookupTarget(String userQuestion) {
        String normalized = normalizeText(userQuestion);
        if (normalized.isBlank()) {
            return "";
        }

        String extracted = normalized
                .replace("\uC601\uC5B4\uB85C", " ")
                .replace("\uD45C\uD604", " ")
                .replace("\uB9D0\uD558\uACE0 \uC2F6\uC5B4", " ")
                .replace("\uB9D0\uD558\uACE0 \uC2F6", " ")
                .replace("\uC5B4\uB5BB\uAC8C \uB9D0", " ")
                .replace("\uBB50\uB77C\uACE0", " ")
                .replace("\uB77C\uACE0 \uB9D0", " ")
                .replace("\uB77C\uACE0 \uD558\uACE0", " ")
                .replace("\uB2E8\uC5B4", " ")
                .replace("how do i say", " ")
                .replace("want to say", " ")
                .replace("expression", " ")
                .replace("phrase", " ")
                .replace("word", " ")
                .replace("\uB73B\uC774 \uBB50\uC57C", " ")
                .replace("\uB73B\uC774 \uBB54\uC9C0", " ")
                .replace("\uBB34\uC2A8 \uB73B", " ")
                .replace("\uB73B", " ")
                .replace("\uC758\uBBF8", " ")
                .replace("what is the meaning of", " ")
                .replace("what does", " ")
                .replace("meaning", " ")
                .replace("means", " ")
                .replaceAll("\\s+", " ")
                .trim();

        extracted = extracted.replaceAll("\\bmean\\b", " ").replaceAll("\\s+", " ").trim();
        return extracted.isBlank() ? normalized : extracted;
    }

    private ExpressionTopicBundle resolveExpressionTopic(String userQuestion) {
        if (userQuestion == null || userQuestion.isBlank()) {
            return null;
        }

        String normalized = normalizeText(userQuestion);
        if (!isMeaningLookupQuestion(normalized)) {
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

    private boolean isMeaningLookupQuestion(String normalizedQuestion) {
        if (containsAny(
                normalizedQuestion,
                "\uC601\uC5B4\uB85C", "\uB9D0\uD558\uACE0 \uC2F6\uC5B4", "\uB9D0\uD558\uACE0 \uC2F6",
                "\uC5B4\uB5BB\uAC8C \uB9D0", "\uBB50\uB77C\uACE0", "\uB77C\uACE0 \uB9D0", "\uB77C\uACE0 \uD558\uACE0", "\uB2E8\uC5B4",
                "how do i say", "want to say")) {
            return true;
        }

        if (containsAny(
                normalizedQuestion,
                "\uB73B", "\uC758\uBBF8", "\uBB34\uC2A8 \uB73B", "\uB73B\uC774 \uBB50\uC57C", "\uB73B\uC774 \uBB54\uC9C0",
                "meaning", "what does", "means", "mean")) {
            return true;
        }

        if (containsAny(normalizedQuestion, "\uD45C\uD604", "\uB2E8\uC5B4", "expression", "phrase", "word")
                && inferCategories(normalizedQuestion).isEmpty()) {
            return true;
        }

        if (containsAny(
                normalizedQuestion,
                "\uAD6C\uC870", "\uD750\uB984", "\uC21C\uC11C", "\uBB50\uBD80\uD130", "\uC2DC\uC791",
                "structure", "flow", "order", "how should i start", "what to write first")) {
            return false;
        }

        return normalizedQuestion.split("\\s+").length <= 2
                && normalizedQuestion.matches(".*[\\uAC00-\\uD7A3].*");
    }

    private boolean looksLikeExpressionLookup(String normalizedQuestion) {
        if (containsAny(
                normalizedQuestion,
                "영어로", "표현", "말하고 싶", "어떻게 말", "뭐라고", "라고 말", "라고 하고", "단어",
                "how do i say", "want to say", "expression", "phrase", "word")) {
            return true;
        }

        return normalizedQuestion.split("\\s+").length <= 2
                && normalizedQuestion.matches(".*[가-힣].*");
    }

    private String buildUsageReply(List<CoachExpressionUsageDto> usedExpressions, List<CoachExpressionUsageDto> unusedExpressions) {
        List<CoachExpressionUsageDto> recommendedExpressions = usedExpressions.stream()
                .filter(expression -> EXPRESSION_SOURCE_RECOMMENDED.equalsIgnoreCase(expression.source()))
                .toList();
        List<CoachExpressionUsageDto> selfDiscoveredExpressions = usedExpressions.stream()
                .filter(expression -> EXPRESSION_SOURCE_SELF_DISCOVERED.equalsIgnoreCase(expression.source()))
                .toList();

        if (!recommendedExpressions.isEmpty()) {
            String highlight = recommendedExpressions.stream()
                    .limit(2)
                    .map(CoachExpressionUsageDto::expression)
                    .toList()
                    .toString();
            return "좋아요. 추천한 표현을 실제로 썼어요: " + highlight + ". 다음엔 같은 흐름으로 다른 표현도 하나 더 붙여볼 수 있어요.";
        }

        if (!selfDiscoveredExpressions.isEmpty()) {
            String highlight = selfDiscoveredExpressions.stream()
                    .limit(2)
                    .map(CoachExpressionUsageDto::expression)
                    .toList()
                    .toString();
            return "좋아요. 답변 안에서 스스로 만든 표현도 잘 살렸어요: " + highlight + ". 이 흐름을 다음 답변에서도 다시 써보세요.";
        }

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
        String normalizedRawExpression = normalizeText(expression);
        String normalizedExpression = normalizeExpressionCore(expression);
        if (normalizedExpression.isBlank()) {
            return new ExpressionMatch(false, "UNUSED", null);
        }

        String normalizedAnswer = normalizeText(answer);
        if (!normalizedRawExpression.isBlank() && normalizedAnswer.contains(normalizedRawExpression)) {
            return new ExpressionMatch(true, "EXACT", normalizedRawExpression);
        }

        if (!normalizedRawExpression.equals(normalizedExpression) && normalizedAnswer.contains(normalizedExpression)) {
            return new ExpressionMatch(true, "NORMALIZED", normalizedExpression);
        }

        List<String> answerTokens = extractMeaningfulTokenSequence(answer);
        List<String> expressionTokens = extractMeaningfulTokenSequence(normalizedExpression);
        TokenWindow tokenWindow = findCompactOrderedTokenWindow(answerTokens, expressionTokens);
        if (tokenWindow != null) {
            return new ExpressionMatch(
                    true,
                    "PARAPHRASED",
                    String.join(" ", answerTokens.subList(tokenWindow.start(), tokenWindow.end() + 1))
            );
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

        if (containsAny(normalized,
                "\uC65C", "\uC774\uC720", "\uB54C\uBB38", "\uADF8\uB798\uC11C",
                "why", "reason", "because")) {
            categories.add("reason");
        }
        if (containsAny(normalized,
                "\uC608\uC2DC", "\uC608\uB97C \uB4E4\uC5B4", "\uC0AC\uB840", "\uACBD\uD5D8",
                "example", "for example", "for instance", "case", "sample")) {
            categories.add("example");
        }
        if (containsAny(normalized,
                "\uAC1C\uC778\uC801\uC73C\uB85C", "\uB0B4 \uC0DD\uAC01", "\uC81C \uC0DD\uAC01",
                "personally", "from my perspective", "in my opinion", "i think", "opinion")) {
            categories.add("opinion");
        }
        if (containsAny(normalized,
                "\uBE44\uAD50", "\uCC28\uC774", "\uBC18\uBA74", "\uBC18\uB300\uB85C",
                "compare", "difference", "similar", "on the other hand", "whereas")) {
            categories.add("comparison");
        }
        if (containsAny(normalized,
                "\uC2B5\uAD00", "\uB8E8\uD2F4", "\uC77C\uC0C1", "\uB9E4\uC77C", "\uC790\uC8FC",
                "habit", "routine", "usually", "every day", "often")) {
            categories.add("habit");
        }
        if (containsAny(normalized,
                "\uACC4\uD68D", "\uBAA9\uD45C", "\uC55E\uC73C\uB85C", "\uC62C\uD574", "\uC7A5\uAE30\uC801",
                "future", "plan", "goal", "long run", "in the long run", "this year")) {
            categories.add("future");
        }
        if (containsAny(normalized,
                "\uAD6C\uCCB4", "\uC790\uC138\uD788", "\uC124\uBA85", "\uD55C \uBC88 \uB354", "\uB354 \uAD6C\uCCB4",
                "detail", "specific", "specifically", "more clearly", "explain")) {
            categories.add("detail");
        }
        if (containsAny(normalized,
                "\uAD6C\uC870", "\uD750\uB984", "\uC815\uB9AC", "\uBB50\uBD80\uD130", "\uC21C\uC11C",
                "structure", "flow", "organize", "order", "what to write first")) {
            categories.add("structure");
        }
        if (containsAny(normalized,
                "\uC7A5\uB2E8\uC810", "\uCC2C\uBC18", "\uD55C\uD3B8", "\uB2E4\uB978 \uD55C\uD3B8",
                "pros and cons", "advantage", "disadvantage", "on the one hand", "overall")) {
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

    private List<String> tokenizeOrdered(String value) {
        String normalized = normalizeText(value);
        if (normalized.isBlank()) {
            return List.of();
        }

        return Arrays.asList(normalized.split("\\s+"));
    }

    private Set<String> extractMeaningfulTokens(String value) {
        return tokenize(value).stream()
                .filter(token -> token.length() >= 3)
                .filter(token -> !PARAPHRASE_STOPWORDS.contains(token))
                .collect(LinkedHashSet::new, LinkedHashSet::add, LinkedHashSet::addAll);
    }

    private List<String> extractMeaningfulTokenSequence(String value) {
        return tokenizeOrdered(value).stream()
                .filter(token -> token.length() >= 3)
                .filter(token -> !PARAPHRASE_STOPWORDS.contains(token))
                .toList();
    }

    private TokenWindow findCompactOrderedTokenWindow(List<String> answerTokens, List<String> expressionTokens) {
        if (expressionTokens.size() < 3 || answerTokens.size() < expressionTokens.size()) {
            return null;
        }

        int maxSpan = expressionTokens.size() + 1;
        for (int start = 0; start < answerTokens.size(); start++) {
            if (!answerTokens.get(start).equals(expressionTokens.get(0))) {
                continue;
            }

            int expressionIndex = 1;
            int end = start;
            while (expressionIndex < expressionTokens.size() && end + 1 < answerTokens.size()) {
                end += 1;
                if (answerTokens.get(end).equals(expressionTokens.get(expressionIndex))) {
                    expressionIndex += 1;
                }

                if (end - start + 1 > maxSpan) {
                    break;
                }
            }

            if (expressionIndex == expressionTokens.size() && end - start + 1 <= maxSpan) {
                return new TokenWindow(start, end);
            }
        }

        return null;
    }

    private record CoachHelpBuildResult(
            String coachReply,
            List<CoachExpressionDto> expressions,
            CoachResponseSource responseSource,
            String responseModel
    ) {
    }

    private record SlotEnrichmentResult(
            CoachQueryAnalyzer.MeaningLookupSpec lookupSpec,
            boolean usedSlotTranslation
    ) {
    }

    private record ExpressionMatch(boolean matched, String matchType, String matchedText) {
    }

    private record TokenWindow(int start, int end) {
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
