# Refinement Root-Cause Fix 리포트

## 개요

`다음 답변에서 써보면 좋은 표현 틀·단어` 섹션은 단순한 보조 UI가 아니라, 사용자가 바로 다음 시도에서 실제로 가져다 쓸 수 있는 학습 카드여야 한다.

이번 수정의 목적은 다음 두 가지를 동시에 해결하는 것이었다.

1. `예문`이 실제 snippet이 아니라 표현 자체를 반복하던 문제
2. `해석`이 비거나 generic placeholder 문구로 보이던 문제

핵심 방향은 단순했다.

- `뭐라도 채워서 보여주기`를 그만둔다.
- `신뢰 가능한 값만 남기고, 부족한 카드는 드롭한다.`

즉 이번 변경은 surface-level UI 보정이 아니라, refinement 카드가 생성되고 검증되고 렌더링되는 파이프라인 자체를 root-cause 기준으로 다시 정리한 작업이다.

## 배경

WriteLoop의 refinement 카드는 아래 역할을 수행해야 한다.

- 사용자가 현재 답변을 다시 쓸 때 참고할 수 있어야 한다.
- modelAnswer에서 실제로 재사용 가능한 표현을 추려야 한다.
- 영어 표현, 한국어 해석, 활용 팁, 실제 예문이 각각 다른 정보를 제공해야 한다.
- “뜻 / 활용 팁 / 예문”이 서로를 대신하면 안 된다.

하지만 기존 구현은 다음과 같은 구조적 문제를 갖고 있었다.

- 예문을 찾지 못하면 `expression` 자체를 `example`에 넣었다.
- lexical item과 frame/pattern을 같은 방식으로 meaning fallback 처리했다.
- generic placeholder 문구가 `meaningKo`로 살아남았다.
- 프론트가 `meaningKo`가 없을 때 `guidance`를 해석처럼 대신 보여주었다.

결과적으로 사용자는 아래 같은 카드를 보게 될 수 있었다.

- 표현: `rest`
- 해석: `다음 답변에서 활용하기 좋은 표현`
- 활용: `주제에 맞는 핵심 단어를 넣어 문장을 더 또렷하게 만들 수 있어요.`
- 예문: `rest`

이런 값은 정보가 있는 것처럼 보이지만, 실제 학습에는 거의 도움이 되지 않는다.

## 이번 수정의 설계 원칙

이번 작업에서 유지한 원칙은 아래와 같다.

1. 거짓 정보보다 빈 값이 낫다.
2. 카드 개수보다 카드 품질이 더 중요하다.
3. `example`에는 절대 `expression` 자체를 넣지 않는다.
4. `meaningKo`와 `guidance`의 역할을 절대 섞지 않는다.
5. refinement는 “보여줄 수 있느냐”보다 “사용자가 다음 답변에 바로 써먹을 수 있느냐”를 기준으로 평가한다.

## 수정 대상

- [FeedbackService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java)
- [answer-loop.tsx](C:/WriteLoop/apps/frontend/app/answer-loop.tsx)
- 테스트 보강:
  - [FeedbackServiceTest.java](C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/FeedbackServiceTest.java)

## 기존 문제 요약

### 1. example fallback이 실패를 숨기고 있었다

기존 [FeedbackService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java)의 refinement 예문 생성 로직은 적절한 snippet을 찾지 못할 때 `expression` 또는 `candidate` 자체를 그대로 `example`로 반환할 수 있었다.

즉 내부적으로는 “예문 생성 실패”였는데, 외부 응답에서는 마치 예문이 있는 것처럼 보였다.

예:

- expression: `rest`
- example: `rest`

이 값은 technically string이지만, semantic하게는 예문이 아니다.

### 2. meaning fallback이 lexical과 frame을 구분하지 못했다

기존 meaning 생성 로직은 frame/pattern 설명에 더 가까운 규칙에 치우쳐 있었다.

그래서 아래처럼 lexical item일 때도 실제 gloss 대신 generic한 설명으로 떨어질 수 있었다.

- `rest` -> `다음 답변에서 활용하기 좋은 표현`
- `after lunch` -> `다음 답변에 바로 가져다 쓸 수 있는 표현 틀`

즉 “뜻”이 아니라 시스템 안내 문구가 meaning 슬롯을 차지했다.

### 3. sanitize 단계가 저품질 카드를 충분히 걸러내지 못했다

기존 파이프라인은 refinement가 일단 문자열 형태로 채워지기만 하면 살아남는 경향이 있었다.

예를 들면 아래 같은 카드도 충분히 최종 응답까지 갈 수 있었다.

- `example == expression`
- `meaningKo`가 generic placeholder
- `example`이 modelAnswer 안에서 확인되지 않는 경우
- `뜻`과 `활용`이 사실상 같은 수준의 generic 설명인 경우

### 4. 프론트가 데이터 품질 문제를 숨기기 위해 fallback 렌더링을 하고 있었다

기존 프론트는 `meaningKo`가 비어 있으면 `guidance`를 대신 해석처럼 보여줄 수 있었다.

이렇게 되면:

- 백엔드에서 뜻풀이 생성 실패
- 프론트가 guidance를 해석처럼 표시
- 사용자는 “해석이 이상하다”고 체감

즉 데이터 품질 이슈가 UI fallback에 의해 더 어색한 형태로 노출됐다.

## Backend 수정 상세

### 1. example 생성 로직 수정

핵심 변경 위치:

- [FeedbackService.java#L3576](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L3576)
- [FeedbackService.java#L3590](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L3590)
- [FeedbackService.java#L3627](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L3627)

이번 변경 후 example 처리 원칙은 아래와 같다.

1. OpenAI가 준 example가 있어도 바로 믿지 않는다.
2. usable example인지 검사한다.
3. modelAnswer 안에서 실제 snippet으로 확인되는지 검사한다.
4. 둘 다 통과한 example만 사용한다.
5. 통과하지 못하면 `expression`으로 fallback 하지 않는다.
6. 최종적으로 valid example이 없으면 `example`은 비워 두고, sanitize 단계에서 카드가 드롭될 수 있다.

즉 기존의:

- 예문 찾음 -> 사용
- 못 찾음 -> expression 복붙

흐름을 아래처럼 바꿨다.

- usable example + modelAnswer snippet 확인 -> 사용
- 아니면 modelAnswer에서 재탐색
- 그래도 없으면 example 없음

### 2. example 유효성 검사 강화

핵심 변경 위치:

- [FeedbackService.java#L3590](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L3590)

example은 이제 아래 조건을 만족해야만 usable로 본다.

- 비어 있지 않아야 한다.
- `normalize(example) != normalize(expression)` 이어야 한다.
- `[` 또는 `]` 같은 placeholder 잔재가 있으면 안 된다.
- obvious meta text, quoted instruction, broken text 형태면 안 된다.
- 너무 짧거나 의미 토큰이 부족한 fragment면 안 된다.
- 자연스러운 snippet으로 보이지 않으면 안 된다.

즉 `rest`, `read`, `after lunch` 같은 raw lexical item은 예문으로 인정되지 않는다.

### 3. modelAnswer snippet 검증 추가

핵심 변경 위치:

- [FeedbackService.java#L3627](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L3627)

이번 작업에서 중요한 점은 `contract 상 example은 modelAnswer 안에서 실제로 쓰인 snippet이어야 한다`는 원칙을 다시 강하게 적용한 것이다.

따라서 backend는 example을 최종 채택하기 전에:

- modelAnswer 문장 분리
- candidate 표현 포함 여부
- snippet 정규화 비교

를 통해 실제 snippet인지 확인한다.

즉 `영어 문장처럼 보이는 fabricated example`을 기본 fallback으로 쓰지 않는다.

### 4. meaning 생성 로직을 lexical / frame으로 분리

핵심 변경 위치:

- [FeedbackService.java#L2939](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L2939)
- [FeedbackService.java#L2949](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L2949)
- [FeedbackService.java#L2992](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L2992)

이전에는 meaning 생성이 frame 위주의 generic 설명으로 쏠리는 경향이 있었다.

이번에는 내부적으로 refinement를 크게 두 종류로 나눠 meaning을 생성하게 했다.

#### lexical item

예:

- `rest`
- `read`
- `after lunch`
- `in my free time`

이 경우에는 짧은 한국어 gloss를 생성한다.

예:

- `rest` -> `휴식하다`
- `read` -> `읽다`
- `after lunch` -> `점심 식사 후에`
- `in my free time` -> `여가 시간에`

#### frame / pattern

예:

- `I want to [verb].`
- `by [verb]ing [method]`
- `because [reason]`

이 경우에는 한국어 틀 설명을 생성한다.

예:

- `I want to [verb].` -> `[동사]하고 싶다고 말하는 틀`
- `by [verb]ing [method]` -> `[동사]해서 방법을 설명하는 틀`
- `because [reason]` -> `이유를 덧붙일 때 쓰는 틀`

즉 lexical은 gloss, frame은 pattern explanation이라는 역할 구분을 파이프라인 내부에서 명확히 했다.

### 5. generic placeholder meaning 차단

핵심 변경 위치:

- [FeedbackService.java#L3914](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L3914)
- [FeedbackService.java#L3923](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L3923)

아래 같은 문구는 이제 meaning으로 인정하지 않는다.

- `다음 답변에서 활용하기 좋은 표현`
- `다음 답변에 바로 가져다 쓸 수 있는 표현 틀`

즉 explicit meaning이 들어와도 그것이 generic placeholder이면:

- 그대로 사용하지 않고
- fallback generation으로 다시 내려가며
- 그래도 적절한 meaning을 만들 수 없으면 `null`로 둔다

즉 “generic한 값이라도 있으면 채웠다”고 보지 않는다.

### 6. hints가 없어도 meaning fallback이 중간에서 끊기지 않도록 수정

핵심 변경 위치:

- [FeedbackService.java#L3895](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L3895)

이전에는 hint가 없으면 meaning fallback 경로가 너무 일찍 끝나면서 `null`을 반환할 수 있었다.

이번 수정 후에는:

- OpenAI meaning이 없거나 generic해도
- hints가 없더라도
- 마지막 lexical/frame fallback generation까지 계속 진행한다

즉 `missing hints == meaning generation stop` 구조를 없앴다.

### 7. candidate 선정 품질 개선

핵심 변경 위치:

- [FeedbackService.java#L2717](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L2717)
- [FeedbackService.java#L2818](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L2818)
- [FeedbackService.java#L2858](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L2858)
- [FeedbackService.java#L3123](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L3123)

이번 수정에서는 candidate 품질도 같이 조정했다.

핵심은:

- modelAnswer에 직접 등장하고
- learner answer에는 없고
- 실제로 다음 답변에 붙여 넣기 좋은 reusable chunk를 우선한다는 점이다.

동시에, 단일 lexical word를 무조건 버리지는 않도록 조정했다.

예:

- `rest`
- `read`

이런 값도:

- novelty가 충분하고
- meaning/gloss를 만들 수 있고
- valid modelAnswer snippet example을 확보할 수 있으면

카드로 살릴 수 있게 했다.

즉 “single word니까 무조건 탈락”이 아니라, “single word라도 학습 카드 품질을 만족하면 살린다”는 방향이다.

### 8. novelty 판정에서 example snippet을 제외

핵심 변경 위치:

- [FeedbackService.java#L3150](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L3150)

이전에는 novelty 판정이 너무 넓어서, example snippet이 learner/correctedAnswer와 겹친다는 이유로 유용한 refinement까지 과하게 제거될 수 있었다.

이번 수정 후 novelty는:

- raw candidate
- reusable expression

기준으로만 판정하고, example snippet은 novelty 차단 기준에서 제외했다.

이 변경은 frame/pattern refinement가 과하게 죽는 문제를 줄이는 데 중요했다.

### 9. sanitize 단계 강화

핵심 변경 위치:

- [FeedbackService.java#L2287](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L2287)
- [FeedbackService.java#L3493](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L3493)

sanitize 단계는 이제 단순 정리 단계가 아니라 품질 게이트로 동작한다.

대표적으로 아래는 최종 응답에서 남기지 않도록 강화했다.

- `example == expression`
- modelAnswer에서 검증되지 않는 example
- placeholder meaning
- 저품질 / meta text example
- 정보량이 거의 없는 weak card

즉 카드 수를 맞추기 위해 low-quality refinement를 억지로 살리지 않는다.

## Frontend 수정 상세

핵심 변경 위치:

- [answer-loop.tsx#L2423](C:/WriteLoop/apps/frontend/app/answer-loop.tsx#L2423)
- [answer-loop.tsx#L2441](C:/WriteLoop/apps/frontend/app/answer-loop.tsx#L2441)
- [answer-loop.tsx#L2454](C:/WriteLoop/apps/frontend/app/answer-loop.tsx#L2454)
- [answer-loop.tsx#L2457](C:/WriteLoop/apps/frontend/app/answer-loop.tsx#L2457)

프론트는 이제 fallback 보정 레이어가 아니라, 신뢰 가능한 데이터를 조건부로 보여주는 레이어로 정리했다.

### 변경 전

- `meaningKo`가 없으면 guidance를 해석처럼 보여줄 수 있었다.
- example이 약해도 문자열이면 그대로 렌더링될 수 있었다.

### 변경 후

- `displayable !== false`인 카드만 렌더링
- `meaningKo`가 있을 때만 meaning row 표시
- lexical이면 라벨 `뜻`
- frame이면 라벨 `틀 설명`
- `guidanceKo`는 항상 `활용 팁`
- `exampleEn`는 있을 때만 `예문`
- `guidance -> meaning` 대체 없음

즉 이제 프론트는 “없으면 다른 걸 끌어다 메우는” 역할을 하지 않는다.

## JSON contract 관점

이번 수정의 중요한 특징은 `외부 JSON contract를 가능한 한 크게 깨지 않으면서 품질 로직을 강화했다`는 점이다.

내부적으로는 refinement 품질 판단과 생성 로직이 더 풍부해졌지만, API 소비 관점에서는 여전히 다음 핵심 구조를 유지한다.

- expression: 영어
- meaningKo: 한국어
- guidance: 한국어
- example: 영어

즉 outward contract는 최대한 유지하면서, 내부 생성/검증 정책만 훨씬 엄격하게 바꾼 셈이다.

## 테스트

이번 변경에 맞춰 아래 테스트들을 보강/수정했다.

- [FeedbackServiceTest.java#L899](C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/FeedbackServiceTest.java#L899)
- [FeedbackServiceTest.java#L1002](C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/FeedbackServiceTest.java#L1002)
- [FeedbackServiceTest.java#L1052](C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/FeedbackServiceTest.java#L1052)
- [FeedbackServiceTest.java#L1102](C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/FeedbackServiceTest.java#L1102)
- [FeedbackServiceTest.java#L1202](C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/FeedbackServiceTest.java#L1202)

핵심 검증 포인트:

1. lexical word
- `rest`
- meaningKo는 gloss여야 함
- example은 문장형 snippet이어야 함
- `example = rest`는 허용되지 않음

2. lexical phrase
- `after lunch`
- meaningKo는 `점심 식사 후에` 수준의 뜻풀이여야 함
- example은 실제 문장이어야 함

3. frame
- `I want to [verb].`
- meaningKo는 틀 설명이어야 함
- example은 자연스러운 snippet이어야 함

4. missing hints
- hints가 null/empty여도 meaning fallback이 중간에서 끊기지 않아야 함

5. sanitize
- `example == expression` 카드 제거
- generic placeholder meaning 제거

실행 결과:

- `./gradlew.bat test --tests com.writeloop.service.FeedbackServiceTest --tests com.writeloop.service.OpenAiFeedbackClientTest`
  - 통과
- `npm.cmd run build`
  - 통과

프론트는 기존 [login-page-client.tsx](C:/WriteLoop/apps/frontend/components/login-page-client.tsx)의 `<img>` 경고만 유지되며, 이번 수정과는 무관하다.

## Before / After 예시

### Before 1

```json
{
  "expression": "rest",
  "meaningKo": "다음 답변에서 활용하기 좋은 표현",
  "guidance": "주제에 맞는 핵심 단어를 넣어 문장을 더 또렷하게 만들 수 있어요.",
  "example": "rest"
}
```

### After 1

```json
{
  "expression": "rest",
  "meaningKo": "휴식하다",
  "guidance": "실제 답변에서 휴식 시간이나 이유를 함께 붙여 더 자연스럽게 말해 보세요.",
  "example": "I usually rest after lunch because it helps me recharge."
}
```

### Before 2

```json
{
  "expression": "after lunch",
  "meaningKo": "다음 답변에 바로 가져다 쓸 수 있는 표현 틀",
  "guidance": "시간 표현을 넣어 보세요.",
  "example": "after lunch"
}
```

### After 2

```json
{
  "expression": "after lunch",
  "meaningKo": "점심 식사 후에",
  "guidance": "시간 표현 뒤에 어떤 활동을 하는지 붙이면 문장이 더 또렷해집니다.",
  "example": "I usually rest after lunch because it helps me recharge."
}
```

### Invalid card dropped

```json
{
  "expression": "rest",
  "meaningKo": null,
  "guidance": "주제에 맞는 핵심 단어를 넣어 문장을 더 또렷하게 만들 수 있어요.",
  "example": "rest"
}
```

위와 같은 카드는 이제 최종 refinement 응답에 남지 않는 방향이 더 자연스럽다.

## 왜 이것이 root-cause fix 인가

이번 변경이 중요한 이유는 placeholder를 다른 문구로 치환한 정도가 아니라, refinement 카드가 살아남는 기준 자체를 바꿨기 때문이다.

### 기존

- 비어 있으면 다른 필드로 메움
- 약한 값이어도 문자열이면 통과
- 실패를 UI에서 감춤

### 현재

- valid snippet이 없으면 example 없음
- generic meaning이면 의미 없음으로 간주
- guidance는 guidance로만 사용
- 카드가 약하면 드롭

즉 “카드 수 유지”보다 “카드 신뢰성”을 우선하는 구조로 바뀌었다.

이건 refinement 문제를 surface-level에서 덮은 것이 아니라, 생성 -> 검증 -> sanitize -> 렌더링 전 과정을 root-cause 기준으로 다시 맞춘 것이다.

## 남은 한계와 후속 개선 포인트

이번 작업으로 큰 구조 문제는 해결됐지만, refinement 품질은 여전히 개선 여지가 있다.

대표적으로:

- lexical gloss coverage를 더 넓힐 수 있다.
- frame 설명 패턴을 더 풍부하게 만들 수 있다.
- OpenAI prompt 자체를 refinement 품질 기준으로 더 강화할 수 있다.
- 필요하다면 low-quality meaning/example만 별도 보정하는 2차 요청 전략도 고려할 수 있다.

다만 현재 기준에서도 가장 큰 문제였던 아래 현상은 구조적으로 정리되었다.

- `예문: rest`
- `해석: 다음 답변에서 활용하기 좋은 표현`
- `뜻/활용/예문`이 사실상 같은 수준의 generic 정보로 보이는 현상

## 한 줄 결론

이번 refinement 개선은 “값을 억지로 채우는 fallback”을 제거하고, `modelAnswer 기반의 검증 가능한 예문 + lexical/frame 분리 meaning + 조건부 렌더링`으로 바꾼 작업이다. 즉 카드 개수를 유지하기 위한 보정이 아니라, 사용자가 다음 답변에서 실제로 써먹을 수 있는 refinement만 남기도록 파이프라인을 바로잡은 root-cause fix다.
