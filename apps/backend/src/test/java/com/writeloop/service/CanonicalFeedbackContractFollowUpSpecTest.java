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
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 작업 057 4단계 뒤 결정(11-main-decision.md)으로 더한 테스트 중 개발자 프롬프트와 스키마.
 *
 * <p>결정 11-2: 완료 전용 출력(053)이 미완료 응답에서도 나오지 않게, 생성 순서의 6~8 줄이 그 출력을 "완료일 때만"과 묶어 적고,
 * 미션 선택 순서 7단계 뒤에 "7단계만 완료이고 1~6단계(슬롯을 고르지 않는 2·3·5단계 포함)는 완료가 아니다"는 뜻을 둔다.
 * 완료 조건(step 7)을 자세히 적는 문단은 내용 규칙 한 곳 그대로이고(CanonicalFeedbackContractContentQualitySpecTest의
 * changed_completionOnlyConditionIsStatedInAtMostOneParagraph), 선택 순서 문구는 그대로다(같은 클래스의 kept_selectionOrderIsUnchanged).
 * 그래서 아래 테스트는 "reached step 7", "only when the answer is complete" 같은 그 테스트의 표지를 요구하지 않는다.
 *
 * <p>결정 11-3: 넣어볼 표현(suggestedPhrases)의 개수 문구("two or three" 등)를 빼고, 개수는 스키마(2~4개)대로 둔다. 명세 4 A의
 * "서로 다른 선택지, 난이도에 맞음"은 남는다. 스키마 최소와 같은 "at least two"는 이번 작업 전부터 있던 규칙이라 막지 않는다.
 *
 * <p>바뀔 동작은 이름이 changed_ 로 시작한다(지금 코드에서 실패해야 한다). 그대로 둘 동작은 kept_ 로 시작한다(지금 통과해야 한다).
 * 문단 나누기는 CanonicalFeedbackContractContentQualitySpecTest와 같은 방법이다.
 */
class CanonicalFeedbackContractFollowUpSpecTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CanonicalFeedbackContract contract = new CanonicalFeedbackContract(objectMapper);

    // ================= 결정 11-2: 완료 전용 출력은 완료일 때만 =================

    // 생성 순서(스키마 필드 순서 안내)에서 완료 전용 출력(풍부하게 써 보기, 모범 답안, 추천 표현)을 말하는 항목이
    // "완료 답일 때만 쓰고 아니면 비운다"를 함께 적는다. 지금은 "Fields 6 to 8 are completion-only output (see Content rules);
    // otherwise return them empty."로 조건 없이 참조만 한다.
    @Test
    void changed_generationOrderWritesCompletionOnlyOutputOnlyForACompleteAnswer() {
        List<String> order = paragraphs(section(contract.developerPrompt(), "(?i)^fill the response in the schema's field order.*:$"));
        Pattern completionOnlyField = Pattern.compile(
                "\\b(enrichmentSupport|modelAnswer|refinementExpressions)\\b|\\b6 to 8\\b|completion-only");
        // "complete"만 센다("completion"은 낱말 경계 때문에 걸리지 않는다). 같은 문장(. 이나 ; 앞) 안에서 only 뒤에 와야 한다.
        Pattern onlyWhenComplete = Pattern.compile("(?i)\\bonly\\b[^.;]*\\bcomplete\\b");
        Pattern otherwiseEmpty = Pattern.compile("(?i)\\botherwise\\b[^.;]*\\bempty\\b");

        assertThat(order)
                .as("a field-order item that writes the completion-only output only for a complete answer and otherwise empty")
                .anyMatch(paragraph -> completionOnlyField.matcher(paragraph).find()
                        && onlyWhenComplete.matcher(paragraph).find()
                        && otherwiseEmpty.matcher(paragraph).find());
    }

    // 미션 선택 순서 7단계 뒤(같은 항목이나 그 뒤의 미션 지원 규칙 안)에 "7단계만 완료이고, 1~6단계는 완료가 아니며, 슬롯을 고르지
    // 않는 2·3·5단계도 마찬가지"라는 뜻이 있다.
    @Test
    void changed_selectionOrderSaysOnlyStep7IsCompleteAndNoSlotStepsAreNot() {
        List<String> mission = paragraphs(section(contract.developerPrompt(), "(?i)^mission support rules:$"));
        int step7 = -1;
        for (int index = 0; index < mission.size(); index++) {
            if (mission.get(index).startsWith("7. ")) {
                step7 = index;
                break;
            }
        }
        assertThat(step7).as("selection order step 7 in the mission support rules").isGreaterThanOrEqualTo(0);
        List<String> afterStep7 = mission.subList(step7, mission.size());
        Pattern onlyStep7Complete = Pattern.compile("(?i)\\bonly\\s+step\\s*7\\b[^.]*\\bcomplete\\b");
        Pattern steps1To6NotComplete = Pattern.compile(
                "(?i)\\bsteps?\\s+1\\s*(to|-|–|through)\\s*6\\b[^.]*\\b(not\\s+complete|incomplete)\\b");
        Pattern noSlotSteps = Pattern.compile("(?i)\\b2\\b[^.]*\\b3\\b[^.]*\\b5\\b[^.]*\\bno\\s+slot\\b");

        assertThat(afterStep7).as("only step 7 means the answer is complete")
                .anyMatch(paragraph -> onlyStep7Complete.matcher(paragraph).find());
        assertThat(afterStep7).as("steps 1 to 6 mean the answer is not complete")
                .anyMatch(paragraph -> steps1To6NotComplete.matcher(paragraph).find());
        assertThat(afterStep7).as("steps 2, 3, and 5 that pick no slot are not complete either")
                .anyMatch(paragraph -> noSlotSteps.matcher(paragraph).find());
    }

    // ================= 결정 11-3: 넣어볼 표현 개수 문구 없음 =================

    // suggestedPhrases를 말하는 문단에 스키마(2~4개)보다 좁히는 개수 문구가 없다. "서로 다른 선택지, 난이도에 맞음"(명세 4 A)은 남는다.
    @Test
    void changed_suggestedPhrasesRulesAddNoCountLimitBeyondTheSchema() {
        List<String> phraseParagraphs = paragraphs(contract.developerPrompt()).stream()
                .filter(paragraph -> paragraph.contains("suggestedPhrase"))
                .toList();
        Pattern countLimit = Pattern.compile("(?i)\\b(two|2)\\s*(or|to|-|–)\\s*(three|3)\\b|\\bat most\\b|\\bup to\\b"
                + "|\\bno more than\\b|\\b(three|3)\\s+or\\s+(fewer|less)\\b");
        Pattern different = Pattern.compile("(?i)\\bdifferent\\b");

        assertThat(phraseParagraphs).as("paragraphs about suggestedPhrases").isNotEmpty();
        assertThat(phraseParagraphs)
                .as("no suggestedPhrases paragraph narrows the schema's 2-to-4 count")
                .noneMatch(paragraph -> countLimit.matcher(paragraph).find());
        assertThat(phraseParagraphs)
                .as("a suggestedPhrases paragraph still asks for different choices that fit the question difficulty")
                .anyMatch(paragraph -> different.matcher(paragraph).find() && paragraph.contains("difficulty"));
    }

    // 개수는 스키마대로: 미션 지원과 풍부하게 써 보기의 suggestedPhrases는 2~4개 그대로다.
    @Test
    void kept_suggestedPhrasesSchemaStaysTwoToFour() {
        JsonNode properties = objectMapper.valueToTree(contract.schema(prompt())).path("properties");

        for (String support : List.of("missionSupport", "enrichmentSupport")) {
            JsonNode phrases = properties.path(support).path("items").path("properties").path("suggestedPhrases");
            assertThat(phrases.path("minItems").asInt(-1)).as("%s.suggestedPhrases.minItems", support).isEqualTo(2);
            assertThat(phrases.path("maxItems").asInt(-1)).as("%s.suggestedPhrases.maxItems", support).isEqualTo(4);
        }
    }

    // ---- helpers (CanonicalFeedbackContractContentQualitySpecTest와 같은 방법) ----

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

    private static PromptDto prompt() {
        Map<String, PromptSlotContractDto> contracts = new LinkedHashMap<>();
        for (String slot : List.of("ACTION", "REASON")) {
            contracts.put(slot, new PromptSlotContractDto(
                    "The question-specific role of " + slot + ".",
                    "The learner answer clearly fulfills " + slot + " for this question.",
                    slot + " 역할",
                    slot + " 충족 기준"
            ));
        }
        return new PromptDto(
                "prompt-spec-057-follow-up",
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
                        contracts
                )
        );
    }
}
