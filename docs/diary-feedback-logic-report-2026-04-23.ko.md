# WriteLoop 영어일기 피드백 로직 보고서

작성일: 2026-04-23

이 문서는 WriteLoop의 **영어일기 피드백 기능**이 어떤 구조로 동작하는지 처음 보는 사람도 이해할 수 있도록 풀어서 설명한 보고서다.

특히 이 문서는 일반 영어 질문 답변 피드백과 영어일기 피드백이 어떻게 분리되어 있는지, 사용자가 일기를 제출했을 때 백엔드와 LLM, DB, 모바일 화면이 어떤 순서로 움직이는지 설명한다.

## 1. 한 줄 요약

영어일기 피드백은 사용자의 자유 영어일기를 받아서, 일반 질문 답변 피드백과 별도의 **일기 전용 엔진, 프롬프트, JSON 스키마, answerBand, 모바일 UI 타입**으로 처리하는 기능이다.

즉, 영어일기는 더 이상 일반 질문 피드백의 `FeedbackResponseDto`를 쓰지 않고, 일기 전용 `DiaryFeedbackResponseDto`를 중심으로 동작한다.

## 2. 왜 별도 피드백 로직이 필요한가

WriteLoop에는 크게 두 가지 쓰기 흐름이 있다.

- 질문 답변 쓰기: 정해진 질문에 답한다.
- 자유 영어일기 쓰기: 사용자가 오늘 있었던 일을 자유롭게 쓴다.

두 기능은 모두 영어 작문을 다룬다는 점에서는 비슷하지만, 실제 피드백 목표는 다르다.

질문 답변 피드백은 사용자가 질문에 맞게 대답했는지, 이유와 예시를 잘 붙였는지, 다시쓰기에서 어떻게 답변을 개선할지에 초점을 둔다.

반면 영어일기 피드백은 사용자의 하루 경험, 감정, 사건 흐름, 시간 순서, 개인적인 목소리를 최대한 유지하면서 더 자연스러운 영어 일기로 다듬는 것이 목표다.

그래서 영어일기에서는 다음 요소가 더 중요하다.

- 오늘 있었던 일이 시간 순서대로 이어지는가
- 사용자의 감정이 자연스럽게 드러나는가
- 일기다운 개인적인 톤이 유지되는가
- 영어 문법을 고치되, 사용자의 이야기를 새로 지어내지 않는가
- 다음 일기에서 다시 써볼 수 있는 작은 미션을 주는가

이 차이 때문에 영어일기 피드백은 일반 질문 답변 피드백과 완전히 분리된 구조로 설계되었다.

## 3. 전체 구조 요약

영어일기 피드백의 큰 흐름은 아래와 같다.

```text
모바일 영어일기 화면
  -> POST /api/diary/entries/{entryId}/feedback
  -> DiaryController
  -> DiaryService
  -> LlmDiaryFeedbackClient
  -> OpenAiDiaryFeedbackEngine 또는 GeminiDiaryFeedbackEngine
  -> DiaryFeedbackPromptSupport
  -> LLM JSON 응답
  -> DiaryFeedbackResponseDto
  -> diary_attempts 저장
  -> 모바일 DiaryFeedback UI 렌더링
```

일반 질문 답변 피드백과 비교하면 아래처럼 나뉜다.

```text
질문 답변 피드백
  FeedbackController
  FeedbackService
  LlmFeedbackClient
  OpenAiFeedbackClient / GeminiFeedbackClient
  FeedbackResponseDto

영어일기 피드백
  DiaryController
  DiaryService
  LlmDiaryFeedbackClient
  OpenAiDiaryFeedbackEngine / GeminiDiaryFeedbackEngine
  DiaryFeedbackResponseDto
```

공유하는 것은 HTTP 호출 보조 유틸리티나 JSON 파싱 도구 정도이고, 피드백 의미 구조와 프롬프트는 분리되어 있다.

## 4. 관련 주요 파일

### 백엔드 컨트롤러

- `apps/backend/src/main/java/com/writeloop/controller/DiaryController.java`

역할:

- 영어일기 생성
- 영어일기 수정
- 영어일기 목록 조회
- 영어일기 단건 조회
- 영어일기 삭제
- 영어일기 피드백 생성 요청 처리

피드백 생성 API:

```text
POST /api/diary/entries/{entryId}/feedback
```

요청 본문은 `DiaryFeedbackRequestDto`를 사용한다.

### 백엔드 서비스

- `apps/backend/src/main/java/com/writeloop/service/DiaryService.java`

역할:

- 사용자가 해당 일기의 소유자인지 확인한다.
- 피드백을 받을 일기 본문을 결정한다.
- LLM 호출용 컨텍스트를 만든다.
- 일기 전용 LLM 클라이언트를 호출한다.
- LLM 실패 시 로컬 fallback 피드백을 만든다.
- 피드백 결과를 `diary_attempts`에 저장한다.
- DB에서 저장된 일기와 피드백을 DTO로 복원한다.

### 일기 전용 LLM 라우터

- `apps/backend/src/main/java/com/writeloop/service/LlmDiaryFeedbackClient.java`

역할:

- 설정값에 따라 OpenAI 또는 Gemini 일기 피드백 엔진을 선택한다.
- `llm.diary-feedback-provider` 값을 우선 사용한다.
- 설정된 provider가 없으면 Gemini를 기본 후보로 본다.

### 일기 전용 LLM 엔진

- `apps/backend/src/main/java/com/writeloop/service/OpenAiDiaryFeedbackEngine.java`
- `apps/backend/src/main/java/com/writeloop/service/GeminiDiaryFeedbackEngine.java`

역할:

- 실제 OpenAI 또는 Gemini API를 호출한다.
- 일기 전용 프롬프트와 JSON 스키마를 함께 전달한다.
- 응답을 `DiaryFeedbackResponseDto`로 파싱한다.

### 일기 전용 프롬프트와 JSON 스키마

- `apps/backend/src/main/java/com/writeloop/service/DiaryFeedbackPromptSupport.java`

역할:

- LLM에게 전달할 일기 전용 프롬프트를 만든다.
- LLM이 반드시 따라야 하는 JSON 스키마를 정의한다.

### 일기 전용 DTO

- `apps/backend/src/main/java/com/writeloop/dto/DiaryFeedbackResponseDto.java`
- `apps/backend/src/main/java/com/writeloop/dto/DiaryAnswerBand.java`
- `apps/backend/src/main/java/com/writeloop/dto/DiaryCorrectionPointDto.java`
- `apps/backend/src/main/java/com/writeloop/dto/DiaryFlowDto.java`
- `apps/backend/src/main/java/com/writeloop/dto/DiaryExpressionDto.java`
- `apps/backend/src/main/java/com/writeloop/dto/DiaryRewriteIdeaDto.java`
- `apps/backend/src/main/java/com/writeloop/dto/DiaryMissionDto.java`

역할:

- LLM 응답을 백엔드와 모바일이 같은 구조로 이해할 수 있게 만든다.

### DB 스키마

- `infra/mysql/schema/058-create-diary-entries.sql`
- `infra/mysql/schema/059-add-diary-feedback-metadata.sql`

역할:

- 영어일기 본문과 피드백 시도 기록을 저장한다.
- 일기 전용 answerBand와 schemaVersion, provider 정보를 저장한다.

### 모바일 타입과 UI

- `apps/mobile/src/lib/types.ts`
- `apps/mobile/src/lib/api.ts`
- `apps/mobile/src/components/diary-entry-screen.tsx`

역할:

- 모바일에서 일기 전용 JSON 응답을 `DiaryFeedback` 타입으로 받는다.
- 일반 질문 피드백 타입인 `Feedback`과 섞지 않는다.
- 일기 피드백 화면에 일기 흐름, 표현, 다시쓰기 미션을 보여준다.

## 5. 사용자 흐름 기준 상세 처리 과정

이 절에서는 사용자가 모바일에서 영어일기를 쓰고 AI 피드백을 누르는 순간부터 결과가 화면에 보이기까지를 순서대로 설명한다.

### 5-1. 사용자가 일기를 작성한다

모바일의 `DiaryEntryScreen`에서 사용자는 다음 정보를 입력할 수 있다.

- 날짜
- 제목
- 기분 태그
- 영어일기 본문

본문 예시:

```text
Today I went to the hospital because I caught a cold last night.
I met the doctor and he told me that I should drink warm water.
When I got back home, my mom made me warm soup.
```

이 단계에서는 아직 피드백이 생성되지 않는다.

### 5-2. 사용자가 AI 피드백 받기를 누른다

모바일 화면에서 `AI 피드백 받기` 버튼을 누르면 `requestDiaryFeedback` 함수가 호출된다.

위치:

- `apps/mobile/src/lib/api.ts`

요청은 아래 API로 전송된다.

```text
POST /api/diary/entries/{entryId}/feedback
```

요청 본문은 대략 다음 형태다.

```json
{
  "bodyText": "Today I went to the hospital...",
  "attemptType": "INITIAL"
}
```

`attemptType`은 첫 제출인지 다시쓰기 제출인지 구분하기 위한 값이다.

### 5-3. DiaryController가 요청을 받는다

위치:

- `DiaryController.generateFeedback`

컨트롤러는 먼저 현재 로그인 사용자를 확인한다.

현재 사용자를 확인하지 못하면 401 에러를 반환한다.

사용자가 확인되면 아래 서비스 메서드를 호출한다.

```java
diaryService.generateFeedback(currentUserId, entryId, request)
```

컨트롤러는 피드백 자체를 만들지 않는다. 컨트롤러의 역할은 요청을 받아 서비스로 넘기는 것이다.

### 5-4. DiaryService가 일기 소유권을 확인한다

위치:

- `DiaryService.requireOwnedEntry`

서비스는 `entryId`와 `userId`를 함께 사용해서 DB에서 일기를 찾는다.

이렇게 하는 이유는 다른 사용자의 일기 ID를 알고 있더라도 접근할 수 없게 막기 위해서다.

일기가 없거나 다른 사용자의 일기라면 404 에러를 반환한다.

### 5-5. 피드백 대상 본문을 결정한다

위치:

- `DiaryService.generateFeedback`

피드백 대상 본문은 아래 우선순위로 정해진다.

1. 요청 본문에 `bodyText`가 있으면 그 값을 사용한다.
2. `bodyText`가 비어 있으면 DB에 저장된 일기 본문을 사용한다.

본문이 완전히 비어 있으면 피드백을 만들 수 없으므로 400 에러를 반환한다.

또한 요청으로 들어온 본문이 DB의 기존 본문과 다르거나, 일기가 draft 상태라면 DB의 일기 본문을 최신 내용으로 업데이트하고 draft를 해제한다.

이렇게 하면 사용자가 피드백을 받은 텍스트와 DB에 남는 일기 본문이 서로 어긋나지 않는다.

### 5-6. attemptNo를 계산한다

위치:

- `DiaryService.generateFeedback`

한 일기에 대해 여러 번 피드백을 받을 수 있으므로 `attemptNo`를 계산한다.

계산 방식:

```text
현재 entryId에 저장된 diary_attempts 개수 + 1
```

예를 들어 같은 일기에 처음 피드백을 받으면 `attemptNo = 1`, 다시 쓴 뒤 한 번 더 받으면 `attemptNo = 2`가 된다.

이전 시도 본문도 함께 조회한다.

이전 본문은 LLM에게 넘겨서, 다시쓰기 피드백을 만들 때 이전 버전과 비교할 수 있는 맥락으로 사용할 수 있다.

### 5-7. DiaryFeedbackPromptContext를 만든다

위치:

- `DiaryService.reviewDiaryEntry`
- `DiaryFeedbackPromptContext`

LLM에게 넘길 재료를 하나의 컨텍스트로 묶는다.

포함되는 값:

- entryId
- attemptNo
- title
- entryDate
- mood
- diaryText
- previousDiaryText

이 컨텍스트는 프롬프트 생성에 사용된다.

## 6. LLM provider 선택 구조

영어일기 피드백은 `LlmDiaryFeedbackClient`가 provider를 선택한다.

설정값:

```yaml
llm:
  diary-feedback-provider: ${LLM_DIARY_FEEDBACK_PROVIDER:${LLM_FEEDBACK_PROVIDER:gemini}}
```

동작 방식:

1. `LLM_DIARY_FEEDBACK_PROVIDER`가 있으면 그 값을 사용한다.
2. 없으면 `LLM_FEEDBACK_PROVIDER` 값을 사용한다.
3. 그것도 없으면 기본값으로 `gemini`를 사용한다.

선택 가능한 provider:

- `openai`
- `gemini`

이 구조 덕분에 일반 질문 피드백은 Gemini로 두고, 영어일기 피드백만 OpenAI로 바꾸는 식의 운영이 가능하다.

예시:

```env
LLM_FEEDBACK_PROVIDER=gemini
LLM_DIARY_FEEDBACK_PROVIDER=openai
```

이 경우 일반 질문 피드백은 Gemini를 쓰고, 영어일기 피드백은 OpenAI를 쓴다.

## 7. OpenAI 일기 피드백 엔진

위치:

- `OpenAiDiaryFeedbackEngine`

이 엔진은 OpenAI Responses API에 요청을 보낸다.

사용 설정:

```yaml
openai:
  diary-model: ${OPENAI_DIARY_MODEL:${OPENAI_FEEDBACK_MODEL:${OPENAI_MODEL:gpt-5-mini}}}
  diary-reasoning-effort: ${OPENAI_DIARY_REASONING_EFFORT:${OPENAI_FEEDBACK_REASONING_EFFORT:}}
  diary-request-timeout-seconds: ${OPENAI_DIARY_REQUEST_TIMEOUT_SECONDS:${OPENAI_FEEDBACK_REQUEST_TIMEOUT_SECONDS:120}}
```

요청에 들어가는 핵심 요소:

- 모델명
- 일기 전용 프롬프트
- 일기 전용 JSON 스키마
- reasoning effort 설정
- timeout 설정

OpenAI 응답이 성공하면 응답 본문에서 구조화된 JSON 텍스트를 추출하고 `DiaryFeedbackResponseDto`로 변환한다.

OpenAI 응답이 실패하면 예외를 던지고, 상위 `DiaryService`에서 fallback 피드백으로 전환한다.

## 8. Gemini 일기 피드백 엔진

위치:

- `GeminiDiaryFeedbackEngine`

이 엔진은 Gemini `generateContent` API에 요청을 보낸다.

사용 설정:

```yaml
gemini:
  diary-model: ${GEMINI_DIARY_MODEL:${GEMINI_FEEDBACK_MODEL:${GEMINI_MODEL:gemini-3-flash-preview}}}
  diary-thinking-budget: ${GEMINI_DIARY_THINKING_BUDGET:${GEMINI_FEEDBACK_THINKING_BUDGET:16000}}
  diary-request-timeout-seconds: ${GEMINI_DIARY_REQUEST_TIMEOUT_SECONDS:${GEMINI_FEEDBACK_REQUEST_TIMEOUT_SECONDS:120}}
```

요청에 들어가는 핵심 요소:

- 모델명
- 일기 전용 프롬프트
- 일기 전용 JSON 스키마
- thinking budget 설정
- timeout 설정

Gemini 응답이 성공하면 응답에서 JSON 텍스트를 추출하고 `DiaryFeedbackResponseDto`로 변환한다.

Gemini 응답이 실패하면 예외를 던지고, 상위 `DiaryService`에서 fallback 피드백으로 전환한다.

## 9. 일기 전용 프롬프트 설계

위치:

- `DiaryFeedbackPromptSupport.buildPrompt`

프롬프트의 핵심 지시사항은 아래와 같다.

### 9-1. 일기를 질문 답변으로 보지 말 것

프롬프트는 LLM에게 사용자의 글을 “quiz answer”가 아니라 “personal English diary entry”로 읽으라고 지시한다.

이것이 중요한 이유는 일기는 정답을 맞히는 글이 아니기 때문이다.

예를 들어 질문 답변에서는 질문에 정확히 답했는지가 중요하지만, 일기에서는 사용자의 하루, 감정, 순서, 개인적인 표현이 중요하다.

### 9-2. 사용자의 사실과 감정을 지어내지 말 것

프롬프트는 다음을 새로 만들지 말라고 지시한다.

- 새로운 사건
- 새로운 감정
- 새로운 의학적 사실
- 진단
- 원인
- 결과

예를 들어 사용자가 “병원에 갔다”고만 썼는데, LLM이 “I had the flu”처럼 독감 진단을 만들어내면 안 된다.

### 9-3. correctedDiary와 modelDiary의 역할을 나눌 것

프롬프트는 두 종류의 다듬은 문장을 요구한다.

- `correctedDiary`: 사용자의 원문에 가깝게 문법과 표현을 고친 버전
- `modelDiary`: 한 단계 더 자연스러운 일기 버전

차이는 아래와 같다.

`correctedDiary`는 사용자의 문장에 최대한 붙어 있어야 한다.

`modelDiary`는 조금 더 자연스러운 흐름과 표현을 보여줄 수 있지만, 사용자가 쓰지 않은 사실을 새로 넣으면 안 된다.

### 9-4. 추가 아이디어는 modelDiary가 아니라 rewriteIdeas에 넣을 것

LLM이 “감정을 더 넣어보면 좋겠다”, “마지막에 배운 점을 붙이면 좋겠다” 같은 제안을 할 수 있다.

하지만 그런 내용이 사용자의 실제 일기에 없었다면 `modelDiary`에 직접 넣지 않는다.

대신 `rewriteIdeas`에 제안으로 넣는다.

이렇게 하면 사용자의 실제 경험을 왜곡하지 않으면서도 다시쓰기 방향을 줄 수 있다.

### 9-5. nextDiaryMission은 작고 쉬운 미션 하나만 줄 것

일기는 부담 없이 계속 쓰게 만드는 것이 중요하다.

그래서 프롬프트는 `nextDiaryMission`을 하나의 작은 미션으로 제한한다.

예시:

```text
오늘 있었던 일 뒤에 기분이나 이유를 한 문장 더 붙여 다시 써보세요.
```

## 10. 일기 전용 answerBand

위치:

- `DiaryAnswerBand.java`

일기 전용 answerBand는 사용자의 일기 상태를 분류하는 값이다.

현재 값은 6개다.

### DIARY_TOO_SHORT

영어 문장이 너무 짧거나 조각 수준이라 일기로 피드백하기 어려운 상태다.

예시:

```text
Good day.
```

이 경우에는 문법 교정보다 내용을 조금 더 쓰게 하는 것이 우선이다.

### DIARY_NOT_ENGLISH

대부분 한국어이거나 영어가 거의 없는 상태다.

예시:

```text
오늘 병원에 갔다. 감기에 걸렸다.
```

이 경우에는 먼저 쉬운 영어 문장으로 옮기는 것이 목표다.

### DIARY_GRAMMAR_BLOCKING

사건이나 감정은 보이지만 문법 오류가 의미 전달을 막는 상태다.

예시:

```text
Yesterday I go hospital because cold catch.
```

이 경우에는 자연스러운 표현보다 의미가 통하게 핵심 문장을 복구하는 것이 우선이다.

### DIARY_FLOW_THIN

영어는 이해되지만 일기 흐름이 얇은 상태다.

즉, 사건은 있지만 시간 흐름, 감정, 결과, 마무리가 부족하다.

예시:

```text
I went to school. I studied English. I came home.
```

이 경우에는 감정이나 디테일을 붙이도록 유도한다.

### DIARY_CLEAR_BASIC

일기로서 의미가 잘 전달되고, 가벼운 문법이나 자연스러움만 다듬으면 되는 상태다.

이 경우에는 `correctedDiary`, `modelDiary`, 표현 제안, 작은 rewrite mission이 균형 있게 제공된다.

### DIARY_NATURAL_COMPLETE

이미 자연스럽고 개인적인 일기처럼 잘 쓰인 상태다.

이 경우에는 큰 수정 대신 optional polish나 더 좋은 표현 정도만 제안하는 것이 적절하다.

## 11. 일기 전용 JSON 응답 구조

위치:

- `DiaryFeedbackResponseDto.java`

LLM은 반드시 `diary-feedback-v1` 스키마에 맞는 JSON을 내려야 한다.

대표 필드는 아래와 같다.

### schemaVersion

현재 값:

```text
diary-feedback-v1
```

프론트와 백엔드가 이 피드백이 어떤 버전의 구조인지 알기 위한 값이다.

### entryId

피드백 대상 일기의 ID다.

LLM이 잘못 내려도 백엔드에서 실제 entryId로 다시 덮어쓴다.

### attemptNo

해당 일기의 몇 번째 피드백인지 나타낸다.

마찬가지로 백엔드에서 실제 attemptNo로 다시 덮어쓴다.

### score

0부터 100 사이의 점수다.

`DiaryFeedbackResponseDto` 생성자에서 0 미만이면 0, 100 초과면 100으로 보정한다.

### finishable

사용자가 이 일기를 여기서 마무리해도 되는지 나타낸다.

예를 들어 너무 짧은 일기라면 `false`, 어느 정도 자연스럽다면 `true`가 될 수 있다.

### diaryAnswerBand

위에서 설명한 일기 상태 분류값이다.

모바일 화면의 헤드라인도 이 값에 따라 달라진다.

### summaryKo

한국어 요약 피드백이다.

예시:

```text
일기의 흐름이 잘 보입니다. 몇 군데 표현만 더 자연스럽게 다듬으면 좋아요.
```

### strengths

사용자가 잘한 점이다.

짧은 한국어 문장 1개에서 3개 정도를 기대한다.

예시:

```json
[
  "하루에 있었던 일을 직접 영어로 정리했어요.",
  "문장의 기본 의미가 잘 전달돼요."
]
```

### correctedDiary

사용자의 원문에 가장 가까운 다듬은 버전이다.

목표는 “원문 보존 + 필요한 수정”이다.

### modelDiary

한 단계 더 자연스러운 일기 버전이다.

목표는 “사용자가 다음에 참고할 수 있는 자연스러운 일기 예시”다.

단, 사용자가 쓰지 않은 사건이나 감정은 새로 만들면 안 된다.

### modelDiaryKo

`modelDiary`의 한국어 의미 설명이다.

### fixPoints

고치면 더 자연스러운 부분이다.

각 항목은 다음 값을 가진다.

- kind
- title
- originalText
- revisedText
- reasonKo
- exampleEn

예시:

```json
{
  "kind": "GRAMMAR",
  "title": "시제 자연스럽게 고치기",
  "originalText": "I go to hospital",
  "revisedText": "I went to the hospital",
  "reasonKo": "어제 있었던 일을 말하므로 went가 자연스러워요.",
  "exampleEn": "Yesterday, I went to the hospital."
}
```

### diaryFlow

일기 흐름에 대한 코칭이다.

포함 필드:

- timeFlow
- emotion
- detail
- reflection
- commentKo
- connectionTips

이 필드는 문법 교정보다 “일기답게 만드는 흐름”을 다룬다.

예를 들어 사건만 나열된 일기라면 감정이나 마무리 문장을 붙이라고 안내할 수 있다.

### rewriteIdeas

다시 쓸 때 붙여볼 아이디어다.

`modelDiary`에 바로 추가하지 않은 선택적 아이디어를 여기에 담는다.

예시:

```json
{
  "title": "기분 한 문장 추가하기",
  "english": "I felt relieved after seeing the doctor.",
  "meaningKo": "의사를 보고 나서 안심이 됐어요.",
  "noteKo": "병원에 간 뒤 느낀 감정을 붙이면 일기 흐름이 좋아져요.",
  "exampleEn": "I felt relieved after seeing the doctor."
}
```

### usedDiaryExpressions

사용자가 이미 잘 쓴 표현 중 다시 써먹을 만한 표현이다.

예를 들어 사용자가 `When I got back home`을 잘 썼다면 이 필드에 들어갈 수 있다.

### diaryExpressions

사용자가 다음 일기에서 써볼 수 있는 추천 표현이다.

예시:

```json
{
  "expression": "After that",
  "meaningKo": "그 후에",
  "exampleEn": "After that, I went home and rested.",
  "usageTipKo": "일기에서 다음 일을 이어 말할 때 좋아요.",
  "tags": ["시간 흐름", "일기 표현"]
}
```

### nextDiaryMission

다음 다시쓰기에서 해볼 작은 미션이다.

포함 필드:

- focus
- titleKo
- instructionKo
- starterEn

예시:

```json
{
  "focus": "DETAIL",
  "titleKo": "디테일 한 문장 추가",
  "instructionKo": "오늘 있었던 일 뒤에 기분이나 이유를 한 문장 더 붙여 다시 써보세요.",
  "starterEn": "After that, I felt..."
}
```

### safetyFlags

안전 관련 플래그다.

문제가 없으면 `NONE`을 넣도록 프롬프트에서 지시한다.

현재는 안전 대응을 깊게 처리하기보다는, 향후 확장을 위한 필드에 가깝다.

## 12. DB 저장 구조

영어일기는 두 테이블에 저장된다.

### diary_entries

사용자의 일기 본문 자체를 저장한다.

주요 컬럼:

- id
- user_id
- title
- entry_text
- language
- entry_date
- mood
- tags_json
- is_draft
- created_at
- updated_at

`diary_entries`는 “오늘 쓴 일기 한 편”을 의미한다.

### diary_attempts

한 일기에 대해 피드백을 받은 기록을 저장한다.

주요 컬럼:

- entry_id
- attempt_no
- diary_text
- score
- answer_band
- feedback_schema_version
- feedback_provider
- feedback_model
- feedback_summary
- strengths_json
- corrections_json
- model_answer
- rewrite_challenge
- feedback_payload_json
- created_at

`diary_attempts`는 “이 일기에 대해 몇 번째로 받은 피드백인가”를 의미한다.

중요한 점은 `feedback_payload_json`에 일기 전용 전체 JSON 응답을 저장한다는 것이다.

즉, 현재 화면에서 쓰지 않는 필드가 있어도 나중에 UI를 개선할 때 과거 피드백을 다시 활용할 수 있다.

## 13. 피드백 저장 방식

LLM 응답이 `DiaryFeedbackResponseDto`로 만들어지면 `DiaryService`는 이를 `DiaryAttemptEntity`로 저장한다.

저장 시 주요 매핑은 아래와 같다.

```text
feedback.score                 -> diary_attempts.score
feedback.diaryAnswerBand       -> diary_attempts.answer_band
feedback.schemaVersion         -> diary_attempts.feedback_schema_version
diaryFeedbackClient.provider() -> diary_attempts.feedback_provider
feedback.summaryKo             -> diary_attempts.feedback_summary
feedback.strengths             -> diary_attempts.strengths_json
feedback.fixPoints             -> diary_attempts.corrections_json
feedback.modelDiary            -> diary_attempts.model_answer
feedback.nextDiaryMission      -> diary_attempts.rewrite_challenge
전체 feedback JSON             -> diary_attempts.feedback_payload_json
```

`model_answer`, `rewrite_challenge` 같은 컬럼명은 기존 구조와 비슷하게 남아 있지만, 실제 전체 구조의 기준은 `feedback_payload_json`이다.

## 14. 저장된 피드백을 다시 불러오는 방식

일기 상세 화면이나 목록 화면에서 DB의 `diary_attempts`를 읽으면 `DiaryService.toAttemptDto`가 실행된다.

우선순위는 아래와 같다.

1. `feedback_payload_json`이 있으면 이를 `DiaryFeedbackResponseDto`로 복원한다.
2. `feedback_payload_json`이 없거나 파싱 실패하면 저장된 요약 컬럼들로 최소 피드백을 만든다.

두 번째 방식은 과거 데이터나 깨진 payload를 위한 보호 장치다.

이 경우 `safetyFlags`에 `LEGACY_PAYLOAD`가 들어간다.

## 15. LLM 실패 시 fallback 로직

LLM 호출이 실패할 수 있는 경우가 있다.

예를 들어:

- API 키가 없음
- 외부 LLM API 장애
- timeout 발생
- 응답 JSON 파싱 실패
- provider 설정 문제

이때 `DiaryService.reviewDiaryEntry`는 예외를 잡고 `buildFallbackFeedback`을 호출한다.

fallback은 LLM 없이 로컬에서 만드는 최소 피드백이다.

fallback의 주요 기준:

- 단어 수가 4개 미만이면 `DIARY_TOO_SHORT`
- ASCII 영어 글자가 없으면 `DIARY_NOT_ENGLISH`
- 단어 수가 16개 미만이면 `DIARY_FLOW_THIN`
- 그 외에는 `DIARY_CLEAR_BASIC`

fallback은 완전한 LLM 피드백만큼 정교하지는 않지만, 사용자가 아무 응답도 받지 못하는 상황을 피하게 해준다.

fallback 피드백에는 `safetyFlags`에 `LOCAL_FALLBACK`이 들어간다.

## 16. 모바일에서 피드백을 받는 방식

모바일은 `requestDiaryFeedback`에서 백엔드 응답을 받는다.

위치:

- `apps/mobile/src/lib/api.ts`

이 함수는 백엔드 응답을 그대로 믿지 않고 `normalizeDiaryFeedbackPayload`로 정리한다.

정리하는 이유:

- 누락된 배열은 빈 배열로 만든다.
- 점수는 0에서 100 사이로 보정한다.
- answerBand가 이상하면 `DIARY_CLEAR_BASIC`으로 보정한다.
- 문자열이 아닌 값은 빈 문자열 또는 null로 정리한다.

이렇게 하면 모바일 UI가 예상하지 못한 값 때문에 쉽게 깨지지 않는다.

## 17. 모바일 UI 렌더링 방식

위치:

- `apps/mobile/src/components/diary-entry-screen.tsx`

모바일 UI는 `DiaryFeedback` 타입만 사용한다.

일반 질문 피드백의 `Feedback`, `FeedbackUi`, `modelAnswerVariants`, `refinementExpressions`를 쓰지 않는다.

화면에 보여주는 주요 영역은 아래와 같다.

### 17-1. 헤드라인

`diaryAnswerBand`에 따라 헤드라인이 달라진다.

예시:

```text
DIARY_TOO_SHORT -> 조금만 더 쓰면 좋은 일기가 돼요
DIARY_NOT_ENGLISH -> 쉬운 영어 문장으로 옮겨보면 좋아요
DIARY_GRAMMAR_BLOCKING -> 의미가 보이도록 문장을 먼저 정리했어요
DIARY_FLOW_THIN -> 일기의 흐름을 더 살릴 수 있어요
DIARY_NATURAL_COMPLETE -> 이미 자연스러운 일기예요
```

### 17-2. 점수

`score`를 원형 배지로 보여준다.

### 17-3. 요약 피드백

`summaryKo`를 보여준다.

### 17-4. 좋았던 점

`strengths`를 최대 3개까지 보여준다.

### 17-5. 고치면 더 자연스러운 부분

`fixPoints`를 카드 형태로 보여준다.

각 카드에는 원문, 수정문, 설명, 예문이 들어갈 수 있다.

### 17-6. 일기 흐름 코칭

`diaryFlow`를 보여준다.

이 영역은 일기 전용 UI에서 특히 중요한 영역이다.

문법만 고치는 것이 아니라 다음을 안내한다.

- 시간 흐름
- 감정
- 디테일
- 마무리

### 17-7. 다듬은 일기

`correctedDiary`를 보여준다.

사용자 원문에 가까운 수정본이다.

### 17-8. 자연스러운 예시

`modelDiary`를 보여준다.

한 단계 더 자연스러운 일기 예시다.

### 17-9. 일기에 써볼 표현

`usedDiaryExpressions`와 `diaryExpressions`를 합쳐서 보여준다.

즉, 사용자가 이미 잘 쓴 표현과 새로 추천받은 표현을 함께 보여준다.

### 17-10. 다시 쓸 때 붙여볼 아이디어

`rewriteIdeas`를 보여준다.

### 17-11. 다시 써보기 미션

`nextDiaryMission`을 보여준다.

사용자가 다시쓰기 버튼을 누르면 `starterEn`, `correctedDiary`, `modelDiary` 중 사용 가능한 값을 바탕으로 rewrite 입력값이 준비된다.

## 18. 일반 질문 피드백과 완전히 분기된 지점

영어일기 피드백은 아래 지점에서 일반 질문 피드백과 분리되어 있다.

### 18-1. API 분리

질문 답변:

```text
POST /api/feedback
```

영어일기:

```text
POST /api/diary/entries/{entryId}/feedback
```

### 18-2. 서비스 분리

질문 답변:

```text
FeedbackService
```

영어일기:

```text
DiaryService
```

### 18-3. LLM 클라이언트 분리

질문 답변:

```text
LlmFeedbackClient
```

영어일기:

```text
LlmDiaryFeedbackClient
```

### 18-4. LLM 엔진 분리

질문 답변:

```text
OpenAiFeedbackClient
GeminiFeedbackClient
```

영어일기:

```text
OpenAiDiaryFeedbackEngine
GeminiDiaryFeedbackEngine
```

### 18-5. 프롬프트 분리

질문 답변은 질문 답변용 프롬프트를 사용한다.

영어일기는 `DiaryFeedbackPromptSupport`에서 만든 일기 전용 프롬프트를 사용한다.

### 18-6. 응답 DTO 분리

질문 답변:

```text
FeedbackResponseDto
```

영어일기:

```text
DiaryFeedbackResponseDto
```

### 18-7. 모바일 타입 분리

질문 답변:

```text
Feedback
```

영어일기:

```text
DiaryFeedback
```

## 19. 설정값 정리

영어일기 피드백 관련 설정은 `application.yml`에서 관리한다.

### provider 설정

```yaml
llm:
  diary-feedback-provider: ${LLM_DIARY_FEEDBACK_PROVIDER:${LLM_FEEDBACK_PROVIDER:gemini}}
```

### Gemini 설정

```yaml
gemini:
  diary-model: ${GEMINI_DIARY_MODEL:${GEMINI_FEEDBACK_MODEL:${GEMINI_MODEL:gemini-3-flash-preview}}}
  diary-thinking-budget: ${GEMINI_DIARY_THINKING_BUDGET:${GEMINI_FEEDBACK_THINKING_BUDGET:16000}}
  diary-request-timeout-seconds: ${GEMINI_DIARY_REQUEST_TIMEOUT_SECONDS:${GEMINI_FEEDBACK_REQUEST_TIMEOUT_SECONDS:120}}
```

### OpenAI 설정

```yaml
openai:
  diary-model: ${OPENAI_DIARY_MODEL:${OPENAI_FEEDBACK_MODEL:${OPENAI_MODEL:gpt-5-mini}}}
  diary-reasoning-effort: ${OPENAI_DIARY_REASONING_EFFORT:${OPENAI_FEEDBACK_REASONING_EFFORT:}}
  diary-request-timeout-seconds: ${OPENAI_DIARY_REQUEST_TIMEOUT_SECONDS:${OPENAI_FEEDBACK_REQUEST_TIMEOUT_SECONDS:120}}
```

## 20. 예시 응답

아래는 LLM이 내려야 하는 일기 피드백 JSON의 예시다.

```json
{
  "schemaVersion": "diary-feedback-v1",
  "entryId": "entry-123",
  "attemptNo": 1,
  "score": 78,
  "finishable": true,
  "diaryAnswerBand": "DIARY_CLEAR_BASIC",
  "summaryKo": "하루의 흐름이 잘 보이고, 몇 군데 표현만 다듬으면 더 자연스러워져요.",
  "strengths": [
    "오늘 있었던 일을 시간 순서대로 잘 적었어요.",
    "병원에 간 이유와 집에 돌아온 뒤의 상황이 잘 연결돼요."
  ],
  "correctedDiary": "Today, I went to the hospital because I caught a cold last night. I saw the doctor, and he told me to drink warm water and sleep well. Then I got a prescription for medicine. When I got back home, my mom made me warm soup. It helped me feel better.",
  "modelDiary": "Today, I went to the hospital because I caught a cold last night. The doctor told me to drink warm water and get enough rest. After that, I got a prescription for medicine. When I came back home, my mom made warm soup for me, and it helped me feel better.",
  "modelDiaryKo": "오늘 감기에 걸려 병원에 갔고, 의사의 조언을 들은 뒤 집에서 따뜻한 수프를 먹고 나아졌다는 내용이에요.",
  "fixPoints": [
    {
      "kind": "WORDING",
      "title": "prescript는 prescription이 자연스러워요",
      "originalText": "I got some prescript",
      "revisedText": "I got a prescription",
      "reasonKo": "약 처방은 영어로 prescription이라고 말해요.",
      "exampleEn": "I got a prescription for medicine."
    }
  ],
  "diaryFlow": {
    "timeFlow": "병원에 간 일, 의사의 조언, 집에 돌아온 일을 순서대로 잘 썼어요.",
    "emotion": "마지막에 기분이 나아졌다는 감정이 들어가서 좋아요.",
    "detail": "따뜻한 물, 약 처방, 수프 같은 구체적인 디테일이 있어요.",
    "reflection": "마지막에 몸이 나아졌다는 결과가 있어 일기답게 마무리돼요.",
    "commentKo": "시간 흐름과 결과가 잘 보이는 일기예요. 몇 군데 단어만 고치면 더 자연스러워요.",
    "connectionTips": ["After that", "When I got back home"]
  },
  "rewriteIdeas": [
    {
      "title": "몸 상태를 한 문장 더 붙이기",
      "english": "I still felt tired, but I was relieved.",
      "meaningKo": "아직 피곤했지만 안심이 됐어요.",
      "noteKo": "병원에 다녀온 뒤의 감정을 붙이면 일기 느낌이 더 살아나요.",
      "exampleEn": "I still felt tired, but I was relieved."
    }
  ],
  "usedDiaryExpressions": [
    {
      "expression": "When I got back home",
      "meaningKo": "집에 돌아왔을 때",
      "exampleEn": "When I got back home, I rested.",
      "usageTipKo": "집에 돌아온 뒤의 일을 이어 말할 때 좋아요.",
      "tags": ["시간 흐름", "일기 표현"]
    }
  ],
  "diaryExpressions": [
    {
      "expression": "get enough rest",
      "meaningKo": "충분히 쉬다",
      "exampleEn": "The doctor told me to get enough rest.",
      "usageTipKo": "몸 상태나 건강 관련 일기에 자주 쓸 수 있어요.",
      "tags": ["건강", "일상 표현"]
    }
  ],
  "nextDiaryMission": {
    "focus": "EMOTION",
    "titleKo": "감정 한 문장 추가",
    "instructionKo": "병원에 다녀온 뒤 어떤 기분이었는지 한 문장을 더 붙여 다시 써보세요.",
    "starterEn": "I felt..."
  },
  "safetyFlags": ["NONE"]
}
```

## 21. 장애 상황에서 확인할 것

영어일기 피드백이 제대로 생성되지 않을 때 확인할 지점은 아래와 같다.

### 21-1. API 요청이 백엔드에 도착하는가

확인할 API:

```text
POST /api/diary/entries/{entryId}/feedback
```

백엔드 로그에 요청이 보이지 않으면 모바일의 API base URL, 네트워크, 토큰 인증 문제를 먼저 확인해야 한다.

### 21-2. 사용자가 로그인되어 있는가

`DiaryController`는 로그인 사용자가 없으면 401을 반환한다.

모바일에서는 access token / refresh token이 정상인지 확인해야 한다.

### 21-3. 해당 일기가 현재 사용자의 것인가

다른 사용자의 entryId이면 404로 처리된다.

### 21-4. LLM API 키가 설정되어 있는가

OpenAI:

```env
OPENAI_API_KEY=...
```

Gemini:

```env
GEMINI_API_KEY=...
```

API 키가 없으면 LLM 피드백 대신 local fallback이 사용될 수 있다.

### 21-5. provider 설정이 올바른가

```env
LLM_DIARY_FEEDBACK_PROVIDER=openai
```

또는:

```env
LLM_DIARY_FEEDBACK_PROVIDER=gemini
```

### 21-6. JSON 스키마 오류가 나는가

LLM 응답이 스키마를 지키지 않으면 파싱 실패가 발생한다.

이 경우 엔진 로그에서 OpenAI 또는 Gemini 응답 body 일부가 warning으로 남는다.

## 22. 현재 설계의 장점

### 22-1. 일반 질문 피드백과 섞이지 않는다

일기 피드백이 일반 질문 피드백의 구조를 오염시키지 않는다.

반대로 일반 질문 피드백도 일기 전용 요구사항 때문에 복잡해지지 않는다.

### 22-2. 일기다운 피드백을 만들 수 있다

일기 전용 프롬프트는 사용자의 경험, 감정, 흐름을 보존하도록 설계되어 있다.

그래서 단순 문법 채점보다 일기 작성 습관에 맞는 피드백을 만들 수 있다.

### 22-3. provider를 독립적으로 바꿀 수 있다

영어일기만 OpenAI로, 질문 답변은 Gemini로 운영하는 식의 실험이 가능하다.

### 22-4. 전체 JSON을 저장한다

`feedback_payload_json`에 전체 응답을 저장하기 때문에, 나중에 UI를 바꾸더라도 과거 데이터를 더 풍부하게 활용할 수 있다.

### 22-5. fallback이 있다

외부 LLM이 실패해도 최소한의 일기 피드백은 제공할 수 있다.

## 23. 현재 한계와 개선 방향

### 23-1. feedback_model 저장이 아직 null일 수 있다

현재 `diary_attempts.feedback_model` 컬럼은 준비되어 있지만, 저장 시 실제 모델명이 항상 들어가지는 않는다.

추후 `DiaryFeedbackLlmEngine` 인터페이스에 `model()` 메서드를 추가하면 어떤 모델이 해당 피드백을 만들었는지 DB에 남길 수 있다.

### 23-2. attemptType이 프롬프트에 직접 반영되지는 않는다

모바일 요청에는 `attemptType`이 있지만, 현재 `DiaryFeedbackPromptContext`에는 이 값이 들어가지 않는다.

추후 `INITIAL`과 `REWRITE`를 구분해, 다시쓰기 피드백에서는 이전 버전 대비 개선된 점을 더 강조할 수 있다.

### 23-3. safetyFlags는 아직 UI에서 적극적으로 쓰이지 않는다

현재는 `NONE`, `LOCAL_FALLBACK`, `LEGACY_PAYLOAD` 같은 신호를 담을 수 있지만, 모바일 UI에서 별도 안전 안내로 분기하지는 않는다.

### 23-4. 일기 표현 저장 기능과 더 깊게 연결할 수 있다

`usedDiaryExpressions`, `diaryExpressions`는 나중에 저장 표현 기능과 연결하면 좋다.

예를 들어 사용자가 일기 피드백에서 추천받은 표현을 바로 단어장에 저장하게 만들 수 있다.

### 23-5. 일기 전용 평가 리포트를 만들 수 있다

향후에는 `diaryAnswerBand`, `score`, `diaryFlow`를 누적해 사용자의 일기 성장 리포트를 만들 수 있다.

예시:

- 최근 7일간 일기 작성 횟수
- 자주 부족한 항목: 감정, 디테일, 마무리
- 자주 쓰는 표현
- 자주 고치는 문법

## 24. 핵심 결론

현재 영어일기 피드백은 일반 질문 답변 피드백과 구조적으로 분리되어 있다.

분리된 요소는 다음과 같다.

- API
- 서비스
- LLM 라우터
- OpenAI/Gemini 엔진
- 프롬프트
- JSON 스키마
- answerBand
- 응답 DTO
- 모바일 타입
- 모바일 렌더링 UI
- DB 메타 컬럼

이 구조 덕분에 WriteLoop는 질문 답변 학습 루프와 자유 영어일기 학습 루프를 각각 다른 목적에 맞게 발전시킬 수 있다.

영어일기 기능의 핵심은 사용자의 글을 평가하는 것이 아니라, 사용자가 계속 영어로 하루를 기록하고 다시 써볼 수 있게 돕는 것이다.

