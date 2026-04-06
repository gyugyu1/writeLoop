# 영작 피드백 로직 상세 흐름

이 문서는 현재 코드 기준으로, 영작 답변 제출 후 피드백이 어떻게 생성되고 화면에 반영되는지를 최신 구조에 맞춰 정리한 문서다.

기준 파일:

- `apps/frontend/app/answer-loop.tsx`
- `apps/frontend/lib/types.ts`
- `apps/backend/src/main/java/com/writeloop/controller/FeedbackController.java`
- `apps/backend/src/main/java/com/writeloop/service/FeedbackService.java`
- `apps/backend/src/main/java/com/writeloop/service/LlmFeedbackClient.java`
- `apps/backend/src/main/java/com/writeloop/service/GeminiFeedbackClient.java`
- `apps/backend/src/main/java/com/writeloop/service/FeedbackGenerationModels.java`
- `apps/backend/src/main/java/com/writeloop/service/FeedbackUiComposer.java`
- `apps/backend/src/main/java/com/writeloop/dto/FeedbackUiDto.java`
- `apps/backend/src/main/java/com/writeloop/dto/FeedbackResponseDto.java`

## 1. 현재 구조 한 줄 요약

현재 영작 피드백은 다음 순서로 동작한다.

1. 프론트가 답변을 `/api/feedback`으로 제출한다.
2. 백엔드가 세션, 시도 번호, 이전 답변, 프롬프트 힌트를 정리한다.
3. Gemini가 먼저 답변 상태를 진단한다.
4. 진단 결과를 기반으로 generation prompt를 만들고, Gemini에게 구조화된 JSON을 요청한다.
5. generation 결과는 sanitize/validate를 거친다.
6. `FeedbackUiComposer`가 최종 UI 블록을 조립한다.
7. 프론트는 `feedback.ui`를 중심으로 `유지할 점 -> 고쳐볼 점 -> 문장 완성하기 -> 예시 답변 -> 써보면 좋은 표현` 순서로 렌더한다.

중요한 최신 변화는 아래 두 가지다.

- 화면의 메인 수정 섹션은 `primaryFix + secondaryLearningPoints` 이원 구조가 아니라 `fixPoints[]` 단일 리스트 중심으로 읽힌다.
- generation prompt도 이제 `fixPoints[0] = 가장 먼저 고칠 점`, `later fixPoints = 남은 distinct fix` 구조를 메인 계약으로 사용한다.

## 2. 프론트에서 요청이 시작되는 지점

시작점은 `apps/frontend/app/answer-loop.tsx`의 `handleSubmit(nextAnswer, mode)`다.

여기서 하는 일:

- 프롬프트가 선택되지 않았거나 답변이 비었으면 에러 표시
- 게스트 rewrite 제한 확인
- 제출 중 상태로 전환
- `submitFeedback()` 호출

실제 요청 바디:

- `promptId`
- `answer`
- `sessionId`
- `attemptType`
- `guestId`

`attemptType`은 최초 제출이면 `INITIAL`, 다시쓰기면 `REWRITE`다.

## 3. 백엔드 진입과 `FeedbackService.review()`

`FeedbackController`는 `/api/feedback` POST를 받아 `FeedbackService.review()`에 전달한다.

`FeedbackService.review()`의 핵심 준비 단계:

- 프롬프트 조회
- 답변 trim
- 세션 결정
- 시도 번호 계산
- 직전 답변 조회
- attempt type 결정
- LLM 사용 가능 여부 확인
- 프롬프트 힌트 조회

그 다음 분기:

- LLM 사용 가능: `LlmFeedbackClient -> GeminiFeedbackClient`
- LLM 사용 불가: 로컬 규칙 기반 fallback

LLM 경로든 fallback 경로든, 마지막에는 `sanitizeFeedbackResponse()`와 `FeedbackUiComposer.compose()`를 거쳐 최종 응답이 완성된다.

## 4. Gemini 하이브리드 로직의 현재 핵심

실제 중심은 `GeminiFeedbackClient.reviewHybrid()`다.

이 로직은 크게 아래 단계로 움직인다.

1. diagnosis
2. answer profile / section policy / screen policy 계산
3. generation prompt 작성
4. structured JSON 생성
5. sanitize / validate
6. retry 또는 deterministic fallback 병합
7. 최종 `FeedbackResponseDto` 조립

## 5. Diagnosis 단계

먼저 Gemini가 답변 상태를 진단한다.

대표 진단 필드:

- `answerBand`
- `taskCompletion`
- `onTopic`
- `finishable`
- `grammarSeverity`
- `minimalCorrection`
- `primaryIssueCode`
- `secondaryIssueCode`
- `rewriteTarget`
- `regressionSensitiveFacts`
- `expansionBudget`

이 단계는 아직 카드 문구를 생성하지 않는다. 대신 이후 generation과 UI 정책이 어떤 방향으로 갈지를 정하는 상태값을 만든다.

특히 중요한 값:

- `minimalCorrection`
  - learner meaning을 최대한 유지한 최소 교정본
- `primaryIssueCode`
  - 이번 루프에서 가장 먼저 잡아야 할 액션 코드
- `rewriteTarget`
  - 다음 rewrite가 어떤 행동을 해야 하는지에 대한 action + skeleton

## 6. Generation prompt의 현재 계약

최신 구조에서 generation prompt는 크게 세 층으로 나뉜다.

### 6.1 UI-ready 메인 출력

이 필드들은 화면에 거의 바로 쓰기 위한 값이다.

- `focusCard`
- `fixPoints`
- `rewritePractice`
- `rewriteSuggestions`
- `modelAnswer`

여기서 가장 중요한 최신 규칙은 `fixPoints[]`다.

- `fixPoints[0]`
  - 사용자가 가장 먼저 고쳐야 하는 포인트
- `fixPoints[1...]`
  - 남아 있는 distinct fix들
- 각 `fixPoint`는 반드시 하나의 teaching point만 설명해야 한다
- 같은 teaching point를 다른 예문으로 여러 카드에 나누지 않는다

즉 지금 메인 생성 계약은:

- 메인 1개 + 보조 여러 개를 서로 다른 필드로 강하게 나누는 방식이 아니라
- `fixPoints[]` 하나 안에서 우선순위를 가진 수정 리스트를 만드는 방식

### 6.2 Raw candidate pool

아래 필드들은 메인 UI의 주인공이 아니라, candidate pool 성격이 강하다.

- `grammarFeedback`
- `corrections`
- `refinementExpressions`

의미:

- `grammarFeedback`
  - raw grammar candidate들
- `corrections`
  - raw non-grammar candidate들
- `refinementExpressions`
  - raw reusable expression candidate들

프롬프트도 이 필드들을 `fixPoints`를 돕는 후보 풀로 다루도록 바뀌었다.

### 6.3 Compatibility fallback

아래 필드는 완전 삭제되진 않았지만, 현재 generation contract의 주인공은 아니다.

- `primaryFix`
- `secondaryLearningPoints`
- `summary`
- `rewriteGuide`

현재 의도:

- `fixPoints`가 진짜 메인 source of truth
- `primaryFix / secondaryLearningPoints`는 하위 호환용
- `summary / rewriteGuide`는 레거시 호환용 fallback

즉 최신 prompt 철학은:

- 메인 UI 5개 중심
- 나머지 필드는 compatibility only

## 7. Structured output과 파싱

Gemini는 자유 텍스트가 아니라 structured JSON으로 응답한다.

generation schema에는 현재 아래 항목들이 포함된다.

- `focusCard`
- `strengths`
- `fixPoints`
- `grammarFeedback`
- `corrections`
- `usedExpressions`
- `refinementExpressions`
- `rewritePractice`
- `rewriteSuggestions`
- `modelAnswer`
- `modelAnswerKo`
- 일부 compatibility 필드

파싱에서 중요한 현재 동작:

- `fixPoints`를 우선 파싱
- `primaryFix`가 비어 있으면 `fixPoints` 첫 non-EXPRESSION 항목으로부터 파생
- `secondaryLearningPoints`가 비어 있으면 `fixPoints`의 나머지 non-EXPRESSION 항목들로부터 파생

즉 내부적으로는 아직 기존 필드와 공존하지만, 생성 계약은 `fixPoints` 중심으로 기울어져 있다.

## 8. Validate / sanitize 단계

generation 결과는 그대로 채택하지 않는다.

주요 정리 대상:

- `focusCard`
- `primaryFix`
- `grammarFeedback`
- `corrections`
- `usedExpressions`
- `refinementExpressions`
- `rewritePractice`
- `rewriteSuggestions`
- `modelAnswer`

현재 중요한 보호 규칙:

- generic한 `primaryFix` shell은 허용하지 않음
- `rewritePractice.starter`는 blank를 반드시 포함해야 함
- `rewriteSuggestions`는 starter의 blank에 실제로 들어갈 수 있어야 함
- `modelAnswer`는 `fixPoints[0]`가 가르친 referent / pronoun / singular-plural 방향을 어기지 않아야 함
- `grammarFeedback.reasonKo`가 특정 토큰 수정을 말하면 `revisedText`에도 실제 그 수정이 보여야 함

## 9. `FeedbackUiComposer`가 하는 일

`FeedbackUiComposer.compose()`는 raw response를 실제 UI 블록으로 정리한다.

현재 조립되는 핵심 UI 필드:

- `focusCard`
- `primaryFix`
- `secondaryLearningPoints`
- `fixPoints`
- `rewritePractice`
- `rewriteSuggestions`
- `screenPolicy`
- `loopStatus`

하지만 최신 프론트 UX 기준으로 중요한 건 `fixPoints`다.

### 9.1 `fixPoints`는 어떻게 만들어지나

현재 backend composer는 아래 순서로 `fixPoints`를 만든다.

1. `primaryFix`를 `FeedbackSecondaryLearningPointDto` 형태로 변환
2. `secondaryLearningPoints` 중 non-EXPRESSION 항목을 뒤에 붙임
3. 중복 제거

즉 렌더용 `fixPoints`는 현재도 composer에서 최종 정리된다.

### 9.2 EXPRESSION은 따로 뺀다

`secondaryLearningPoints` 안에서 `kind == EXPRESSION`인 항목은 `fixPoints`에 합치지 않는다.

이 항목들은 나중에 프론트에서 `써보면 좋은 표현` 섹션으로 분리되어 렌더된다.

### 9.3 중복 제거

composer는 현재 아래 중복을 줄이려 한다.

- `primaryFix`와 같은 anchor phrase 반복
- 같은 connector / time phrase 반복
- 같은 teaching point를 다른 카드로 다시 설명하는 경우 일부 제거

다만 teaching point 중복은 prompt와 backend guard가 함께 줄이는 구조다.

## 10. 프론트의 실제 렌더 순서

현재 `answer-loop.tsx`에서 `feedback` step은 아래 순서로 화면을 렌더한다.

1. 질문 + 제출 답변
2. `유지할 점`
3. `고쳐볼 점`
4. `문장 완성하기`
5. `예시 답변`
6. `써보면 좋은 표현`
7. CTA / 다음 루프 버튼

중요한 현재 변화:

- `focusCard`는 backend에서 여전히 계산되지만, 현재 프론트 핵심 흐름에서는 더 이상 메인 섹션으로 렌더되지 않는다
- 예전의 `우선적으로 고쳐볼 점` / `더 자연스럽게 다듬을 점` 이원 구조 대신, 지금은 `고쳐볼 점` 단일 리스트가 우선이다

### 10.1 `고쳐볼 점`

프론트는 우선 `feedback.ui.fixPoints`를 본다.

- 있으면 그걸 그대로 사용
- 없으면 빈 리스트로 본다. 프론트는 더 이상 `primaryFix + secondaryLearningPoints`를 조립해 `fixPoints`를 복원하지 않는다.

그리고 여기서 `EXPRESSION` kind는 제외한다.

즉 화면에 보이는 `고쳐볼 점`은 결국:

- 한 카드 = 한 포인트
- 위에서 아래로 갈수록 우선순위가 낮아지는 ordered list

구조를 의도한다.

### 10.2 `문장 완성하기`

이 섹션은 `rewritePractice`를 사용한다.

구성:

- `title`
- `starter`
- `instruction`
- `ctaLabel`

여기 아래의 suggestion 카드는 `rewriteSuggestions`를 우선 사용한다.

`rewriteSuggestions`가 없을 때만, 일부 `EXPRESSION` secondary를 blank-fit 기준으로 fallback 재사용한다.

### 10.3 `예시 답변`

`modelAnswer`가 있으면 렌더한다.

현재 중요한 규칙:

- `rewritePractice.starter`와 완전히 같은 문장이면 숨김
- `fixPoints[0]`가 가르친 핵심 교정 방향을 유지한 one-step-up example이어야 함

### 10.4 `써보면 좋은 표현`

여기는 `secondaryLearningPoints` 중 `kind == EXPRESSION`인 항목만 별도로 렌더한다.

즉:

- 수정 포인트는 `fixPoints`
- 재사용 표현은 `EXPRESSION`

으로 역할이 나뉜다.

## 11. 현재 데이터 구조를 어떻게 이해하면 되는가

최신 코드 기준으로는 아래처럼 이해하면 가장 정확하다.

### 11.1 생성 계약 기준

- 메인 UI-ready 수정 리스트: `fixPoints[]`
- rewrite 카드: `rewritePractice`
- rewrite blank 보조 표현: `rewriteSuggestions`
- example answer: `modelAnswer`

### 11.2 내부 호환 기준

- `primaryFix`
  - `fixPoints[0]`의 compatibility projection
- `secondaryLearningPoints`
  - `fixPoints[1...]`와 EXPRESSION류를 함께 담는 compatibility / candidate 역할

즉 `primaryFix`와 `secondaryLearningPoints`는 완전히 사라지진 않았지만, 현재 사고의 중심은 `fixPoints[]`다.

## 12. 로컬 fallback 경로

LLM이 없거나 generation/validation 일부가 실패하면 deterministic fallback이 일부 섹션을 보충한다.

이 fallback은 여전히 아래를 만든다.

- strengths
- grammar feedback
- corrections
- model answer
- rewrite guide 성격의 최소 fallback

다만 최종 화면은 결국 `FeedbackUiComposer`가 다시 `fixPoints / rewritePractice / expression section` 형태로 정리한다.

## 13. 저장과 후처리

최종 응답이 만들어지면:

- 세션 완료 여부 갱신
- 시도 로그 저장
- diagnosis 로그 저장

이후 프론트는 응답을 `feedback` 상태로 저장하고 `feedback` step으로 전환한다.

## 14. 현재 설계 포인트

### 14.1 rewrite-first

이 시스템의 목표는 첨삭 결과 나열보다, 다음 rewrite를 가능하게 만드는 것이다.

그래서:

- diagnosis에서 `rewriteTarget`을 먼저 잡고
- generation에서 `fixPoints[0]`와 `rewritePractice`를 정렬하고
- 프론트도 `고쳐볼 점 -> 문장 완성하기 -> 예시 답변` 흐름으로 보여준다

### 14.2 한 카드 = 한 teaching point

최신 prompt 계약에서 가장 중요한 규칙 중 하나다.

- `Each fixPoints item must teach exactly one concrete correction point.`
- unrelated lesson merge 금지
- same teaching point split 금지

즉 한 카드가 철자 + 대명사 + 이유 추가를 동시에 다루는 구조를 줄이려는 방향이다.

### 14.3 메인/보조를 너무 강하게 나누지 않음

예전에는 `primaryFix / secondaryLearningPoints`의 경계 때문에 같은 포인트가 두 섹션에 새는 문제가 컸다.

지금은:

- LLM에는 `fixPoints[]` ordered list를 우선 요청
- 화면도 `고쳐볼 점` 단일 리스트로 렌더

하는 방향으로 단순화되어 있다.

### 14.4 레거시 필드는 아직 완전 제거되지 않음

`summary`, `rewriteGuide`, `primaryFix`, `secondaryLearningPoints`는 아직 코드 안에 남아 있다.

하지만 현재 메인 경로에서의 의미는:

- 일부는 compatibility fallback
- 일부는 parser projection
- 일부는 old response / persistence 호환

에 가깝다.

## 15. 최종 정리

현재 영작 피드백 파이프라인은 다음처럼 이해하면 가장 정확하다.

- diagnosis가 답변 상태를 정의한다
- generation prompt는 `fixPoints[] + rewritePractice + rewriteSuggestions + modelAnswer`를 메인 출력으로 유도한다
- raw candidate pool은 `grammarFeedback / corrections / refinementExpressions`가 담당한다
- parser와 composer가 compatibility field를 흡수하면서 최종 `ui.fixPoints`를 만든다
- 프론트는 `유지할 점 -> 고쳐볼 점 -> 문장 완성하기 -> 예시 답변 -> 써보면 좋은 표현` 순서로 렌더한다

즉 현재 구조는 `primaryFix 중심 카드 UX`에서 `fixPoints[] 중심 ordered fix list UX`로 이동한 상태라고 보면 된다.
