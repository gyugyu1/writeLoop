package com.writeloop.util;

import com.writeloop.persistence.SavedExpressionSourceType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ExpressionTagSupportTest {

    @Test
    void withSavedExpressionDefaults_removes_time_expression_for_generic_action() {
        List<String> tags = ExpressionTagSupport.withSavedExpressionDefaults(
                List.of("used_expression", "verb_phrase", "time_expression"),
                SavedExpressionSourceType.USED_EXPRESSION,
                "take a walk"
        );

        assertThat(tags).containsExactly("used_expression", "verb_phrase");
    }

    @Test
    void withSavedExpressionDefaults_keeps_time_expression_for_direct_time_phrase() {
        List<String> tags = ExpressionTagSupport.withSavedExpressionDefaults(
                List.of("used_expression", "time_expression", "sleep"),
                SavedExpressionSourceType.USED_EXPRESSION,
                "before I go to bed"
        );

        assertThat(tags).containsExactly("used_expression", "time_expression", "sleep");
    }
}
