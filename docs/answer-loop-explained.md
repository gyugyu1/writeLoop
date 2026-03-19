# writeLoop Answer Loop Explained

이 문서는 [answer-loop.tsx](C:/WriteLoop/apps/frontend/app/answer-loop.tsx)를 기준으로,  
TypeScript와 Next.js가 익숙하지 않은 사람도 전체 흐름을 이해할 수 있도록 정리한 문서입니다.

## 1. 이 파일은 무엇인가

[answer-loop.tsx](C:/WriteLoop/apps/frontend/app/answer-loop.tsx)는 사용자가:

- 질문을 고르고
- 영어 답변을 작성하고
- AI 피드백을 받고
- 다시 써 보고
- 완료 화면까지 가는

흐름 전체를 담당하는 프론트엔드 컴포넌트입니다.

이 파일은 `tsx` 파일인데, 뜻은:

- `ts`: TypeScript
- `tsx`: TypeScript + React JSX 문법

즉 "타입이 있는 React 화면 코드"라고 이해하면 됩니다.

## 2. `use client`는 왜 필요한가

파일 첫 줄:

```tsx
"use client";
```

이건 Next.js에게 "이 파일은 브라우저에서 실행되는 클라이언트 컴포넌트"라고 알려주는 표시입니다.

이 파일은 아래 기능들을 사용합니다.

- `window`
- `localStorage`
- `useState`
- `useEffect`
- 버튼 클릭 이벤트

이런 것들은 브라우저에서 동작하는 코드이기 때문에 `use client`가 필요합니다.

## 3. React의 상태(state)란 무엇인가

React에서 상태(state)는:

"화면이 기억해야 하는, 바뀔 수 있는 값"

입니다.

예를 들어 이 파일에서는 이런 값들이 상태입니다.

- 질문 목록
- 지금 선택한 질문
- 사용자가 입력한 답변
- 서버에서 받은 피드백
- 현재 단계가 질문 선택인지, 피드백 단계인지
- 지금 제출 중인지 여부

대표적인 예:

```tsx
const [prompts, setPrompts] = useState<Prompt[]>([]);
```

의미:

- `prompts`: 현재 질문 목록 값
- `setPrompts`: 질문 목록을 바꾸는 함수
- `useState<Prompt[]>([])`: 처음엔 빈 배열로 시작하는 `Prompt[]` 상태

왜 일반 변수 대신 state를 쓰냐면,  
state가 바뀌면 React가 화면을 다시 그려주기 때문입니다.

## 4. `useState`, `useEffect`, `useMemo`

### `useState`

변할 수 있는 값을 기억합니다.

예:

- `prompts`
- `answer`
- `feedback`
- `step`

### `useEffect`

렌더링 이후 실행해야 하는 작업을 넣습니다.

예:

- localStorage에서 guestId 읽기
- 서버에서 질문 목록 가져오기

### `useMemo`

기존 값들로부터 계산한 결과를 필요할 때만 다시 계산합니다.

예:

```tsx
const selectedPrompt = useMemo(
  () => prompts.find((prompt) => prompt.id === selectedPromptId) ?? null,
  [prompts, selectedPromptId]
);
```

이건 현재 선택된 질문 하나를 계산해서 `selectedPrompt`로 저장하는 코드입니다.

## 5. `guestId`는 무엇인가

로그인하지 않은 사용자를 임시로 식별하기 위한 값입니다.

지금 writeLoop에서는 비로그인 사용자도 한 번은 써볼 수 있게 하고 있으므로,  
서버가 "이 사람이 같은 게스트인지"를 알아야 합니다.

그 역할을 하는 것이 `guestId`입니다.

생성 위치:

[answer-loop.tsx](C:/WriteLoop/apps/frontend/app/answer-loop.tsx#L14)

```tsx
function getOrCreateGuestId() {
  if (typeof window === "undefined") {
    return "";
  }

  const saved = window.localStorage.getItem(GUEST_ID_KEY);
  if (saved) {
    return saved;
  }

  const created =
    window.crypto?.randomUUID?.() ??
    `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(GUEST_ID_KEY, created);
  return created;
}
```

동작:

1. 브라우저가 아니면 빈 문자열 반환
2. `localStorage`에 이미 guestId가 있으면 그걸 재사용
3. 없으면 새로 만들기
4. `localStorage`에 저장
5. 반환

## 6. `window.crypto`는 무엇인가

`window.crypto`는 브라우저가 제공하는 보안 관련 기능 모음입니다.

지금 이 코드에서는:

```tsx
window.crypto?.randomUUID?.()
```

를 사용해서 고유한 ID를 만듭니다.

예시:

```txt
550e8400-e29b-41d4-a716-446655440000
```

즉 guest 사용자 식별용 ID를 안전하게 만드는 데 쓰고 있습니다.

## 7. `saved`는 왜 리턴하나

이 부분:

```tsx
const saved = window.localStorage.getItem(GUEST_ID_KEY);
if (saved) {
  return saved;
}
```

에서 `saved`는 "이전에 localStorage에 저장해둔 guestId"입니다.

즉:

- 예전에 이미 guestId를 만든 적이 있으면
- 새로 만들지 않고
- 그 값을 그대로 다시 사용

하는 것입니다.

여기서 `saved`는 함수 밖에서 오래 쓰려고 저장하는 값이 아니라,  
이 함수 안에서 localStorage에서 꺼낸 값을 잠깐 담아두는 변수입니다.

## 8. 질문 목록은 어떻게 불러오나

컴포넌트가 처음 열릴 때 `useEffect`가 실행됩니다.

[answer-loop.tsx](C:/WriteLoop/apps/frontend/app/answer-loop.tsx#L59)

```tsx
useEffect(() => {
  let isMounted = true;

  async function loadPrompts() {
    try {
      const promptList = await getPrompts();
      if (!isMounted) {
        return;
      }

      setPrompts(promptList);
      setSelectedPromptId((current) => current || promptList[0]?.id || "");
    } catch {
      if (isMounted) {
        setError("We could not load the prompt list.");
      }
    } finally {
      if (isMounted) {
        setIsLoadingPrompts(false);
      }
    }
  }

  void loadPrompts();

  return () => {
    isMounted = false;
  };
}, []);
```

의미:

- 처음 화면이 열리면 서버에서 질문 목록을 가져온다
- 성공하면 `setPrompts(promptList)`로 상태에 저장한다
- 그러면 화면이 다시 렌더링되고 질문 카드가 보인다

## 9. `handleSubmit()`은 무엇을 하나

핵심 함수:

[answer-loop.tsx](C:/WriteLoop/apps/frontend/app/answer-loop.tsx#L135)

```tsx
function handleSubmit(nextAnswer: string, mode: "INITIAL" | "REWRITE")
```

이 함수는:

- 사용자가 쓴 답변을 확인하고
- 서버에 보내고
- 결과를 받아서
- 화면을 피드백 단계로 이동시키는

역할을 합니다.

## 10. 프론트에서 API 요청을 만들고 보내는 흐름

`handleSubmit()` 안에서:

```tsx
void submitFeedback({
  promptId: selectedPromptId,
  answer: nextAnswer.trim(),
  sessionId: sessionId || undefined,
  attemptType: mode,
  guestId: guestId || undefined
})
```

이렇게 JSON body에 들어갈 데이터를 준비해서 보냅니다.

즉 프론트가 만드는 요청은 대략 이런 모습입니다.

```json
{
  "promptId": "prompt-a-1",
  "answer": "After work, I usually take a walk...",
  "sessionId": "기존 세션이 있으면 포함",
  "attemptType": "INITIAL",
  "guestId": "localStorage에서 꺼낸 guest id"
}
```

## 11. `api.ts`는 무엇인가

[api.ts](C:/WriteLoop/apps/frontend/lib/api.ts)는  
브라우저에서 실제 HTTP 요청을 보내는 역할을 하는 파일입니다.

역할 분리 관점에서 보면:

- `answer-loop.tsx`: 어떤 데이터를 보낼지 결정
- `api.ts`: 그 데이터를 실제로 서버에 전송

즉 `answer-loop.tsx`는 화면과 흐름 중심이고,  
`api.ts`는 네트워크 요청 중심입니다.

## 12. 백엔드는 어디서 이 요청을 받나

프론트가 보낸 요청은:

[FeedbackController.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/controller/FeedbackController.java#L27)

```java
@PostMapping
public FeedbackResponseDto review(@RequestBody FeedbackRequestDto request)
```

에서 받습니다.

여기서 `@RequestBody`는:

"프론트가 보낸 JSON body를 읽어서 `FeedbackRequestDto` 객체로 바꿔라"

는 뜻입니다.

즉 `request`는 컨트롤러가 직접 만든 값이 아니라,  
클라이언트가 보낸 JSON을 Spring이 자바 객체로 바꿔서 넣어준 것입니다.

## 13. `OpenAiFeedbackClient`는 어디서 쓰이나

컨트롤러가 아니라 서비스에서 쓰입니다.

호출 흐름:

`FeedbackController -> FeedbackService -> OpenAiFeedbackClient`

[FeedbackService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L39)

```java
FeedbackResponseDto feedback = openAiFeedbackClient.isConfigured()
        ? openAiFeedbackClient.review(prompt, answer)
        : buildLocalFeedback(prompt, answer);
```

즉:

- OpenAI API 키가 있으면 `OpenAiFeedbackClient` 사용
- 없으면 로컬 fallback 피드백 사용

## 14. `buildLocalFeedback()`는 무엇인가

[FeedbackService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L132)

`buildLocalFeedback()`는 OpenAI를 못 쓸 때 대신 피드백을 만들어주는 로컬 fallback 메서드입니다.

간단한 규칙으로:

- 답변 길이
- 연결어 사용 여부
- 개인 표현 사용 여부
- 문장 끝 구두점 여부

를 보고:

- `score`
- `strengths`
- `corrections`
- `modelAnswer`
- `rewriteChallenge`

를 직접 만들어 반환합니다.

## 15. `resolveSession()`은 무엇인가

[FeedbackService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java#L61)

`resolveSession()`은 이번 요청이:

- 기존 세션을 이어가는지
- 새 세션을 시작하는지

를 판단하는 메서드입니다.

역할:

- `sessionId`가 있으면 기존 세션 조회
- 없으면 새 세션 생성
- 게스트 제한도 함께 검사

즉 "이 요청이 어떤 문답 루프에 속하는지"를 정하는 메서드입니다.

## 16. 세션 정보는 DB에 저장되나

네. 지금은 DB에 저장합니다.

관련 엔티티:

- [AnswerSessionEntity.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/persistence/AnswerSessionEntity.java)
- [AnswerAttemptEntity.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/persistence/AnswerAttemptEntity.java)

구조:

- `answer_sessions`: 문답 루프 하나의 묶음
- `answer_attempts`: 그 루프 안의 개별 답변 제출 기록

즉:

- 첫 답변을 시작하면 세션 생성
- 첫 답변, rewrite 답변은 attempt로 저장

됩니다.

## 17. 프론트는 응답을 받은 후 무엇을 하나

`submitFeedback(...)`가 성공하면:

[answer-loop.tsx](C:/WriteLoop/apps/frontend/app/answer-loop.tsx#L157)

```tsx
.then((result) => {
  setFeedback(result);
  setSessionId(result.sessionId);
  setLastSubmittedAnswer(nextAnswer.trim());
  setStep("feedback");
})
```

즉:

- `feedback` 상태 저장
- `sessionId` 저장
- 사용자가 방금 제출한 답변 저장
- 현재 화면 단계를 `feedback`으로 변경

React는 상태가 바뀌면 다시 렌더링하므로,  
사용자는 답변 화면에서 피드백 화면으로 이동한 것처럼 보이게 됩니다.

## 18. 왜 `setIsSubmitting(false)`를 마지막에 하나

[answer-loop.tsx](C:/WriteLoop/apps/frontend/app/answer-loop.tsx#L183)

```tsx
.finally(() => {
  setIsSubmitting(false);
});
```

이건 요청이 성공하든 실패하든:

- "이제 제출이 끝났다"
- "버튼을 다시 누를 수 있다"

는 상태로 돌려놓기 위한 코드입니다.

즉:

- 요청 시작 전: `setIsSubmitting(true)`
- 요청 종료 후: `setIsSubmitting(false)`

흐름으로 로딩 상태를 관리합니다.

## 19. 전체 흐름 한 번에 보기

1. 사용자가 질문 선택
2. 답변 입력
3. `handleSubmit()` 실행
4. 프론트가 JSON body를 만들어 `/api/feedback`로 전송
5. `FeedbackController`가 요청을 받음
6. `FeedbackService`가 세션 처리 + OpenAI 또는 fallback 피드백 생성
7. 결과를 DB에 저장
8. `FeedbackResponseDto`를 JSON으로 반환
9. 프론트가 `setFeedback(...)`, `setStep("feedback")`
10. 화면이 피드백 단계로 전환

## 20. 아주 짧은 요약

- `answer-loop.tsx`는 문답 루프 화면 전체를 담당하는 클라이언트 컴포넌트다
- React state는 화면이 기억해야 하는 값이다
- `handleSubmit()`이 프론트에서 백엔드로 피드백 요청을 보낸다
- 백엔드는 세션을 만들고 OpenAI 또는 fallback으로 피드백을 생성한다
- 결과는 DB에 저장되고, 프론트는 응답을 받아 다음 단계 화면을 보여준다
