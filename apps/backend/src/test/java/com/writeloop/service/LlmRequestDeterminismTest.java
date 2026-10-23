package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptSlotContractDto;
import com.writeloop.dto.PromptTaskMetaDto;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * LLM 요청의 스키마와 프롬프트는 JSON 키 순서가 모델의 생성·읽기 순서가 된다.
 * Map.of 같은 팩토리는 JVM을 시작할 때마다 순서가 바뀌므로, 요청 구조가 항상 같은 순서로 만들어지는지 검사한다.
 */
class LlmRequestDeterminismTest {

    private static final Path MAIN_SOURCE_DIR = Path.of("src/main/java/com/writeloop");
    // LLM 요청을 만드는 코드와, 순서가 결과를 바꾸는 코치 질의 분석 표
    private static final List<String> LLM_REQUEST_BUILDER_SOURCES = List.of(
            "service/CanonicalFeedbackContract.java",
            "service/FeedbackLearningContractPolicy.java",
            "service/OpenAiStructuredOutputSupport.java",
            "service/DiaryFeedbackPromptSupport.java",
            "service/OpenAiCoachClient.java",
            "service/CoachQueryAnalyzer.java",
            "service/OpenAiNowInEnglishCoachFeedbackClient.java",
            "service/OpenAiNowInEnglishReflectionClient.java",
            "util/ExpressionTagSupport.java"
    );
    // java.util.Map.of(처럼 패키지 이름을 붙인 호출도 잡는다. OrderedMaps.of(나 LinkedHashMap 등은 잡지 않는다.
    // objectSchema처럼 결과를 LinkedHashMap으로 옮겨 담는 코드는 구조 검사로 알 수 없으므로, 이 소스 검사가 최종 방어선이다.
    private static final Pattern RANDOM_ORDER_FACTORY =
            Pattern.compile("(?<![\\w$])(Map\\.(of|ofEntries|copyOf)|Set\\.(of|copyOf))\\(");

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CanonicalFeedbackContract contract = new CanonicalFeedbackContract(objectMapper);
    private final FeedbackLearningContractPolicy policy = new FeedbackLearningContractPolicy();

    @Test
    void canonicalSchemaUsesDeclaredFieldOrder() {
        JsonNode properties = objectMapper.valueToTree(contract.schema(prompt())).path("properties");

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
        assertThat(keys(properties.path("topicAssessment").path("properties")))
                .containsExactly("reasonKo", "status");
        assertThat(keys(properties.path("languageAssessment").path("properties")
                .path("revisionSteps").path("items").path("properties")))
                .containsExactly("kind", "answerAfter", "reasonKo");
        assertThat(keys(properties.path("refinementExpressions").path("items").path("properties")))
                .containsExactly("expression", "meaningKo", "guidanceKo", "exampleEn");

        JsonNode slots = properties.path("slotAssessments").path("properties");
        assertThat(keys(slots)).containsExactly("ACTION", "REASON");
        JsonNode slot = slots.path("ACTION").path("properties");
        assertThat(keys(slot)).containsExactly("evidence", "verdict");
        JsonNode support = properties.path("missionSupport").path("items").path("properties");
        assertThat(keys(support)).containsExactly(
                "slot",
                "title",
                "whyKo",
                "instructionKo",
                "skeletonEn",
                "skeletonKo",
                "suggestedPhrases"
        );
        assertThat(keys(support.path("suggestedPhrases").path("items").path("properties")))
                .containsExactly("phrase", "meaningKo");
    }

    @Test
    void canonicalUserPromptUsesDeclaredFieldOrder() throws Exception {
        JsonNode userPrompt = objectMapper.readTree(contract.userPrompt(prompt(), "I go home.", List.of()));

        assertThat(keys(userPrompt)).containsExactly("question", "questionContract", "learnerAnswer", "promptHints");
        assertThat(keys(userPrompt.path("question"))).containsExactly(
                "id",
                "difficulty",
                "questionEn",
                "questionKo",
                "topicCategory",
                "topicDetail"
        );
        JsonNode questionContract = userPrompt.path("questionContract");
        assertThat(keys(questionContract)).containsExactly(
                "answerMode",
                "requiredSlots",
                "depthSlots",
                "minimumDepthSlots",
                "expectedTense",
                "expectedPov",
                "slotContracts"
        );
        assertThat(keys(questionContract.path("slotContracts"))).containsExactly("ACTION", "REASON");
        assertThat(keys(questionContract.path("slotContracts").path("ACTION")))
                .containsExactly("definition", "semanticRole", "satisfiedWhen");
    }

    @Test
    void openAiRequestBodyKeepsSchemaFieldOrder() throws Exception {
        String body = OpenAiStructuredOutputSupport.buildResponsesRequestBody(
                objectMapper,
                "test-model",
                contract.developerPrompt(),
                contract.userPrompt(prompt(), "I go home.", List.of()),
                "writeloop_feedback_canonical",
                contract.schema(prompt()),
                "low"
        );
        JsonNode schema = objectMapper.readTree(body).path("text").path("format").path("schema");

        assertThat(keys(schema.path("properties").path("topicAssessment").path("properties")))
                .containsExactly("reasonKo", "status");
        assertThat(keys(schema.path("properties").path("slotAssessments").path("properties")
                .path("ACTION").path("properties")))
                .containsExactly("evidence", "verdict");
        List<String> required = new ArrayList<>();
        schema.path("required").forEach(item -> required.add(item.asText()));
        assertThat(required).containsExactlyElementsOf(keys(schema.path("properties")));
    }

    @Test
    void llmRequestStructuresContainNoRandomOrderMaps() {
        assertNoRandomOrderCollections(contract.schema(prompt()), "canonicalSchema");
        assertNoRandomOrderCollections(policy.promptContract(prompt()), "questionContract");
        assertNoRandomOrderCollections(DiaryFeedbackPromptSupport.jsonSchema(false), "diarySchema");
        assertNoRandomOrderCollections(DiaryFeedbackPromptSupport.jsonSchema(true), "diarySchemaWithFullDiaries");
    }

    @Test
    void llmRequestBuildersDoNotUseRandomOrderFactories() throws Exception {
        for (String fileName : LLM_REQUEST_BUILDER_SOURCES) {
            String source = Files.readString(MAIN_SOURCE_DIR.resolve(fileName), StandardCharsets.UTF_8);
            Matcher matcher = RANDOM_ORDER_FACTORY.matcher(source);
            boolean found = matcher.find();
            assertThat(found)
                    .as("%s must build LLM requests with OrderedMaps instead of %s",
                            fileName, found ? matcher.group() : "")
                    .isFalse();
        }
    }

    private static void assertNoRandomOrderCollections(Object node, String path) {
        if (node instanceof Map<?, ?> map) {
            assertThat(map.getClass().getName())
                    .as("%s must preserve key order", path)
                    .doesNotStartWith("java.util.ImmutableCollections");
            map.forEach((key, value) -> assertNoRandomOrderCollections(value, path + "." + key));
            return;
        }
        if (node instanceof Collection<?> collection) {
            if (collection instanceof Set<?>) {
                assertThat(collection.getClass().getName())
                        .as("%s must preserve element order", path)
                        .doesNotStartWith("java.util.ImmutableCollections");
            }
            int index = 0;
            for (Object item : collection) {
                assertNoRandomOrderCollections(item, path + "[" + index++ + "]");
            }
        }
    }

    private static List<String> keys(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    private static PromptDto prompt() {
        return new PromptDto(
                "prompt-1",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you usually do after work and why?",
                "퇴근 후 보통 무엇을 하고 왜 그렇게 하나요?",
                "",
                null,
                new PromptTaskMetaDto(
                        "ROUTINE",
                        List.of("ACTION"),
                        List.of("REASON"),
                        "PRESENT_SIMPLE",
                        "FIRST_PERSON",
                        1,
                        Map.of(
                                "ACTION", new PromptSlotContractDto(
                                        "The learner's usual action after work.",
                                        "The answer states an action the learner usually performs after work.",
                                        "학습자가 퇴근 후 하는 행동.",
                                        "행동을 분명히 제시하면 충족."
                                ),
                                "REASON", new PromptSlotContractDto(
                                        "The learner's reason for the usual action.",
                                        "The answer gives a concrete motivation that explains why the learner performs the action.",
                                        "그 행동을 하는 이유.",
                                        "구체적인 이유를 제시하면 충족."
                                )
                        )
                )
        );
    }
}
