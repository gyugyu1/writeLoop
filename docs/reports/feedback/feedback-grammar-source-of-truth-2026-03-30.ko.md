# 피드백 문법 파이프라인 정리 리포트
작성일: 2026-03-30  
범위: `correctedAnswer`, `inlineFeedback`, `grammarFeedback`, `corrections` 역할 재정의와 동기화

## 목적

이번 작업의 목적은 피드백 응답에서 문법 관련 데이터의 책임을 명확하게 분리하는 것이었습니다.

기존에는 다음 문제가 있었습니다.

- `correctedAnswer`와 `inlineFeedback`가 서로 다른 수정 범위를 가리키는 경우가 있었음
- `grammarFeedback`가 일부 수정만 설명하고 나머지는 놓치는 경우가 있었음
- `문장별 피드백`이 문법 교정보다 더 넓은 개입처럼 보일 수 있었음
- `개선 포인트(corrections)`에 문법 설명과 내용 개선이 섞여 사용자 경험이 흐려졌음

이번 정리의 핵심 방향은 아래와 같습니다.

1. `correctedAnswer`를 최종 교정 기준으로 둔다.
2. `inlineFeedback`는 오직 그 교정 기준을 시각적으로 보여주는 diff 역할만 맡긴다.
3. `grammarFeedback`는 같은 diff를 바탕으로 왜 틀렸는지 설명하는 문법 코칭만 맡긴다.
4. `corrections`는 문법 설명을 제외하고 내용 확장, 구체화, 논리 흐름 같은 비문법 코칭만 남긴다.

## 변경 대상

- `apps/backend/src/main/java/com/writeloop/service/OpenAiFeedbackClient.java`
- `apps/backend/src/main/java/com/writeloop/service/FeedbackService.java`
- `apps/backend/src/main/java/com/writeloop/dto/GrammarFeedbackItemDto.java`
- `apps/backend/src/main/java/com/writeloop/dto/FeedbackResponseDto.java`
- `apps/frontend/components/inline-feedback-preview.tsx`
- `apps/frontend/lib/types.ts`
- `apps/frontend/app/answer-loop.tsx`
- `apps/backend/src/test/java/com/writeloop/service/OpenAiFeedbackClientTest.java`
- `apps/backend/src/test/java/com/writeloop/service/FeedbackServiceTest.java`

## 기존 구조의 문제

기존 응답 구조에서는 `correctedAnswer`, `inlineFeedback`, `grammarFeedback`가 모두 OpenAI 응답에서 별도 필드로 들어왔습니다.

이 구조의 한계는 명확했습니다.

- `correctedAnswer`는 최종 교정문
- `inlineFeedback`는 별도 세그먼트 배열
- `grammarFeedback`는 또 다른 별도 설명 배열

즉 세 필드가 서로를 기준으로 계산되는 구조가 아니었습니다.  
이 때문에 다음과 같은 불일치가 발생할 수 있었습니다.

- `correctedAnswer`에는 반영된 수정이 `inlineFeedback`에는 없음
- `inlineFeedback`에는 일부 수정이 있는데 `grammarFeedback`에는 설명이 없음
- `corrections`와 `grammarFeedback`가 같은 문법 포인트를 중복 설명함

## 새 구조

이번 작업에서는 `correctedAnswer`를 source of truth로 두는 방향으로 바꿨습니다.

### 1. correctedAnswer 역할

`correctedAnswer`는 학습자 답변을 최대한 유지하면서 문법, 표기, 기초적인 자연스러움만 최소 수정한 최종 교정문입니다.

이제 이 필드가 실제 문법 수정의 기준점 역할을 합니다.

### 2. inlineFeedback 역할

`inlineFeedback`는 더 이상 OpenAI가 준 세그먼트를 그대로 신뢰하지 않습니다.

대신 아래 방식으로 생성됩니다.

- 입력: `learnerAnswer`, `correctedAnswer`
- 처리: 두 문장을 비교해서 최소 diff 생성
- 출력: `KEEP`, `REPLACE`, `ADD`, `REMOVE`

즉 `inlineFeedback`는 오직 `correctedAnswer`를 화면에서 하이라이트하기 위한 표시용 diff입니다.

의도한 UX는 아래와 같습니다.

- 문법 문제가 있으면 수정된 범위만 표시
- 문법 문제가 없으면 `inlineFeedback=[]`
- 이미 맞는 문장을 억지로 `KEEP`만 나열하지 않음

### 3. grammarFeedback 역할

`grammarFeedback`는 이제 같은 diff를 기준으로 문법 설명을 붙이는 구조입니다.

각 항목은 다음 정보를 가집니다.

- `originalText`
- `revisedText`
- `reasonKo`

즉 역할은 다음과 같습니다.

- `inlineFeedback` = 어디를 어떻게 고쳤는지
- `grammarFeedback` = 왜 그렇게 고쳤는지

또한 `grammarFeedback`는 문법/기계적 수정만 담도록 제한했습니다.
아래와 같은 범주만 허용합니다.

- capitalization
- article / determiner
- preposition
- pronoun
- be-verb / agreement
- punctuation
- 단수/복수 등 기초 문법

### 4. corrections 역할

`corrections`는 문법 설명을 담당하지 않도록 방향을 분리했습니다.

이제 `corrections`는 다음과 같은 비문법 코칭만 담당합니다.

- 답변이 짧을 때 내용 확장
- 이유, 예시, 구체성 추가
- 논리 흐름 보강
- 더 풍부한 설명 유도

즉 구조가 아래처럼 정리됩니다.

- `correctedAnswer`: 최종 교정 결과
- `inlineFeedback`: 수정 하이라이트
- `grammarFeedback`: 문법 설명
- `corrections`: 문법 외 개선 포인트

## 구현 요약

### OpenAiFeedbackClient

프롬프트를 조정해서 `correctedAnswer`는 로컬 문법/표기/기계적 수정 중심의 최소 교정만 하도록 더 명확히 했습니다.

또한 최종 파싱 시점에서 OpenAI가 직접 준 `inlineFeedback`를 그대로 사용하지 않고, `correctedAnswer`를 기준으로 백엔드에서 다시 `inlineFeedback`를 만들도록 바꿨습니다.

핵심 효과:

- `correctedAnswer`와 `inlineFeedback`가 같은 수정 집합을 가리킴
- OpenAI가 내린 불완전한 세그먼트 때문에 화면이 비거나 어긋나는 경우 감소

### FeedbackService

`sanitizeFeedbackResponse(...)` 단계에서 아래 순서로 정리하도록 바꿨습니다.

1. `correctedAnswer` 기준으로 `inlineFeedback` 재생성
2. 그 diff 기준으로 `grammarFeedback` 보강
3. 문법성 수정이 아닌 경우는 `grammarFeedback`에서 제외
4. `corrections`는 비문법 코칭만 남김

또한 OpenAI가 좋은 `reasonKo`를 준 경우에는 그 문구를 최대한 살리고, 부족한 경우에만 백엔드 fallback 설명을 사용하도록 했습니다.

## 실사용 검증

최신 코드로 백엔드 컨테이너를 재빌드한 뒤 실제 `/api/feedback` 응답을 기준으로 3개 샘플을 검증했습니다.

검증 결과 파일:

- `C:/Users/lwd33/AppData/Local/Temp/writeloop_correctedanswer_rooted_feedback_live_check_2026_03_30.json`

### 샘플 1. 문법 오류가 많은 답변

입력:

```text
On weekends, i usually take nap and write a my diary.
```

결과:

- `correctedAnswer`: `On weekends, I usually take a nap and write my diary.`
- `inlineFeedback`: `i -> I`, `a ` 추가, 불필요한 `a ` 제거
- `grammarFeedback`: 같은 수정 범위에 대한 한국어 설명 제공
- `corrections`: 비어 있음

해석:

- 문법 수정은 전부 `문법 피드백` 쪽으로 모였고
- 별도의 내용 개선 포인트는 강제로 추가되지 않았음

### 샘플 2. 문법 오류가 1개만 있는 답변

입력:

```text
One health goal i have this year is to work out regularly.
```

결과:

- `correctedAnswer`: `One health goal I have this year is to work out regularly.`
- `inlineFeedback`: `i -> I`
- `grammarFeedback`: `i -> I`의 이유 설명
- `corrections`: 목표의 이유와 실천 방법을 더 설명하라는 내용 확장 포인트

해석:

- 문법 설명은 `grammarFeedback`
- 내용 보강은 `corrections`

역할 분리가 의도대로 동작함

### 샘플 3. 문법 문제 없는 답변

입력:

```text
I want to build an exercise habit this year.
```

결과:

- `correctedAnswer`: 동일
- `inlineFeedback`: `[]`
- `grammarFeedback`: `[]`
- `corrections`: 구체성과 중요성 설명을 더하라는 내용 개선 포인트만 존재

해석:

- 문법 문제가 없으면 문장별 피드백이 비는 것이 정상
- 개선 포인트는 문법 설명 없이 내용 보강 중심으로 유지됨

## 검증 결과

테스트 및 빌드 확인:

- `.\gradlew.bat test --tests com.writeloop.service.OpenAiFeedbackClientTest --tests com.writeloop.service.FeedbackServiceTest`
- `.\gradlew.bat compileJava compileTestJava`
- `npm.cmd run lint:frontend`
- `docker compose up -d --build writeloop-backend`

상태:

- 백엔드 테스트 통과
- 백엔드 컴파일 통과
- 프론트 린트 통과
  - 단, 기존 `login-page-client.tsx`의 `<img>` 경고는 유지
- 실제 API 샘플 응답 확인 완료

## 얻은 결과

이번 리팩터링으로 아래가 개선되었습니다.

- `correctedAnswer`와 `inlineFeedback`의 일관성 강화
- `grammarFeedback`가 실제 diff를 기준으로 설명하도록 정렬
- 문법 설명과 내용 코칭의 역할 분리
- 문법 문제가 없을 때 `문장별 피드백`이 비는 동작을 자연스럽게 허용
- UI 관점에서 `문법 피드백`의 목적이 더 분명해짐

## 남은 과제

아직 더 다듬을 수 있는 부분도 있습니다.

### 1. reasonKo 품질 고도화

현재 `grammarFeedback.reasonKo`는

- OpenAI가 잘 쓰면 자연스럽고
- fallback일 때는 다소 일반적인 문구가 섞일 수 있습니다

특히 article / determiner / preposition 설명은 더 구체적이고 교육적인 문장으로 강화할 여지가 있습니다.

### 2. correctedAnswer의 교정 범위 제한

현재 프롬프트는 `correctedAnswer`를 문법/기계적 수정 중심으로 유도하고 있지만, 모델이 가끔 자연스러운 표현 보정까지 넓게 하려는 경향이 남아 있을 수 있습니다.

필요하다면 이후에는 아래 중 하나를 더 고려할 수 있습니다.

- `correctedAnswer`를 더 엄격하게 제한
- 문법 수정 범위를 벗어나는 교정은 별도 필드로 분리

### 3. 문법 카테고리 노출

향후 UI에서 아래 같은 카테고리를 붙일 수도 있습니다.

- 대문자
- 관사
- 전치사
- 복수형
- 문장부호

이렇게 되면 사용자는 어떤 문법 유형에서 자주 실수하는지 더 잘 이해할 수 있습니다.

## 결론

이번 작업으로 피드백 파이프라인의 책임 분리가 훨씬 명확해졌습니다.

이제 구조는 다음처럼 이해할 수 있습니다.

- `correctedAnswer`: 정답에 가까운 최소 교정문
- `inlineFeedback`: 그 교정문을 기준으로 한 수정 하이라이트
- `grammarFeedback`: 각 문법 수정의 이유 설명
- `corrections`: 문법을 제외한 내용 개선 코칭

즉 `문장별 피드백은 문법 전용`, `개선 포인트는 비문법 전용`이라는 목표에 가까운 형태로 정리되었습니다.
