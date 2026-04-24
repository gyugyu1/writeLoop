# WriteLoop 질문 답변 피드백 로직 보고서

이 문서는 WriteLoop의 **영어 질문 답변 피드백 로직**을 처음 보는 사람도 이해할 수 있도록 풀어서 설명한 문서다.

WriteLoop에는 최근 별도로 구현된 **영어일기 피드백**도 있지만, 이 문서는 사용자가 정해진 영어 질문에 답하고 피드백을 받는 기존 작문 루프를 다룬다.

## 1. 한 줄 요약

WriteLoop의 질문 답변 피드백은 단순히 영어 문장을 채점하는 기능이 아니다.

사용자의 답변을 먼저 진단하고, 그 답변이 어떤 상태인지 `answerBand`로 분류한 뒤, 그 상태에 맞게 **고칠 점**, **다시쓰기 방향**, **표현 추천**, **한 단계 위의 모델 답안**, **완료 가능 여부**를 구조화된 JSON으로 만들어 주는 학습 루프다.

## 2. 피드백 로직의 핵심 목적

WriteLoop 피드백의 목적은 "정답을 보여주는 것"보다 "사용자가 다음 답변을 더 잘 다시 쓰게 만드는 것"에 가깝다.

예를 들어 사용자가 아래처럼 답했다고 가정한다.

```text
Question:
What is your favorite food, and why do you like it?

Answer:
I like pizza and hamburger because it is easy to find and cheap price.
```

이 답변에서 시스템은 단순히 점수만 주지 않는다.

대신 다음을 판단한다.

- 질문에 답하고 있는가?
- 핵심 답변이 있는가?
- 이유가 있는가?
- 문법 오류가 의미 전달을 막는가?
- 지금 바로 완료해도 되는가?
- 다시 쓴다면 문법을 먼저 고쳐야 하는가, 내용을 더해야 하는가?
- 학습자가 다음 답변에 바로 재사용할 만한 표현은 무엇인가?

즉 피드백은 "틀렸다"가 아니라, **다음 루프에서 무엇을 하면 좋아지는지**를 알려주는 구조다.

## 3. 전체 처리 흐름

질문 답변 피드백은 크게 아래 순서로 처리된다.

```text
1. 클라이언트가 /api/feedback 호출
2. 백엔드가 질문, 답변, 세션, 시도 번호를 정리
3. LLM provider 선택
4. LLM이 답변 상태를 진단
5. LLM이 피드백 섹션을 JSON으로 생성
6. 백엔드가 JSON을 검증하고 부족하면 재생성 또는 보정
7. answerBand에 맞게 섹션 노출 정책 적용
8. 모바일/웹 UI에서 쓰기 좋은 FeedbackUiDto로 조립
9. 답변 시도 기록과 진단 로그를 DB에 저장
10. 클라이언트가 피드백 화면을 렌더링
```

가장 중요한 점은 LLM 결과를 그대로 화면에 던지지 않는다는 것이다.

LLM은 초안을 만들고, 백엔드는 그 결과를 다시 검증하고 정리한 뒤, WriteLoop의 학습 흐름에 맞는 형태로 바꾼다.

## 4. 주요 코드 위치

피드백 로직을 따라가려면 아래 파일들을 보면 된다.

| 역할 | 파일 |
|---|---|
| 피드백 API 진입점 | `apps/backend/src/main/java/com/writeloop/controller/FeedbackController.java` |
| 피드백 전체 오케스트레이션 | `apps/backend/src/main/java/com/writeloop/service/FeedbackService.java` |
| LLM provider 라우팅 | `apps/backend/src/main/java/com/writeloop/service/LlmFeedbackClient.java` |
| LLM 엔진 공통 인터페이스 | `apps/backend/src/main/java/com/writeloop/service/FeedbackLlmEngine.java` |
| OpenAI 피드백 엔진 | `apps/backend/src/main/java/com/writeloop/service/OpenAiFeedbackEngine.java` |
| Gemini 피드백 엔진 | `apps/backend/src/main/java/com/writeloop/service/GeminiFeedbackEngine.java` |
| Gemini 피드백 프롬프트/스키마/생성 | `apps/backend/src/main/java/com/writeloop/service/GeminiFeedbackClient.java` |
| OpenAI 피드백 프롬프트/스키마/생성 | `apps/backend/src/main/java/com/writeloop/service/OpenAiFeedbackClient.java` |
| 답변 상태 모델 | `apps/backend/src/main/java/com/writeloop/service/AnswerProfile.java` |
| answerBand별 섹션 정책 | `apps/backend/src/main/java/com/writeloop/service/SectionPolicySelector.java` |
| 완료 가능 여부 판단 | `apps/backend/src/main/java/com/writeloop/service/CompletionStateSelector.java` |
| 화면 노출 정책 | `apps/backend/src/main/java/com/writeloop/service/FeedbackScreenPolicySelector.java` |
| UI용 피드백 조립 | `apps/backend/src/main/java/com/writeloop/service/FeedbackUiComposer.java` |
| LLM 생성/검증 내부 모델 | `apps/backend/src/main/java/com/writeloop/service/FeedbackGenerationModels.java` |

## 5. API 입력값

클라이언트는 `POST /api/feedback`으로 피드백을 요청한다.

요청 DTO는 `FeedbackRequestDto`다.

```java
public record FeedbackRequestDto(
    String promptId,
    String answer,
    String sessionId,
    String attemptType,
    String guestId
) {}
```

각 필드의 의미는 다음과 같다.

| 필드 | 의미 |
|---|---|
| `promptId` | 사용자가 답변한 질문 ID |
| `answer` | 사용자가 작성한 영어 답변 |
| `sessionId` | 같은 질문에 대한 작문 세션 ID |
| `attemptType` | 첫 답변인지, 다시쓰기인지 구분하는 값 |
| `guestId` | 비로그인 사용자의 제한/기록 처리를 위한 ID |

`FeedbackController`는 먼저 요청이 비어 있는지, 답변이 비어 있는지 확인한다.
답변이 없으면 피드백을 만들 수 없기 때문에 바로 에러를 반환한다.

## 6. FeedbackService의 역할

`FeedbackService`는 피드백 처리의 중심이다.

주요 책임은 아래와 같다.

1. 질문 조회
2. 답변 길이 검증
3. 세션 생성 또는 기존 세션 조회
4. 몇 번째 시도인지 계산
5. 이전 답변 조회
6. LLM 피드백 호출
7. LLM 결과 검증 및 보정
8. UI용 피드백 조립
9. 답변 시도 기록 저장
10. 완료 여부 저장
11. 진단 로그 저장

중요한 제한도 여기서 처리한다.

현재 답변은 4,000자를 넘으면 거절된다.
너무 긴 답변은 비용과 응답 품질, UI 표시 안정성에 문제가 생길 수 있기 때문이다.

## 7. LLM provider 선택 구조

WriteLoop는 OpenAI와 Gemini를 모두 사용할 수 있는 구조다.

`LlmFeedbackClient`가 provider를 선택한다.

설정값은 아래처럼 관리된다.

```yaml
llm.feedback-provider
```

기본값은 코드 기준으로 `gemini`다.

즉 백엔드 입장에서는 "피드백을 만들어 줘"라고 요청하면, 현재 설정된 provider에 따라 OpenAI 또는 Gemini 엔진으로 위임된다.

```text
FeedbackService
  -> LlmFeedbackClient
      -> GeminiFeedbackEngine
      -> OpenAiFeedbackEngine
```

이 구조 덕분에 피드백 서비스 로직은 provider에 직접 묶이지 않는다.
나중에 모델을 바꾸거나 provider를 바꿔도 `FeedbackService`의 큰 흐름은 유지된다.

## 8. LLM 피드백은 두 단계로 나뉜다

질문 답변 피드백의 핵심은 **진단과 생성의 분리**다.

LLM에게 한 번에 "피드백 만들어줘"라고 하지 않고, 먼저 답변 상태를 진단하게 한다.

### 8-1. 1단계: 답변 진단

진단 단계에서는 사용자의 답변을 보고 아래 정보를 판단한다.

| 진단 항목 | 의미 |
|---|---|
| `score` | 답변의 현재 점수 |
| `answerBand` | 답변 상태 분류 |
| `taskCompletion` | 질문 과제를 얼마나 수행했는지 |
| `onTopic` | 질문과 관련 있는 답변인지 |
| `finishable` | 지금 상태로 완료 가능성이 있는지 |
| `grammarSeverity` | 문법 문제가 어느 정도 심한지 |
| `grammarIssues` | 구체적인 문법 문제 목록 |
| `minimalCorrection` | 의미를 보존한 최소 수정 문장 |
| `primaryIssueCode` | 가장 먼저 고쳐야 할 문제 |
| `secondaryIssueCode` | 보조적으로 고치면 좋은 문제 |
| `rewriteTarget` | 다시쓰기 목표 |
| `expansionBudget` | 새 내용을 얼마나 덧붙여도 되는지 |
| `regressionSensitiveFacts` | 모델 답안에서 보존해야 할 사실 |

이 진단 결과가 이후 피드백의 기준점이 된다.

### 8-2. 2단계: 피드백 섹션 생성

진단이 끝나면 LLM은 피드백 화면에 필요한 섹션을 만든다.

대표 섹션은 아래와 같다.

| 섹션 | 역할 |
|---|---|
| `strengths` | 사용자가 이미 잘한 점 |
| `fixPoints` | 가장 먼저 고칠 점 |
| `secondaryLearningPoints` | 추가로 배울 만한 점 |
| `grammarFeedback` | 문법 오류와 수정 이유 |
| `corrections` | 개선 제안 |
| `refinementExpressions` | 답변을 더 자연스럽게 만드는 추천 표현 |
| `rewriteIdeas` | 다시쓰기 때 붙여볼 표현/이유/예시/디테일 |
| `modelAnswer` | 사용자의 답변을 한 단계 올린 영어 답안 |
| `modelAnswerKo` | 모델 답안의 한국어 의미 |
| `modelAnswerVariants` | 다른 방향의 모델 답안 변형 |
| `usedExpressions` | 사용자가 실제로 쓴 저장 가능 표현 |

여기서 중요한 점은 `modelAnswer`가 "완벽한 모범답안"이 아니라는 것이다.

WriteLoop에서 `modelAnswer`는 사용자의 현재 답변과 너무 멀어지지 않는 **한 단계 위의 제출 가능한 답안**에 가깝다.

## 9. answerBand란 무엇인가

`answerBand`는 사용자의 답변을 어떤 방식으로 도와야 하는지 정하는 핵심 분류다.

현재 질문 답변 피드백에는 아래 6가지 상태가 있다.

| answerBand | 의미 | 피드백 방향 |
|---|---|---|
| `TOO_SHORT_FRAGMENT` | 답변이 너무 짧거나 문장 조각에 가까움 | 먼저 한 문장으로 완성하게 돕는다 |
| `SHORT_BUT_VALID` | 짧지만 질문에는 답하고 있음 | 이유나 디테일을 한 가지 더 붙이게 한다 |
| `GRAMMAR_BLOCKING` | 문법 오류가 의미 전달을 막음 | 내용 확장보다 핵심 문장 복구를 우선한다 |
| `CONTENT_THIN` | 문법은 어느 정도 되지만 내용이 얇음 | 이유, 예시, 시간 흐름, 디테일을 추가하게 한다 |
| `NATURAL_BUT_BASIC` | 자연스럽지만 조금 단순함 | 큰 교정보다 표현 polish를 제안한다 |
| `OFF_TOPIC` | 질문과 맞지 않는 답변 | 질문에 맞는 핵심 답으로 다시 돌아오게 한다 |

이 분류가 중요한 이유는 같은 답변이라도 필요한 피드백이 다르기 때문이다.

예를 들어 문법이 크게 무너진 답변에는 "예시를 더 붙여 보세요"보다 "먼저 이 문장 구조를 고쳐 보세요"가 더 도움이 된다.
반대로 이미 자연스러운 답변에는 큰 빨간펜 피드백보다 "원하면 이 표현만 더 자연스럽게 바꿔 보세요"가 더 적절하다.

## 10. rewriteTarget과 primaryIssueCode

`answerBand`가 답변의 큰 상태라면, `primaryIssueCode`와 `rewriteTarget`은 다음 행동을 더 구체적으로 정한다.

예를 들어 LLM은 답변을 보고 아래 중 하나를 고를 수 있다.

| rewriteTarget action | 의미 |
|---|---|
| `MAKE_ON_TOPIC` | 질문 주제로 돌아와야 함 |
| `STATE_MAIN_ANSWER` | 핵심 답변을 먼저 말해야 함 |
| `FIX_BLOCKING_GRAMMAR` | 의미 전달을 막는 문법을 고쳐야 함 |
| `FIX_LOCAL_GRAMMAR` | 국소적인 문법 오류를 고쳐야 함 |
| `ADD_REASON` | 이유를 더해야 함 |
| `ADD_EXAMPLE` | 예시를 더해야 함 |
| `ADD_DETAIL` | 구체적인 디테일을 더해야 함 |
| `IMPROVE_NATURALNESS` | 표현을 더 자연스럽게 다듬어야 함 |

이 값은 UI에서 "먼저 고칠 부분", "다시쓰기 안내", "완료 버튼 노출 여부"를 결정하는 데 사용된다.

## 11. 섹션 정책 적용

LLM이 피드백 섹션을 만들었다고 해서 모두 그대로 보여주지는 않는다.

`SectionPolicySelector`가 `answerBand`에 따라 어떤 섹션을 얼마나 보여줄지 정한다.

예를 들어:

- `TOO_SHORT_FRAGMENT`는 강점은 짧게, 다시쓰기 scaffold는 강하게 보여준다.
- `GRAMMAR_BLOCKING`은 문법 카드와 최소 수정 문장을 우선한다.
- `CONTENT_THIN`은 내용 확장 아이디어와 표현 더하기를 더 적극적으로 보여준다.
- `NATURAL_BUT_BASIC`은 과한 교정보다 선택적인 polish를 보여준다.
- `OFF_TOPIC`은 모델 답안도 task reset 예시처럼 다룬다.

또한 두 번째 시도 이후에는 같은 설명이 반복되지 않도록 progress-aware overlay가 적용된다.
즉 사용자가 다시쓰기 중이면 피드백을 더 짧고 핵심적으로 보여주려는 방향이다.

## 12. LLM 결과 검증과 재생성

WriteLoop는 LLM 결과를 신뢰하되, 그대로 믿지는 않는다.

LLM이 만든 결과는 `FeedbackSectionValidators` 계열 로직을 통해 검증된다.
검증 실패 유형은 `FeedbackGenerationModels`의 `ValidationFailureCode`에 정의되어 있다.

대표적인 실패 유형은 아래와 같다.

| 실패 유형 | 의미 |
|---|---|
| `EMPTY_SECTION` | 필요한 섹션이 비어 있음 |
| `PLACEHOLDER` | `...`, `[something]` 같은 placeholder가 남아 있음 |
| `GENERIC_TEXT` | 너무 일반적인 조언만 있음 |
| `BROKEN_SPAN_REUSE` | 학습자의 어색한 표현을 그대로 추천함 |
| `NEAR_DUPLICATE` | 같은 내용이 반복됨 |
| `MEANING_DRIFT` | 사용자가 말하지 않은 내용으로 의미가 바뀜 |
| `MODEL_REGRESSION` | 모델 답안이 원래 답변보다 나빠짐 |
| `LOW_VALUE_REFINEMENT` | 추천 표현의 학습 가치가 낮음 |

검증 결과 문제가 있으면 일부 섹션만 다시 생성하거나, 백엔드의 deterministic fallback으로 보정한다.

이 장치가 필요한 이유는 LLM이 가끔 다음과 같은 실수를 하기 때문이다.

- 사용자가 쓰지 않은 사실을 모델 답안에 넣음
- 질문과 관련 없는 표현을 추천함
- 이미 틀린 표현을 "좋은 표현"으로 저장하게 함
- 너무 긴 문장을 추천 표현으로 내려줌
- 같은 조언을 여러 섹션에서 반복함

## 13. deterministic fallback의 역할

LLM이 실패하거나, 결과가 부족하거나, 특정 섹션이 신뢰하기 어렵다고 판단되면 백엔드가 보수적으로 피드백을 만든다.

이 fallback은 "LLM보다 더 멋진 피드백"을 만들기 위한 장치가 아니다.

목적은 최소한 아래를 보장하는 것이다.

- 사용자에게 빈 화면을 보여주지 않는다.
- 문법이 크게 무너진 답변은 최소 수정 문장이라도 제공한다.
- 질문에 맞지 않는 답변은 task reset 방향으로 안내한다.
- 추천 표현이 위험하면 제거한다.
- 모델 답안이 의미를 바꾸지 않도록 제한한다.

즉 fallback은 서비스 안정성을 위한 안전망이다.

## 14. UI 조립 방식

최종적으로 클라이언트가 받는 응답은 `FeedbackResponseDto`다.

하지만 현재 UI에서 중요한 부분은 그 안의 `ui` 필드, 즉 `FeedbackUiDto`다.

`FeedbackUiComposer`는 아래 요소들을 조립한다.

| UI 요소 | 설명 |
|---|---|
| `focusCard` | 이번 답변에서 가장 중요한 학습 목표 |
| `primaryFix` | 먼저 고칠 한 가지 |
| `microTip` | 짧은 팁 |
| `fixPoints` | 고칠 점 목록 |
| `nextStepPractice` | 다시쓰기 실천 안내 |
| `rewriteIdeas` | 표현 더하기/아이디어 카드 |
| `modelAnswerVariants` | 모델 답안 변형 |
| `screenPolicy` | 화면에 어떤 섹션을 펼칠지/숨길지 |
| `loopStatus` | 완료 가능 여부와 CTA 상태 |

여기서도 `answerBand`와 `completionState`가 중요하게 쓰인다.

## 15. completionState란 무엇인가

`CompletionStateSelector`는 사용자가 지금 답변을 완료해도 되는지 판단한다.

현재 상태는 크게 세 가지다.

| completionState | 의미 |
|---|---|
| `NEEDS_REVISION` | 다시쓰기가 필요함 |
| `OPTIONAL_POLISH` | 지금도 괜찮지만 원하면 다듬을 수 있음 |
| `CAN_FINISH` | 완료해도 되는 상태 |

예를 들어:

- `OFF_TOPIC`, `TOO_SHORT_FRAGMENT`, `SHORT_BUT_VALID`, `GRAMMAR_BLOCKING`은 보통 `NEEDS_REVISION`이다.
- 질문 과제를 충분히 수행하지 못했거나 `finishable=false`이면 `NEEDS_REVISION`이다.
- `NATURAL_BUT_BASIC`이고 문법 문제가 크지 않으면 `OPTIONAL_POLISH`가 될 수 있다.
- 과제 수행이 충분하고 큰 문제가 없으면 `CAN_FINISH`가 된다.

이 값은 클라이언트가 "다시쓰기"를 강하게 유도할지, "완료" 버튼을 보여줄지 결정하는 데 사용된다.

## 16. 저장되는 데이터

피드백이 생성되면 백엔드는 답변 시도 기록을 저장한다.

저장되는 주요 정보는 아래와 같다.

- 질문 ID
- 세션 ID
- 몇 번째 시도인지
- 사용자의 답변
- 점수
- 완료 여부
- LLM 피드백 결과
- UI 피드백 구조
- 진단 정보

이를 통해 사용자는 나중에 작문 기록을 다시 볼 수 있고, 서비스는 같은 세션에서 다시쓰기 흐름을 이어갈 수 있다.

## 17. 추천 표현과 저장 표현의 관계

피드백에는 여러 종류의 표현이 포함될 수 있다.

### usedExpressions

`usedExpressions`는 사용자가 실제 답변 안에서 쓴 표현 중 저장 가치가 있는 표현이다.

예를 들어 사용자가 `before I go to bed`라고 썼다면, 이 표현은 저장 가능한 표현이 될 수 있다.

단, 너무 긴 문장 전체나 어색한 문법 조각은 저장 표현으로 적합하지 않기 때문에 백엔드에서 걸러낸다.

### refinementExpressions

`refinementExpressions`는 사용자의 답변을 더 자연스럽게 만들기 위해 추천하는 표현이다.

예를 들어 `cheap price`를 더 자연스럽게 바꾸려면 `affordable` 또는 `not too expensive` 같은 표현이 추천될 수 있다.

### rewriteIdeas

`rewriteIdeas`는 단순 표현 추천보다 넓다.

다시쓰기 때 붙일 수 있는 이유, 예시, 디테일, 짧은 문장 아이디어를 포함한다.

예를 들어 "favorite food" 질문이라면:

- `It is easy to find near my home.`
- `I usually eat it with my friends.`
- `It tastes better when it is hot.`

같은 식으로 답변을 확장하는 아이디어가 될 수 있다.

## 18. modelAnswer의 원칙

`modelAnswer`는 사용자의 답변을 완전히 새로 써버리는 모범답안이 아니다.

기본 원칙은 아래와 같다.

- 사용자가 말한 의미를 유지한다.
- 사용자가 말하지 않은 사실을 마음대로 추가하지 않는다.
- 현재 답변보다 한 단계만 자연스럽게 만든다.
- 문법이 심각하면 최소 수정에 가깝게 만든다.
- 내용이 너무 얇으면 적당한 디테일을 붙일 수 있지만 과하게 확장하지 않는다.

이 원칙 때문에 `regressionSensitiveFacts`와 `expansionBudget` 같은 값이 중요하다.

`regressionSensitiveFacts`는 보존해야 할 사실이고, `expansionBudget`은 새 내용을 얼마나 추가해도 되는지를 제한한다.

## 19. 예시로 보는 피드백 흐름

아래 답변을 예로 들 수 있다.

```text
I like pizza and hamburger because it is easy to find and cheap price.
```

가능한 진단은 다음과 비슷하다.

```text
answerBand:
SHORT_BUT_VALID 또는 CONTENT_THIN

grammarSeverity:
MINOR 또는 MODERATE

primaryIssueCode:
FIX_LOCAL_GRAMMAR 또는 ADD_DETAIL

minimalCorrection:
I like pizza and hamburgers because they are easy to find and not too expensive.
```

이후 생성될 수 있는 피드백 방향은 다음과 같다.

- `pizza and hamburger`는 복수/일반명사 표현을 다듬는다.
- `cheap price`는 `not too expensive`처럼 자연스럽게 바꾼다.
- 이유는 있지만 조금 얇기 때문에 한 가지 개인 경험을 붙이면 더 좋아진다.
- 모델 답안은 사용자의 의미를 유지하면서 한두 문장으로 정리한다.
- rewriteIdeas에는 "I usually eat them after school." 같은 확장 아이디어가 들어갈 수 있다.

중요한 점은 이 답변을 갑자기 고급 에세이처럼 바꾸지 않는다는 것이다.
WriteLoop는 사용자가 다음 다시쓰기에서 실제로 따라 쓸 수 있는 수준을 우선한다.

## 20. 웹/모바일에서 받는 결과

웹과 모바일은 같은 백엔드 피드백 API를 사용한다.

다만 UI 표현은 플랫폼에 따라 다를 수 있다.

백엔드는 `FeedbackResponseDto` 안에 기존 필드와 현재 UI용 필드를 함께 내려준다.
최근 화면에서는 `ui` 내부의 구조화된 값이 더 중요하다.

클라이언트는 이 값을 사용해 아래 화면을 만든다.

- 현재 질문과 답변
- 이번 답변의 상태
- 먼저 고칠 부분
- 모델 답안
- 표현 더하기
- 다시쓰기 버튼
- 완료 버튼

## 21. 장애 또는 품질 문제를 볼 때 확인할 것

피드백이 생성되지 않거나 결과가 이상할 때는 아래 순서로 보면 좋다.

### 21-1. API 요청이 백엔드까지 도착했는가

백엔드 로그에 `FeedbackController` 또는 `FeedbackService` 관련 로그가 없다면, 클라이언트의 API 주소나 네트워크 설정 문제일 수 있다.

모바일에서는 특히 운영 빌드가 로컬 주소를 바라보고 있지 않은지 확인해야 한다.

### 21-2. LLM provider가 설정되어 있는가

`llm.feedback-provider`가 현재 원하는 provider인지 확인한다.

OpenAI를 쓰려면 OpenAI API key와 모델 설정이 필요하고, Gemini를 쓰려면 Gemini API key와 모델 설정이 필요하다.

### 21-3. LLM 응답이 JSON 스키마를 만족하는가

피드백 로직은 구조화된 JSON을 전제로 한다.

LLM이 스키마와 다른 응답을 주면 백엔드는 재생성하거나 fallback으로 전환할 수 있다.

### 21-4. 검증 단계에서 섹션이 제거되었는가

표현이 안 보이거나 모델 답안이 줄어들었다면, LLM이 안 내려준 것이 아니라 백엔드 검증에서 제거되었을 수 있다.

특히 아래 값들은 자주 필터링된다.

- 너무 긴 표현
- 어색한 원문 조각
- 질문과 관련 없는 표현
- `and`, `because`처럼 끝나는 dangling span
- 한국어 의미나 예문이 부족한 표현
- 모델 답안과 거의 중복되는 rewrite idea

### 21-5. answerBand가 예상과 다른가

피드백 방향이 이상하면 먼저 `answerBand`를 확인해야 한다.

예를 들어 사용자는 "내용을 더하라"는 피드백을 기대했는데 실제로는 문법 피드백만 나온다면, 답변이 `GRAMMAR_BLOCKING`으로 진단되었을 가능성이 있다.

## 22. 이 구조의 장점

현재 피드백 구조의 장점은 다음과 같다.

1. LLM provider를 교체할 수 있다.
2. 진단과 생성을 분리해 피드백 목표가 흔들리지 않는다.
3. answerBand에 따라 사용자 상태별 피드백을 줄 수 있다.
4. JSON 스키마 기반이라 웹/모바일 UI가 안정적으로 렌더링할 수 있다.
5. 검증/재생성/fallback이 있어 LLM 품질 흔들림을 줄인다.
6. 답변 기록과 진단 로그가 남아 품질 개선에 활용할 수 있다.

## 23. 앞으로 개선할 수 있는 지점

현재 구조 위에서 더 발전시킬 수 있는 방향은 아래와 같다.

- answerBand별 실제 사용자 완료율 분석
- rewriteIdeas 클릭/저장/재사용률 측정
- modelAnswer가 너무 쉬운지/어려운지 자동 평가
- 피드백 후 다시쓰기에서 개선된 지점 자동 표시
- OpenAI와 Gemini 결과 품질 비교 리포트 자동화
- 사용자의 반복 약점 기반 개인화 피드백
- 저장 표현과 피드백 표현을 연결한 복습 루프 강화

## 24. 처음 코드를 읽는 사람을 위한 추천 순서

처음 이 로직을 이해하려면 아래 순서로 읽는 것을 추천한다.

1. `FeedbackController.java`
2. `FeedbackRequestDto.java`
3. `FeedbackResponseDto.java`
4. `FeedbackService.java`
5. `LlmFeedbackClient.java`
6. `FeedbackLlmEngine.java`
7. `GeminiFeedbackClient.java` 또는 `OpenAiFeedbackClient.java`
8. `AnswerProfile.java`
9. `SectionPolicySelector.java`
10. `CompletionStateSelector.java`
11. `FeedbackUiComposer.java`

이 순서로 읽으면 API 진입점에서 시작해 LLM 생성, 검증, UI 조립까지 자연스럽게 따라갈 수 있다.

## 25. 결론

WriteLoop의 질문 답변 피드백 로직은 단순한 영어 교정 기능이 아니다.

핵심은 사용자의 답변을 학습 가능한 상태로 해석하고, 그 상태에 맞는 다음 행동을 제안하는 것이다.

이를 위해 백엔드는 LLM에게 구조화된 진단과 섹션 생성을 요청하고, 결과를 다시 검증한 뒤, `answerBand`, `completionState`, `screenPolicy`를 기준으로 화면에 맞게 재조립한다.

결과적으로 WriteLoop의 피드백은 아래 문장으로 요약할 수 있다.

> 사용자의 현재 답변을 기준으로, 지금 가장 도움이 되는 다음 한 걸음을 구조화해서 보여주는 피드백 시스템이다.

