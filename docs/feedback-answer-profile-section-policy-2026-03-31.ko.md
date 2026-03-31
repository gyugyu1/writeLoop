# WriteLoop 피드백 파이프라인 개선 정리

작성일: 2026-03-31

## 1. 배경

WriteLoop의 목표는 “예쁜 피드백”이 아니라, 사용자가 **지금 답변을 더 좋게 다시 쓰게 만드는 피드백**을 만드는 것이다.

기존 피드백 구조는 OpenAI 응답을 sanitize한 뒤 거의 바로 UI용 응답 DTO로 흘려보내는 구조에 가까웠다. 이 구조는 빠르게 기능을 만들기에는 좋았지만, 아래 같은 한계가 있었다.

- 질문마다 요구하는 슬롯이 다른데도, task 판단이 prompt 문구 heuristic에 크게 의존했다.
- 답변의 상태를 내부적으로 명확히 진단하는 구조가 약해서, 섹션별 전략 분기가 제한적이었다.
- 문법/내용/재작성 우선순위를 내부 코드 값으로 정리하지 못해, 피드백이 섹션마다 일관되게 라우팅되지 않았다.
- answer quality band에 따라 “무엇을 얼마나 보여줄지”를 체계적으로 제어하는 계층이 없었다.

이번 변경은 이 문제를 해결하기 위해 다음 4축을 도입한 것이다.

1. `PromptTaskMeta` 기반 질문 메타데이터
2. 내부 진단 객체 `AnswerProfile`
3. `AnswerBand` 기반 `SectionPolicy`
4. 공통 validator / sanitizer / guard 분리

---

## 2. 이번 변경의 큰 그림

현재 피드백 생성 흐름은 아래와 같다.

1. `FeedbackService.review()`에서 prompt, learner answer, session/attempt를 읽는다.
2. OpenAI 또는 local feedback을 가져온다.
3. `sanitizeFeedbackResponse(...)`로 corrected answer / inline / grammar / corrections / refinement / usedExpressions를 정리한다.
4. `AnswerProfileBuilder`가 `AnswerContext`를 바탕으로 `AnswerProfile(task / grammar / content / rewrite)`를 만든다.
5. `AnswerProfile`을 바탕으로 rewrite challenge를 다시 정리한다.
6. `SectionPolicySelector`가 `AnswerBand + attemptIndex`를 보고 섹션 정책을 선택한다.
7. `FeedbackSectionPolicyApplier`가 policy를 실제 응답 섹션에 적용한다.
8. 공통 validator가 grammar/refinement/modelAnswer 품질 규칙을 다시 보장한다.
9. 최종 `FeedbackResponseDto`를 저장하고 응답한다.

즉 구조가

`raw feedback -> sanitize -> diagnose -> route -> validate -> response`

로 바뀐 것이다.

---

## 3. Prompt 메타데이터 정규화

### 3.1 왜 필요했는가

기존에는 `expectsReason`, `expectsExample` 같은 판단을 prompt 문구에서 추측했다. 예를 들어 prompt에 `why`가 들어 있으면 reason이 필요하다고 보는 식이었다.

이 방식은 다음 문제가 있다.

- wording이 조금만 달라져도 오진한다.
- 같은 의도의 질문도 문장 형태가 다르면 분류가 흔들린다.
- `ROUTINE`, `GOAL_PLAN`, `BALANCED_OPINION`, `CHANGE_REFLECTION` 같은 prompt family별 차이를 안정적으로 반영하기 어렵다.

그래서 질문이 요구하는 구조를 DB와 백엔드 카탈로그에 **명시적인 메타데이터**로 넣었다.

### 3.2 추가한 메타데이터 테이블

SQL 파일:

- `infra/mysql/schema/028-create-prompt-task-metadata.sql`
- `infra/mysql/schema/029-add-prompt-task-grammar-metadata.sql`

추가된 정규화 구조:

- `prompt_answer_modes`
- `prompt_task_slots`
- `prompt_task_profiles`
- `prompt_task_profile_slots`

`prompt_task_profiles`에는 prompt별로 아래 같은 메타가 들어간다.

- `answer_mode`
- `required_slots`
- `optional_slots`
- `expected_tense`
- `expected_pov`

### 3.3 백엔드 연결

관련 파일:

- `apps/backend/src/main/java/com/writeloop/dto/PromptTaskMetaDto.java`
- `apps/backend/src/main/java/com/writeloop/service/PromptTaskMetaCatalog.java`
- `apps/backend/src/main/java/com/writeloop/service/PromptTaskMetaSupport.java`
- `apps/backend/src/main/java/com/writeloop/config/PromptSeedConfig.java`

역할은 다음과 같다.

- `PromptTaskMetaCatalog`
  - prompt family / canonical prompt에 맞는 task meta의 source of truth
- `PromptTaskMetaSupport`
  - prompt 엔티티/DTO와 메타를 매핑
- `PromptSeedConfig`
  - 앱 기동 시 seed / backfill 보조
- `PromptTaskMetaDto`
  - 런타임에서 `PromptDto`가 가지는 내부 메타 구조

### 3.4 현재 메타가 담는 정보

현재 메타는 최소 MVP 기준으로 다음을 포함한다.

- `answerMode`
  - 예: `ROUTINE`, `PREFERENCE`, `GOAL_PLAN`, `BALANCED_OPINION`, `CHANGE_REFLECTION`
- `requiredSlots`
  - 예: `MAIN_ANSWER`, `REASON`, `EXAMPLE`, `ACTIVITY`, `TIME_OR_PLACE`, `METHOD`
- `optionalSlots`
  - 질문마다 보조 슬롯
- `expectedTense`
  - 예: `PRESENT_SIMPLE`, `FUTURE_PLAN`, `MIXED_PAST_PRESENT`
- `expectedPov`
  - 예: `FIRST_PERSON`, `GENERAL_OR_FIRST_PERSON`

---

## 4. AnswerProfile 도입

### 4.1 철학

`AnswerProfile`은 사용자에게 직접 보여줄 문장이 아니라, 피드백 생성 파이프라인이 사용할 **내부 진단 객체**다.

즉 “설명문”이 아니라 “판정값 / 신호 / 코드” 중심이어야 한다.

### 4.2 AnswerContext와 분리

입력 재료는 `AnswerContext`, 진단 결과는 `AnswerProfile`로 분리했다.

관련 파일:

- `apps/backend/src/main/java/com/writeloop/service/AnswerContext.java`
- `apps/backend/src/main/java/com/writeloop/service/AnswerProfile.java`
- `apps/backend/src/main/java/com/writeloop/service/AnswerProfileBuilder.java`

`AnswerContext`는 대략 아래 재료를 포함한다.

- promptText
- difficulty
- attemptIndex
- learnerAnswer
- previousAnswer
- modelAnswer
- promptHints
- promptTaskMeta
- topicCategory
- topicDetail

### 4.3 AnswerProfile 구조

top-level은 고정 4블록이다.

- `task`
- `grammar`
- `content`
- `rewrite`

#### task

- `onTopic`
- `taskCompletion`
- `answerBand`

#### grammar

- `severity`
- `issues`
- `minimalCorrection`

#### content

- `specificity`
- `signals`
- `strengths`

#### rewrite

- `primaryIssueCode`
- `secondaryIssueCode`
- `target`
- `progressDelta`

### 4.4 현재 실제 활용

현재 `AnswerProfile`은 이미 `FeedbackService.review()` 경로에서 만들어지고 있다.

적용 위치:

- `apps/backend/src/main/java/com/writeloop/service/FeedbackService.java`

실제 연결 포인트:

1. feedback sanitize 이후 `AnswerProfile` 생성
2. profile 기반 rewrite challenge 보정
3. profile 기반 section policy 선택 및 적용

즉 지금은 AnswerProfile이 단순 설계 문서가 아니라 실제 라우팅 입력으로 쓰이고 있다.

---

## 5. content를 메타 기반으로 강화한 변경

### 5.1 이전 상태

예전에는 content 쪽이 mostly heuristic이었다.

- reason cue가 있는가
- example cue가 있는가
- time/place 토큰이 있는가

이 정도를 중심으로 판단했다.

### 5.2 변경 후

이제 `requiredSlots / optionalSlots`를 기준으로 `content` 판단이 훨씬 prompt-specific하게 바뀌었다.

영향받는 영역:

- `content.signals`
- `content.specificity`
- `strengths`
- `progressDelta`
- `rewrite.primaryIssueCode`

예를 들면:

- `ROUTINE` prompt에서는 `ACTIVITY`, `TIME_OR_PLACE` 신호가 더 중요해진다.
- `PREFERENCE` prompt에서는 `MAIN_ANSWER`, `REASON`, `FEELING` 신호가 중요하다.
- `GOAL_PLAN` prompt에서는 `MAIN_ANSWER`, `METHOD`, `PLAN` 축이 중요하다.

결과적으로 `CONTENT_THIN` 판정과 `ADD_DETAIL`, `ADD_REASON`, `ADD_EXAMPLE` 같은 rewrite target이 더 안정적으로 결정된다.

---

## 6. onTopic을 메타 기반으로 강화한 변경

### 6.1 이전 상태

기존 `onTopic`은 다음에 많이 의존했다.

- prompt text token overlap
- hint token overlap
- model answer token overlap

이 방식은 일부 질문에서는 동작했지만, semantic variation에 약했다.

### 6.2 변경 후

이제 `topicCategory`, `topicDetail`, `answerMode`, slot shape를 같이 본다.

즉 `onTopic`은 여전히 답변을 보고 판정하는 하이브리드 규칙이지만, 판단 기준이 메타 중심으로 강화되었다.

현재는 다음 신호가 함께 쓰인다.

- prompt/task meta
- topicCategory / topicDetail
- answerMode별 answer shape
- 기존 prompt/hint/modelAnswer overlap
- 일부 domain-specific fallback

예를 들면:

- `Favorite Season` prompt에 `spring`, `warm`, `breeze`가 들어가면 주제 일치 가능성이 높다.
- `Routine` prompt는 activity/time 패턴이 있으면 on-topic 가능성이 올라간다.
- `Goal Plan` prompt는 plan/future form/achievement shape가 있으면 on-topic 가능성이 올라간다.

---

## 7. grammar에 expectedTense / expectedPov 메타를 붙인 변경

### 7.1 왜 필요했는가

문법 피드백은 결국 answer-driven이어야 하지만, 질문이 기대하는 시제나 시점이 있으면 오진을 줄일 수 있다.

예:

- `ROUTINE`는 대체로 `present simple`
- `GOAL_PLAN`은 `future / plan form`
- `CHANGE_REFLECTION`은 `past + present contrast`
- personal question은 보통 `first person`

### 7.2 변경 내용

`PromptTaskMeta`에 다음 필드를 추가했다.

- `expectedTense`
- `expectedPov`

그리고 `AnswerProfileBuilder`의 grammar pass에서 이 메타를 참고해 보수적으로 alignment issue를 추가한다.

현재 추가되는 대표 issue code:

- `TENSE_ALIGNMENT`
- `POINT_OF_VIEW_ALIGNMENT`

중요한 점:

- 이건 기존 grammar feedback을 대체하는 것이 아니다.
- 기존 OpenAI grammar / inline feedback 위에 **메타 기반 보조 판정**을 얹는 구조다.
- 오진을 줄이기 위해 아주 명확한 경우에만 낮은 severity로 붙인다.

즉 grammar는 여전히 answer-driven이지만, prompt meta가 기대값을 제공하는 구조다.

---

## 8. rewrite challenge를 AnswerProfile 기반으로 재구성

예전에는 rewrite challenge가 비교적 고정 문구에 가까웠다.

이번에는 `AnswerProfile.rewrite.target`을 기준으로 rewrite challenge를 다시 생성하도록 바꿨다.

관련 위치:

- `apps/backend/src/main/java/com/writeloop/service/FeedbackService.java`

현재 rewrite action은 대략 아래와 같은 분기를 가진다.

- `MAKE_ON_TOPIC`
- `STATE_MAIN_ANSWER`
- `FIX_BLOCKING_GRAMMAR`
- `FIX_LOCAL_GRAMMAR`
- `ADD_REASON`
- `ADD_EXAMPLE`
- `ADD_DETAIL`
- `IMPROVE_NATURALNESS`

즉 rewrite challenge가 더 이상 막연한 “다시 써 보세요”가 아니라, profile이 판정한 primary issue에 맞는 one-step action이 된다.

---

## 9. SectionPolicy 시스템 도입

### 9.1 왜 필요했는가

기존에는 섹션 생성 로직이 거의 고정되어 있어서, 답변 상태가 달라도 strengths / grammar / refinement / model answer가 비슷한 비중으로 나가는 문제가 있었다.

하지만 실제로는

- 너무 짧은 답변
- 문법이 뜻을 막는 답변
- 내용은 맞지만 얇은 답변
- 자연스럽지만 기본적인 답변
- 아예 질문과 어긋난 답변

은 서로 다른 섹션 정책을 가져야 한다.

그래서 `AnswerBand`를 중심으로 **공통 품질 규칙은 고정하고, 섹션 정책만 바꾸는 계층**을 만들었다.

### 9.2 핵심 파일

- `apps/backend/src/main/java/com/writeloop/service/SectionPolicy.java`
- `apps/backend/src/main/java/com/writeloop/service/SectionPolicySelector.java`
- `apps/backend/src/main/java/com/writeloop/service/RefinementFocus.java`
- `apps/backend/src/main/java/com/writeloop/service/ModelAnswerMode.java`
- `apps/backend/src/main/java/com/writeloop/service/AttemptOverlayPolicy.java`
- `apps/backend/src/main/java/com/writeloop/service/FeedbackSectionPolicyApplier.java`
- `apps/backend/src/main/java/com/writeloop/service/FeedbackSectionValidators.java`

### 9.3 AnswerBand

현재 지원되는 band:

- `TOO_SHORT_FRAGMENT`
- `SHORT_BUT_VALID`
- `GRAMMAR_BLOCKING`
- `CONTENT_THIN`
- `NATURAL_BUT_BASIC`
- `OFF_TOPIC`

### 9.4 SectionPolicy가 제어하는 값

현재 policy는 아래를 제어한다.

- strengths 노출 여부 / 최대 개수
- grammar 노출 여부 / 최대 개수
- improvement 노출 여부
- refinement 노출 여부 / 최대 개수 / focus
- summary 노출 여부
- rewrite guide 노출 여부
- model answer 최대 문장 수 / mode
- attempt overlay

### 9.5 refinementFocus

현재 refinement focus:

- `EASY_REUSABLE`
- `GRAMMAR_PATTERN`
- `DETAIL_BUILDING`
- `NATURALNESS`
- `TASK_COMPLETION`

이 값은 refinement 카드의 **추천 방향/정렬 우선순위**를 바꾸며, 카드 품질 규칙은 바꾸지 않는다.

### 9.6 modelAnswerMode

현재 model answer mode:

- `MINIMAL_CORRECTION`
- `ONE_STEP_UP`
- `TASK_RESET`

설명:

- `MINIMAL_CORRECTION`
  - 문법 차단형 답변에서 뜻 유지 + 최소 수정 위주
- `ONE_STEP_UP`
  - 기본적인 품질에서 한 단계 위 답변
- `TASK_RESET`
  - off-topic 답변에서 질문 의도에 맞는 짧은 정답형

---

## 10. attempt overlay 도입

두 번째 시도 이상에서는 answerBand 기본 정책만으로는 부족하다.

왜냐하면 재작성 단계에서는

- 이미 고친 문제를 반복 설명하지 않아야 하고
- 좋아진 점을 우선 보여 줘야 하며
- 남은 문제 하나만 더 강조하는 편이 좋기 때문이다.

그래서 `attemptIndex >= 2`일 때는 `AttemptOverlayPolicy.PROGRESS_AWARE`가 적용된다.

현재 overlay는 대략 아래를 한다.

- strengths 개수 축소
- grammar 개수 축소
- model answer sentence 폭 축소
- progress-aware strength 정렬
- 이미 해결된 문법 반복 설명 억제 준비

---

## 11. 공통 validator / sanitizer 계층 분리

### 11.1 철학

answerBand가 달라도 품질 규칙 자체는 깨지면 안 된다.

즉,

- section policy는 “무엇을 얼마나 보여줄지”만 바꾸고
- validator는 “어떤 품질을 절대 깨면 안 되는지”를 고정해야 한다.

### 11.2 현재 validator 역할

`FeedbackSectionValidators`는 아래를 맡고 있다.

- strength dedupe
- grammar section format validator
- duplicate correction reducer
- refinement card quality validator
- model answer guard

### 11.3 공통 규칙

현재 고정된 주요 규칙:

- grammar item은 `원문 / 수정문 / 이유`가 살아 있어야 한다.
- meaningless grammar item은 제거한다.
- duplicate correction은 줄인다.
- refinement에서 `example == expression`은 제거한다.
- generic meaning / generic guidance refinement는 제거한다.
- displayable=false refinement는 제거한다.
- model answer는 sentence/word guard를 통과해야 한다.

즉, refinement focus가 바뀌어도 카드 품질 규칙은 동일하다.

---

## 12. FeedbackService 실제 적용 방식

현재 `FeedbackService.review()` 흐름은 아래 순서로 바뀌었다.

1. attempt index 계산
2. previous answer 조회
3. OpenAI/local feedback 생성
4. sanitize
5. `AnswerProfile` 생성
6. rewrite challenge 보정
7. section policy 적용
8. loop complete 판단 후 저장

즉 `AnswerProfile`과 `SectionPolicy`는 실제 응답 생성 경로에 이미 들어가 있다.

관련 위치:

- `apps/backend/src/main/java/com/writeloop/service/FeedbackService.java`

---

## 13. 현재 rollout 상태

이번 작업은 한 번에 전체를 갈아엎는 대공사가 아니라, `FeedbackService`에 점진적으로 붙이는 방식으로 진행했다.

### 13.1 이미 실제 반영된 것

- prompt task metadata 기반 `task/content/grammar` 진단
- AnswerProfile 생성
- rewrite target 기반 rewrite challenge
- answerBand 기반 section policy 선택
- attempt overlay 반영
- section validator 적용

### 13.2 현재 strict하게 적용된 것

최근 단계에서 아래 3개는 policy 값을 더 엄격하게 따르도록 맞췄다.

- improvement는 한 번에 1개 행동만 남김
- summary는 `showSummary`가 false면 숨김
- refinement는 policy의 `maxRefinementCount`만큼만 남김

### 13.3 아직 보수적으로 남겨둔 부분

반면 일부는 기존 UX를 너무 크게 흔들지 않기 위해 아직 보수적이다.

- grammar는 `showGrammar=false`여도 완전히 숨기지 않고 일부 유지하는 경향이 남아 있다.
- grammar issue count도 완전 strict max 대신 보수적으로 유지하는 경향이 있다.
- 일부 policy는 실제 응답 안정성을 위해 완전히 공격적으로 줄이지 않고 있다.

즉 현재는 “완전 strict final form”보다는, **품질을 깨지 않으면서 단계적으로 policy를 강화하는 중간 상태**라고 보는 게 맞다.

---

## 14. 테스트

이번 변경에 대해 아래 테스트 축을 추가/유지했다.

### 14.1 새 테스트

- `apps/backend/src/test/java/com/writeloop/service/AnswerProfileBuilderTest.java`
- `apps/backend/src/test/java/com/writeloop/service/PromptTaskMetaCatalogTest.java`
- `apps/backend/src/test/java/com/writeloop/service/SectionPolicySelectorTest.java`
- `apps/backend/src/test/java/com/writeloop/service/FeedbackSectionPolicyApplierTest.java`

### 14.2 기존 회귀 테스트

- `apps/backend/src/test/java/com/writeloop/service/FeedbackServiceTest.java`

### 14.3 검증 명령

실행 기준:

```bash
./gradlew.bat test --tests com.writeloop.service.SectionPolicySelectorTest --tests com.writeloop.service.FeedbackSectionPolicyApplierTest --tests com.writeloop.service.AnswerProfileBuilderTest --tests com.writeloop.service.PromptTaskMetaCatalogTest --tests com.writeloop.service.FeedbackServiceTest
./gradlew.bat compileJava compileTestJava
```

현재 이 범위는 통과 상태다.

---

## 15. 이번 변경의 의미

이번 작업의 핵심은 단순히 필드를 몇 개 늘린 것이 아니다.

이전:

- prompt를 문구로 추측
- feedback를 섹션별로 거의 고정 노출
- answer state와 section strategy가 느슨하게 연결

이후:

- 질문 메타를 DB/카탈로그로 명시
- AnswerProfile로 답변 상태를 내부 진단
- AnswerBand로 라우팅
- SectionPolicy로 섹션 전략 제어
- validator로 공통 품질 규칙 고정

즉 시스템이

`생성된 피드백을 보여 주는 구조`

에서

`답변 상태를 진단하고, 그 상태에 맞는 피드백 전략을 적용하는 구조`

로 한 단계 넘어간 것이다.

이 구조가 자리잡으면 앞으로 아래를 더 자연스럽게 확장할 수 있다.

- section policy의 strictness 단계적 상향
- model answer mode 정교화
- refinement focus 고도화
- progress-aware overlay 강화
- prompt metadata 확장
- LLM semantic judge와 rule-based profile의 hybrid 강화

---

## 16. 앞으로의 다음 단계 제안

다음 단계로 자연스러운 일은 아래다.

1. grammar visibility/count도 policy strict mode에 더 가깝게 정리
2. improvement 1개 선택 로직을 primaryIssueCode와 더 강하게 정렬
3. model answer distance guard를 answerBand별로 더 미세 조정
4. topic anchor / support signal 메타를 DB로 더 확장
5. profile-driven prompt/refinement generation을 더 강화

지금까지는 “설계 도입 + 안정화” 단계였다면, 다음은 “정책 정교화 + strict rollout” 단계라고 보면 된다.
