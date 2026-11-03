package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.PromptHintItemDto;
import com.writeloop.dto.PromptSlotContractDto;
import com.writeloop.dto.PromptTaskMetaDto;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 작업 053 명세(문장 피드백 스키마 고정과 완료 전용 출력)의 기대 결과 중 스키마와 프롬프트.
 * 바뀔 동작: 이름이 changed_ 로 시작한다. 그대로 둘 동작: kept_ 로 시작한다.
 */
class CanonicalFeedbackContractSpecTest {

    // 명세: 로컬 DB prompt_task_slots의 활성 코드 20개, 표시 순서(V107__baseline.sql의 display_order 1~20)
    private static final List<String> ALL_SLOTS = List.of(
            "ACTION",
            "CHOICE",
            "GOAL",
            "PROBLEM",
            "OPINION",
            "PLAN",
            "SOLUTION",
            "ADVANTAGE",
            "DISADVANTAGE",
            "BEFORE_STATE",
            "NOW_STATE",
            "CHANGE_CAUSE",
            "ADDITIONAL_ACTION",
            "SPECIFIC_TIME",
            "PLACE",
            "REASON",
            "DETAIL",
            "EXAMPLE",
            "FEELING",
            "RESULT"
    );

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CanonicalFeedbackContract contract = new CanonicalFeedbackContract(objectMapper);

    // ---- 바뀔 동작 1: 슬롯 판정을 고정 모양 배열로 ----

    @Test
    void changed_slotAssessmentsIsAnArrayOfSlotEvidenceVerdictItems() {
        JsonNode slotAssessments = schema(routinePrompt()).path("properties").path("slotAssessments");

        assertThat(slotAssessments.path("type").asText()).isEqualTo("array");
        JsonNode item = slotAssessments.path("items");
        assertThat(item.path("type").asText()).isEqualTo("object");
        assertThat(item.path("additionalProperties").asBoolean(true)).isFalse();
        assertThat(keys(item.path("properties"))).containsExactly("slot", "evidence", "reason", "verdict");
        assertThat(item.path("required"))
                .extracting(JsonNode::asText)
                .containsExactlyInAnyOrder("slot", "evidence", "reason", "verdict");
        assertThat(item.path("properties").path("slot").path("enum"))
                .extracting(JsonNode::asText)
                .containsExactlyElementsOf(ALL_SLOTS);
        assertThat(item.path("properties").path("evidence").path("type").asText()).isEqualTo("string");
        assertThat(item.path("properties").path("verdict").path("enum"))
                .extracting(JsonNode::asText)
                .containsExactly("SATISFIED", "GENERIC", "MISSING");
    }

    @Test
    void changed_missionAndEnrichmentSlotChoicesAreEverySlotCode() {
        for (PromptDto prompt : List.of(routinePrompt(), goalPrompt(), requiredOnlyPrompt())) {
            JsonNode properties = schema(prompt).path("properties");

            assertThat(properties.path("missionSupport").path("items").path("properties").path("slot").path("enum"))
                    .as(prompt.id() + " missionSupport")
                    .extracting(JsonNode::asText)
                    .containsExactlyElementsOf(ALL_SLOTS);
            assertThat(properties.path("enrichmentSupport").path("items").path("properties").path("slot").path("enum"))
                    .as(prompt.id() + " enrichmentSupport")
                    .extracting(JsonNode::asText)
                    .containsExactlyElementsOf(ALL_SLOTS);
        }
    }

    @Test
    void changed_schemaIsLiterallyTheSameForQuestionsWithDifferentSlots() throws Exception {
        String routine = objectMapper.writeValueAsString(contract.schema(routinePrompt()));
        String goal = objectMapper.writeValueAsString(contract.schema(goalPrompt()));
        String requiredOnly = objectMapper.writeValueAsString(contract.schema(requiredOnlyPrompt()));

        assertThat(goal).isEqualTo(routine);
        assertThat(requiredOnly).isEqualTo(routine);
    }

    @Test
    void changed_developerPromptNoLongerDescribesAFixedKeyObject() {
        assertThat(contract.developerPrompt())
                .doesNotContain("fixed-key object")
                .doesNotContain("slotAssessments has exactly the fixed keys supplied by the response schema");
    }

    // ---- 바뀔 동작 2: 학습자 답을 사용자 프롬프트 맨 뒤로 ----

    @Test
    void changed_userPromptPutsTheLearnerAnswerLast() throws Exception {
        JsonNode withoutHints = objectMapper.readTree(contract.userPrompt(routinePrompt(), "I take a walk.", List.of()));
        JsonNode withHints = objectMapper.readTree(contract.userPrompt(routinePrompt(), "I take a walk.", List.of(hint())));

        assertThat(keys(withoutHints)).containsExactly("question", "questionContract", "promptHints", "learnerAnswer");
        assertThat(keys(withHints)).containsExactly("question", "questionContract", "promptHints", "learnerAnswer");
        assertThat(withHints.path("learnerAnswer").asText()).isEqualTo("I take a walk.");
        assertThat(withHints.path("promptHints").get(0).path("items").get(0).path("content").asText())
                .isEqualTo("take a walk");
    }

    // ---- 바뀔 동작 3: 완료 전용 출력은 완료일 때만 ----

    @Test
    void changed_refinementExpressionsMayBeEmpty() {
        JsonNode refinementExpressions = schema(routinePrompt()).path("properties").path("refinementExpressions");

        assertThat(refinementExpressions.path("minItems").asInt(-1)).isEqualTo(0);
    }

    // ---- 그대로 둘 동작 ----

    // 작업 055 결정 1(03-main-decision.md)로 고침: 선택 순서의 앞 세 단계(주제 이탈, FRAGMENT·BLOCKING) 바로 뒤에
    // 지난 미션 유지 단계(previousAttempt를 쓰는 단계)가 들어가고, 그 뒤는 지금 단계가 같은 문구·순서로 이어진다.
    // 들어간 단계 때문에 뒤 단계의 번호는 바뀌므로 번호는 숫자인지만 본다.
    @Test
    void kept_developerPromptKeepsTheMissionSelectionOrder() {
        String head = String.join("\n",
                "  Pick it with this order, using only what you have already written:",
                "  1. topicAssessment.status is OFF_TOPIC: the first questionContract.requiredSlots slot,",
                "     or the first depthSlots slot when requiredSlots is empty.",
                "  2. structureAssessment.status is FRAGMENT, or any revision step has kind GRAMMAR_BLOCKING: no slot."
        );
        String number = "\n  \\d+\\. ";
        java.util.regex.Pattern selectionOrder = java.util.regex.Pattern.compile(
                java.util.regex.Pattern.quote(head)
                        + number + "(?s:[^\\n]*(?:\\n(?!  \\d+\\. )[^\\n]*)*)"
                        + number + java.util.regex.Pattern.quote("The first requiredSlots slot whose verdict is not SATISFIED.")
                        + number + java.util.regex.Pattern.quote("Any revision step has kind GRAMMAR_LOCAL: no slot.")
                        + number + java.util.regex.Pattern.quote(
                        "minimumDepthSlots is greater than 0 and fewer than minimumDepthSlots depthSlots slots are SATISFIED:")
                        + "\n     " + java.util.regex.Pattern.quote("the first depthSlots slot whose verdict is not SATISFIED.")
                        + number + java.util.regex.Pattern.quote("Otherwise: no slot.")
        );

        java.util.regex.Matcher matcher = selectionOrder.matcher(contract.developerPrompt());
        assertThat(matcher.find()).as("selection order with one step inserted after step 2").isTrue();
        String inserted = matcher.group().substring(head.length(),
                matcher.group().indexOf("The first requiredSlots slot whose verdict is not SATISFIED."));
        assertThat(inserted).as("inserted step").contains("previousAttempt");
    }

    @Test
    void kept_schemaKeepsTheGenerationOrder() {
        assertThat(keys(schema(routinePrompt()).path("properties"))).containsExactly(
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
    }

    @Test
    void kept_userPromptKeepsQuestionAndContractContent() throws Exception {
        JsonNode payload = objectMapper.readTree(contract.userPrompt(routinePrompt(), "I take a walk.", List.of()));

        assertThat(keys(payload.path("question")))
                .containsExactly("id", "difficulty", "questionEn", "questionKo", "topicCategory", "topicDetail");
        assertThat(payload.path("question").path("questionEn").asText()).isEqualTo("What do you usually do after work?");
        assertThat(keys(payload.path("questionContract"))).containsExactly(
                "answerMode",
                "requiredSlots",
                "depthSlots",
                "minimumDepthSlots",
                "expectedTense",
                "expectedPov",
                "slotContracts"
        );
        assertThat(payload.path("questionContract").path("requiredSlots"))
                .extracting(JsonNode::asText)
                .containsExactly("ACTION");
        assertThat(payload.path("questionContract").path("depthSlots"))
                .extracting(JsonNode::asText)
                .containsExactly("REASON");
        assertThat(keys(payload.path("questionContract").path("slotContracts"))).containsExactly("ACTION", "REASON");
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

    private static PromptHintDto hint() {
        return new PromptHintDto(
                "hint-1",
                "prompt-1",
                "VOCAB_PHRASE",
                "Useful phrases",
                1,
                List.of(new PromptHintItemDto(
                        "item-1", "hint-1", "PHRASE", "take a walk", "산책하다", "tip", "I take a walk.", "walk", 1
                ))
        );
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
                "prompt-spec-053-routine",
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
                "prompt-spec-053-goal",
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

    // 선택 슬롯이 없는 질문. 지금은 enrichmentSupport 선택지와 개수가 다른 질문과 달라진다.
    private static PromptDto requiredOnlyPrompt() {
        return new PromptDto(
                "prompt-spec-053-required-only",
                "Daily life",
                "Daily life",
                "Home",
                "I",
                "Where do you live?",
                "어디에 사나요?",
                "",
                null,
                new PromptTaskMetaDto(
                        "GENERAL_DESCRIPTION",
                        List.of("PLACE"),
                        List.of(),
                        "PRESENT_SIMPLE",
                        "FIRST_PERSON",
                        0,
                        contracts("PLACE")
                )
        );
    }
}
