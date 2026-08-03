package com.writeloop.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FeedbackRevisionDiffSupportTest {

    @Test
    void separatesNonAdjacentChangesInSourceOrder() {
        FeedbackRevisionDiff diff = FeedbackRevisionDiffSupport.compare(
                "i take phill to stay focus.",
                "I take a pill to stay focused."
        );

        assertThat(diff.edits())
                .extracting(LanguageRevisionEdit::displayOriginalText)
                .containsExactly("i", "phill", "focus.");
        assertThat(diff.edits())
                .extracting(LanguageRevisionEdit::displayRevisedText)
                .containsExactly("I", "a pill", "focused.");
    }

    @Test
    void treatsAWordOrderRepairAsOneContinuousReplacement() {
        FeedbackRevisionDiff diff = FeedbackRevisionDiffSupport.compare(
                "I work no today.",
                "I do not work today."
        );

        assertThat(diff.edits()).singleElement()
                .satisfies(edit -> {
                    assertThat(edit.displayOriginalText()).isEqualTo("work no");
                    assertThat(edit.displayRevisedText()).isEqualTo("do not work");
                });
    }

    @Test
    void locatesTheChangedOccurrenceWhenTextRepeats() {
        FeedbackRevisionDiff diff = FeedbackRevisionDiffSupport.compare(
                "I drink makgeolli, and I enjoy makgeolli.",
                "I drink makgeolli, and I enjoy Makgeolli."
        );

        assertThat(diff.edits()).singleElement()
                .satisfies(edit -> {
                    assertThat(edit.sourceStart()).isGreaterThan(20);
                    assertThat(edit.displayOriginalText()).isEqualTo("makgeolli.");
                    assertThat(edit.displayRevisedText()).isEqualTo("Makgeolli.");
                });
    }

    @Test
    void enclosesSeveralLowLevelChangesAsOneTeachingCorrection() {
        String original = "I'm like eat watermelon.";
        String revised = "I like eating watermelon.";
        FeedbackRevisionDiff diff = FeedbackRevisionDiffSupport.compare(original, revised);

        assertThat(diff.edits()).hasSize(2);
        LanguageRevisionEdit correction = FeedbackRevisionDiffSupport.enclosingEdit(
                original,
                revised,
                diff
        );

        assertThat(correction.displayOriginalText()).isEqualTo("I'm like eat");
        assertThat(correction.displayRevisedText()).isEqualTo("I like eating");
    }

    @Test
    void validationDiffSeparatesSentencePunctuationFromTheAdjacentWord() {
        FeedbackRevisionDiff diff = FeedbackRevisionDiffSupport.compareForValidation(
                "rainy Day. Because it is traditional.",
                "rainy Day because it is traditional."
        );

        assertThat(diff.edits())
                .extracting(LanguageRevisionEdit::displayOriginalText)
                .containsExactly(".", "Because");
        assertThat(diff.edits())
                .extracting(LanguageRevisionEdit::displayRevisedText)
                .containsExactly("", "because");
    }

    @Test
    void validationDiffKeepsRepeatedNonAdjacentWordChangesSeparate() {
        FeedbackRevisionDiff diff = FeedbackRevisionDiffSupport.compareForValidation(
                "on rainy Day because it is a tradition on rainy Day.",
                "on rainy days because it is a tradition on rainy days."
        );

        assertThat(diff.edits())
                .extracting(LanguageRevisionEdit::displayOriginalText)
                .containsExactly("Day", "Day");
        assertThat(diff.edits())
                .extracting(LanguageRevisionEdit::displayRevisedText)
                .containsExactly("days", "days");
    }
}
