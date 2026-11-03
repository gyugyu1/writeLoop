package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptSlotContractDto;
import com.writeloop.dto.PromptTaskMetaDto;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 작업 055 계획 ② 명세(03-지난-미션-판정-맥락/01-main-spec.md)의 기대 결과 중 CanonicalFeedbackContract의 스키마와 개발자 프롬프트.
 * 사용자 프롬프트의 previousAttempt는 다시 쓴 답 요청의 맥락이 필요해 FeedbackServicePreviousAttemptContextSpecTest에서 본다.
 * 바뀔 동작: 이름이 changed_ 로 시작한다(지금 코드에서 실패해야 한다). 그대로 둘 동작: kept_ 로 시작한다(지금 통과해야 한다).
 */
class CanonicalFeedbackContractPreviousAttemptSpecTest {

    private static final Pattern REASON_WORD = Pattern.compile("\\breason\\b");

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CanonicalFeedbackContract contract = new CanonicalFeedbackContract(objectMapper);

    // ---- 바뀔 동작 4: 판정 앞 이유 칸(스키마) ----

    @Test
    void changed_structureAssessmentHasAReasonBeforeStatus() {
        JsonNode structure = schema(routinePrompt()).path("properties").path("structureAssessment");

        assertThat(keys(structure.path("properties"))).containsExactly("reason", "status");
        assertThat(structure.path("required"))
                .extracting(JsonNode::asText)
                .containsExactlyInAnyOrder("reason", "status");
        assertThat(structure.path("properties").path("reason").path("type").asText()).isEqualTo("string");
        assertThat(structure.path("properties").path("status").path("enum"))
                .extracting(JsonNode::asText)
                .containsExactly("COMPLETE", "FRAGMENT");
    }

    @Test
    void changed_slotAssessmentItemHasAReasonAfterEvidenceAndBeforeVerdict() {
        JsonNode item = schema(routinePrompt()).path("properties").path("slotAssessments").path("items");

        assertThat(keys(item.path("properties"))).containsExactly("slot", "evidence", "reason", "verdict");
        assertThat(item.path("required"))
                .extracting(JsonNode::asText)
                .containsExactlyInAnyOrder("slot", "evidence", "reason", "verdict");
        assertThat(item.path("properties").path("reason").path("type").asText()).isEqualTo("string");
        assertThat(item.path("properties").path("verdict").path("enum"))
                .extracting(JsonNode::asText)
                .containsExactly("SATISFIED", "GENERIC", "MISSING");
    }

    // 명세: 영어 한 줄(짧게, 프롬프트에 길이 지시). 채우는 순서 안내도 이유를 판정 앞에 둔다.
    @Test
    void changed_developerPromptAsksForAShortEnglishReasonBeforeTheStructureStatusAndEachSlotVerdict() {
        List<String> paragraphs = paragraphs(contract.developerPrompt());

        assertThat(paragraphs)
                .as("a paragraph about structureAssessment that puts reason before status")
                .anyMatch(paragraph -> paragraph.contains("structureAssessment")
                        && inOrder(paragraph, REASON_WORD, Pattern.compile("\\bstatus\\b")));
        assertThat(paragraphs)
                .as("a paragraph that orders evidence, then reason, then verdict")
                .anyMatch(paragraph -> inOrder(paragraph,
                        Pattern.compile("\\bevidence\\b"), REASON_WORD, Pattern.compile("\\bverdict\\b")));
        assertThat(paragraphs)
                .as("a paragraph that asks for a short English reason")
                .anyMatch(paragraph -> REASON_WORD.matcher(paragraph).find()
                        && paragraph.contains("English")
                        && (paragraph.contains("short") || paragraph.contains("one sentence")
                        || paragraph.contains("one line") || paragraph.contains("words")));
    }

    // ---- 바뀔 동작 2: 선택 순서에 지난 미션 유지(앞 세 단계 뒤) ----

    @Test
    void changed_selectionOrderPutsThePreviousMissionStepRightAfterTheFirstThreeSteps() {
        String prompt = contract.developerPrompt();
        int blocking = prompt.indexOf("structureAssessment.status is FRAGMENT, or any revision step has kind GRAMMAR_BLOCKING: no slot.");
        int required = prompt.indexOf("The first requiredSlots slot whose verdict is not SATISFIED.");

        assertThat(blocking).as("FRAGMENT/BLOCKING step").isGreaterThan(0);
        assertThat(required).as("missing required slot step after FRAGMENT/BLOCKING").isGreaterThan(blocking);
        String between = prompt.substring(blocking, required);
        assertThat(between).as("text between the FRAGMENT/BLOCKING step and the required slot step")
                .contains("previousAttempt");
    }

    // ---- 바뀔 동작 3: 판정 유지(프롬프트 규칙) ----

    @Test
    void changed_developerPromptKeepsThePreviousVerdictWhenItsEvidenceIsUnchanged() {
        assertThat(paragraphs(contract.developerPrompt()))
                .as("a rule that mentions previousAttempt, evidence, and verdict together")
                .anyMatch(paragraph -> paragraph.contains("previousAttempt")
                        && paragraph.contains("evidence")
                        && paragraph.contains("verdict"));
    }

    // ---- 그대로 둘 동작 ----

    // 첫 답의 선택 순서: 바뀌는 것은 앞 세 단계 뒤에 한 단계를 넣는 것뿐이다. 번호는 바뀔 수 있으므로 문구의 순서만 본다.
    @Test
    void kept_selectionOrderKeepsTheExistingStepsInTheSameOrder() {
        String prompt = contract.developerPrompt();
        List<String> steps = List.of(
                "topicAssessment.status is OFF_TOPIC: the first questionContract.requiredSlots slot,",
                "or the first depthSlots slot when requiredSlots is empty.",
                "structureAssessment.status is FRAGMENT, or any revision step has kind GRAMMAR_BLOCKING: no slot.",
                "The first requiredSlots slot whose verdict is not SATISFIED.",
                "Any revision step has kind GRAMMAR_LOCAL: no slot.",
                "minimumDepthSlots is greater than 0 and fewer than minimumDepthSlots depthSlots slots are SATISFIED:",
                "the first depthSlots slot whose verdict is not SATISFIED.",
                "Otherwise: no slot."
        );
        int from = 0;
        for (String step : steps) {
            int index = prompt.indexOf(step, from);
            assertThat(index).as("step in order: %s", step).isGreaterThanOrEqualTo(0);
            from = index + step.length();
        }
    }

    @Test
    void kept_topicAssessmentAndTopLevelFieldOrderAreUnchanged() {
        JsonNode properties = schema(routinePrompt()).path("properties");

        assertThat(keys(properties)).containsExactly(
                "topicAssessment",
                "structureAssessment",
                "languageAssessment",
                "slotAssessments",
                "missionSupport",
                "enrichmentSupport",
                "modelAnswer",
                "modelAnswerKo",
                "refinementExpressions",
                "strengths"
        );
        assertThat(keys(properties.path("topicAssessment").path("properties"))).containsExactly("reasonKo", "status");
        assertThat(keys(properties.path("languageAssessment").path("properties")
                .path("revisionSteps").path("items").path("properties")))
                .containsExactly("kind", "answerAfter", "reasonKo");
    }

    // 053: 스키마는 질문과 관계없이 글자 그대로 같다.
    @Test
    void kept_schemaIsLiterallyTheSameForQuestionsWithDifferentSlots() throws Exception {
        String routine = objectMapper.writeValueAsString(contract.schema(routinePrompt()));
        String goal = objectMapper.writeValueAsString(contract.schema(goalPrompt()));

        assertThat(goal).isEqualTo(routine);
    }

    // ---- helpers ----

    private JsonNode schema(PromptDto prompt) {
        return objectMapper.valueToTree(contract.schema(prompt));
    }

    private static List<String> keys(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    private static boolean inOrder(String text, Pattern... patterns) {
        int from = 0;
        for (Pattern pattern : patterns) {
            Matcher matcher = pattern.matcher(text);
            if (!matcher.find(from)) {
                return false;
            }
            from = matcher.end();
        }
        return true;
    }

    // 개발자 프롬프트를 항목 단위로 나눈다. "- ", "* ", "1. " 로 시작하는 줄이나 빈 줄 뒤에서 새 항목이 시작하고,
    // 들여 쓴 이어지는 줄은 앞 항목에 붙인다.
    private static List<String> paragraphs(String prompt) {
        List<String> paragraphs = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String rawLine : prompt.split("\n")) {
            String line = rawLine.trim();
            boolean starts = line.isEmpty()
                    || line.startsWith("- ")
                    || line.startsWith("* ")
                    || line.matches("^\\d+\\.\\s.*")
                    || line.endsWith(":") && !line.startsWith("-");
            if (starts && current.length() > 0) {
                paragraphs.add(current.toString());
                current.setLength(0);
            }
            if (!line.isEmpty()) {
                if (current.length() > 0) {
                    current.append(' ');
                }
                current.append(line);
            }
        }
        if (current.length() > 0) {
            paragraphs.add(current.toString());
        }
        return paragraphs;
    }

    private static Map<String, PromptSlotContractDto> contracts(String... slots) {
        Map<String, PromptSlotContractDto> contracts = new LinkedHashMap<>();
        for (String slot : slots) {
            contracts.put(slot, new PromptSlotContractDto(
                    "The question-specific role of " + slot + ".",
                    "The learner answer clearly fulfills " + slot + " for this question.",
                    slot + " 역할",
                    slot + " 충족 기준"
            ));
        }
        return contracts;
    }

    private static PromptDto routinePrompt() {
        return new PromptDto(
                "prompt-spec-055-routine",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you usually do after work?",
                "퇴근 후 보통 무엇을 하나요?",
                "",
                null,
                new PromptTaskMetaDto(
                        "ROUTINE",
                        List.of("ACTION"),
                        List.of("REASON"),
                        "PRESENT_SIMPLE",
                        "FIRST_PERSON",
                        1,
                        contracts("ACTION", "REASON")
                )
        );
    }

    private static PromptDto goalPrompt() {
        return new PromptDto(
                "prompt-spec-055-goal",
                "Growth",
                "Growth",
                "Goal",
                "B",
                "What is one language goal you want to focus on this year, and how will you work toward it?",
                "올해 집중하고 싶은 언어 목표 하나는 무엇이고, 어떻게 이루어 갈 건가요?",
                "",
                null,
                new PromptTaskMetaDto(
                        "GOAL_PLAN",
                        List.of("GOAL", "PLAN"),
                        List.of("SPECIFIC_TIME", "PROBLEM", "RESULT", "REASON", "EXAMPLE"),
                        "FUTURE",
                        "FIRST_PERSON",
                        0,
                        contracts("GOAL", "PLAN", "SPECIFIC_TIME", "PROBLEM", "RESULT", "REASON", "EXAMPLE")
                )
        );
    }
}
