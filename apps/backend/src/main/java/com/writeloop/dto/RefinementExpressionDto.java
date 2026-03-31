package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RefinementExpressionDto(
        String expression,
        RefinementExpressionType type,
        RefinementExpressionSource source,
        String meaningKo,
        RefinementMeaningType meaningType,
        @JsonProperty("guidance") @JsonAlias({"guidance", "guidanceKo"}) String guidanceKo,
        @JsonProperty("example") @JsonAlias({"example", "exampleEn"}) String exampleEn,
        @JsonProperty("exampleKo") @JsonAlias({"exampleKo"}) String exampleKo,
        RefinementExampleSource exampleSource,
        Boolean displayable,
        List<String> qualityFlags
) {
    public RefinementExpressionDto {
        expression = normalize(expression);
        meaningKo = normalize(meaningKo);
        guidanceKo = normalize(guidanceKo);
        exampleEn = normalize(exampleEn);
        exampleKo = normalize(exampleKo);
        type = type == null ? inferType(expression) : type;
        source = source == null ? RefinementExpressionSource.GENERATED : source;
        meaningType = meaningType == null ? inferMeaningType(type, meaningKo) : meaningType;
        exampleSource = exampleSource == null ? inferExampleSource(exampleEn, expression) : exampleSource;
        displayable = displayable == null ? inferDisplayable(exampleEn, expression) : displayable;
        qualityFlags = qualityFlags == null ? List.of() : List.copyOf(qualityFlags);
    }

    public RefinementExpressionDto(
            String expression,
            String guidanceKo,
            String exampleEn
    ) {
        this(
                expression,
                inferType(expression),
                RefinementExpressionSource.GENERATED,
                null,
                RefinementMeaningType.NONE,
                guidanceKo,
                exampleEn,
                null,
                inferExampleSource(exampleEn, expression),
                inferDisplayable(exampleEn, expression),
                List.of()
        );
    }

    public RefinementExpressionDto(
            String expression,
            String guidanceKo,
            String exampleEn,
            String exampleKo,
            String meaningKo
    ) {
        this(
                expression,
                inferType(expression),
                RefinementExpressionSource.GENERATED,
                meaningKo,
                inferMeaningType(inferType(expression), meaningKo),
                guidanceKo,
                exampleEn,
                exampleKo,
                inferExampleSource(exampleEn, expression),
                inferDisplayable(exampleEn, expression),
                List.of()
        );
    }

    public RefinementExpressionDto(
            String expression,
            String guidanceKo,
            String exampleEn,
            String meaningKo
    ) {
        this(
                expression,
                inferType(expression),
                RefinementExpressionSource.GENERATED,
                meaningKo,
                inferMeaningType(inferType(expression), meaningKo),
                guidanceKo,
                exampleEn,
                null,
                inferExampleSource(exampleEn, expression),
                inferDisplayable(exampleEn, expression),
                List.of()
        );
    }

    public String guidance() {
        return guidanceKo;
    }

    public String example() {
        return exampleEn;
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static RefinementExpressionType inferType(String expression) {
        return expression != null && expression.contains("[") && expression.contains("]")
                ? RefinementExpressionType.FRAME
                : RefinementExpressionType.LEXICAL;
    }

    private static RefinementMeaningType inferMeaningType(
            RefinementExpressionType type,
            String meaningKo
    ) {
        if (meaningKo == null || meaningKo.isBlank()) {
            return RefinementMeaningType.NONE;
        }
        return type == RefinementExpressionType.FRAME
                ? RefinementMeaningType.PATTERN_EXPLANATION
                : RefinementMeaningType.GLOSS;
    }

    private static RefinementExampleSource inferExampleSource(String exampleEn, String expression) {
        if (exampleEn == null || exampleEn.isBlank()) {
            return RefinementExampleSource.NONE;
        }
        return normalize(exampleEn).equalsIgnoreCase(normalize(expression))
                ? RefinementExampleSource.NONE
                : RefinementExampleSource.OPENAI;
    }

    private static Boolean inferDisplayable(String exampleEn, String expression) {
        if (exampleEn == null || exampleEn.isBlank()) {
            return false;
        }
        String normalizedExample = normalize(exampleEn);
        String normalizedExpression = normalize(expression);
        return normalizedExpression == null || !normalizedExpression.equalsIgnoreCase(normalizedExample);
    }
}
