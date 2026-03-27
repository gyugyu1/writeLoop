package com.writeloop.service;

import com.writeloop.dto.PromptDto;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
class CoachQueryAnalyzer {

    private static final Pattern NON_WORD_PATTERN = Pattern.compile("[^\\p{L}\\p{N}\\s']");
    private static final Pattern ENGLISH_PHRASE_PATTERN = Pattern.compile("[A-Za-z][A-Za-z0-9' -]{2,}");
    private static final Pattern QUOTED_PHRASE_PATTERN = Pattern.compile("\"([^\"]+)\"");
    private static final Pattern LEARN_FAMILY_PATTERN = Pattern.compile(
            "(?:\\uBC30\\uC6B0\\S*|\\uBC30\\uC6CC\\S*|\\uC775\\uD788\\S*|\\uC775\\uD600\\S*|\\uC5F0\\uC2B5\\S*|learn\\S*)"
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
            Map.entry("\uC2A4\uD398\uC778\uC5B4", "Spanish"),
            Map.entry("\uD504\uB791\uC2A4\uC5B4", "French"),
            Map.entry("\uB3C5\uC77C\uC5B4", "German"),
            Map.entry("\uC694\uB9AC", "cooking"),
            Map.entry("\uCD95\uAD6C", "soccer"),
            Map.entry("\uB18D\uAD6C", "basketball"),
            Map.entry("\uD14C\uB2C8\uC2A4", "tennis")
    );

    private static final Map<String, String> VISIT_TARGET_TRANSLATIONS = Map.ofEntries(
            Map.entry("\uBA54\uC774\uB4DC\uCE74\uD398", "maid cafe"),
            Map.entry("\uBC15\uBB3C\uAD00", "museum"),
            Map.entry("\uCD95\uC81C", "festival"),
            Map.entry("\uC804\uC2DC", "exhibition"),
            Map.entry("\uBB38\uD654", "culture"),
            Map.entry("\uC2A4\uD398\uC778", "Spain"),
            Map.entry("\uC77C\uBCF8", "Japan"),
            Map.entry("\uD55C\uAD6D", "Korea"),
            Map.entry("\uB3C4\uC2DC", "city"),
            Map.entry("\uC7A5\uC18C", "place"),
            Map.entry("\uACF3", "place")
    );

    private static final Map<String, String> GROWTH_TARGET_TRANSLATIONS = Map.ofEntries(
            Map.entry("근력", "strength"),
            Map.entry("체력", "stamina"),
            Map.entry("지구력", "endurance"),
            Map.entry("유연성", "flexibility"),
            Map.entry("자신감", "confidence"),
            Map.entry("집중력", "focus"),
            Map.entry("영향력", "influence"),
            Map.entry("면역력", "immunity"),
            Map.entry("근육", "muscle"),
            Map.entry("실력", "skills"),
            Map.entry("영어 실력", "English skills"),
            Map.entry("말하기 실력", "speaking skills"),
            Map.entry("발음", "pronunciation")
    );

    private static final Map<String, String> REDUCE_TARGET_TRANSLATIONS = Map.ofEntries(
            Map.entry("스트레스", "stress"),
            Map.entry("불안", "anxiety"),
            Map.entry("걱정", "worry"),
            Map.entry("지출", "spending"),
            Map.entry("소비", "spending"),
            Map.entry("스크린 타임", "screen time"),
            Map.entry("체지방", "body fat"),
            Map.entry("체중", "weight"),
            Map.entry("피로", "fatigue"),
            Map.entry("압박감", "pressure")
    );

    enum QueryMode {
        WRITING_SUPPORT,
        IDEA_SUPPORT,
        MEANING_LOOKUP
    }

    enum IntentCategory {
        REASON("reason"),
        EXAMPLE("example"),
        OPINION("opinion"),
        COMPARISON("comparison"),
        HABIT("habit"),
        FUTURE("future"),
        DETAIL("detail"),
        STRUCTURE("structure"),
        BALANCE("balance");

        private final String key;

        IntentCategory(String key) {
            this.key = key;
        }

        String key() {
            return key;
        }
    }

    enum ActionFamily {
        UNKNOWN,
        SOCIALIZE,
        LEARN,
        SLEEP,
        STUDY,
        REST,
        GROWTH_CAPABILITY,
        REDUCE_MANAGE,
        STATE_CHANGE,
        VISIT_INTEREST
    }

    enum MeaningSlot {
        TARGET,
        TOPIC,
        QUALIFIER
    }

    record LookupDetection(QueryMode mode, String cue) {
    }

    record MeaningFrame(
            ActionFamily family,
            String surfaceMeaning,
            EnumMap<MeaningSlot, String> sourceSlots
    ) {
    }

    record TranslationResult(String sourceText, String englishText, boolean resolved) {
    }

    record MeaningLookupSpec(
            LookupDetection detection,
            MeaningFrame frame,
            EnumMap<MeaningSlot, TranslationResult> translations
    ) {
    }

    record CoachQueryAnalysis(
            String rawQuestion,
            String normalizedQuestion,
            EnumSet<IntentCategory> intents,
            LookupDetection detection,
            Optional<MeaningLookupSpec> lookup
    ) {
        Set<String> intentKeys() {
            return intents.stream()
                    .map(IntentCategory::key)
                    .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        }

        QueryMode queryMode() {
            return detection.mode();
        }
    }

    CoachQueryAnalysis analyze(PromptDto prompt, String userQuestion) {
        String rawQuestion = userQuestion == null ? "" : userQuestion.trim();
        String normalizedQuestion = normalizeText(rawQuestion);
        EnumSet<IntentCategory> userIntents = inferIntentCategories(rawQuestion);
        EnumSet<IntentCategory> intents = userIntents.isEmpty()
                ? inferIntentCategories(prompt.questionEn() + " " + prompt.questionKo() + " " + prompt.tip())
                : userIntents;
        String promptContext = normalizeText(
                prompt.topic() + " " + prompt.questionEn() + " " + prompt.questionKo() + " " + prompt.tip()
        );
        LookupDetection detection = detectLookup(rawQuestion, normalizedQuestion, promptContext, userIntents);
        Optional<MeaningLookupSpec> lookup = detection.mode() == QueryMode.MEANING_LOOKUP
                ? Optional.of(buildLookupSpec(promptContext, rawQuestion, normalizedQuestion, detection))
                : Optional.empty();

        return new CoachQueryAnalysis(rawQuestion, normalizedQuestion, intents, detection, lookup);
    }

    EnumSet<IntentCategory> resolveIntentCategories(PromptDto prompt, String userQuestion) {
        EnumSet<IntentCategory> userIntents = inferIntentCategories(userQuestion);
        if (!userIntents.isEmpty()) {
            return userIntents;
        }
        return inferIntentCategories(prompt.questionEn() + " " + prompt.questionKo() + " " + prompt.tip());
    }

    EnumSet<IntentCategory> inferIntentCategories(String text) {
        String normalized = normalizeText(text);
        EnumSet<IntentCategory> categories = EnumSet.noneOf(IntentCategory.class);

        if (containsAny(normalized,
                "\uC65C", "\uC774\uC720", "\uB54C\uBB38", "\uADF8\uB798\uC11C",
                "why", "reason", "because", "one reason is that")) {
            categories.add(IntentCategory.REASON);
        }
        if (containsAny(normalized,
                "\uC608\uC2DC", "\uC608\uB97C \uB4E4\uC5B4", "\uC0AC\uB840", "\uC0D8\uD50C",
                "example", "for example", "for instance", "case", "sample")) {
            categories.add(IntentCategory.EXAMPLE);
        }
        if (containsAny(normalized,
                "\uAC1C\uC778\uC801\uC73C\uB85C", "\uB0B4 \uC0DD\uAC01", "\uB0B4\uC0DD\uAC01", "\uC81C \uC0DD\uAC01", "\uC81C\uC0DD\uAC01", "\uC758\uACAC", "\uC785\uC7A5",
                "personally", "from my perspective", "in my opinion", "i think", "opinion")) {
            categories.add(IntentCategory.OPINION);
        }
        if (containsAny(normalized,
                "\uBE44\uAD50", "\uCC28\uC774", "\uBC18\uBA74", "\uBC18\uB300\uB85C", "\uBC18\uB300 \uC758\uACAC", "\uB2E4\uB978 \uD55C\uD3B8", "\uC7A5\uB2E8\uC810",
                "compare", "difference", "similar", "on the other hand", "whereas")) {
            categories.add(IntentCategory.COMPARISON);
        }
        if (containsAny(normalized,
                "\uC2B5\uAD00", "\uB8E8\uD2F4", "\uC77C\uC0C1", "\uB9E4\uC77C", "\uC790\uC8FC",
                "habit", "routine", "usually", "every day", "often")) {
            categories.add(IntentCategory.HABIT);
        }
        if (containsAny(normalized,
                "\uACC4\uD68D", "\uBAA9\uD45C", "\uC55E\uC73C\uB85C", "\uC62C\uD574", "\uC7A5\uAE30\uC801",
                "future", "plan", "goal", "long run", "in the long run", "this year")) {
            categories.add(IntentCategory.FUTURE);
        }
        if (containsAny(normalized,
                "\uAD6C\uCCB4", "\uC790\uC138\uD788", "\uC124\uBA85", "\uD55C \uBC88 \uB354", "\uB354 \uAD6C\uCCB4",
                "detail", "specific", "specifically", "more clearly", "explain")) {
            categories.add(IntentCategory.DETAIL);
        }
        if (containsAny(normalized,
                "\uAD6C\uC870", "\uD750\uB984", "\uC815\uB9AC", "\uBB50\uBD80\uD130", "\uC21C\uC11C",
                "structure", "flow", "organize", "order", "guide", "what to write first")) {
            categories.add(IntentCategory.STRUCTURE);
        }
        if (containsAny(normalized,
                "\uC7A5\uB2E8\uC810", "\uCC2C\uBC18", "\uD55C\uD3B8", "\uB2E4\uB978 \uD55C\uD3B8",
                "pros and cons", "advantage", "disadvantage", "on the one hand", "overall")) {
            categories.add(IntentCategory.BALANCE);
        }

        return categories;
    }

    private LookupDetection detectLookup(
            String rawQuestion,
            String normalizedQuestion,
            String promptContext,
            EnumSet<IntentCategory> intents
    ) {
        String compactQuestion = compactText(rawQuestion);
        if (normalizedQuestion.isBlank()) {
            return new LookupDetection(QueryMode.WRITING_SUPPORT, "empty");
        }

        boolean structureCue = hasStructureCue(normalizedQuestion, compactQuestion);
        boolean supportMeta = hasSupportMetaCue(normalizedQuestion, compactQuestion);
        boolean ideaSupportCue = hasIdeaSupportCue(normalizedQuestion, compactQuestion);
        boolean explicitLookup = hasLookupSayCue(normalizedQuestion, compactQuestion);
        boolean meaningKeyword = hasMeaningKeywordCue(normalizedQuestion, compactQuestion);
        boolean expressionLookupCue = hasMeaningExpressionCue(normalizedQuestion, compactQuestion, intents);
        boolean implicitLookup = looksLikeImplicitMeaningLookup(normalizedQuestion, compactQuestion, promptContext, intents);
        boolean hybridCompanionCue = hasHybridCompanionCue(normalizedQuestion, compactQuestion);
        boolean meaningLikeCue = explicitLookup || meaningKeyword || expressionLookupCue || implicitLookup;
        boolean hybridRequest = ((supportMeta || structureCue) && meaningLikeCue)
                || (hybridCompanionCue && hasSupportStyleIntent(intents) && meaningLikeCue);

        if (hybridRequest) {
            return new LookupDetection(QueryMode.MEANING_LOOKUP, "hybrid_meaning_support");
        }

        if (structureCue) {
            return new LookupDetection(QueryMode.WRITING_SUPPORT, "structure_override");
        }

        if (ideaSupportCue) {
            return new LookupDetection(QueryMode.IDEA_SUPPORT, "idea_support");
        }

        if (explicitLookup) {
            return new LookupDetection(QueryMode.MEANING_LOOKUP, "say_in_english");
        }

        if (meaningKeyword) {
            return new LookupDetection(QueryMode.MEANING_LOOKUP, "meaning_keyword");
        }

        if (supportMeta) {
            return new LookupDetection(QueryMode.WRITING_SUPPORT, "support_meta");
        }

        if (expressionLookupCue) {
            return new LookupDetection(QueryMode.MEANING_LOOKUP, "expression_lookup");
        }

        if (implicitLookup) {
            return new LookupDetection(QueryMode.MEANING_LOOKUP, "implicit_meaning_statement");
        }

        if (containsAny(normalizedQuestion, "\uD45C\uD604", "\uB2E8\uC5B4", "expression", "phrase", "word")
                && !hasSupportStyleIntent(intents)
                && containsAny(
                        compactQuestion,
                        "\uB77C\uB294\uD45C\uD604", "\uB2E4\uB294\uD45C\uD604", "\uB77C\uACE0\uD45C\uD604", "\uB2E4\uACE0\uD45C\uD604",
                        "\uC774\uBB38\uC7A5", "\uC774\uB9D0", "\uC601\uC5B4\uD45C\uD604",
                        "\uD45C\uD604\uC880", "\uD45C\uD604\uC54C\uB824", "\uD45C\uD604\uCD94\uCC9C", "\uD45C\uD604\uC8FC\uB77C"
                )) {
            return new LookupDetection(QueryMode.MEANING_LOOKUP, "expression_keyword");
        }

        if (intents.isEmpty()
                && normalizedQuestion.split("\\s+").length <= 2
                && normalizedQuestion.matches(".*[\\uAC00-\\uD7A3].*")) {
            return new LookupDetection(QueryMode.MEANING_LOOKUP, "short_hangul");
        }

        return new LookupDetection(QueryMode.WRITING_SUPPORT, "default");
    }

    private MeaningLookupSpec buildLookupSpec(
            String promptContext,
            String rawQuestion,
            String normalizedQuestion,
            LookupDetection detection
    ) {
        String surfaceMeaning = extractMeaningLookupTarget(rawQuestion);
        MeaningFrame frame = classifyMeaningFrame(surfaceMeaning, normalizedQuestion, promptContext);
        return new MeaningLookupSpec(detection, frame, translateFrame(frame));
    }

    private String extractMeaningLookupTarget(String rawQuestion) {
        String normalized = normalizeText(rawQuestion);
        if (normalized.isBlank()) {
            return "";
        }

        Matcher quotedMatcher = QUOTED_PHRASE_PATTERN.matcher(rawQuestion == null ? "" : rawQuestion);
        if (quotedMatcher.find()) {
            return quotedMatcher.group(1).trim();
        }

        String extracted = normalized
                .replace("\uC601\uC5B4\uB85C", " ")
                .replace("\uD45C\uD604", " ")
                .replace("\uB2E8\uC5B4", " ")
                .replace("\uBB38\uC7A5", " ")
                .replace("\uB9D0\uD558\uACE0 \uC2F6\uC5B4", " ")
                .replace("\uB9D0\uD558\uACE0 \uC2F6\uB2E4", " ")
                .replace("\uB9D0\uD558\uACE0 \uC2F6", " ")
                .replace("\uC5B4\uB5BB\uAC8C \uB9D0", " ")
                .replace("\uBB50\uB77C\uACE0", " ")
                .replace("\uB77C\uACE0 \uB9D0", " ")
                .replace("\uB77C\uACE0 \uD558\uACE0", " ")
                .replace("\uB73B\uC774 \uBB50\uC57C", " ")
                .replace("\uB73B\uC774 \uBB54\uC9C0", " ")
                .replace("\uBB34\uC2A8 \uB73B", " ")
                .replace("\uB73B", " ")
                .replace("\uC758\uBBF8", " ")
                .replace("how do i say", " ")
                .replace("how should i say", " ")
                .replace("want to say", " ")
                .replace("\uC54C\uB824\uC918", " ")
                .replace("\uC54C\uB824\uC8FC", " ")
                .replace("\uCD94\uCC9C", " ")
                .replace("\uC790\uC5F0\uC2A4\uB7FD", " ")
                .replace("\uBB50\uAC00", " ")
                .replace("\uC5B4\uB5A4", " ")
                .replace("expression", " ")
                .replace("phrase", " ")
                .replace("word", " ")
                .replace("natural", " ")
                .replace("recommend", " ")
                .replace("meaning", " ")
                .replace("means", " ")
                .replace("what is the meaning of", " ")
                .replace("what does", " ")
                .replaceAll("\\bmean\\b", " ")
                .replaceAll("\\s+", " ")
                .trim();

        return extracted.isBlank() ? normalized : extracted;
    }

    private MeaningFrame classifyMeaningFrame(
            String surfaceMeaning,
            String normalizedQuestion,
            String promptContext
    ) {
        String normalizedSurface = normalizeText(surfaceMeaning);
        String familyContext = (normalizedSurface + " " + normalizedQuestion).trim();
        EnumMap<MeaningSlot, String> slots = new EnumMap<>(MeaningSlot.class);
        slots.put(MeaningSlot.TARGET, surfaceMeaning);

        if (looksLikeLearningMeaning(familyContext)) {
            String learningTarget = stripLearningScaffold(normalizedSurface.isBlank() ? familyContext : normalizedSurface);
            slots.put(MeaningSlot.TARGET, learningTarget.isBlank() ? surfaceMeaning : learningTarget);
            return new MeaningFrame(ActionFamily.LEARN, surfaceMeaning, slots);
        }

        if (looksLikeGrowthMeaning(familyContext)) {
            String growthTarget = stripGrowthScaffold(normalizedSurface.isBlank() ? familyContext : normalizedSurface);
            slots.put(MeaningSlot.TARGET, growthTarget.isBlank() ? surfaceMeaning : growthTarget);
            return new MeaningFrame(ActionFamily.GROWTH_CAPABILITY, surfaceMeaning, slots);
        }

        if (looksLikeReduceManageMeaning(familyContext)) {
            String manageTarget = stripReduceManageScaffold(normalizedSurface.isBlank() ? familyContext : normalizedSurface);
            slots.put(MeaningSlot.TARGET, manageTarget.isBlank() ? surfaceMeaning : manageTarget);
            return new MeaningFrame(ActionFamily.REDUCE_MANAGE, surfaceMeaning, slots);
        }

        if (looksLikeSleepMeaning(familyContext)) {
            return new MeaningFrame(ActionFamily.SLEEP, surfaceMeaning, slots);
        }
        if (looksLikeStudyMeaning(familyContext)) {
            return new MeaningFrame(ActionFamily.STUDY, surfaceMeaning, slots);
        }
        if (looksLikeRestMeaning(familyContext)) {
            return new MeaningFrame(ActionFamily.REST, surfaceMeaning, slots);
        }

        if (looksLikeStateChangeMeaning(familyContext, promptContext)) {
            slots.put(MeaningSlot.TOPIC, extractRelationshipTopic(familyContext));
            slots.put(MeaningSlot.QUALIFIER, extractStateQualifier(familyContext));
            return new MeaningFrame(ActionFamily.STATE_CHANGE, surfaceMeaning, slots);
        }

        if (looksLikeSocializeMeaning(familyContext) || looksLikeExpandedSocializeMeaning(familyContext)) {
            String socializeTarget = stripSocializeScaffold(normalizedSurface.isBlank() ? familyContext : normalizedSurface);
            slots.put(MeaningSlot.TARGET, socializeTarget.isBlank() ? surfaceMeaning : socializeTarget);
            return new MeaningFrame(ActionFamily.SOCIALIZE, surfaceMeaning, slots);
        }

        if (looksLikeVisitInterestMeaning(familyContext)) {
            String visitTarget = stripVisitInterestScaffold(normalizedSurface.isBlank() ? familyContext : normalizedSurface);
            slots.put(MeaningSlot.TARGET, visitTarget.isBlank() ? surfaceMeaning : visitTarget);
            return new MeaningFrame(ActionFamily.VISIT_INTEREST, surfaceMeaning, slots);
        }

        return new MeaningFrame(ActionFamily.UNKNOWN, surfaceMeaning, slots);
    }

    private EnumMap<MeaningSlot, TranslationResult> translateFrame(MeaningFrame frame) {
        EnumMap<MeaningSlot, TranslationResult> translations = new EnumMap<>(MeaningSlot.class);

        switch (frame.family()) {
            case LEARN -> {
                String sourceTarget = frame.sourceSlots().getOrDefault(MeaningSlot.TARGET, "");
                String translatedTarget = translateLearnTarget(sourceTarget);
                translations.put(MeaningSlot.TARGET, new TranslationResult(
                        sourceTarget,
                        translatedTarget,
                        !translatedTarget.isBlank()
                ));
            }
            case GROWTH_CAPABILITY -> {
                String sourceTarget = frame.sourceSlots().getOrDefault(MeaningSlot.TARGET, "");
                String translatedTarget = translateGrowthTarget(sourceTarget);
                translations.put(MeaningSlot.TARGET, new TranslationResult(
                        sourceTarget,
                        translatedTarget,
                        !translatedTarget.isBlank()
                ));
            }
            case REDUCE_MANAGE -> {
                String sourceTarget = frame.sourceSlots().getOrDefault(MeaningSlot.TARGET, "");
                String translatedTarget = translateReduceTarget(sourceTarget);
                translations.put(MeaningSlot.TARGET, new TranslationResult(
                        sourceTarget,
                        translatedTarget,
                        !translatedTarget.isBlank()
                ));
            }
            case STATE_CHANGE -> {
                String sourceTopic = frame.sourceSlots().getOrDefault(MeaningSlot.TOPIC, "");
                String sourceQualifier = frame.sourceSlots().getOrDefault(MeaningSlot.QUALIFIER, "");
                String translatedTopic = translateRelationshipTopic(sourceTopic);
                String translatedQualifier = translateQualifier(sourceQualifier);
                translations.put(MeaningSlot.TOPIC, new TranslationResult(sourceTopic, translatedTopic, !translatedTopic.isBlank()));
                translations.put(MeaningSlot.QUALIFIER, new TranslationResult(sourceQualifier, translatedQualifier, !translatedQualifier.isBlank()));
            }
            case VISIT_INTEREST -> {
                String sourceTarget = frame.sourceSlots().getOrDefault(MeaningSlot.TARGET, "");
                String translatedTarget = translateVisitInterestTarget(sourceTarget);
                translations.put(MeaningSlot.TARGET, new TranslationResult(
                        sourceTarget,
                        translatedTarget,
                        !translatedTarget.isBlank()
                ));
            }
            default -> {
            }
        }

        return translations;
    }

    private boolean looksLikeSocializeMeaning(String normalizedText) {
        boolean hasPerson = containsAny(
                normalizedText,
                "\uCE5C\uAD6C", "\uCE5C\uAD6C\uB4E4", "\uC0AC\uB78C", "\uC0AC\uB78C\uB4E4", "\uB3D9\uB8CC", "\uC9C0\uC778",
                "friend", "friends", "people", "person", "coworker", "coworkers", "classmate", "classmates"
        );
        boolean hasSocialAction = containsAny(
                normalizedText,
                "\uB9CC\uB098", "\uB9CC\uB0A0", "\uB9CC\uB09C", "\uB9CC\uB0A8", "\uC5B4\uC6B8", "\uC5B4\uC6B8\uB9B0",
                "\uB180", "\uB17C", "\uB17C\uB2E4", "\uB17C\uB2E4\uACE0", "\uBCF4\uB2E4", "\uBCF4\uB0B4", "\uBCF4\uB0B8",
                "\uC2DC\uAC04", "\uC2DC\uAC04\uC744 \uBCF4\uB0B4", "\uC2DC\uAC04 \uBCF4\uB0B4", "\uC5F0\uB77D",
                "\uC5F0\uB77D\uD55C", "\uB300\uD654", "\uB300\uD654\uD55C", "\uC5F0\uACB0", "\uC5F0\uACB0\uB41C", "\uCE5C\uD574",
                "\uCE5C\uD574\uC9C0",
                "meet", "meeting", "see", "hang out", "catch up", "get together",
                "spend time", "stay in touch", "keep in touch", "talk with", "talk to", "connect with"
        );
        return hasPerson && hasSocialAction;
    }

    private boolean looksLikeExpandedSocializeMeaning(String normalizedText) {
        boolean hasPerson = containsAny(
                normalizedText,
                "친구", "친구들", "사람", "사람들", "동료", "지인", "상대", "누군가",
                "friend", "friends", "people", "person", "coworker", "coworkers", "classmate", "classmates"
        );
        boolean hasClosenessAction = containsAny(
                normalizedText,
                "가까워", "가까워지", "친밀", "친해지", "말 걸", "사귀",
                "get closer", "become closer", "get close"
        );
        return hasPerson && hasClosenessAction;
    }

    private boolean looksLikeLearningMeaning(String normalizedText) {
        return LEARN_FAMILY_PATTERN.matcher(normalizedText).find()
                || containsAny(
                normalizedText,
                "\uBC30\uC6B0\uACE0 \uC2F6", "\uBC30\uC6B0\uACE0", "\uBC30\uC6B0\uB2E4", "\uBC30\uC6B0\uB824",
                "\uBC30\uC6CC\uC57C", "\uBC30\uC6B0\uB824\uACE0", "\uBC30\uC6B0\uAC8C", "\uC775\uD788",
                "want to learn", "start learning", "learning", "learn"
        );
    }

    private boolean looksLikeGrowthMeaning(String normalizedText) {
        if (containsAny(normalizedText, "좋게 만들", "더 좋게", "좋아지게")
                && containsAny(normalizedText, "발음", "pronunciation")) {
            return true;
        }
        boolean hasGrowthVerb = containsAny(
                normalizedText,
                "키우", "늘리", "높이", "기르", "강화", "향상", "개선", "발전", "발달", "boost", "build up", "increase", "improve", "develop"
        );
        boolean hasGrowthTarget = containsAny(
                normalizedText,
                "근력", "체력", "지구력", "유연성", "자신감", "집중력", "영향력", "면역력", "근육", "실력", "발음",
                "strength", "stamina", "endurance", "flexibility", "confidence", "focus", "influence", "immunity", "muscle", "skills", "skill", "pronunciation"
        );
        return hasGrowthVerb && (hasGrowthTarget || normalizedText.contains("싶"));
    }

    private boolean looksLikeReduceManageMeaning(String normalizedText) {
        boolean hasReduceVerb = containsAny(
                normalizedText,
                "줄이", "낮추", "완화", "관리", "조절", "통제", "억제", "cut down", "reduce", "lower", "manage", "control"
        );
        boolean hasReduceTarget = containsAny(
                normalizedText,
                "스트레스", "불안", "걱정", "지출", "소비", "스크린 타임", "체지방", "체중", "피로", "압박감",
                "stress", "anxiety", "worry", "spending", "screen time", "body fat", "weight", "fatigue", "pressure"
        );
        return hasReduceVerb && (hasReduceTarget || normalizedText.contains("싶"));
    }

    private boolean looksLikeSleepMeaning(String normalizedText) {
        return containsAny(
                normalizedText,
                "\uC7A0", "\uC218\uBA74", "\uC790\uACE0", "\uC790\uB2E4", "\uC790\uB7EC", "\uC7A0\uB4E4", "\uC794\uB2E4", "\uC790\uB294", "\uCE68\uB300",
                "sleep", "asleep", "bed", "go to bed"
        );
    }

    private boolean looksLikeStudyMeaning(String normalizedText) {
        return containsAny(
                normalizedText,
                "\uACF5\uBD80", "\uC5F0\uC2B5", "\uBC30\uC6B0", "\uC775\uD788",
                "study", "learning", "learn", "practice"
        );
    }

    private boolean looksLikeRestMeaning(String normalizedText) {
        return containsAny(
                normalizedText,
                "\uC26C\uB2E4", "\uC26C\uACE0", "\uC277", "\uD734\uC2DD", "\uD55C\uC228 \uB3CC", "\uB9C8\uC74C \uB193",
                "rest", "relax", "break", "unwind"
        );
    }

    private boolean looksLikeOnlineRelationshipStateChange(String normalizedText) {
        boolean hasOnline = containsAny(normalizedText, "\uC778\uD130\uB137", "\uC628\uB77C\uC778", "internet", "online");
        boolean hasRelationship = containsAny(
                normalizedText,
                "\uB9CC\uB0A8", "\uB9CC\uB098", "\uAD00\uACC4", "\uC5F0\uACB0", "\uC5F0\uB77D", "\uB300\uD654",
                "\uCE5C\uD574", "\uB9FA", "\uB9CC\uB4E4", "meet", "meeting", "relationship", "relationships",
                "connect", "contact", "talk"
        );
        boolean hasQualifier = containsAny(
                normalizedText,
                "\uC790\uC5F0\uC2A4\uB7FD", "\uC790\uC5F0\uC2A4\uB7EC", "\uC790\uC5F0\uC2A4\uB7EC\uC6CC", "\uC775\uC219", "\uC775\uC219\uD574", "\uD3B8\uD574",
                "\uD3B8\uC548", "\uD754\uD574", "\uB2F9\uC5F0", "\uC26C\uC6CC", "\uC26C\uC6CC\uC84C", "\uB354 \uC26C\uC6CC",
                "\uB35C \uC5B4\uC0C9", "\uC5B4\uC0C9\uD558\uC9C0 \uC54A", "\uBD80\uB2F4\uC5C6", "\uC775\uC219\uD574\uC84C",
                "\uD3B8\uD574\uC84C", "\uC790\uC5F0\uC2A4\uB7EC\uC6CC\uC84C",
                "natural", "normal", "comfortable", "common", "easier"
        );
        return hasOnline && hasRelationship && hasQualifier;
    }

    private boolean looksLikeStateChangeMeaning(String normalizedText, String promptContext) {
        return looksLikeOnlineRelationshipStateChange(normalizedText)
                || looksLikeExpandedOnlineRelationshipStateChange(normalizedText)
                || looksLikePromptScopedOnlineRelationshipStateChange(normalizedText, promptContext);
    }

    private boolean looksLikeExpandedOnlineRelationshipStateChange(String normalizedText) {
        boolean hasOnline = containsAny(normalizedText, "인터넷", "온라인", "internet", "online");
        boolean hasRelationship = containsAny(
                normalizedText,
                "만남", "만나", "관계", "연결", "연락", "대화",
                "친해", "가까워", "말 걸", "말 거", "맺", "만들",
                "meet", "meeting", "relationship", "relationships", "connect", "contact", "talk"
        );
        boolean hasQualifier = containsAny(
                normalizedText,
                "자연스럽", "익숙", "편해", "편하다", "편안", "쉬워",
                "덜 어색", "어색하지 않", "어색해", "부담없",
                "natural", "normal", "comfortable", "common", "easier", "less awkward", "awkward"
        );
        return hasOnline && hasRelationship && hasQualifier;
    }

    private boolean looksLikePromptScopedOnlineRelationshipStateChange(String normalizedQuestion, String promptContext) {
        boolean promptSignalsRelationshipChange = containsAny(
                promptContext,
                "technology", "online", "internet", "relationship", "relationships", "stay in touch",
                "technology changed", "온라인", "인터넷", "관계", "연락", "대화", "만남"
        );
        if (!promptSignalsRelationshipChange) {
            return false;
        }

        boolean hasRelationship = containsAny(
                normalizedQuestion,
                "사람", "사람들", "친구", "친구들", "연락", "대화", "만남", "만나",
                "친해", "친해지", "가까워", "가까워지", "말 걸", "말 거", "멀리 사는",
                "relationship", "people", "friends", "contact", "talk", "meet", "closer"
        );
        boolean hasQualifier = containsAny(
                normalizedQuestion,
                "자연스럽", "익숙", "편해", "편하다", "편안", "쉬워",
                "덜 어색", "어색하지 않", "어색해", "부담없",
                "natural", "comfortable", "normal", "easier", "less awkward", "awkward"
        );
        return hasRelationship && hasQualifier;
    }

    private boolean looksLikeVisitInterestMeaning(String normalizedText) {
        boolean hasVisitOrInterestAction = containsAny(
                normalizedText,
                "\uAC00\uBCF4", "\uAC00\uACE0 \uC2F6", "\uBC29\uBB38", "\uACBD\uD5D8", "\uCCB4\uD5D8", "\uB458\uB7EC\uBCF4",
                "\uD0D0\uD5D8", "\uAD81\uAE08", "\uAD00\uC2EC", "\uD765\uBBF8",
                "visit", "go to", "experience", "explore", "curious", "interested"
        );
        boolean hasTargetCue = containsAny(
                normalizedText,
                "\uCE74\uD398", "\uBC15\uBB3C\uAD00", "\uCD95\uC81C", "\uC804\uC2DC", "\uBB38\uD654", "\uB3C4\uC2DC",
                "\uC7A5\uC18C", "\uACF3", "\uAD6D\uAC00", "\uC2A4\uD398\uC778", "\uC77C\uBCF8", "\uD55C\uAD6D",
                "cafe", "museum", "festival", "exhibition", "culture", "city", "place"
        );
        return hasVisitOrInterestAction && hasTargetCue;
    }

    private String stripLearningScaffold(String normalizedText) {
        return stripTrailingParticles(
                normalizedText
                        .replaceAll("(?:\\uBC30\\uC6B0\\uACE0\\s*\\uC2F6(?:\\uC5B4|\\uB2E4)?(?:\\uACE0)?|\\uBC30\\uC6CC\\uC57C\\s*\\uD55C(?:\\uB2E4|\\uB2E4\\uACE0)?|\\uBC30\\uC6B0(?:\\uACE0|\\uB824\\uACE0|\\uB824|\\uB294|\\uB2E4|\\uAC8C)|\\uBC30\\uC6CC(?:\\uC57C|\\uC11C|\\uC9C0|\\uACE0)|\\uC775\\uD788(?:\\uACE0|\\uB2E4)|\\uC775\\uD600(?:\\uC57C|\\uC11C|\\uC9C0)|\\uC5F0\\uC2B5\\uD558(?:\\uACE0|\\uB2E4))", " ")
                        .replaceAll("\\b(?:want\\s+to\\s+learn|start\\s+learning|learn(?:ing)?)\\b", " ")
                        .replaceAll("(?:\\uB77C\\uACE0|\\uACE0|\\uC774\\uB77C\\uACE0)$", " ")
                        .replaceAll("\\s+", " ")
                        .trim()
        );
    }

    private String stripGrowthScaffold(String normalizedText) {
        return stripTrailingParticles(
                normalizedText
                        .replaceAll("(?:더\\s*)?(?:키우(?:고\\s*싶(?:어|다)?|려고|고|는|다)?|늘리(?:고\\s*싶(?:어|다)?|려고|고|는|다)?|높이(?:고\\s*싶(?:어|다)?|려고|고|는|다)?|기르(?:고\\s*싶(?:어|다)?|려고|고|는|다)?|강화(?:하(?:고\\s*싶(?:어|다)?|려고|고|는|다)?)|향상(?:시키(?:고\\s*싶(?:어|다)?|려고|고|는|다)?)|개선(?:하(?:고\\s*싶(?:어|다)?|려고|고|는|다)?)|발전(?:시키(?:고\\s*싶(?:어|다)?|려고|고|는|다)?)|발달(?:시키(?:고\\s*싶(?:어|다)?|려고|고|는|다)?)|build up|boost|increase|improve|develop)", " ")
                        .replaceAll("(?:\\uB77C\\uACE0|\\uACE0|\\uC774\\uB77C\\uACE0)$", " ")
                        .replaceAll("\\s+", " ")
                        .trim()
        );
    }

    private String stripReduceManageScaffold(String normalizedText) {
        return stripTrailingParticles(
                normalizedText
                        .replaceAll("(?:더\\s*)?(?:줄이(?:고\\s*싶(?:어|다)?|려고|고|는|다)?|낮추(?:고\\s*싶(?:어|다)?|려고|고|는|다)?|완화(?:하(?:고\\s*싶(?:어|다)?|려고|고|는|다)?)|관리(?:하(?:고\\s*싶(?:어|다)?|려고|고|는|다)?)|조절(?:하(?:고\\s*싶(?:어|다)?|려고|고|는|다)?)|통제(?:하(?:고\\s*싶(?:어|다)?|려고|고|는|다)?)|억제(?:하(?:고\\s*싶(?:어|다)?|려고|고|는|다)?)|cut down on|cut down|reduce|lower|manage|control)", " ")
                        .replaceAll("(?:\\uB77C\\uACE0|\\uACE0|\\uC774\\uB77C\\uACE0)$", " ")
                        .replaceAll("\\s+", " ")
                        .trim()
        );
    }

    private String stripSocializeScaffold(String normalizedText) {
        return stripTrailingParticles(
                normalizedText
                        .replaceAll("(?:\\uB9CC\\uB098(?:\\uACE0|\\uB294|\\uB2E4)?|\\uB9CC\\uB09C(?:\\uB2E4|\\uB2E4\\uACE0)?|\\uC5B4\\uC6B8(?:\\uB9AC|\\uACE0|\\uB9B0\\uB2E4)?|\\uB180(?:\\uACE0)?|\\uB17C(?:\\uB2E4|\\uB2E4\\uACE0)?|\\uBCF4\\uB0B4(?:\\uACE0|\\uB2E4)?|\\uC2DC\\uAC04\\uC744?\\s*\\uBCF4\\uB0B4(?:\\uACE0|\\uB2E4)?|\\uC5F0\\uB77D(?:\\uD558|\\uC744|\\uD55C\\uB2E4|\\uD55C\\uB2E4\\uACE0)?|\\uB300\\uD654(?:\\uD558|\\uB97C|\\uD55C\\uB2E4|\\uD55C\\uB2E4\\uACE0)?|\\uC5F0\\uACB0(?:\\uB418|\\uD558)?|\\uCE5C\\uD574\\uC9C0(?:\\uB2E4|\\uACE0)?)", " ")
                        .replaceAll("(?:\\uB77C\\uACE0|\\uACE0|\\uC774\\uB77C\\uACE0)$", " ")
                        .replaceAll("\\s+", " ")
                        .trim()
        );
    }

    private String stripVisitInterestScaffold(String normalizedText) {
        return stripTrailingParticles(
                normalizedText
                        .replaceAll("(?:\\uAC00\\uBCF4(?:\\uACE0\\s*\\uC2F6|\\uACE0)?|\\uAC00\\uACE0\\s*\\uC2F6|\\uBC29\\uBB38(?:\\uD558\\uACE0\\s*\\uC2F6|\\uD558\\uACE0|\\uD558\\uB2E4)?|\\uACBD\\uD5D8(?:\\uD558\\uACE0\\s*\\uC2F6|\\uD558\\uACE0|\\uD558\\uB2E4)?|\\uCCB4\\uD5D8(?:\\uD558\\uACE0\\s*\\uC2F6|\\uD558\\uACE0|\\uD558\\uB2E4)?|\\uB458\\uB7EC\\uBCF4(?:\\uACE0\\s*\\uC2F6|\\uACE0)?|\\uD0D0\\uD5D8(?:\\uD558\\uACE0\\s*\\uC2F6|\\uD558\\uACE0|\\uD558\\uB2E4)?|\\uAD81\\uAE08\\uD558(?:\\uB2E4|\\uACE0)?|\\uAD00\\uC2EC\\s*\\uC788(?:\\uB2E4|\\uACE0)?|\\uD765\\uBBF8\\uB86D(?:\\uB2E4|\\uACE0)?)", " ")
                        .replaceAll("(?:\\uB77C\\uACE0|\\uACE0|\\uC774\\uB77C\\uACE0)$", " ")
                        .replaceAll("\\s+", " ")
                        .trim()
        );
    }

    private String stripTrailingParticles(String value) {
        return value
                .replaceAll("(\\uC744|\\uB97C|\\uC740|\\uB294|\\uC774|\\uAC00|\\uACFC|\\uC640)$", "")
                .trim();
    }

    private String translateLearnTarget(String sourceTarget) {
        for (Map.Entry<String, String> entry : LEARN_TARGET_TRANSLATIONS.entrySet()) {
            if (sourceTarget.contains(entry.getKey())) {
                return entry.getValue();
            }
        }

        Matcher englishMatcher = ENGLISH_PHRASE_PATTERN.matcher(sourceTarget);
        if (englishMatcher.find()) {
            return englishMatcher.group().trim();
        }

        return "";
    }

    private String translateGrowthTarget(String sourceTarget) {
        for (Map.Entry<String, String> entry : GROWTH_TARGET_TRANSLATIONS.entrySet()) {
            if (sourceTarget.contains(entry.getKey())) {
                return entry.getValue();
            }
        }

        Matcher englishMatcher = ENGLISH_PHRASE_PATTERN.matcher(sourceTarget);
        if (englishMatcher.find()) {
            return englishMatcher.group().trim();
        }

        return "";
    }

    private String translateReduceTarget(String sourceTarget) {
        for (Map.Entry<String, String> entry : REDUCE_TARGET_TRANSLATIONS.entrySet()) {
            if (sourceTarget.contains(entry.getKey())) {
                return entry.getValue();
            }
        }

        Matcher englishMatcher = ENGLISH_PHRASE_PATTERN.matcher(sourceTarget);
        if (englishMatcher.find()) {
            return englishMatcher.group().trim();
        }

        return "";
    }

    private String translateVisitInterestTarget(String sourceTarget) {
        for (Map.Entry<String, String> entry : VISIT_TARGET_TRANSLATIONS.entrySet()) {
            if (sourceTarget.contains(entry.getKey())) {
                return entry.getValue();
            }
        }

        Matcher englishMatcher = ENGLISH_PHRASE_PATTERN.matcher(sourceTarget);
        if (englishMatcher.find()) {
            return englishMatcher.group().trim();
        }

        return "";
    }

    private boolean hasStructureCue(String normalizedQuestion, String compactQuestion) {
        return containsAny(
                normalizedQuestion,
                "\uAD6C\uC870", "\uD750\uB984", "\uC21C\uC11C", "\uBB50\uBD80\uD130", "\uC2DC\uC791", "\uAC00\uC774\uB4DC",
                "structure", "flow", "order", "guide", "how should i start", "what to write first"
        ) || containsAny(compactQuestion, "\uBB50\uBD80\uD130", "\uC5B4\uB5BB\uAC8C\uC2DC\uC791");
    }

    private boolean hasLookupSayCue(String normalizedQuestion, String compactQuestion) {
        return containsAny(
                normalizedQuestion,
                "\uC601\uC5B4\uB85C", "\uC5B4\uB5BB\uAC8C \uB9D0", "\uBB50\uB77C\uACE0 \uB9D0",
                "\uB77C\uACE0 \uB9D0", "\uB9D0\uD558\uACE0 \uC2F6", "\uC5B4\uB5BB\uAC8C \uD45C\uD604",
                "\uD45C\uD604\uD558\uACE0 \uC2F6", "\uC601\uC5B4 \uD45C\uD604", "\uC5B4\uB5BB\uAC8C \uD45C\uD604\uD574",
                "\uC5B4\uB5BB\uAC8C \uD45C\uD604\uD558\uC9C0", "\uC5B4\uB5BB\uAC8C \uB9D0\uD574",
                "how do i say", "want to say", "how should i say"
        ) || containsAny(
                compactQuestion,
                "\uB9D0\uD558\uACE0\uC2F6", "\uB9D0\uD558\uACE0\uC2F6\uC5B4", "\uB9D0\uD558\uACE0\uC2F6\uB2E4",
                "\uB77C\uACE0\uD558\uACE0\uC2F6", "\uB77C\uACE0\uD558\uACE0\uC2F6\uC5B4", "\uB77C\uACE0\uD558\uACE0\uC2F6\uB2E4",
                "\uB2E4\uACE0\uD558\uACE0\uC2F6", "\uB2E4\uACE0\uD558\uACE0\uC2F6\uC5B4", "\uB2E4\uACE0\uD558\uACE0\uC2F6\uB2E4",
                "\uB9D0\uD574", "\uC5B4\uB5BB\uAC8C\uB9D0", "\uC5B4\uCF00\uB9D0\uD574", "\uC5B4\uB5BB\uAC8C\uD45C\uD604",
                "\uD45C\uD604\uD574", "\uC601\uC5B4\uD45C\uD604", "\uBB50\uB77C\uACE0", "\uC601\uC5B4\uB85C",
                "\uC5B4\uB5BB\uAC8C\uD45C\uD604\uD574", "\uC5B4\uB5BB\uAC8C\uD45C\uD604\uD558\uC9C0", "\uC5B4\uCF00\uD45C\uD604\uD574"
        );
    }

    private boolean hasMeaningKeywordCue(String normalizedQuestion, String compactQuestion) {
        return containsAny(
                normalizedQuestion,
                "\uB73B", "\uC758\uBBF8", "\uBB34\uC2A8 \uB73B", "\uB73B\uC774 \uBB50\uC57C", "\uB73B\uC774 \uBB54\uC9C0",
                "meaning", "what does", "means", "mean"
        ) || containsAny(
                compactQuestion,
                "\uB73B", "\uC758\uBBF8", "\uBB34\uC2A8\uB73B", "\uB73B\uC774\uBB50\uC57C", "\uB73B\uC774\uBB54\uC9C0"
        );
    }

    private boolean hasMeaningExpressionCue(
            String normalizedQuestion,
            String compactQuestion,
            EnumSet<IntentCategory> intents
    ) {
        if (hasSupportStyleIntent(intents)) {
            return false;
        }

        if (containsAny(normalizedQuestion, "\uADF8\uAC70", "\uC774\uAC70", "\uC800\uAC70", "that thing", "this thing")) {
            return false;
        }

        boolean hasExpressionWord = containsAny(
                normalizedQuestion,
                "\uD45C\uD604", "\uB2E8\uC5B4", "\uBB38\uC7A5", "\uC774 \uB9D0", "\uC774 \uBB38\uC7A5",
                "expression", "phrase", "word", "sentence"
        );
        boolean asksNaturalLookup = containsAny(
                normalizedQuestion,
                "\uC790\uC5F0\uC2A4\uB7EC", "\uC5B4\uB5A4", "\uBB34\uC2A8", "\uCD94\uCC9C", "\uC54C\uB824",
                "natural", "recommend", "which expression", "what expression"
        ) || containsAny(
                compactQuestion,
                "\uD45C\uD604\uBB50", "\uD45C\uD604\uC790\uC5F0", "\uC790\uC5F0\uC2A4\uB7EC", "\uC5B4\uB5A4\uD45C\uD604"
        );
        return hasExpressionWord && asksNaturalLookup;
    }

    private boolean hasSupportStyleIntent(EnumSet<IntentCategory> intents) {
        return !intents.isEmpty();
    }

    private boolean hasSupportMetaCue(String normalizedQuestion, String compactQuestion) {
        return containsAny(
                normalizedQuestion,
                "\uC774 \uC9C8\uBB38\uC5D0\uC11C", "\uB9D0\uD560 \uB54C", "\uC4F8 \uB54C", "\uC4F8 \uC218 \uC788\uB294",
                "\uBD99\uC77C \uB54C", "\uB123\uC744 \uB54C", "\uCCAB \uBB38\uC7A5", "\uB2F5 \uAD6C\uC870",
                "in this question", "when i say", "when i write", "that i can use", "first sentence"
        ) || containsAny(
                compactQuestion,
                "\uC774\uC9C8\uBB38\uC5D0\uC11C", "\uB9D0\uD560\uB54C", "\uC4F8\uB54C", "\uC4F8\uC218\uC788\uB294",
                "\uBD99\uC77C\uB54C", "\uCCAB\uBB38\uC7A5", "\uB2F5\uAD6C\uC870"
        );
    }

    private boolean hasIdeaSupportCue(String normalizedQuestion, String compactQuestion) {
        boolean hasIdeaNoun = containsAny(
                normalizedQuestion,
                "\uC774\uC720", "\uADFC\uAC70", "\uC608\uC2DC", "\uC544\uC774\uB514\uC5B4", "\uD3EC\uC778\uD2B8", "\uC18C\uC7AC",
                "reason", "reasons", "example", "examples", "idea", "ideas", "point", "points"
        );
        boolean hasIdeaQuestionForm = containsAny(
                normalizedQuestion,
                "\uBB50\uAC00 \uC788\uC744\uAE4C", "\uBB50\uAC00 \uC788\uC744\uC9C0", "\uBB50\uAC00 \uC88B\uC744\uAE4C",
                "\uBB34\uC2A8 \uC774\uC720", "\uC5B4\uB5A4 \uC774\uC720", "\uBB34\uC2A8 \uC608\uC2DC", "\uC5B4\uB5A4 \uC608\uC2DC",
                "\uB2F5\uC73C\uB85C \uC4F8 \uB9CC\uD55C", "\uB4E4 \uC218 \uC788\uC744\uAE4C", "\uC4F8 \uC218 \uC788\uB294 \uC774\uC720\uAC00",
                "\uC4F8 \uC218 \uC788\uB294 \uC608\uC2DC\uAC00", "\uC0DD\uAC01\uD574 \uBCFC", "\uD3EC\uC778\uD2B8\uAC00 \uBB50",
                "what reasons", "what ideas", "what points", "what examples",
                "what could i say", "what can i say", "ideas for this question", "reasons i can use"
        ) || containsAny(
                compactQuestion,
                "\uBB50\uAC00\uC788\uC744\uAE4C", "\uBB50\uAC00\uC88B\uC744\uAE4C", "\uBB34\uC2A8\uC774\uC720", "\uC5B4\uB5A4\uC774\uC720",
                "\uBB34\uC2A8\uC608\uC2DC", "\uC5B4\uB5A4\uC608\uC2DC", "\uC774\uC720\uAC00\uBB50", "\uC608\uC2DC\uAC00\uBB50",
                "\uD3EC\uC778\uD2B8\uAC00\uBB50", "\uC4F8\uC218\uC788\uB294\uC774\uC720\uAC00", "\uC4F8\uC218\uC788\uB294\uC608\uC2DC\uAC00"
        );

        hasIdeaNoun = hasIdeaNoun || containsAny(normalizedQuestion, "사례", "내용", "case", "cases");
        hasIdeaQuestionForm = hasIdeaQuestionForm
                || containsAny(normalizedQuestion, "뭐가 있어", "들 수 있어", "추천할 만한", "알려줄 만한")
                || containsAny(compactQuestion, "뭐가있어", "들수있어");

        boolean hasIdeaContextCue = containsAny(
                normalizedQuestion,
                "이 질문", "답에", "넣을", "넣으면", "쓸 만한", "들 수", "아이디어", "포인트", "사례"
        );
        boolean hasIdeaRequestVerb = containsAny(
                normalizedQuestion,
                "알려줘", "추천해줘", "추천해 줘", "추천 좀", "정리해줘", "뽑아줘", "줄래", "줘",
                "show me", "give me", "suggest", "brainstorm"
        ) || containsAny(
                compactQuestion,
                "알려줘", "추천해줘", "추천좀", "정리해줘", "뽑아줘"
        );

        return hasIdeaNoun
                && (hasIdeaQuestionForm || hasIdeaRequestVerb || hasIdeaContextCue)
                && !looksLikePhraseSupportRequest(normalizedQuestion, compactQuestion);
    }

    private boolean looksLikePhraseSupportRequest(String normalizedQuestion, String compactQuestion) {
        return containsAny(
                normalizedQuestion,
                "표현", "문장", "영어로", "어떻게 말", "어떻게 표현", "스타터", "첫 문장", "연결 표현",
                "expression", "phrase", "sentence", "how do i say", "how to say", "starter"
        ) || containsAny(
                compactQuestion,
                "표현", "문장", "영어로", "어떻게말", "어떻게표현", "첫문장", "연결표현"
        );
    }

    private boolean hasHybridCompanionCue(String normalizedQuestion, String compactQuestion) {
        return containsAny(
                normalizedQuestion,
                "같이", "함께", "도 같이", "도 알려", "도 추천", "도 필요", "도 보고 싶", "도 궁금",
                "필요해", "있으면 좋겠", "한 줄", "도 원해",
                "also", "as well", "together", "along with"
        ) || containsAny(
                compactQuestion,
                "같이", "함께", "도같이", "도알려", "도추천", "도필요", "도보고싶",
                "필요해", "있으면좋겠", "한줄", "도원해"
        );
    }

    private boolean looksLikeImplicitMeaningLookup(
            String normalizedQuestion,
            String compactQuestion,
            String promptContext,
            EnumSet<IntentCategory> intents
    ) {
        if (hasSupportStyleIntent(intents) || hasSupportMetaCue(normalizedQuestion, compactQuestion)) {
            return false;
        }

        if (!normalizedQuestion.matches(".*[\\uAC00-\\uD7A3].*")) {
            return false;
        }

        if (normalizedQuestion.split("\\s+").length > 8) {
            return false;
        }

        return looksLikeLearningMeaning(normalizedQuestion)
                || looksLikeGrowthMeaning(normalizedQuestion)
                || looksLikeReduceManageMeaning(normalizedQuestion)
                || looksLikeSleepMeaning(normalizedQuestion)
                || looksLikeStudyMeaning(normalizedQuestion)
                || looksLikeRestMeaning(normalizedQuestion)
                || looksLikeStateChangeMeaning(normalizedQuestion, promptContext)
                || looksLikeSocializeMeaning(normalizedQuestion)
                || looksLikeExpandedSocializeMeaning(normalizedQuestion)
                || looksLikeVisitInterestMeaning(normalizedQuestion)
                || looksLikeGenericDesireStateMeaning(normalizedQuestion, compactQuestion);
    }

    private boolean looksLikeGenericDesireStateMeaning(String normalizedQuestion, String compactQuestion) {
        boolean hasDesireEnding = containsAny(
                normalizedQuestion,
                "고 싶다", "고 싶어", "고 싶", "싶다", "싶어", "되고 싶", "보이고 싶", "느껴지고 싶",
                "want to", "would like to"
        ) || containsAny(
                compactQuestion,
                "고싶다", "고싶어", "되고싶", "보이고싶", "느껴지고싶"
        );

        boolean hasMeaningContent = containsAny(
                normalizedQuestion,
                "보이", "되", "느껴지", "같아 보이", "매력적", "자연스러", "편안", "건강해", "성숙해", "professional",
                "confident", "attractive", "natural", "comfortable", "healthy", "mature"
        );

        return hasDesireEnding && hasMeaningContent;
    }

    private String extractRelationshipTopic(String normalizedText) {
        if (containsAny(normalizedText, "\uC5F0\uB77D", "contact")) {
            return "\uC628\uB77C\uC778\uC73C\uB85C \uC5F0\uB77D\uD558\uB294 \uAC83";
        }
        if (containsAny(normalizedText, "\uB300\uD654", "talk")) {
            return "\uC628\uB77C\uC778\uC5D0\uC11C \uB300\uD654\uD558\uB294 \uAC83";
        }
        if (containsAny(normalizedText, "\uCE5C\uD574", "\uAC00\uAE4C\uC6CC")) {
            return "\uC628\uB77C\uC778 \uAD00\uACC4";
        }
        if (containsAny(normalizedText, "\uAD00\uACC4", "relationship", "relationships")) {
            return "\uC628\uB77C\uC778 \uAD00\uACC4";
        }
        return "\uC778\uD130\uB137\uC5D0\uC11C \uC0AC\uB78C \uB9CC\uB098\uB294 \uAC83";
    }

    private String translateRelationshipTopic(String sourceTopic) {
        String normalized = normalizeText(sourceTopic);
        if (containsAny(normalized, "\uC5F0\uB77D", "contact")) {
            return "keeping in touch online";
        }
        if (containsAny(normalized, "\uB300\uD654", "talk")) {
            return "talking to people online";
        }
        if (containsAny(normalized, "\uAD00\uACC4", "relationship", "relationships")) {
            return "building relationships online";
        }
        if (containsAny(normalized, "\uC778\uD130\uB137", "\uC628\uB77C\uC778", "internet", "online")) {
            return "meeting people online";
        }
        return "";
    }

    private String extractStateQualifier(String normalizedText) {
        if (containsAny(normalizedText, "\uC775\uC219", "comfortable")) {
            return "\uC775\uC219\uD558\uB2E4";
        }
        if (containsAny(normalizedText, "\uD754\uD574", "common")) {
            return "\uD754\uD558\uB2E4";
        }
        if (containsAny(normalizedText, "\uC26C\uC6CC", "\uC26C\uC6CC\uC84C", "easy", "easier")) {
            return "\uC26C\uC6B4";
        }
        if (containsAny(normalizedText, "\uD3B8\uD574", "comfortable")) {
            return "\uD3B8\uD558\uB2E4";
        }
        if (containsAny(normalizedText, "normal")) {
            return "\uC77C\uBC18\uC801\uC774\uB2E4";
        }
        return "\uC790\uC5F0\uC2A4\uB7FD\uB2E4";
    }

    private String translateQualifier(String sourceQualifier) {
        String normalized = normalizeText(sourceQualifier);
        if (containsAny(normalized, "\uC775\uC219", "comfortable")) {
            return "comfortable";
        }
        if (containsAny(normalized, "\uD754\uD574", "common")) {
            return "common";
        }
        if (containsAny(normalized, "\uC26C\uC6CC", "\uC26C\uC6B4", "easy", "easier")) {
            return "easy";
        }
        if (containsAny(normalized, "\uD3B8\uD574", "comfortable")) {
            return "comfortable";
        }
        if (containsAny(normalized, "normal")) {
            return "normal";
        }
        return "natural";
    }

    private boolean containsAny(String source, String... tokens) {
        for (String token : tokens) {
            if (source.contains(token)) {
                return true;
            }
        }
        return false;
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

    private String compactText(String value) {
        return normalizeText(value).replace(" ", "");
    }
}
