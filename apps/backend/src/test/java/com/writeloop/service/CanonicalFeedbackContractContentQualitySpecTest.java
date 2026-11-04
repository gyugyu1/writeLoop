package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptSlotContractDto;
import com.writeloop.dto.PromptTaskMetaDto;
import org.assertj.core.api.SoftAssertions;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 작업 057 명세(01-main-spec.md)의 기대 결과 중 CanonicalFeedbackContract의 스키마와 개발자 프롬프트.
 *
 * <p>바뀔 동작은 이름이 changed_ 로 시작한다(지금 코드에서 실패해야 한다). 그대로 둘 동작은 kept_ 로 시작한다(지금 통과해야 한다).
 *
 * <p>프롬프트 문구는 명세가 글자를 정하지 않았으므로, 바뀔 동작은 명세의 뜻을 나타내는 낱말이 한 항목(문단) 안에 함께 있는지,
 * 겹친 규칙이 몇 번 나오는지로 본다. 그대로 둘 문구는 공백을 하나로 줄인 뒤 지금 문장이 그대로 있는지 본다.
 */
class CanonicalFeedbackContractContentQualitySpecTest {

    private static final List<String> ALL_SLOTS = List.of(
            "ACTION", "CHOICE", "GOAL", "PROBLEM", "OPINION", "PLAN", "SOLUTION", "ADVANTAGE", "DISADVANTAGE",
            "BEFORE_STATE", "NOW_STATE", "CHANGE_CAUSE", "ADDITIONAL_ACTION", "SPECIFIC_TIME", "PLACE", "REASON",
            "DETAIL", "EXAMPLE", "FEELING", "RESULT"
    );
    private static final Pattern REASON_WORD = Pattern.compile("\\breason\\b");
    private static final Pattern STATUS_WORD = Pattern.compile("\\bstatus\\b");

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CanonicalFeedbackContract contract = new CanonicalFeedbackContract(objectMapper);

    // ================= 바뀔 동작 3: 화면에 쓰지 않는 출력 줄이기 (스키마) =================

    // 명세 3: topicAssessment.reasonKo를 reason으로 바꾼다(스키마 키 이름도 reason). 이유를 먼저 쓰고 판정한다.
    @Test
    void changed_topicAssessmentHasAReasonFieldBeforeStatus() {
        JsonNode topic = schema(routinePrompt()).path("properties").path("topicAssessment");

        assertThat(keys(topic.path("properties"))).containsExactly("reason", "status");
        assertThat(topic.path("required")).extracting(JsonNode::asText).containsExactly("reason", "status");
        assertThat(topic.path("properties").path("reason").path("type").asText()).isEqualTo("string");
        assertThat(topic.path("properties").path("status").path("enum"))
                .extracting(JsonNode::asText)
                .containsExactly("ON_TOPIC", "OFF_TOPIC");
        assertThat(topic.path("additionalProperties").asBoolean(true)).isFalse();
    }

    // 명세 3: 추천 표현은 완료일 때 2~3개(스키마 최대 3). 완료가 아닐 때 빈 배열을 내는 053 규칙 때문에 최소는 0 그대로.
    @Test
    void changed_refinementExpressionsAllowAtMostThreeItems() {
        JsonNode refinements = schema(routinePrompt()).path("properties").path("refinementExpressions");

        assertThat(refinements.path("maxItems").asInt(-1)).isEqualTo(3);
        assertThat(refinements.path("minItems").asInt(-1)).isEqualTo(0);
    }

    // ================= 바뀔 동작 3: 화면에 쓰지 않는 출력 줄이기 (프롬프트) =================

    // 명세 3: 주제 판정 이유는 한국어 reasonKo가 아니라 reason이다. 채우는 순서 안내도 reason을 쓴 뒤 status를 정하게 한다.
    @Test
    void changed_topicAssessmentNoLongerAsksForAKoreanReason() {
        List<String> paragraphs = paragraphs(contract.developerPrompt());

        assertThat(paragraphs)
                .as("no paragraph about topicAssessment that still names reasonKo")
                .noneMatch(paragraph -> paragraph.contains("topicAssessment") && paragraph.contains("reasonKo"));
        assertThat(paragraphs)
                .as("a paragraph about topicAssessment that puts reason before status")
                .anyMatch(paragraph -> paragraph.contains("topicAssessment")
                        && inOrder(paragraph, REASON_WORD, STATUS_WORD));
    }

    // 명세 3: 짧은 영어 한 문장. 다른 판정 이유와 같은 길이 지시(지금 다른 이유에는 "one short English sentence of at most
    // 20 words"). 주제 판정 이유에도 그 지시가 닿는지, 주제를 말하는 문단에 길이·영어 지시가 함께 있는지로 본다.
    @Test
    void changed_topicReasonGetsTheSameShortEnglishLengthInstruction() {
        Pattern topicWord = Pattern.compile("(?i)\\btopic");

        assertThat(paragraphs(contract.developerPrompt()))
                .as("a paragraph that names the topic assessment and gives the short English reason instruction")
                .anyMatch(paragraph -> topicWord.matcher(paragraph).find()
                        && REASON_WORD.matcher(paragraph).find()
                        && (paragraph.contains("20 words")
                        || paragraph.contains("short") && paragraph.contains("English")));
    }

    // 명세 3: "2개 이상, 2개에서 멈추지 말라"에서 완료일 때 2~3개로.
    @Test
    void changed_refinementExpressionsAreTwoOrThreeWithoutTheDoNotStopRule() {
        String prompt = contract.developerPrompt();
        Pattern two = Pattern.compile("(?i)\\b(two|2)\\b");
        Pattern three = Pattern.compile("(?i)\\b(three|3)\\b");

        assertThat(prompt).doesNotContain("do not stop at two").doesNotContain("arbitrary count limit");
        assertThat(paragraphs(prompt))
                .as("a paragraph that asks for two to three refinementExpressions")
                .anyMatch(paragraph -> {
                    String body = withoutListNumber(paragraph);
                    return body.contains("refinementExpressions")
                            && two.matcher(body).find()
                            && three.matcher(body).find();
                });
    }

    // ================= 바뀔 동작 1: 중복 정리 =================

    // 명세 1: "학생 사실을 지어내지 말라"가 문장 구조 규칙에 두 번 -> 한 번.
    @Test
    void changed_structureRulesForbidInventingLearnerFactsAtMostOnce() {
        String structure = section(contract.developerPrompt(), "(?i)^structure.*rules:$");

        assertThat(count(Pattern.compile("(?i)\\binvent"), structure))
                .as("'invent' in the structure-assessment rules")
                .isLessThanOrEqualTo(1);
    }

    // 명세 1: 슬롯 규칙 앞뒤의 "더하거나 이름을 바꾸지 말라" -> 한 번.
    @Test
    void changed_slotRulesForbidRenamingSlotsAtMostOnce() {
        String slotRules = section(contract.developerPrompt(), "(?i)^slot.*rules:$");

        assertThat(count(Pattern.compile("(?i)\\brename\\b"), slotRules))
                .as("'rename' in the slot rules")
                .isLessThanOrEqualTo(1);
    }

    // 명세 1: "질문과 답을 함께 보고 판정" -> 한 번. 슬롯 규칙에서 질문을 보고 판정(judge/assess)하라는 문장 수로 본다.
    @Test
    void changed_slotRulesSayToJudgeWithTheQuestionAtMostOnce() {
        String slotRules = section(contract.developerPrompt(), "(?i)^slot.*rules:$");
        Pattern judge = Pattern.compile("(?i)\\b(judge|assess)\\b");

        List<String> judgeWithQuestion = sentences(slotRules).stream()
                .filter(sentence -> judge.matcher(sentence).find() && sentence.contains("question"))
                .toList();
        assertThat(judgeWithQuestion).as("slot-rule sentences that tell the model to judge slots with the question")
                .hasSizeLessThanOrEqualTo(1);
    }

    // 명세 1: "방금 쓴 근거로 판정"(생성 순서와 슬롯 규칙) -> 한 번.
    @Test
    void changed_verdictFromTheJustWrittenEvidenceIsStatedAtMostOnce() {
        Pattern decideFromEvidence = Pattern.compile("(?i)\\b(decide|base|judge)\\w*\\b.*\\bevidence\\b");

        List<String> matches = sentences(contract.developerPrompt()).stream()
                .filter(sentence -> decideFromEvidence.matcher(sentence).find())
                .toList();
        assertThat(matches).as("sentences that tell the model to decide the verdict from the evidence")
                .hasSizeLessThanOrEqualTo(1);
    }

    // 명세 1: "완료일 때만" 조건(생성 순서·내용 규칙·풍부하게 써 보기 규칙) -> 한 번.
    // 선택 순서 3단계의 "(the answer would not reach step 7)"은 완료 전용 출력 조건이 아니므로 세지 않는다.
    @Test
    void changed_completionOnlyConditionIsStatedInAtMostOneParagraph() {
        Pattern condition = Pattern.compile(
                "(?i)(\\breach(ed|es)\\s+step\\s*7|only when the answer is (already )?complete"
                        + "|only under the same condition|the same condition as)");

        List<String> stating = paragraphs(contract.developerPrompt()).stream()
                .filter(paragraph -> condition.matcher(paragraph).find())
                .toList();
        assertThat(stating).as("paragraphs that state the completion-only condition").hasSizeLessThanOrEqualTo(1);
    }

    // ================= 바뀔 동작 2: 헷갈리거나 낡은 문구 =================

    // 명세 2: "When status is OFF_TOPIC, return COMPLETE"를 structureAssessment.status를 COMPLETE로 한다는 뜻이 드러나게.
    @Test
    void changed_offTopicCompleteRuleNamesStructureAssessmentStatus() {
        Pattern complete = Pattern.compile("\\bCOMPLETE\\b");

        List<String> offTopicComplete = paragraphs(contract.developerPrompt()).stream()
                .filter(paragraph -> paragraph.contains("OFF_TOPIC") && complete.matcher(paragraph).find())
                .toList();
        assertThat(offTopicComplete).as("paragraphs that pair OFF_TOPIC with COMPLETE").isNotEmpty();
        assertThat(offTopicComplete)
                .as("every OFF_TOPIC + COMPLETE paragraph names structureAssessment")
                .allMatch(paragraph -> paragraph.contains("structureAssessment"));
    }

    // 명세 2: "Do not decide completion, mission type…"을 "백엔드가 완료와 미션을 정하고, 너는 같은 선택 순서로 지원 내용을 쓸
    // 슬롯만 고른다"는 뜻으로.
    @Test
    void changed_authorityRuleSaysTheBackendDecidesCompletionAndMissionWithTheSameSelectionOrder() {
        String prompt = contract.developerPrompt();

        assertThat(prompt).doesNotContain("Do not decide completion, mission type");
        assertThat(paragraphs(prompt))
                .as("a paragraph that says the backend decides completion and the mission, and the model follows the selection order")
                .anyMatch(paragraph -> paragraph.contains("backend")
                        && paragraph.contains("complet")
                        && paragraph.contains("mission")
                        && paragraph.contains("selection order"));
    }

    // 명세 2: "If only local grammar steps exist, … the backend keeps them below unresolved required content slots"를 지금
    // 선택 순서(055의 지난 미션 유지 단계 포함)와 맞게. 다시 쓴 답에서 지난 미션이 문장 교정이면 가벼운 문법이 필수 슬롯보다 앞선다.
    @Test
    void changed_localGrammarRuleNoLongerContradictsTheSelectionOrder() {
        String prompt = contract.developerPrompt();
        Pattern onlyLocal = Pattern.compile("(?i)only\\s+(local grammar|GRAMMAR_LOCAL)");

        assertThat(prompt).doesNotContainPattern("(?i)below\\s+(the\\s+)?unresolved\\s+required");
        assertThat(paragraphs(prompt).stream()
                .filter(paragraph -> onlyLocal.matcher(paragraph).find() && paragraph.contains("backend"))
                .toList())
                .as("an only-local-grammar rule that says where the backend puts it must follow the selection order")
                .allMatch(paragraph -> paragraph.contains("selection order") || paragraph.contains("previousAttempt"));
    }

    // ================= 바뀔 동작 4 A: 도움 자료 =================

    // 명세 4 A: 넣어볼 표현은 문장 틀 빈칸에 그대로 넣었을 때 완전히 맞는 영어가 되는 말만. 틀에 이미 있는 낱말(빈칸 앞뒤의
    // at·on·because·together 등)을 다시 넣지 않는다.
    @Test
    void changed_suggestedPhrasesMustFitTheBlankWithoutRepeatingFrameWords() {
        List<String> paragraphs = paragraphs(contract.developerPrompt());
        Pattern repeat = Pattern.compile("(?i)\\b(repeat|repeats|repeating|already)\\b");
        Pattern correct = Pattern.compile("(?i)\\b(correct|grammatical|complete)\\b");

        assertThat(paragraphs)
                .as("a paragraph that ties suggestedPhrases to the blank")
                .anyMatch(paragraph -> paragraph.contains("suggestedPhrase") && paragraph.contains("blank"));
        assertThat(paragraphs)
                .as("a paragraph that says the phrase in the blank must make correct English")
                .anyMatch(paragraph -> paragraph.contains("blank") && correct.matcher(paragraph).find());
        assertThat(paragraphs)
                .as("a paragraph that forbids repeating words the frame already has around the blank")
                .anyMatch(paragraph -> paragraph.contains("blank") && repeat.matcher(paragraph).find());
    }

    // 명세 4 A: 표현은 서로 다른 선택지다.
    @Test
    void changed_suggestedPhrasesAreDistinctChoices() {
        Pattern distinct = Pattern.compile("(?i)\\b(different|distinct|separate|alternative|alternatives)\\b");

        assertThat(paragraphs(contract.developerPrompt()))
                .as("a paragraph that asks for different suggestedPhrases choices")
                .anyMatch(paragraph -> paragraph.contains("suggestedPhrase") && distinct.matcher(paragraph).find());
    }

    // ================= 바뀔 동작 4 B: 완료 화면 자료 =================

    // 명세 4 B: 모범 답안은 학생이 쓴 사실과 내용을 모두 살리고 표현만 다듬는다. 학생이 말하지 않은 사실을 더하지 않는다.
    @Test
    void changed_modelAnswerKeepsEveryLearnerFactAndAddsNone() {
        List<String> paragraphs = paragraphs(contract.developerPrompt());
        Pattern keep = Pattern.compile("(?i)\\b(keep|keeps|preserve|preserves|retain|retains|include|includes|use|uses|cover|covers)\\b");
        Pattern facts = Pattern.compile("(?i)\\b(facts?|content|details?|everything)\\b");
        Pattern addNone = Pattern.compile("(?i)(\\b(do not|don't|never|must not|not)\\s+(add|invent)"
                + "|\\badd\\s+no\\b|\\bno\\s+(new|other|extra)\\s+facts?\\b|\\bunstated\\b"
                + "|did not (state|say|mention|write))");
        Pattern withoutAdding = Pattern.compile("(?i)\\bwithout adding\\b");

        // 지금 추천 표현 문단("…without adding new facts. An expression may come from modelAnswer…")은 모범 답안 규칙이 아니라서
        // "expression"이 든 문단의 "without adding"은 치지 않는다.
        assertThat(paragraphs)
                .as("a modelAnswer paragraph that keeps the learner's facts")
                .anyMatch(paragraph -> paragraph.contains("modelAnswer")
                        && keep.matcher(paragraph).find()
                        && facts.matcher(paragraph).find());
        assertThat(paragraphs)
                .as("a modelAnswer paragraph that forbids adding facts the learner did not state")
                .anyMatch(paragraph -> paragraph.contains("modelAnswer")
                        && (addNone.matcher(paragraph).find()
                        || withoutAdding.matcher(paragraph).find() && !paragraph.contains("expression")));
    }

    // ================= 바뀔 동작 4 C: 교정 설명 =================

    // 명세 4 C: 교정 이유는 그 단계에서 바뀐 것만, 무엇이 왜 틀렸는지 규칙이나 구별법으로 짧게.
    @Test
    void changed_correctionReasonExplainsOnlyThatStepsChangeAndWhyWithARule() {
        List<String> paragraphs = paragraphs(contract.developerPrompt());
        Pattern why = Pattern.compile("(?i)\\b(why|because)\\b");
        Pattern rule = Pattern.compile("(?i)(\\brules?\\b|\\bdistinguish|\\bdistinction\\b|\\btell\\b[^.]*\\bapart\\b)");
        Pattern only = Pattern.compile("(?i)(\\b(only|just)\\b|\\bother steps?\\b|\\banother step\\b)");

        assertThat(paragraphs)
                .as("a reasonKo paragraph that explains why with a rule or a way to tell forms apart")
                .anyMatch(paragraph -> paragraph.contains("reasonKo")
                        && why.matcher(paragraph).find()
                        && rule.matcher(paragraph).find());
        assertThat(paragraphs)
                .as("a reasonKo paragraph that limits the explanation to what that step changed")
                .anyMatch(paragraph -> paragraph.contains("reasonKo")
                        && only.matcher(paragraph).find()
                        && paragraph.contains("step"));
    }

    // 명세 4 C: "자연스럽게 연결" 같은 막연한 말과 문법 용어(동명사, 존재 구문 등)를 쓰지 않는다.
    @Test
    void changed_correctionReasonAvoidsVagueWordsAndGrammarTerms() {
        List<String> paragraphs = paragraphs(contract.developerPrompt());
        Pattern vague = Pattern.compile("(?i)(\\bvague\\b|\\bnaturally\\b|자연스럽)");
        Pattern grammarTerms = Pattern.compile("(?i)(grammar(tical)?\\s+(terms?|terminology|jargon|labels?)"
                + "|\\bterminology\\b|\\bjargon\\b|technical\\s+terms?|\\bgerunds?\\b|\\bexistential\\b"
                + "|동명사|존재\\s*구문|문법\\s*용어)");

        // 슬롯 판정의 "vague slot information"과 풍부하게 써 보기의 "vague wording"(GENERIC 슬롯)은 교정 설명 규칙이 아니다.
        assertThat(paragraphs)
                .as("a paragraph outside the slot rules that forbids vague wording such as 자연스럽게 연결")
                .anyMatch(paragraph -> vague.matcher(paragraph).find()
                        && !paragraph.contains("slot")
                        && !paragraph.contains("GENERIC"));
        assertThat(paragraphs)
                .as("a paragraph that forbids grammar terms such as 동명사 or 존재 구문")
                .anyMatch(paragraph -> grammarTerms.matcher(paragraph).find());
    }

    // 명세 4 C: 관계없는 오류를 한 단계에 묶지 말라는 규칙을 예와 함께. 지금의 "I'm like eat" 예는 한 단계로 묶는 예라서 치지 않는다.
    @Test
    void changed_unrelatedErrorsRuleComesWithAnExample() {
        List<String> paragraphs = paragraphs(contract.developerPrompt());
        Pattern unrelated = Pattern.compile("(?i)\\bunrelated\\s+(errors?|mistakes?|corrections?|issues?)\\b");
        Pattern example = Pattern.compile("(?i)(->|\\bexample\\b|\\be\\.g\\.)");

        boolean found = false;
        for (int index = 0; index < paragraphs.size(); index++) {
            if (!unrelated.matcher(paragraphs.get(index)).find()) {
                continue;
            }
            for (int near = index; near <= Math.min(index + 1, paragraphs.size() - 1); near++) {
                String candidate = paragraphs.get(near);
                if (example.matcher(candidate).find() && !candidate.contains("I'm like eat")) {
                    found = true;
                }
            }
        }
        assertThat(found).as("the unrelated-errors rule or the next paragraph carries a new example").isTrue();
    }

    // 명세 4 C: 학생에게 보이는 한국어 문장에 내부 슬롯 코드(ACTION 등)를 쓰지 말라는 규칙.
    @Test
    void changed_koreanTextMustNotUseInternalSlotCodes() {
        Pattern slotCode = Pattern.compile("(?i)(slot\\s+codes?|\\bACTION\\b)");
        Pattern negation = Pattern.compile("(?i)\\b(never|do not|don't|must not)\\b");

        assertThat(paragraphs(contract.developerPrompt()))
                .as("a paragraph that forbids internal slot codes in Korean text")
                .anyMatch(paragraph -> paragraph.contains("Korean")
                        && slotCode.matcher(paragraph).find()
                        && negation.matcher(paragraph).find());
    }

    // ================= 그대로 둘 동작: 스키마 =================

    // 053·055 스키마에서 바뀌는 곳은 topicAssessment와 refinementExpressions.maxItems뿐이다. 나머지는 내용과
    // properties 키 순서(생성 순서)가 지금과 같다.
    @Test
    void kept_schemaIsOtherwiseUnchanged() {
        JsonNode actual = schema(routinePrompt()).deepCopy();

        assertThat(keys(actual.path("properties"))).containsExactly(
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
        ((ObjectNode) actual.path("properties")).remove("topicAssessment");
        ((ObjectNode) actual.path("properties").path("refinementExpressions")).remove("maxItems");
        JsonNode expected = objectMapper.valueToTree(expectedSchemaWithoutTheChangedParts());

        assertThat(actual).isEqualTo(expected);
        assertThat(propertiesKeyOrder(actual, "$")).isEqualTo(propertiesKeyOrder(expected, "$"));
    }

    // 053: 스키마는 질문과 관계없이 글자 그대로 같다.
    @Test
    void kept_schemaIsLiterallyTheSameForQuestionsWithDifferentSlots() throws Exception {
        String routine = objectMapper.writeValueAsString(contract.schema(routinePrompt()));
        String goal = objectMapper.writeValueAsString(contract.schema(goalPrompt()));

        assertThat(goal).isEqualTo(routine);
    }

    // ================= 그대로 둘 동작: 사용자 프롬프트 순서 =================

    @Test
    void kept_userPromptOrderIsUnchanged() throws Exception {
        JsonNode first = objectMapper.readTree(contract.userPrompt(routinePrompt(), "I take a walk.", List.of()));
        JsonNode rewrite = objectMapper.readTree(contract.userPrompt(
                routinePrompt(),
                "I take a walk because it helps me relax.",
                List.of(),
                new PreviousAttemptContext(
                        "I take a walk.",
                        MissionKind.SLOT,
                        "REASON",
                        List.of(
                                new PreviousAttemptContext.SlotVerdict("ACTION", SlotAssessmentStatus.SATISFIED, "take a walk"),
                                new PreviousAttemptContext.SlotVerdict("REASON", SlotAssessmentStatus.MISSING, "")
                        )
                )
        ));

        assertThat(keys(first)).containsExactly("question", "questionContract", "promptHints", "learnerAnswer");
        assertThat(keys(rewrite))
                .containsExactly("question", "questionContract", "promptHints", "previousAttempt", "learnerAnswer");
        assertThat(keys(rewrite.path("previousAttempt"))).containsExactly("learnerAnswer", "mission", "slotAssessments");
        assertThat(keys(rewrite.path("previousAttempt").path("mission"))).containsExactly("kind", "slot");
        assertThat(keys(rewrite.path("previousAttempt").path("slotAssessments").get(0)))
                .containsExactly("slot", "verdict", "evidence");
        assertThat(keys(first.path("question")))
                .containsExactly("id", "difficulty", "questionEn", "questionKo", "topicCategory", "topicDetail");
        assertThat(keys(first.path("questionContract"))).containsExactly(
                "answerMode", "requiredSlots", "depthSlots", "minimumDepthSlots", "expectedTense", "expectedPov",
                "slotContracts");
    }

    // ================= 그대로 둘 동작: 프롬프트의 미션 선택 순서 =================

    @Test
    void kept_selectionOrderIsUnchanged() {
        String prompt = normalize(contract.developerPrompt());
        SoftAssertions softly = new SoftAssertions();
        for (String expected : List.of(
                "1. topicAssessment.status is OFF_TOPIC: the first questionContract.requiredSlots slot, "
                        + "or the first depthSlots slot when requiredSlots is empty. "
                        + "2. structureAssessment.status is FRAGMENT, or any revision step has kind GRAMMAR_BLOCKING: no slot. "
                        + "3. previousAttempt is present and steps 4 to 6 would pick a mission (the answer would not reach step 7): "
                        + "if previousAttempt.mission.kind is SLOT, its slot is in questionContract, and that slot's verdict is not SATISFIED, "
                        + "that slot; if previousAttempt.mission.kind is LANGUAGE_FIX and any revision step has kind GRAMMAR_LOCAL, no slot. "
                        + "Otherwise continue with step 4. "
                        + "4. The first requiredSlots slot whose verdict is not SATISFIED. "
                        + "5. Any revision step has kind GRAMMAR_LOCAL: no slot. "
                        + "6. minimumDepthSlots is greater than 0 and fewer than minimumDepthSlots depthSlots slots are SATISFIED: "
                        + "the first depthSlots slot whose verdict is not SATISFIED. "
                        + "7. Otherwise: no slot.",
                "When a slot is picked, return exactly one missionSupport item whose slot is that slot code. "
                        + "When no slot is picked, return an empty missionSupport array. Never write support for any other slot.",
                "The support must teach that exact slot, not a broader category.",
                "the first questionContract.depthSlots slot whose verdict is not SATISFIED and return exactly one item for it.",
                "when every depth slot is SATISFIED, return an empty enrichmentSupport array."
        )) {
            softly.assertThat(prompt).as("selection rule").contains(expected);
        }
        softly.assertAll();
    }

    // ================= 그대로 둘 동작: 슬롯 판정 규칙 =================

    // 정리 대상(더하거나 이름 바꾸지 말라, 질문과 함께 판정, 방금 쓴 근거로 판정)이 아닌 슬롯 판정 문장은 그대로다.
    @Test
    void kept_slotJudgmentRulesAreUnchanged() {
        assertContainsAll(normalize(contract.developerPrompt()), "slot rule", List.of(
                "slotAssessments contains exactly one item for every slot listed in questionContract.slotContracts and no other slot.",
                "definition is the shared slot meaning, semanticRole is this question's exact relationship, and satisfiedWhen is the "
                        + "paraphrase-tolerant fulfillment criterion. All three must be satisfied.",
                "Fixed context already supplied by the question, including time, place, situation, and referenced people or things, "
                        + "is inherited and does not need to be repeated in the learner answer.",
                "The learner answer needs to supply only the new slot information requested by the question. Do not inherit question "
                        + "context when the answer explicitly contradicts it or switches to a different context.",
                "Inherit only fixed context that the question supplies. Never treat the value a question asks the learner to provide "
                        + "as already supplied.",
                "A grammatical sentence, a matching keyword, or a mentioned entity does not satisfy a slot unless the answer expresses "
                        + "the question-specific semantic relationship.",
                "For concrete, learnable slot information, return a non-empty exact learner-answer substring in evidence and verdict SATISFIED.",
                "Evidence must be the smallest exact learner-answer span that, when interpreted together with the original question, "
                        + "proves the slot relationship. It must remain a literal learner-answer substring; never paraphrase or invent evidence.",
                "Copy slot evidence from the untouched learner answer before applying any language correction. When a language change "
                        + "overlaps the slot evidence, preserve the learner's incorrect original wording in evidence and put the correction "
                        + "only in languageAssessment.",
                "For learner answer \"I usually washes the dishes.\", valid ACTION evidence is \"washes the dishes\"; \"wash the dishes\" "
                        + "is invalid because it exists only after correction.",
                "For \"What challenge do you face at work or school?\", \"too many tasks\" can prove PROBLEM without repeating "
                        + "\"at work or school\". For \"Where do you live?\", the question does not supply a PLACE value, so the learner "
                        + "answer must still identify one.",
                "Concrete information may be brief. It is SATISFIED when the evidence itself gives a distinguishable answer to that slot.",
                "For vague slot information, such as something, somehow, more, some problems, life changed, differently, nice, or good, "
                        + "return a non-empty exact learner-answer substring in evidence and verdict GENERIC.",
                "When wording attempts the slot but only uses a placeholder, circular evaluation, or unspecified manner, use GENERIC, "
                        + "not MISSING. Use MISSING only when the answer contains no information attempting that slot.",
                "REASON: \"because it is nice\" is GENERIC; \"because blue reminds me of the ocean\" is SATISFIED.",
                "PLACE: \"a nice area\" is GENERIC; \"western Seoul near a park\" is SATISFIED.",
                "BEFORE_STATE: \"used to meet differently\" is GENERIC; \"used to meet in person\" is SATISFIED.",
                "When the answer provides no information for the slot, return an empty evidence string and verdict MISSING.",
                "When previousAttempt is present, keep judgments stable: if the evidence previousAttempt recorded for a slot still "
                        + "appears unchanged in the learner answer and the surrounding words do not change its meaning, keep that slot's "
                        + "previous verdict. Re-judge a slot only when the learner changed, added, or removed the wording for it."
        ));
    }

    // ================= 그대로 둘 동작: 주제·문장 구조·문장 교정 규칙 중 바꾸지 않는 문장 =================

    @Test
    void kept_topicStructureAndLanguageRulesOutsideTheChangeAreUnchanged() {
        assertContainsAll(normalize(contract.developerPrompt()), "topic/structure/language rule", List.of(
                "ON_TOPIC means the answer directly addresses the question or clearly contributes relevant information.",
                "OFF_TOPIC means the answer is about a different subject and cannot be repaired by adding one requested detail.",
                "A short but relevant answer is ON_TOPIC. A grammatically broken but relevant answer is ON_TOPIC.",
                "set every configured slot to empty evidence and verdict MISSING. Unrelated facts never satisfy question slots.",
                "structureAssessment.status is COMPLETE when every answer-bearing segment forms an independent sentence.",
                "structureAssessment.status is FRAGMENT when at least one answer-bearing segment cannot stand as a sentence, for example "
                        + "a noun phrase, a bare -ing phrase, a subordinate clause beginning with because, or a trailing phrase such as "
                        + "\"At the gym.\"",
                "An imperative sentence can be structurally complete. However, when the question asks the learner to describe the "
                        + "learner's own action or thought, an imperative reading that changes the actor to implicit \"you\" does not make "
                        + "the answer complete. In that case, set structureAssessment.status to FRAGMENT and minimally restore the learner "
                        + "as the subject.",
                "Diagnose sentence structure only. A complete but short or content-thin sentence is still COMPLETE.",
                "For an ON_TOPIC FRAGMENT, at least one revision step must restore the minimum structure needed to form complete "
                        + "sentences and use kind STRUCTURE.",
                "When structure and grammar changes overlap in the same phrase, include them in one STRUCTURE step. When they affect "
                        + "separate phrases, use separate steps.",
                "languageAssessment.revisionSteps is the only authoritative language revision.",
                "Each step's answerAfter must contain the complete learner answer after applying exactly one pedagogical correction "
                        + "group. It must never be a fragment, patch, example, or model answer.",
                "The first answerAfter starts from the untouched learner answer. Every later answerAfter starts from the previous "
                        + "step's complete answer and must preserve all earlier corrections exactly.",
                "A later step must never revise, expand, or revert text already corrected by an earlier step. If corrections overlap, "
                        + "combine them into the earlier, higher-priority step.",
                "Every step must make a real change from the previous complete answer.",
                "If no language correction is needed, return an empty revisionSteps array.",
                "Return at most 25 steps. If more than 25 correction groups are possible, apply and explain only the first 25 under "
                        + "the priority below and leave every unselected error unchanged.",
                "One step may contain multiple low-level changed spans only when they form one local grammatical construction that "
                        + "needs one teaching explanation. Include the unchanged bridge words in that correction group.",
                "Example: \"I'm like eat\" -> \"I like eating\" is one step even though \"like\" itself stays unchanged.",
                "Order steps by kind: STRUCTURE, then GRAMMAR_BLOCKING, then GRAMMAR_LOCAL. Within the same kind, prefer left-to-right "
                        + "order for readability, but never reorder a correction in a way that changes or reverts an earlier answerAfter.",
                "Use kind STRUCTURE only for a change required to turn a fragment or broken clause connection into a complete sentence.",
                "Use kind GRAMMAR_BLOCKING when a real grammar problem prevents reliable understanding.",
                "Use kind GRAMMAR_LOCAL when meaning is clear but the wording is grammatically unacceptable in standard English.",
                "If one correction group inseparably contains structure and grammar repairs, classify the step as STRUCTURE. Otherwise "
                        + "prefer GRAMMAR_BLOCKING over GRAMMAR_LOCAL within one overlapping group.",
                "When at least one structural or blocking step exists, include local grammar steps too, up to the 25-step cap.",
                "Before returning a step, check whether the original wording can remain unchanged as acceptable English. If it can, "
                        + "do not revise it.",
                "A difference in naturalness, idiomatic preference, collocation preference, register, concision, or specificity alone "
                        + "is not a grammar error. Put a useful optional alternative in refinementExpressions instead.",
                "For example, \"practice a five-minute conversation\" is acceptable. Do not change it to \"practice having a "
                        + "five-minute conversation\" as a grammar correction. If useful, offer the latter only as an optional "
                        + "refinementExpression.",
                "Real errors such as \"Companies should protects workers\" -> \"Companies should protect workers\" and \"I am live in "
                        + "Seoul\" -> \"I live in Seoul\" use GRAMMAR_LOCAL."
        ));
    }

    // ================= 그대로 둘 동작: 입력 설명·지원 내용·완료 화면 규칙 중 바꾸지 않는 문장 =================

    @Test
    void kept_inputSupportAndContentRulesOutsideTheChangeAreUnchanged() {
        assertContainsAll(normalize(contract.developerPrompt()), "input/support/content rule", List.of(
                "You are WriteLoop's English writing coach and diagnostic engine. Return only data that satisfies the supplied JSON schema.",
                "Fill the response in the schema's field order. Each field may rely only on what you have already written:",
                "languageAssessment.revisionSteps: zero to 25 cumulative steps.",
                "slotAssessments: one item for every slot in questionContract.slotContracts, exactly once each.",
                "missionSupport: teaching support for at most one slot, chosen by the selection order below.",
                "one short English sentence of at most 20 words",
                "question.difficulty is the learner's level: I = beginner (one or two very short sentences, basic words), A = easy "
                        + "(simple sentences), B = intermediate (reasons and examples), C = challenge (comparison, contrast, and richer "
                        + "linking). Match modelAnswer length and vocabulary, skeletons, suggestedPhrases, and refinementExpressions to "
                        + "this level.",
                "promptHints are the hints the learner could see while writing: starter sentences, words, phrases, structures, details, "
                        + "and linkers. They are not part of the learner answer and never count as slot evidence. Prefer their wording in "
                        + "suggestedPhrases when it fits the target slot, and do not recommend a hint the learner already used as a "
                        + "refinementExpression.",
                "previousAttempt appears only when this answer is a rewrite. It holds the learner's previous answer, the mission the "
                        + "learner was given for it (kind and slot), and the slot verdicts with evidence from that attempt. It is context, "
                        + "never slot evidence: judge only the current learnerAnswer.",
                "Do not return a separate revisedAnswer or issues array. The backend derives the final revised answer and visible "
                        + "correction cards from revisionSteps.",
                "Write it as an invitation to add that one detail to the complete answer, for example the title "
                        + "\"장소를 넣어 더 풍부하게 써 보세요\". Never ask the learner to fix anything else.",
                "For a GENERIC depth slot, invite the learner to make that vague wording specific instead of adding a new detail.",
                "Leave the new detail as a blank placeholder in skeletonEn and skeletonKo; never invent learner facts.",
                "skeletonEn and skeletonKo are both required and must align in meaning.",
                "skeletonKo must be a Korean-language scaffold containing Hangul, not an English scaffold copied from skeletonEn. "
                        + "Translate the fixed wording into Korean and preserve the blank placeholder.",
                "strengths contains at most one specific, honest strength in Korean.",
                "modelAnswerKo is the faithful Korean translation of modelAnswer.",
                "modelAnswer is written before refinementExpressions. Compare that modelAnswer with the learner answer and select "
                        + "short, reusable expressions that can enrich the learner's existing meaning without adding new facts. An "
                        + "expression may come from modelAnswer only when it is compatible with the learner's stated meaning and facts.",
                "one useful vocabulary, collocation, or phrasal expression",
                "one sentence frame, connector, emphasis, contrast, reason, result, or detail-building expression",
                "Do not recommend wording the learner already used, near-duplicates, an entire model answer, or an expression that "
                        + "requires the learner to claim an unstated experience, time, place, reason, feeling, or result.",
                "Keep each expression appropriate for the question difficulty.",
                "Do not repeat a language revision step in refinementExpressions or describe an optional refinement as a required "
                        + "correction."
        ));
    }

    // ================= 그대로 둘 동작: 정리한 규칙이 사라지지 않음 =================

    // 정리 1은 한 번으로 줄이는 것이고 규칙을 없애는 것이 아니다. 055의 이유 -> 판정 순서와 053의 완료 전용 조건도 남는다.
    @Test
    void kept_cleanedUpRulesAreStillStated() {
        String prompt = contract.developerPrompt();
        List<String> paragraphs = paragraphs(prompt);
        String structure = section(prompt, "(?i)^structure.*rules:$");
        String slotRules = section(prompt, "(?i)^slot.*rules:$");
        Pattern judge = Pattern.compile("(?i)\\b(judge|assess)\\b");
        Pattern onlyLocal = Pattern.compile("(?i)only\\s+(local grammar|GRAMMAR_LOCAL)");
        SoftAssertions softly = new SoftAssertions();

        softly.assertThat(normalize(structure)).as("structure rules keep the learner's facts in answerAfter")
                .containsPattern("(?i)\\bfacts\\b");
        softly.assertThat(slotRules).as("slot rules still forbid renaming slots").containsPattern("(?i)\\brename\\b");
        softly.assertThat(sentences(slotRules))
                .as("slot rules still tell the model to judge slots with the question")
                .anyMatch(sentence -> judge.matcher(sentence).find() && sentence.contains("question"));
        softly.assertThat(paragraphs)
                .as("structure reason before status")
                .anyMatch(paragraph -> paragraph.contains("structureAssessment") && inOrder(paragraph, REASON_WORD, STATUS_WORD));
        softly.assertThat(paragraphs)
                .as("slot evidence, then reason, then verdict")
                .anyMatch(paragraph -> inOrder(paragraph,
                        Pattern.compile("\\bevidence\\b"), REASON_WORD, Pattern.compile("\\bverdict\\b")));
        softly.assertThat(paragraphs)
                .as("completion-only outputs are tied to step 7")
                .anyMatch(paragraph -> paragraph.contains("step 7")
                        && (paragraph.contains("modelAnswer") || paragraph.contains("refinementExpressions")
                        || paragraph.contains("enrichmentSupport")));
        softly.assertThat(paragraphs)
                .as("OFF_TOPIC answers return an empty revisionSteps array")
                .anyMatch(paragraph -> paragraph.contains("OFF_TOPIC") && paragraph.contains("revisionSteps")
                        && paragraph.contains("empty"));
        softly.assertThat(paragraphs)
                .as("only-local-grammar answers are still diagnosed")
                .anyMatch(paragraph -> onlyLocal.matcher(paragraph).find()
                        && Pattern.compile("(?i)\\b(diagnose|return|include)").matcher(paragraph).find());
        softly.assertThat(paragraphs)
                .as("refinement examples use the learner's meaning")
                .anyMatch(paragraph -> paragraph.contains("exampleEn") && paragraph.contains("meaning"));
        softly.assertAll();
    }

    // ---- helpers ----

    private JsonNode schema(PromptDto prompt) {
        return objectMapper.valueToTree(contract.schema(prompt));
    }

    private static void assertContainsAll(String normalizedPrompt, String label, List<String> sentences) {
        SoftAssertions softly = new SoftAssertions();
        for (String sentence : sentences) {
            softly.assertThat(normalizedPrompt).as(label).contains(normalize(sentence));
        }
        softly.assertAll();
    }

    private static String normalize(String text) {
        return text.replaceAll("\\s+", " ").trim();
    }

    private static List<String> keys(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    // 스키마 안의 모든 properties 객체의 키 순서. 구조화 출력은 이 순서로 생성된다.
    private static Map<String, List<String>> propertiesKeyOrder(JsonNode node, String path) {
        Map<String, List<String>> orders = new LinkedHashMap<>();
        collectPropertiesKeyOrder(node, path, orders);
        return orders;
    }

    private static void collectPropertiesKeyOrder(JsonNode node, String path, Map<String, List<String>> orders) {
        if (node == null) {
            return;
        }
        if (node.isObject()) {
            if (node.path("properties").isObject()) {
                orders.put(path + ".properties", keys(node.path("properties")));
            }
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                collectPropertiesKeyOrder(field.getValue(), path + "." + field.getKey(), orders);
            }
        } else if (node.isArray()) {
            for (int index = 0; index < node.size(); index++) {
                collectPropertiesKeyOrder(node.get(index), path + "[" + index + "]", orders);
            }
        }
    }

    private static int count(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        int count = 0;
        while (matcher.find()) {
            count++;
        }
        return count;
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

    private static String withoutListNumber(String paragraph) {
        return paragraph.replaceFirst("^\\d+\\.\\s+", "");
    }

    // 공백을 하나로 줄인 글을 문장 끝(. ! ?) 뒤의 공백에서 나눈다.
    private static List<String> sentences(String text) {
        List<String> sentences = new ArrayList<>();
        for (String sentence : normalize(text).split("(?<=[.!?])\\s+")) {
            if (!sentence.isBlank()) {
                sentences.add(sentence);
            }
        }
        return sentences;
    }

    // 개발자 프롬프트의 한 절. 들여 쓰지 않았고 ":"로 끝나며 "- ", "* ", "1. "로 시작하지 않는 줄이 절 제목이다.
    private static String section(String prompt, String headerRegex) {
        Pattern header = Pattern.compile(headerRegex);
        StringBuilder body = null;
        for (String line : prompt.split("\n")) {
            boolean isHeader = isSectionHeader(line);
            if (body == null) {
                if (isHeader && header.matcher(line.trim()).matches()) {
                    body = new StringBuilder();
                }
                continue;
            }
            if (isHeader) {
                break;
            }
            body.append(line).append('\n');
        }
        assertThat(body).as("developer prompt section %s", headerRegex).isNotNull();
        return body.toString();
    }

    private static boolean isSectionHeader(String line) {
        if (line.isEmpty() || Character.isWhitespace(line.charAt(0))) {
            return false;
        }
        String trimmed = line.trim();
        return trimmed.endsWith(":")
                && !trimmed.startsWith("-")
                && !trimmed.startsWith("*")
                && !trimmed.matches("^\\d+\\..*");
    }

    // 개발자 프롬프트를 항목 단위로 나눈다(055 CanonicalFeedbackContractPreviousAttemptSpecTest와 같은 방법).
    // "- ", "* ", "1. "로 시작하는 줄이나 빈 줄, ":"로 끝나는 줄 뒤에서 새 항목이 시작하고, 들여 쓴 이어지는 줄은 앞 항목에 붙인다.
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

    // 지금(053·055) 스키마에서 바뀌는 두 곳(topicAssessment, refinementExpressions.maxItems)을 뺀 모양.
    private static Map<String, Object> expectedSchemaWithoutTheChangedParts() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("structureAssessment", objectSchema(ordered(
                "reason", stringSchema(),
                "status", enumString(List.of("COMPLETE", "FRAGMENT"))
        )));
        properties.put("languageAssessment", objectSchema(ordered(
                "revisionSteps", arraySchema(objectSchema(ordered(
                        "kind", enumString(List.of("STRUCTURE", "GRAMMAR_BLOCKING", "GRAMMAR_LOCAL")),
                        "answerAfter", stringSchema(),
                        "reasonKo", stringSchema()
                )), 0, 25)
        )));
        properties.put("slotAssessments", arraySchema(objectSchema(ordered(
                "slot", enumString(ALL_SLOTS),
                "evidence", stringSchema(),
                "reason", stringSchema(),
                "verdict", enumString(List.of("SATISFIED", "GENERIC", "MISSING"))
        )), 0, null));
        properties.put("missionSupport", arraySchema(supportSchema(), 0, 1));
        properties.put("enrichmentSupport", arraySchema(supportSchema(), 0, 1));
        properties.put("modelAnswer", stringSchema());
        properties.put("modelAnswerKo", stringSchema());
        properties.put("refinementExpressions", arraySchema(objectSchema(ordered(
                "expression", stringSchema(),
                "meaningKo", stringSchema(),
                "guidanceKo", stringSchema(),
                "exampleEn", stringSchema()
        )), 0, null));
        properties.put("strengths", arraySchema(stringSchema(), 0, 1));
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("additionalProperties", false);
        schema.put("properties", properties);
        schema.put("required", List.of(
                "topicAssessment", "structureAssessment", "languageAssessment", "slotAssessments", "missionSupport",
                "enrichmentSupport", "modelAnswer", "modelAnswerKo", "refinementExpressions", "strengths"
        ));
        return schema;
    }

    private static Map<String, Object> supportSchema() {
        return objectSchema(ordered(
                "slot", enumString(ALL_SLOTS),
                "title", stringSchema(),
                "whyKo", stringSchema(),
                "instructionKo", stringSchema(),
                "skeletonEn", stringSchema(),
                "skeletonKo", stringSchema(),
                "suggestedPhrases", arraySchema(objectSchema(ordered(
                        "phrase", stringSchema(),
                        "meaningKo", stringSchema()
                )), 2, 4)
        ));
    }

    private static Map<String, Object> objectSchema(Map<String, Object> properties) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("additionalProperties", false);
        schema.put("properties", properties);
        schema.put("required", List.copyOf(properties.keySet()));
        return schema;
    }

    private static Map<String, Object> stringSchema() {
        return ordered("type", "string");
    }

    private static Map<String, Object> enumString(List<String> values) {
        return ordered("type", "string", "enum", values);
    }

    private static Map<String, Object> arraySchema(Object items, int minItems, Integer maxItems) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "array");
        schema.put("items", items);
        schema.put("minItems", minItems);
        if (maxItems != null) {
            schema.put("maxItems", maxItems);
        }
        return schema;
    }

    private static Map<String, Object> ordered(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int index = 0; index < keyValues.length; index += 2) {
            map.put((String) keyValues[index], keyValues[index + 1]);
        }
        return map;
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
                "prompt-spec-057-routine",
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
                "prompt-spec-057-goal",
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
