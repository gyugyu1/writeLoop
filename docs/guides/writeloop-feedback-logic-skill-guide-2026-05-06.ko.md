# WriteLoop 피드백 로직 Skill 상세 설명서

작성일: 2026-05-06

이 문서는 `writeloop-feedback-logic` Codex skill의 각 파일이 어떤 역할을 하는지, 언제 읽히는지, 앞으로 어떻게 유지보수하면 좋은지를 사람이 읽기 쉽게 정리한 안내서입니다.

Skill 위치:

```text
C:\Users\lwd33\.codex\skills\writeloop-feedback-logic
```

## 1. Skill 전체 목적

`writeloop-feedback-logic` skill은 WriteLoop의 질문 답변 피드백 시스템을 수정하거나 검증할 때 Codex가 같은 기준으로 판단하도록 만든 전용 작업 지침입니다.

이 skill의 핵심 철학은 다음 한 문장으로 요약할 수 있습니다.

> 피드백은 여러 조언을 흩뿌리는 것이 아니라, 사용자가 지금 바로 적용할 수 있는 하나의 미션을 중심으로 구성되어야 한다.

그래서 이 skill은 피드백 작업 시 다음 기준을 강하게 유지하도록 돕습니다.

- `coachMission`을 피드백의 단일 기준으로 삼는다.
- 상단 미션 카드, 자세한 피드백, 표현 더하기, 다시쓰기 입력창이 서로 같은 방향을 가리키게 한다.
- 이해 가능한데 내용이 얇은 답변은 사소한 문법보다 내용 추가 미션을 우선한다.
- 비영어, 로마자 한국어, 무의미한 답변, 질문과 무관한 답변은 `TASK_RESET` 계열로 보낸다.
- 예전 레거시 스키마인 `secondaryLearningPoints`, `modelAnswerVariants`, `nextStepPractice`를 OpenAI 출력 스키마에 다시 넣지 않는다.

## 2. 파일 구성 요약

현재 skill은 다음 파일들로 구성되어 있습니다.

```text
writeloop-feedback-logic/
  SKILL.md
  agents/
    openai.yaml
  references/
    file-map.md
    feedback-schema.md
    mission-quality-rubric.md
    regression-workflow.md
  scripts/
    run-feedback-checks.ps1
```

각 파일은 역할이 조금씩 다릅니다.

- `SKILL.md`: Codex가 skill을 사용할 때 가장 먼저 읽는 핵심 지침입니다.
- `agents/openai.yaml`: UI나 skill 목록에서 보여줄 이름, 짧은 설명, 기본 프롬프트를 담습니다.
- `references/file-map.md`: 피드백 로직과 관련된 코드 위치를 빠르게 찾기 위한 지도입니다.
- `references/feedback-schema.md`: 현재 유지해야 할 피드백 스키마의 기준 문서입니다.
- `references/mission-quality-rubric.md`: 피드백 품질을 평가하는 기준표입니다.
- `references/regression-workflow.md`: 피드백 로직 변경 후 회귀 검증 절차를 정리한 문서입니다.
- `scripts/run-feedback-checks.ps1`: 핵심 빌드와 테스트를 한 번에 돌리는 PowerShell 스크립트입니다.

## 3. `SKILL.md`

파일 위치:

```text
C:\Users\lwd33\.codex\skills\writeloop-feedback-logic\SKILL.md
```

`SKILL.md`는 skill의 가장 중요한 파일입니다. Codex는 skill이 트리거되면 이 파일을 먼저 읽습니다.

### 3.1 Frontmatter

파일 상단에는 다음과 같은 YAML frontmatter가 있습니다.

```yaml
---
name: writeloop-feedback-logic
description: Use when working on WriteLoop question-answer feedback logic, mission-centered feedback, OpenAI feedback schema, coachMission/fixPoints/refinementExpressions, feedback quality regression, or mobile/web feedback UI alignment.
---
```

여기서 중요한 것은 `description`입니다.

Codex는 사용자의 요청이 이 설명과 맞는지 보고 skill을 자동 적용할지 판단합니다. 그래서 설명에는 일부러 다음 키워드들을 넣었습니다.

- WriteLoop question-answer feedback logic
- mission-centered feedback
- OpenAI feedback schema
- `coachMission`
- `fixPoints`
- `refinementExpressions`
- feedback quality regression
- mobile/web feedback UI alignment

예를 들어 사용자가 “피드백 로직 고쳐줘”, “coachMission이랑 fixPoints가 어긋나”, “OpenAI 피드백 스키마 정리해줘”라고 하면 이 skill이 자동으로 적용될 가능성이 높습니다.

### 3.2 Core Principle

`SKILL.md`의 핵심 원칙은 다음입니다.

```text
Treat coachMission as the single source of truth for the learner's next action.
```

즉, 피드백 화면에 여러 정보가 있더라도 최종적으로는 하나의 학습 행동으로 모여야 합니다.

각 필드의 역할은 다음처럼 정의되어 있습니다.

- `coachMission`: LLM이 선택한 단 하나의 다음 행동입니다.
- `coachMove`: 모바일/웹 상단 미션 카드에 표시되는 공개 DTO입니다.
- `fixPoints`: 자세한 피드백 영역에 들어가는 구체적인 교정 카드입니다.
- `refinementExpressions`: 표현 더하기 영역에 들어가는 선택형 표현입니다.
- `rewriteWorkspace`: 다시쓰기 입력창의 seed와 placeholder를 담당합니다.
- `modelAnswer`: 조용한 참고 답안일 뿐, 피드백의 메인 플랜이 아닙니다.

### 3.3 First Files To Inspect

`SKILL.md`는 피드백 작업 전에 먼저 볼 파일을 지정합니다.

주요 파일은 다음과 같습니다.

- `OpenAiFeedbackClient.java`
- `FeedbackCoachMissionDto.java`
- `FeedbackCoachMoveDto.java`
- `FeedbackUiDto.java`
- `apps/mobile/src/app/practice/feedback.tsx`
- `apps/mobile/src/lib/types.ts`

이 목록은 “피드백 관련 버그를 고칠 때 어디부터 봐야 하지?”라는 탐색 비용을 줄이기 위한 것입니다.

### 3.4 Current Schema

`SKILL.md`는 현재 피드백 스키마에서 절대 다시 넣지 말아야 할 필드를 짧게 알려줍니다.

```text
secondaryLearningPoints
modelAnswerVariants
nextStepPractice
```

이 세 필드는 과거 구조에서는 그럴듯했지만, 미션 중심 구조에서는 역할이 중복되거나 피드백 방향을 흐릴 수 있습니다.

현재 대체 관계는 다음과 같습니다.

- `secondaryLearningPoints` 대신 `fixPoints`
- `modelAnswerVariants` 대신 하나의 `modelAnswer`
- `nextStepPractice` 대신 `coachMission`과 `rewriteWorkspace`

### 3.5 Editing Rules

피드백 로직을 수정할 때 지켜야 하는 실무 규칙입니다.

가장 중요한 규칙은 다음입니다.

- OpenAI schema와 parser는 반드시 함께 바꾼다.
- `missionDecision`, `coachMission`, 첫 번째 `fixPoint`, rewrite UI는 같은 방향이어야 한다.
- 내용 추가 미션에는 before/after 비교를 억지로 만들지 않는다.
- 문법/표현 교정 미션에는 짧고 대응되는 `originalText`와 `revisedText`가 있어야 한다.
- `modelAnswer`가 피드백의 메인 플랜이 되면 안 된다.

이 규칙은 이전에 문제가 되었던 “상단 미션과 자세한 피드백이 서로 다른 이야기를 하는 문제”를 방지하기 위한 것입니다.

### 3.6 Verification

`SKILL.md`에는 검증 방법도 들어 있습니다.

권장 명령은 다음입니다.

```powershell
C:\Users\lwd33\.codex\skills\writeloop-feedback-logic\scripts\run-feedback-checks.ps1 -RepoRoot C:\WriteLoop
```

이 명령은 백엔드 컴파일, 피드백 계약 테스트, 모바일 타입체크, 프론트 빌드를 한 번에 실행합니다.

## 4. `agents/openai.yaml`

파일 위치:

```text
C:\Users\lwd33\.codex\skills\writeloop-feedback-logic\agents\openai.yaml
```

이 파일은 Codex UI나 skill 목록에서 사람이 볼 수 있는 표시 정보를 담습니다.

현재 내용은 다음과 같습니다.

```yaml
interface:
  display_name: "WriteLoop 피드백 로직"
  short_description: "WriteLoop의 미션 중심 피드백 스키마와 품질 검증 워크플로"
  default_prompt: "WriteLoop 질문 답변 피드백 로직을 미션 중심 구조에 맞춰 수정하고 검증해줘."
```

각 필드의 의미는 다음과 같습니다.

- `display_name`: skill 목록에 표시될 이름입니다.
- `short_description`: 짧은 설명입니다.
- `default_prompt`: 사용자가 이 skill을 바로 실행할 때 기본 요청으로 쓸 수 있는 문장입니다.

이 파일은 실제 피드백 로직에는 영향을 주지 않습니다. 사람과 UI를 위한 메타데이터입니다.

## 5. `references/file-map.md`

파일 위치:

```text
C:\Users\lwd33\.codex\skills\writeloop-feedback-logic\references\file-map.md
```

이 파일은 피드백 로직 관련 코드의 지도입니다.

Codex가 피드백 작업을 할 때 “어떤 파일이 어떤 책임을 갖는지” 빠르게 파악하도록 돕습니다.

### 5.1 Backend: OpenAI Feedback

가장 중요한 파일은 `OpenAiFeedbackClient.java`입니다.

여기에는 다음 책임이 들어 있습니다.

- OpenAI 요청 스키마 정의
- 프롬프트 지시문
- LLM 응답 파싱
- 미션 선택 guardrail
- `fixPoints`, `refinementExpressions`, `coachMission` 정렬

즉, LLM이 무엇을 내려주는지, 그 결과를 어떻게 신뢰하거나 보정하는지는 대부분 이 파일에서 결정됩니다.

### 5.2 Backend: DTO Contract

DTO 관련 파일은 “밖으로 나가는 응답 모양”을 결정합니다.

- `FeedbackResponseDto.java`: 전체 피드백 응답입니다.
- `FeedbackUiDto.java`: `ui` 내부 공개 계약입니다.
- `FeedbackCoachMissionDto.java`: OpenAI가 내려주는 raw mission입니다.
- `FeedbackCoachMoveDto.java`: 앱 화면에서 쓰는 상단 미션 카드 데이터입니다.

이 구간을 수정할 때는 모바일/웹 타입도 함께 맞춰야 합니다.

### 5.3 Mobile UI

모바일에서 피드백이 실제로 보이는 부분입니다.

- `apps/mobile/src/app/practice/feedback.tsx`: 피드백 전용 화면입니다.
- `apps/mobile/src/components/practice-feedback-content.tsx`: 피드백 콘텐츠 컴포넌트입니다.
- `apps/mobile/src/lib/types.ts`: 모바일 타입 계약입니다.

상단 미션 카드, 예문 표시, 다시쓰기 입력창, 자세한 피드백 토글 같은 UX는 이쪽을 봐야 합니다.

### 5.4 Web UI

웹 버전의 피드백 렌더링입니다.

- `apps/frontend/app/answer-loop.tsx`
- `apps/frontend/lib/types.ts`

모바일만 고치고 웹을 안 고치면 타입이나 응답 계약이 어긋날 수 있으므로, 공용 스키마를 바꾸면 웹도 같이 확인해야 합니다.

### 5.5 Tests

피드백 구조 변경 시 최소한 확인해야 할 테스트입니다.

- `FeedbackResponseContractTest.java`
- `FeedbackUiComposerTest.java`

첫 번째는 공개 응답 계약을 확인하고, 두 번째는 deterministic UI composer가 의도대로 작동하는지 확인합니다.

## 6. `references/feedback-schema.md`

파일 위치:

```text
C:\Users\lwd33\.codex\skills\writeloop-feedback-logic\references\feedback-schema.md
```

이 파일은 현재 피드백 스키마의 기준 문서입니다.

스키마를 수정하거나 OpenAI 응답 필드를 바꿀 때 반드시 참고해야 합니다.

### 6.1 OpenAI Output Fields

현재 OpenAI에게 기대하는 핵심 필드는 다음입니다.

- `missionDecision`
- `coachMission`
- `fixPoints`
- `refinementExpressions`
- `modelAnswer`
- `modelAnswerKo`
- `summary`
- `strengths`
- `corrections`
- `grammarFeedback`

각 필드의 역할도 함께 정리되어 있습니다.

특히 `missionDecision`은 내부 판단 기록이고, `coachMission`은 실제 사용자에게 보여줄 단일 미션의 원천입니다.

### 6.2 Legacy Schema Guardrail

이 문서에도 레거시 필드 재도입 방지 규칙이 있습니다.

이 내용이 `SKILL.md`에도 한 번 있고 `feedback-schema.md`에도 있는 이유는 역할이 조금 다르기 때문입니다.

- `SKILL.md`: Codex가 작업 시작 시 빠르게 기억해야 하는 짧은 가드
- `feedback-schema.md`: 스키마 수정 시 자세히 확인하는 기준 문서

### 6.3 coachMission Rules

`coachMission`의 mission type에 따라 필드 사용법이 다릅니다.

교정형 미션:

- `GRAMMAR_FIX`
- `EXPRESSION_POLISH`

이 경우에는 `originalText`와 `revisedText`가 있어야 합니다.

내용 추가형 미션:

- `REASON`
- `DETAIL`
- `SITUATION`
- `EXAMPLE`
- `FEELING`
- `RESULT`
- `TASK_RESET`

이 경우에는 억지 before/after를 만들지 않고, `exampleEn`으로 따라 쓸 수 있는 예문을 줘야 합니다.

### 6.4 UI Mapping

OpenAI가 내려준 값이 UI로 어떻게 이어지는지도 정리되어 있습니다.

- `coachMission.toCoachMove()` -> 상단 미션 카드
- `coachMission.toRewriteWorkspace(seedText)` -> 다시쓰기 입력창
- `FeedbackUiDto.fixPoints` -> 자세한 피드백
- `refinementExpressions` -> 표현 더하기

이 매핑을 보면 “어떤 백엔드 필드를 바꾸면 화면 어디가 바뀌는지” 빠르게 알 수 있습니다.

## 7. `references/mission-quality-rubric.md`

파일 위치:

```text
C:\Users\lwd33\.codex\skills\writeloop-feedback-logic\references\mission-quality-rubric.md
```

이 파일은 피드백 품질 평가 기준표입니다.

피드백 로직을 바꿨을 때 “좋아 보인다”가 아니라, 어떤 기준으로 좋은지 평가하기 위해 만들었습니다.

### 7.1 Good Mission

좋은 미션은 다음 조건을 만족해야 합니다.

- 한 가지 행동만 요구한다.
- 바로 다시 쓸 수 있다.
- 질문과 맞다.
- 사소한 문법 고침보다 유용하다.
- 사용자가 다음에 무엇을 써야 할지 알 수 있다.
- `fixPoints`, `refinementExpressions`, `modelAnswer`, rewrite UI가 같은 방향을 가리킨다.

### 7.2 Mission Selection

미션 선택 기준이 가장 중요합니다.

내용 미션을 우선할 때:

- 답변은 이해 가능하지만 얇다.
- 이유, 디테일, 예시, 감정, 상황, 결과가 부족하다.
- 문법 오류는 있지만 의미를 막지는 않는다.

문법/표현 미션을 우선할 때:

- 의미가 잘 안 통한다.
- 한 가지 문법 문제가 rewrite 성공을 막는다.
- 조각난 문장 구조라 먼저 문장으로 만들어야 한다.

`TASK_RESET`을 쓸 때:

- 비영어 답변
- 로마자 한국어
- 무의미한 답변
- 질문과 무관한 답변

### 7.3 Required Example Behavior

내용 추가 미션에는 예문이 있어야 합니다.

예를 들어 “장을 본 뒤 행동에 디테일을 붙이세요”라는 미션이면 이런 예문이 필요합니다.

```text
I put the groceries away as soon as I get home.
```

예문이 없으면 사용자는 “그래서 뭘 쓰라는 거지?”라고 느끼기 쉽습니다.

### 7.4 Fail Cases

실패 케이스도 명확히 적어두었습니다.

대표적으로:

- 미션은 “디테일 추가”인데 예문이 없음
- 상단 미션과 자세한 피드백이 서로 다름
- 내용 부족이 핵심인데 단어 polish만 시킴
- `originalText`와 `revisedText`가 같음
- `refinementExpressions`가 `fixPoints`와 같은 내용을 반복함

이 기준은 실제 LLM 품질 검수에서 아주 중요합니다.

## 8. `references/regression-workflow.md`

파일 위치:

```text
C:\Users\lwd33\.codex\skills\writeloop-feedback-logic\references\regression-workflow.md
```

이 파일은 피드백 로직 변경 후 회귀 검증 절차를 정리한 문서입니다.

### 8.1 Static Checks

먼저 정적 검증을 돌립니다.

```powershell
scripts/run-feedback-checks.ps1 -RepoRoot C:\WriteLoop
```

이 검증은 코드가 깨지지 않았는지 확인하는 기본 안전장치입니다.

### 8.2 Schema Search

레거시 필드가 다시 들어왔는지 검색합니다.

```powershell
rg -n "secondaryLearningPoints|modelAnswerVariants|nextStepPractice" apps/backend/src/main/java/com/writeloop/service/OpenAiFeedbackClient.java apps/mobile/src apps/frontend/lib apps/frontend/app
```

OpenAI, 모바일, 웹 공개 경로에서는 이 검색 결과가 없어야 합니다.

### 8.3 Quality Sample Set

LLM 품질을 볼 때는 다양한 답변을 테스트해야 합니다.

문서에 적힌 샘플 범위는 다음입니다.

- 얇지만 유효한 답변
- 사소한 문법 오류가 있는 답변
- 조각난 비문
- 질문과 무관한 답변
- 비영어/로마자 한국어
- 완성도 높은 답변
- `That is all`이 들어간 답변
- `because it is delicious`처럼 일반적인 이유만 있는 답변

이 범위가 중요한 이유는, 한두 개 예시에서는 좋아 보여도 다른 답변 유형에서 미션 선택이 무너질 수 있기 때문입니다.

### 8.4 Review Questions

각 샘플을 볼 때 던져야 할 질문입니다.

- `coachMission.missionType`이 실제 문제와 맞는가?
- 상단 미션이 바로 다시 쓸 수 있는가?
- 내용 추가 미션이면 `exampleEn`이 있는가?
- 첫 번째 `fixPoint`가 같은 미션을 설명하는가?
- 표현 더하기가 중복되지 않는가?
- `modelAnswer`가 미션과 충돌하지 않는가?

### 8.5 Iterate

중요한 방향성도 들어 있습니다.

개념적 미션 선택 문제는 백엔드 guardrail보다 프롬프트/스키마를 먼저 고치는 것이 좋습니다.

백엔드 guardrail은 다음에 쓰는 것이 적절합니다.

- 안전성
- invalid schema
- 중복 필드
- 동일한 before/after
- 비영어/무의미 답변 reset

## 9. `scripts/run-feedback-checks.ps1`

파일 위치:

```text
C:\Users\lwd33\.codex\skills\writeloop-feedback-logic\scripts\run-feedback-checks.ps1
```

이 파일은 피드백 로직 변경 후 반복적으로 실행할 검증 스크립트입니다.

실행 예시는 다음입니다.

```powershell
C:\Users\lwd33\.codex\skills\writeloop-feedback-logic\scripts\run-feedback-checks.ps1 -RepoRoot C:\WriteLoop
```

### 9.1 실행하는 작업

스크립트는 다음 작업을 순서대로 실행합니다.

1. 백엔드 컴파일

```powershell
cd C:\WriteLoop\apps\backend
.\gradlew.bat compileJava
```

2. 피드백 관련 핵심 테스트

```powershell
.\gradlew.bat test --tests com.writeloop.dto.FeedbackResponseContractTest --tests com.writeloop.service.FeedbackUiComposerTest
```

3. 모바일 타입체크

```powershell
cd C:\WriteLoop\apps\mobile
npm.cmd run typecheck
```

4. 웹 프론트 빌드

```powershell
cd C:\WriteLoop
npm.cmd run build --workspace @english-learning/frontend
```

### 9.2 왜 필요한가

피드백 로직은 백엔드 DTO, OpenAI 파서, 모바일 타입, 웹 타입이 서로 연결되어 있습니다.

따라서 한 파일만 보면 괜찮아 보여도 실제로는 다음 문제가 생길 수 있습니다.

- 백엔드 응답 필드는 바뀌었는데 모바일 타입이 그대로임
- OpenAI 파서는 바뀌었는데 UI 컴포저 fallback이 옛 구조를 기대함
- 모바일은 통과하지만 웹 빌드가 깨짐
- 공개 JSON 계약에서 내부 필드가 다시 노출됨

이 스크립트는 그런 문제를 빠르게 잡기 위한 최소 검증 묶음입니다.

## 10. 앞으로 skill을 업데이트할 때 원칙

이 skill은 너무 많은 설명을 담으면 오히려 Codex가 불필요한 문서를 많이 읽게 됩니다.

그래서 업데이트할 때는 다음 원칙을 추천합니다.

### 10.1 `SKILL.md`에는 핵심만 둔다

`SKILL.md`는 자동으로 읽히는 핵심 지침입니다.

따라서 여기에 너무 긴 설명, 과거 히스토리, 장황한 예시를 넣지 않는 것이 좋습니다.

적합한 내용:

- 핵심 철학
- 먼저 볼 파일
- 절대 깨면 안 되는 규칙
- 검증 명령

부적합한 내용:

- 긴 품질 평가 예시
- 많은 테스트 케이스
- 과거 시행착오
- 사용자용 설명서

### 10.2 자세한 내용은 `references`로 분리한다

세부 문서는 `references`에 두는 것이 좋습니다.

Codex는 필요한 상황에서만 해당 문서를 읽으면 됩니다.

예를 들어:

- 스키마를 바꿀 때만 `feedback-schema.md`
- 품질을 평가할 때만 `mission-quality-rubric.md`
- 회귀 테스트를 할 때만 `regression-workflow.md`

이런 식으로 분리하면 context를 아낄 수 있습니다.

### 10.3 검증 루틴은 스크립트로 유지한다

반복되는 검증 명령은 문서에만 두지 말고 스크립트로 유지하는 것이 좋습니다.

그래야 매번 사람이 명령어를 복사하다가 실수하는 일을 줄일 수 있습니다.

## 11. 실제 사용 예시

앞으로 다음과 같이 요청하면 이 skill이 자연스럽게 맞습니다.

```text
writeloop-feedback-logic 스킬을 사용해서 coachMission과 fixPoints 정렬 문제를 고쳐줘.
```

```text
OpenAI 피드백 스키마에서 레거시 필드가 다시 들어왔는지 점검해줘.
```

```text
미션 중심 피드백 품질을 30개 샘플로 검증하고 개선점을 찾아줘.
```

```text
질문 답변 피드백에서 내용이 얇은 답변인데 문법 미션이 나오는 문제를 고쳐줘.
```

## 12. 한 줄 요약

`writeloop-feedback-logic` skill은 WriteLoop 질문 답변 피드백을 “하나의 적용 미션 중심”으로 유지하기 위한 Codex 전용 작업 가이드입니다.

이 skill이 있으면 Codex는 피드백 로직을 수정할 때 매번 다음을 기억할 수 있습니다.

- 어디를 먼저 봐야 하는지
- 어떤 스키마를 유지해야 하는지
- 어떤 필드를 다시 넣으면 안 되는지
- 피드백 품질을 어떤 기준으로 평가해야 하는지
- 수정 후 어떤 검증을 돌려야 하는지

