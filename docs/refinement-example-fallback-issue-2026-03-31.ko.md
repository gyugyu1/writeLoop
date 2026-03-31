# Refinement Example / Meaning Fallback 이슈 리포트

## 개요

`다음 답변에서 써보면 좋은 표현 틀·단어` 섹션에서 아래 두 문제가 함께 확인되었다.

- `예문`이 실제 문장이 아니라 표현 자체만 반복됨
- `해석`이 비어 있거나, 실제 뜻풀이가 아니라 generic 문구로 표시됨

대표 예시:

- 표현: `rest`
  예문: `rest`
  해석: `다음 답변에서 활용하기 좋은 표현`
- 표현: `read`
  예문: `read`
  해석: `다음 답변에서 활용하기 좋은 표현`
- 표현: `after lunch`
  예문: `after lunch`
  해석: `다음 답변에서 활용하기 좋은 표현`

이 현상은 주로 백엔드의 `refinementExpressions.example` / `refinementExpressions.meaningKo` 생성 fallback 로직 때문에 발생하며, 일부는 프론트의 해석 fallback 표시 방식이 문제를 더 눈에 띄게 만든다.

## 기대 동작

`example`은 표현 자체가 아니라, 그 표현이 실제 문장 안에서 어떻게 쓰이는지 보여주는 짧은 예문이어야 한다.

`meaningKo`는 generic 안내 문구가 아니라, 표현의 뜻 또는 틀의 역할을 설명하는 한국어 해석이어야 한다.

예시:

- 표현: `rest`
  해석: `휴식하다`
  예문: `I usually rest after lunch.`
- 표현: `after lunch`
  해석: `점심 식사 후에`
  예문: `I often read a book after lunch.`
- 표현: `I want to [verb].`
  해석: `[동사]하고 싶다고 말하는 틀`
  예문: `I want to build a healthy routine this year.`

## 실제 동작

현재는 백엔드가 적절한 예문을 찾지 못하면 `expression` 자체를 `example`로 반환한다.

결과적으로 UI에는 아래처럼 보인다.

- `예문: rest`
- `예문: read`
- `예문: after lunch`

이 값은 예문이 아니라 사실상 `예문 생성 실패 결과`이다.

또한 해석도 아래처럼 비정상적으로 보일 수 있다.

- `해석: 다음 답변에서 활용하기 좋은 표현`
- `해석: 다음 답변에 바로 가져다 쓸 수 있는 표현 틀`
- 또는 `해석` 자체가 비어 있음

이 경우도 실제 한국어 뜻풀이가 아니라, `meaningKo` 생성 실패 또는 generic fallback 노출에 가깝다.

## 영향

사용자 입장에서 아래 문제가 생긴다.

- 예문 섹션의 신뢰도가 떨어진다.
- 표현과 예문의 차이가 사라져 정보가 중복된다.
- 학습자가 “문장 속에서 어떻게 써야 하는지”를 배우지 못한다.
- `해석`, `활용`, `예문` 세 줄이 모두 비슷한 정보처럼 보이면서 UI 품질도 같이 떨어진다.
- `해석`이 뜻풀이가 아니라 generic 안내 문구로 보이면, 학습자가 표현 의미를 바로 이해하지 못한다.
- `해석`과 `활용`이 사실상 같은 문장처럼 보여 정보 구분이 무너진다.

## 현재 동작 상세

### 1. 후보 표현 생성

백엔드는 `modelAnswer`를 바탕으로 refinement 후보를 만든다.

주요 경로:

- `apps/backend/src/main/java/com/writeloop/service/FeedbackService.java`
  - `buildRefinementExpressions(...)`
  - `sanitizeRefinementExpressions(...)`
  - `extractAdditionalRefinementCandidates(...)`

이 단계에서 OpenAI가 준 `refinementExpressions`를 정리하거나, `modelAnswer`에서 후보를 다시 추출한다.

### 2. 예문 생성

실제 예문 생성은 `buildRefinementExample(...)`가 담당한다.

파일:

- `apps/backend/src/main/java/com/writeloop/service/FeedbackService.java`

현재 핵심 동작:

1. 표현이 frame (`[verb]`, `[reason]` 같은 슬롯 표현)이면
   - `modelAnswer` 안에서 맞는 문장을 찾고
   - 못 찾으면 frame을 기계적으로 materialize 한다.
2. 일반 표현이면
   - `modelAnswer` 문장들 중 해당 표현을 포함하는 문장을 찾는다.
   - 못 찾으면 마지막에 `expression`을 그대로 반환한다.

즉 현재 구현은 아래와 같다.

- 예문을 찾음 -> 그 문장을 예문으로 사용
- 예문을 못 찾음 -> `expression` 자체를 예문으로 사용

이 fallback 이 바로 문제의 핵심이다.

### 3. 힌트 기반 fallback도 동일한 문제를 갖고 있음

`buildHintRefinementExample(...)` 역시 내부적으로 `buildRefinementExample(...)`를 호출하고, 비어 있으면 다시 `candidate`를 반환한다.

즉 hint 기반 추천도 같은 문제를 반복할 수 있다.

### 4. 해석(meaningKo) 생성 경로

해석은 `resolveRefinementMeaning(...)`가 담당한다.

파일:

- `apps/backend/src/main/java/com/writeloop/service/FeedbackService.java`

현재 우선순위는 아래와 같다.

1. OpenAI가 준 `meaningKo`
2. prompt hint item의 `meaningKo`
3. `buildReadableRefinementMeaning(...)` fallback

문제는 이 경로에 두 가지 약점이 있다는 점이다.

- 힌트가 없으면 조기 종료하면서 `null`을 반환한다.
- fallback 이 lexical 표현의 실제 뜻을 만들지 못하고, generic 설명으로 떨어진다.

즉 `rest`, `read`, `after lunch` 같은 표현은 진짜 뜻풀이가 아니라 아래 같은 문구로 대체될 수 있다.

- `다음 답변에서 활용하기 좋은 표현`
- `다음 답변에 바로 가져다 쓸 수 있는 표현 틀`

## 프론트는 왜 이렇게 보이는가

프론트는 별도 가공 없이 `expression.example`를 그대로 렌더링한다.

파일:

- `apps/frontend/app/answer-loop.tsx`

현재 렌더링은 단순하다.

- 표현: `expression.expression`
- 해석: `interpretation`
- 활용: `expression.guidance`
- 예문: `expression.example`

따라서 백엔드가 `example = expression`을 내려주면, 프론트는 그대로 `예문: rest`처럼 보여준다.

즉 예문 문제의 직접 원인은 프론트가 아니라 백엔드 데이터 품질이다.

다만 `해석` 쪽은 프론트 fallback 도 문제를 더 두드러지게 만든다.

현재 프론트는 아래처럼 동작한다.

- `meaningKo`가 있으면 그 값을 `해석:`으로 표시
- `meaningKo`가 없으면 `guidance`를 대신 `해석:`으로 표시

즉 백엔드에서 실제 뜻풀이를 못 만들면, 프론트가 `활용 문장`을 `해석:` 라벨 아래에 대신 보여주게 된다.

그 결과 아래 같은 어색한 화면이 생긴다.

- `해석: 다음 답변에서 활용하기 좋은 표현`
- `활용: 주제에 맞는 핵심 단어를 넣어 문장을 더 또렷하게 만들 수 있어요.`

이 경우 `해석`과 `활용`이 모두 generic 설명이 되어 버린다.

## 근본 원인

이 문제는 여러 원인이 겹쳐서 생긴다.

### 원인 1. 예문 생성 실패 시 fallback 이 너무 약함

현재 로직은 “문장형 예문을 못 찾았을 때 표현 자체를 돌려주는 것”을 허용한다.

이 때문에 `example` 필드가 사실상 실패값을 담는 용도로 쓰이고 있다.

### 원인 2. 예문 유효성 검사가 없음

현재 후처리에서는 아래를 강하게 막지 않는다.

- `normalize(example) == normalize(expression)`
- 예문이 문장이 아니라 단순 단어/구인 경우

즉 `example`가 예문 역할을 못 해도 최종 응답까지 살아남을 수 있다.

### 원인 3. meaningKo fallback 이 lexical 표현의 실제 뜻을 생성하지 못함

`buildReadableRefinementMeaning(...)`는 주로 frame 표현을 설명하는 데 최적화되어 있다.

예:

- `because [reason]`
- `by [verb]ing [method]`
- `I want to [verb].`

이런 구조에는 어느 정도 맞지만, 아래 같은 lexical 표현에는 부적합하다.

- `rest`
- `read`
- `after lunch`
- `in my free time`

이 경우 실제 한국어 뜻풀이 대신 generic 문구가 나오기 쉽다.

### 원인 4. 힌트가 없을 때 meaning fallback 이 아예 비어질 수 있음

`resolveRefinementMeaning(...)`는 현재 아래 조건에서 바로 `null`을 반환한다.

- `candidate`가 비어 있음
- `hints == null`
- `hints.isEmpty()`

즉 hint 데이터가 없는 경우, 마지막 fallback 인 `buildReadableRefinementMeaning(...)`까지 가지 못하고 해석이 비게 된다.

이건 단순 품질 이슈가 아니라, meaning fallback 경로가 중간에 끊기는 구조적 문제다.

### 원인 5. 프론트가 guidance 를 해석 대용으로 보여줌

프론트는 `meaningKo`가 비면 `guidance`를 `해석:`으로 대신 노출한다.

즉 백엔드에서 뜻풀이가 비면, 프론트는 뜻이 아니라 사용 설명을 해석처럼 보여준다.

이 때문에 사용자는 “해석이 이상하다”고 느끼게 된다.

## 왜 이게 특히 어색하게 느껴지는가

refinement 섹션의 역할은 “다음 답변에서 써볼 수 있는 표현”을 제안하는 것이다.

이 섹션에서 사용자는 보통 아래 정보를 기대한다.

- 표현이 무엇인지
- 무슨 뜻인지
- 언제 쓰는지
- 실제 문장에서는 어떻게 쓰는지

그런데 `example == expression`이면 마지막 축이 완전히 사라진다.

예:

- 표현: `rest`
- 해석: `휴식하다`
- 활용: `주제에 맞는 핵심 단어를 넣어 문장을 또렷하게 만들 수 있어요.`
- 예문: `rest`

이렇게 되면 `예문`이 사실상 의미 없는 줄이 된다.

해석도 같은 문제가 있다.

예:

- 표현: `rest`
- 해석: `다음 답변에서 활용하기 좋은 표현`
- 활용: `주제에 맞는 핵심 단어를 넣어 문장을 또렷하게 만들 수 있어요.`
- 예문: `rest`

이렇게 되면

- `해석`은 뜻풀이가 아니고
- `활용`은 generic 설명이며
- `예문`도 문장이 아니다

즉 refinement 카드 전체가 실제 학습 정보보다 placeholder 성격에 가까워진다.

## 개선 방향

### 1. `example == expression`이면 유효한 예문으로 인정하지 않기

가장 중요한 규칙이다.

의미:

- 표현과 예문이 동일하면 예문 생성 실패로 간주
- 이 경우 새 예문을 다시 만들거나
- 끝까지 못 만들면 해당 refinement 항목을 버린다

### 2. 일반 lexical 표현은 문장형 예문이 없으면 제외하기

단어 또는 짧은 구는 실제 문장 속 예문이 있어야 학습 가치가 있다.

예:

- 허용:
  - 표현: `after lunch`
  - 예문: `I often take a walk after lunch.`
- 비허용:
  - 표현: `after lunch`
  - 예문: `after lunch`

### 3. frame 표현과 lexical 표현을 다르게 처리하기

frame 표현:

- `I want to [verb].`
- `by [verb]ing [method]`

이런 패턴은 materialize fallback 이 비교적 자연스럽다.

lexical 표현:

- `rest`
- `read`
- `after lunch`

이런 표현은 문장형 예문이 없으면 fallback 품질이 매우 낮다.

따라서 lexical 표현은 더 엄격하게 다뤄야 한다.

### 4. meaningKo 는 실제 뜻풀이와 generic 설명을 분리해서 다루기

lexical 표현:

- `rest`
- `read`
- `after lunch`

이런 표현은 가능한 한 실제 한국어 뜻풀이를 만들어야 한다.

예:

- `rest` -> `휴식하다`
- `read` -> `읽다`
- `after lunch` -> `점심 식사 후에`

반면 frame 표현은 뜻풀이보다 “무슨 틀인지” 설명하는 방식이 더 적합할 수 있다.

예:

- `I want to [verb].` -> `[동사]하고 싶다고 말하는 틀`
- `by [verb]ing [method]` -> `[방법]으로 [동사]하는 방식을 말하는 틀`

즉 lexical 과 frame 은 meaning 생성 전략도 분리할 필요가 있다.

### 5. `resolveRefinementMeaning(...)`의 조기 `null` 반환 제거

힌트가 없어도 마지막 fallback 은 항상 타도록 구조를 바꾸는 것이 좋다.

즉 아래 구조가 더 적절하다.

- OpenAI meaning 있으면 사용
- hint meaning 있으면 사용
- 없으면 `buildReadableRefinementMeaning(candidate)` 사용

지금처럼 `hints`가 비어 있다는 이유만으로 의미 fallback 전체를 건너뛰는 것은 좋지 않다.

### 6. 프론트에서 `해석`과 `활용`을 혼동하지 않기

`meaningKo`가 없을 때 `guidance`를 `해석:`으로 보여주는 방식은 품질 문제를 가린다.

따라서 더 안전한 방향은:

- `meaningKo`가 없으면 `해석:` 줄을 숨기거나
- `뜻풀이 없음` 상태로 두고
- `활용:`만 별도로 보여주는 것

이다.

### 7. 필요하면 OpenAI에게 example / meaning 품질을 더 강하게 요구하기

프롬프트 차원에서도 아래 규칙을 넣을 수 있다.

- `example must be an actual sentence or natural snippet, not the same text as expression`
- `If you cannot provide a valid example, do not return that refinement item`
- `For lexical items, meaningKo should be a short Korean gloss, not a generic coaching sentence`

다만 현재 문제의 직접 원인은 백엔드 fallback 이므로, 우선순위는 백엔드 수정이 더 높다.

## 권장 수정 순서

1. `buildRefinementExample(...)`에서 일반 표현의 마지막 fallback 으로 `expression`을 그대로 반환하지 않기
2. `sanitizeRefinementExpressions(...)`에서 `example == expression`이면 재생성 또는 제거
3. `buildHintRefinementExample(...)`도 같은 기준 적용
4. `resolveRefinementMeaning(...)`에서 힌트가 없어도 마지막 meaning fallback 을 타게 수정
5. lexical 표현의 `meaningKo`는 실제 한국어 뜻풀이로, frame 은 구조 설명으로 분리
6. 프론트에서 `meaningKo`가 없을 때 `guidance`를 `해석:`으로 대신 쓰지 않기
7. lexical 표현에 대해 문장형 예문이 없으면 탈락시키기
8. 필요 시 OpenAI 프롬프트 강화

## 한 줄 요약

현재 refinement 섹션에서 `예문: rest`, `해석: 다음 답변에서 활용하기 좋은 표현`처럼 보이는 이유는, 백엔드가 실제 예문/뜻풀이를 만들지 못했을 때 약한 fallback 또는 generic fallback 을 사용하고, 프론트가 그 값을 그대로 또는 `guidance` fallback 으로 노출하기 때문이다. 즉 이것은 “예문 생성 실패와 의미 생성 실패가 UI에 그대로 노출되는 문제”다.
