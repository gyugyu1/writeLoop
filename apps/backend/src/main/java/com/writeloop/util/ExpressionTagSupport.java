package com.writeloop.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.persistence.SavedExpressionSourceType;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

public final class ExpressionTagSupport {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final Pattern NON_TAG_CHARACTERS = Pattern.compile("[^a-z0-9_]");
    private static final Pattern MULTIPLE_UNDERSCORES = Pattern.compile("_+");
    private static final Pattern EDGE_UNDERSCORES = Pattern.compile("^_+|_+$");
    private static final Pattern TEMPORAL_SEQUENCE_PATTERN = Pattern.compile(
            "\\b(before|after|during|while|when|until|since|once|whenever|later|earlier|afterward|afterwards|meanwhile|first|next|finally|immediately)\\b"
    );
    private static final Pattern CLOCK_OR_DAYPART_PATTERN = Pattern.compile(
            "\\b(in|at|on|by|around)\\s+(the\\s+)?(morning|afternoon|evening|night|weekend|weekends|weekday|weekdays|beginning|end)\\b"
    );
    private static final Pattern RELATIVE_TIME_EVENT_PATTERN = Pattern.compile(
            "\\b(before|after)\\s+(breakfast|lunch|dinner|school|work|class|bed|bedtime)\\b"
    );
    private static final Pattern DURATION_PATTERN = Pattern.compile(
            "\\bfor\\s+(a\\s+)?(while|little while|moment|bit|few minutes|few hours|an hour|one hour)\\b|\\bfor\\s+\\d+\\s+(minutes?|hours?|days?|weeks?)\\b"
    );
    private static final Pattern REPEATED_TIME_PATTERN = Pattern.compile(
            "\\b(every|each)\\s+(day|night|morning|afternoon|evening|weekend|weekends|weekday|weekdays)\\b|\\bmost\\s+(mornings|afternoons|evenings|nights|weekends|weekdays)\\b|\\b(all day|all night|the next day|the day before|later on|at first|right away)\\b"
    );

    private static final List<String> ALLOWED_TAGS = List.of(
            "used_expression",
            "refinement_expression",
            "coach_recommendation",
            "verb_phrase",
            "noun_phrase",
            "adjective_phrase",
            "sentence_starter",
            "frequency_expression",
            "time_expression",
            "place_expression",
            "reason_expression",
            "example_expression",
            "opinion_expression",
            "comparison_expression",
            "feeling_expression",
            "daily_routine",
            "home",
            "school",
            "work",
            "study",
            "meal",
            "exercise",
            "hobby",
            "travel",
            "shopping",
            "sleep",
            "health",
            "relationship",
            "technology",
            "present_habit",
            "past_experience",
            "future_plan"
    );

    private static final Set<String> ALLOWED_TAG_SET = Set.copyOf(ALLOWED_TAGS);
    private static final Map<String, String> ALIAS_TO_TAG = buildAliasMap();

    private ExpressionTagSupport() {
    }

    public static List<String> allowedTags() {
        return ALLOWED_TAGS;
    }

    public static Map<String, Object> jsonSchema() {
        return Map.of(
                "type", "array",
                "minItems", 2,
                "maxItems", 6,
                "items", Map.of(
                        "type", "string",
                        "enum", ALLOWED_TAGS
                )
        );
    }

    public static String formatAllowedTagsForPrompt() {
        return String.join(", ", ALLOWED_TAGS);
    }

    public static List<String> fromJsonNode(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }

        List<String> tags = new ArrayList<>();
        node.forEach(item -> {
            if (item != null && item.isTextual()) {
                tags.add(item.asText());
            }
        });
        return sanitizeTags(tags);
    }

    public static List<String> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }

        try {
            return fromJsonNode(OBJECT_MAPPER.readTree(json));
        } catch (JsonProcessingException exception) {
            return List.of();
        }
    }

    public static String toJson(List<String> tags) {
        List<String> sanitized = sanitizeTags(tags);
        if (sanitized.isEmpty()) {
            return null;
        }

        try {
            return OBJECT_MAPPER.writeValueAsString(sanitized);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize expression tags", exception);
        }
    }

    public static List<String> sanitizeTags(List<String> tags) {
        return filterExpressionSpecificTags(sanitizeCanonicalTags(tags), null);
    }

    public static List<String> sanitizeTags(List<String> tags, String expression) {
        return filterExpressionSpecificTags(sanitizeCanonicalTags(tags), expression);
    }

    private static List<String> sanitizeCanonicalTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return List.of();
        }

        LinkedHashSet<String> sanitized = new LinkedHashSet<>();
        for (String tag : tags) {
            String normalized = normalizeTag(tag);
            if (normalized != null) {
                sanitized.add(normalized);
            }
        }
        return List.copyOf(sanitized);
    }

    @SafeVarargs
    public static List<String> mergeTags(List<String>... tagGroups) {
        LinkedHashSet<String> merged = new LinkedHashSet<>();
        if (tagGroups != null) {
            for (List<String> tagGroup : tagGroups) {
                merged.addAll(sanitizeTags(tagGroup));
            }
        }
        return List.copyOf(merged);
    }

    @SafeVarargs
    public static List<String> mergeTagsForExpression(String expression, List<String>... tagGroups) {
        LinkedHashSet<String> merged = new LinkedHashSet<>();
        if (tagGroups != null) {
            for (List<String> tagGroup : tagGroups) {
                merged.addAll(sanitizeCanonicalTags(tagGroup));
            }
        }
        return filterExpressionSpecificTags(List.copyOf(merged), expression);
    }

    public static List<String> withCoachDefaults(List<String> tags) {
        return withCoachDefaults(tags, null);
    }

    public static List<String> withCoachDefaults(List<String> tags, String expression) {
        return mergeTagsForExpression(expression, List.of("coach_recommendation"), tags);
    }

    public static List<String> withUsedExpressionDefaults(List<String> tags) {
        return withUsedExpressionDefaults(tags, null);
    }

    public static List<String> withUsedExpressionDefaults(List<String> tags, String expression) {
        return mergeTagsForExpression(expression, List.of("used_expression"), tags);
    }

    public static List<String> withRewriteIdeaDefaults(List<String> tags) {
        return withRewriteIdeaDefaults(tags, null);
    }

    public static List<String> withRewriteIdeaDefaults(List<String> tags, String expression) {
        return mergeTagsForExpression(expression, List.of("refinement_expression"), tags);
    }

    public static List<String> withSavedExpressionDefaults(List<String> tags, SavedExpressionSourceType sourceType) {
        return withSavedExpressionDefaults(tags, sourceType, null);
    }

    public static List<String> withSavedExpressionDefaults(
            List<String> tags,
            SavedExpressionSourceType sourceType,
            String expression
    ) {
        return mergeTagsForExpression(expression, tags, defaultTagsFor(sourceType));
    }

    public static List<String> defaultTagsFor(SavedExpressionSourceType sourceType) {
        if (sourceType == null) {
            return List.of();
        }

        return switch (sourceType) {
            case USED_EXPRESSION -> List.of("used_expression");
            case REFINEMENT_EXPRESSION -> List.of("refinement_expression");
            case COACH_RECOMMENDATION -> List.of("coach_recommendation");
            case DIARY_EXPRESSION -> List.of("diary_expression");
        };
    }

    private static String normalizeTag(String rawTag) {
        String normalizedKey = normalizeAliasKey(rawTag);
        if (normalizedKey == null) {
            return null;
        }

        String mapped = ALIAS_TO_TAG.get(normalizedKey);
        if (mapped != null) {
            return mapped;
        }
        return ALLOWED_TAG_SET.contains(normalizedKey) ? normalizedKey : null;
    }

    private static String normalizeAliasKey(String rawValue) {
        if (rawValue == null) {
            return null;
        }

        String normalized = rawValue.trim().toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return null;
        }

        normalized = normalized
                .replace('-', '_')
                .replace(' ', '_')
                .replace('/', '_');
        normalized = NON_TAG_CHARACTERS.matcher(normalized).replaceAll("");
        normalized = MULTIPLE_UNDERSCORES.matcher(normalized).replaceAll("_");
        normalized = EDGE_UNDERSCORES.matcher(normalized).replaceAll("");
        return normalized.isBlank() ? null : normalized;
    }

    private static List<String> filterExpressionSpecificTags(List<String> tags, String expression) {
        if (tags == null || tags.isEmpty()) {
            return List.of();
        }

        String normalizedExpression = normalizeExpressionText(expression);
        if (normalizedExpression == null) {
            return List.copyOf(tags);
        }

        LinkedHashSet<String> filtered = new LinkedHashSet<>();
        for (String tag : tags) {
            if (shouldKeepTag(tag, normalizedExpression)) {
                filtered.add(tag);
            }
        }
        return List.copyOf(filtered);
    }

    private static boolean shouldKeepTag(String tag, String normalizedExpression) {
        if ("time_expression".equals(tag)) {
            return matchesTimeExpression(normalizedExpression);
        }
        return true;
    }

    private static boolean matchesTimeExpression(String normalizedExpression) {
        if (normalizedExpression == null || normalizedExpression.isBlank()) {
            return true;
        }

        return TEMPORAL_SEQUENCE_PATTERN.matcher(normalizedExpression).find()
                || CLOCK_OR_DAYPART_PATTERN.matcher(normalizedExpression).find()
                || RELATIVE_TIME_EVENT_PATTERN.matcher(normalizedExpression).find()
                || DURATION_PATTERN.matcher(normalizedExpression).find()
                || REPEATED_TIME_PATTERN.matcher(normalizedExpression).find();
    }

    private static String normalizeExpressionText(String expression) {
        if (expression == null) {
            return null;
        }

        String normalized = expression.trim()
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ");
        return normalized.isBlank() ? null : normalized;
    }

    private static Map<String, String> buildAliasMap() {
        Map<String, String> aliases = new LinkedHashMap<>();
        register(aliases, "used_expression",
                "used",
                "usedexpression",
                "my_expression",
                "learner_used",
                "self_discovered");
        register(aliases, "refinement_expression",
                "refinement",
                "rewrite_idea",
                "rewrite",
                "expression_plus");
        register(aliases, "coach_recommendation",
                "coach",
                "coach_expression",
                "ai_coach",
                "coach_recommended");
        register(aliases, "verb_phrase", "verb", "verbphrase");
        register(aliases, "noun_phrase", "noun", "nounphrase");
        register(aliases, "adjective_phrase", "adjective", "adjectivephrase");
        register(aliases, "sentence_starter", "starter", "opening", "first_sentence");
        register(aliases, "frequency_expression", "frequency", "habit_frequency");
        register(aliases, "time_expression", "time", "time_phrase");
        register(aliases, "place_expression", "place", "location", "location_expression");
        register(aliases, "reason_expression", "reason", "because_expression");
        register(aliases, "example_expression", "example", "for_example");
        register(aliases, "opinion_expression", "opinion", "personal_opinion");
        register(aliases, "comparison_expression", "comparison", "compare", "contrast");
        register(aliases, "feeling_expression", "feeling", "emotion", "emotion_expression");
        register(aliases, "daily_routine", "routine", "habit_routine");
        register(aliases, "home", "house");
        register(aliases, "school", "schoollife");
        register(aliases, "work", "job", "office");
        register(aliases, "study", "learning");
        register(aliases, "meal", "food", "eating");
        register(aliases, "exercise", "workout");
        register(aliases, "hobby", "interest");
        register(aliases, "travel", "trip");
        register(aliases, "shopping", "shop");
        register(aliases, "sleep", "bedtime");
        register(aliases, "health", "healthy");
        register(aliases, "relationship", "social", "friendship");
        register(aliases, "technology", "tech");
        register(aliases, "present_habit", "present", "current_habit");
        register(aliases, "past_experience", "past", "experience");
        register(aliases, "future_plan", "future", "plan", "goal");
        return Map.copyOf(aliases);
    }

    private static void register(Map<String, String> aliases, String canonicalTag, String... aliasValues) {
        String normalizedCanonical = normalizeAliasKey(canonicalTag);
        if (normalizedCanonical == null || !ALLOWED_TAG_SET.contains(normalizedCanonical)) {
            throw new IllegalArgumentException("Unsupported canonical tag: " + canonicalTag);
        }

        aliases.put(normalizedCanonical, normalizedCanonical);
        for (String aliasValue : aliasValues) {
            String normalizedAlias = normalizeAliasKey(aliasValue);
            if (normalizedAlias != null) {
                aliases.put(normalizedAlias, normalizedCanonical);
            }
        }
    }
}
