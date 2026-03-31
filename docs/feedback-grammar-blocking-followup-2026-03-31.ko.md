# WriteLoop GRAMMAR_BLOCKING 후속 보강

작성일: 2026-03-31

## 1. 배경

기존 `feedback-answer-profile-section-policy-2026-03-31.ko.md` 문서가

- `PromptTaskMeta`
- `AnswerProfile`
- `AnswerBand`
- `SectionPolicy`
- 공통 validator / sanitizer

중심의 전체 구조 변경을 정리했다면, 이 문서는 그 이후에 진행한 `GRAMMAR_BLOCKING` 경로의 후속 보강만 따로 정리한 문서다.

이번 보강의 목적은 간단하다.

- 문법이 핵심 문제인 답변에서
- raw learner answer를 너무 많이 끌고 가지 않고
- 사용자가 “지금 무엇으로 고쳐야 하는지”를 한 번에 파악하게 만들기

---

## 2. 대상 케이스

learner answer:

```text
I often struggle with meet the deadline, to address I try to stay on track by write a to-do list.
```

이 답변은 `CONTENT_THIN`보다 `GRAMMAR_BLOCKING`으로 우선 처리해야 한다.

핵심 이유:

- `struggle with meet` 형태가 비문이다.
- `by write`가 `by writing`으로 고쳐져야 한다.
- `to address I ...` 연결이 문장을 막는다.

즉, 내용 확장보다 먼저 “문장을 읽히게 만드는 최소 수정”이 필요하다.

---

## 3. 목표 출력

### 3.1 Minimal Correction

이 케이스의 기준 minimal correction은 아래 한 문장으로 정했다.

```text
I often struggle to meet deadlines, so I try to stay on track by writing a to-do list.
```

중요한 점:

- corrected sentence는 여러 대안 중 하나가 아니라
- 실제 사용자-facing grammar section의 기준 문장 하나여야 한다.

### 3.2 Rewrite Guide

```text
"I often struggle to meet deadlines, so I try to stay on track by writing a to-do list."
여기에 이 방법이 어떻게 도움이 되는지 한 가지를 더 덧붙여 보세요.
```

### 3.3 Model Answer

```text
I often struggle to meet deadlines, so I try to stay on track by writing a to-do list.
This helps me organize my tasks better.
```

이 구조에서:

- `rewriteGuide`는 행동 지시
- `modelAnswer`는 one-step-up 예시

를 맡는다.

---

## 4. 실제 코드 변경

관련 파일:

- `apps/backend/src/main/java/com/writeloop/service/FeedbackSectionPolicyApplier.java`
- `apps/backend/src/main/java/com/writeloop/service/FeedbackSectionValidators.java`
- `apps/backend/src/test/java/com/writeloop/service/FeedbackSectionPolicyApplierTest.java`
- `apps/backend/src/test/java/com/writeloop/service/FeedbackServiceTest.java`

### 4.1 corrected sentence 정규화

`FeedbackSectionPolicyApplier`에 아래 흐름을 추가했다.

- `resolveGrammarBlockingMinimalCorrection(...)`
- `normalizeGrammarBlockingCorrection(...)`

이 단계에서 하는 일:

- `struggle with meet the deadline` -> `struggle to meet deadlines`
- `struggle with meeting the deadline` -> `struggle to meet deadlines`
- `by write` -> `by writing`
- `to address I ...` -> `, so I ...`
- punctuation / spacing / sentence ending 정리

즉, grammar-blocking일 때는 corrected sentence를 단순 통과시키지 않고 “하나의 읽히는 문장”으로 정규화한다.

### 4.2 grammar section 고정

`buildGrammarBlockingSection(...)`가 이제 항상 아래 형태를 우선한다.

- 원문
- 수정문
- 이유

그리고 이유는 `buildGrammarBlockingReasonV2(...)`에서 최종 correction에 맞는 설명만 남긴다.

현재 남기는 이유:

- `struggle` 뒤에는 `to meet`가 자연스럽다.
- `by` 뒤에는 `writing`처럼 `-ing` 형태가 와야 한다.
- `so`로 연결하면 문장이 더 자연스럽다.

즉, 아래 같은 설명은 제거 대상이다.

- substring patch 설명
- `a -> b` diff 문자열
- orphan quote
- correction보다 더 복잡한 대안 나열

### 4.3 strengths / used expressions 필터 강화

`grammarSeverity >= MODERATE` 또는 `answerBand == GRAMMAR_BLOCKING`이면

- raw learner sentence 전체 인용 칭찬 금지
- broken clause를 “잘 사용한 표현”으로 노출 금지

현재 적용 규칙:

- `buildMeaningBasedStrengthsV2(...)`
  - 의미 기반 칭찬만 생성
- `shouldDropUsedExpressionForElevatedGrammar(...)`
  - grammar issue span과 겹치는 chunk 제거
- `isLongBrokenRawClause(...)`
  - 긴 raw 비문 제거
- grammar-blocking에서는 used expression 최대 1개 유지

좋은 strength 예:

- `문제와 해결 방법을 함께 제시하려는 흐름이 좋아요.`

### 4.4 refinement focus 재정렬

grammar-blocking에서는 refinement를 “즉시 수리용 chunk” 중심으로 좁혔다.

핵심 메서드:

- `buildGrammarBlockingRepairRefinements(...)`
- `toDirectGrammarBlockingRefinement(...)`
- `mergeGrammarBlockingRefinements(...)`
- `requiresLargeReframeForGrammarBlocking(...)`
- `shouldDropRefinementForGrammarBlocking(...)`

현재 우선순위:

1. `struggle to meet deadlines`
2. `by writing a to-do list`
3. `stay on track`

현재 제거 대상:

- `As a result`
- `Therefore`
- `One challenge I often face is ...`
- placeholder가 남은 frame
- grammar issue span과 겹치는 broken chunk

즉, 이 밴드에서는 fancy frame보다 repair-oriented chunk가 우선이다.

### 4.5 rewrite guide / model answer 분리

기존 문제:

- rewrite guide와 model answer가 correction을 거의 같은 방식으로 반복

현재 보강:

- `buildGrammarBlockingRewriteGuideV2(...)`
  - correction 문장을 인용한 뒤, 다음 행동을 지시
- `buildGrammarBlockingOneStepUpModelAnswer(...)`
  - correction + detail 1문장 구조
- `extractHelpfulDetailSentence(...)`
  - fallback model answer의 2번째 문장을 detail로 재사용 가능
- `inferHelpfulDetailSentence(...)`
  - fallback이 약하면 기본 detail 생성

즉:

- rewrite guide는 “이제 뭘 더 붙이면 되는가”
- model answer는 “그걸 반영하면 어떻게 보이는가”

를 맡는다.

---

## 5. validator / sanitizer 강화

`FeedbackSectionValidators`에 이번 후속 보강과 직접 연결되는 규칙은 아래와 같다.

### 5.1 unresolved placeholder 차단

다음 값은 refinement에 남지 않게 한다.

- `[verb]`
- `[noun]`
- `[동사]`
- `[명사]`

### 5.2 generic meaning / guidance 차단

너무 넓거나 직접성이 약한 뜻풀이 / 활용 문구는 제거한다.

현재 방향:

- `마감일을 맞추는 데 어려움을 겪다`
- `해결 방법을 설명할 때 자연스럽게 이어 쓸 수 있어요`

처럼 짧고 직접적인 문장을 우선한다.

### 5.3 malformed grammar explanation 차단

제거 대상:

- orphan quote
- substring patch
- broken arrow patch
- original == revised 인 grammar item

### 5.4 corrected sentence sanitize

`sanitizeCorrectedSentence(...)`에서:

- 공백 정리
- punctuation spacing 정리
- 문장 끝 punctuation 보정

을 수행한다.

### 5.5 rewriteGuide-modelAnswer dedupe

grammar-blocking에서는 rewrite guide가 skeleton 역할을 하고 model answer가 one-step-up 역할을 해야 하므로,

- 둘이 거의 같으면 실패로 본다.
- guide의 quoted base는 유지하되
- guide의 “행동 지시”를 살리고
- model answer는 detail 1문장을 갖도록 유도한다.

---

## 6. 현재 기대 출력

### 6.1 Strengths

1개만 남겨도 충분하다.

예:

- `문제와 해결 방법을 함께 제시하려는 흐름이 좋아요.`

### 6.2 Grammar

- 원문:
  - `I often struggle with meet the deadline, to address I try to stay on track by write a to-do list.`
- 수정문:
  - `I often struggle to meet deadlines, so I try to stay on track by writing a to-do list.`
- 이유:
  - `struggle` 뒤에는 `to meet`가 자연스럽습니다.
  - `by` 뒤에는 `writing`처럼 `-ing` 형태가 와야 자연스럽습니다.
  - `so`로 연결하면 문장이 더 자연스럽습니다.

### 6.3 Improvement

1개만 유지한다.

예:

- `to-do list가 어떻게 도움이 되는지 한 가지 더 구체적으로 써 보세요.`

### 6.4 Refinement

2개만 권장한다.

1. `struggle to meet deadlines`
2. `by writing a to-do list`

예:

```text
expression: struggle to meet deadlines
meaningKo: 마감일을 맞추는 데 어려움을 겪다
example: I often struggle to meet deadlines.
guidance: 자주 겪는 어려움을 말할 때 쓸 수 있어요.
```

```text
expression: by writing a to-do list
meaningKo: 할 일 목록을 써서
example: I stay organized by writing a to-do list.
guidance: 해결 방법을 설명할 때 자연스럽게 이어 쓸 수 있어요.
```

### 6.5 Summary / Rewrite Guide / Model Answer

Summary:

- `문제와 해결 방법을 함께 제시한 점은 좋지만, 먼저 핵심 문법을 바로잡아야 해요.`

Rewrite Guide:

```text
"I often struggle to meet deadlines, so I try to stay on track by writing a to-do list."
여기에 이 방법이 어떻게 도움이 되는지 한 가지를 더 덧붙여 보세요.
```

Model Answer:

```text
I often struggle to meet deadlines, so I try to stay on track by writing a to-do list.
This helps me organize my tasks better.
```

---

## 7. 테스트 상태

검증 대상:

- `FeedbackSectionPolicyApplierTest`
- `FeedbackServiceTest`

이번 후속 보강 이후 확인한 포인트:

- grammar-blocking에서 refinement가 repair chunk 우선으로 정렬되는가
- rewrite guide와 model answer가 같은 역할이 되지 않는가
- used expression이 broken raw clause를 포함하지 않는가
- corrected sentence가 새 minimal correction 기준으로 정규화되는가

실행 명령:

```bash
./gradlew.bat test --tests com.writeloop.service.FeedbackSectionPolicyApplierTest --tests com.writeloop.service.FeedbackServiceTest
./gradlew.bat compileJava compileTestJava
```

---

## 8. 한 줄 요약

현재 `GRAMMAR_BLOCKING` 경로는

- 문법 피드백은 하나의 분명한 수정문으로,
- refinement는 즉시 수리 가능한 chunk 위주로,
- rewrite guide는 행동 지시로,
- model answer는 one-step-up 예시로,
- strengths / used expressions는 broken raw answer를 재사용하지 않도록

정리되어 있다.
