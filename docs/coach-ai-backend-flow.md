# Coach AI Backend Flow

writeLoop의 `AI 표현 코치`가 백엔드에서 어떻게 동작하는지 정리한 문서입니다.

관련 파일:

- `apps/backend/src/main/java/com/writeloop/controller/CoachController.java`
- `apps/backend/src/main/java/com/writeloop/service/CoachService.java`
- `apps/backend/src/main/java/com/writeloop/service/CoachQueryAnalyzer.java`
- `apps/backend/src/main/java/com/writeloop/service/OpenAiCoachClient.java`

이 문서는 특히 아래 두 가지를 설명합니다.

1. 사용자의 질문이 들어왔을 때 어떤 순서로 분석되고 처리되는지
2. 최근 로직이 `문장 패턴 추가형`에서 `의미 추출형 + 슬롯 번역 fallback`으로 어떻게 바뀌었는지

---

## 1. 코치 API 개요

코치 관련 엔드포인트는 두 개입니다.

### `POST /api/coach/help`

사용자가 코치에게 질문을 보내면, 지금 질문에 바로 쓸 수 있는 표현과 짧은 예문을 반환합니다.

예:

- `이 질문에서 쓸 수 있는 이유 표현 알려줘`
- `친구 만난다고 말하고 싶어`
- `인터넷에서의 만남이 자연스러워졌다고 어떻게 말해`

역할:

- `promptId`, `question` 기본 유효성 검사
- `CoachService.help(...)` 호출

### `POST /api/coach/usage-check`

코치가 추천한 표현을 사용자가 실제 답변에 썼는지 확인합니다.

결과는 이후 아래 용도로 사용됩니다.

- 피드백 화면의 `잘 사용한 표현`
- 작문 기록의 `내가 실제로 써본 표현`

---

## 2. 전체 처리 흐름

`/api/coach/help` 요청이 들어오면 전체 흐름은 아래와 같습니다.

```text
CoachController
  -> CoachService.help()
      -> Prompt / Hint 조회
      -> CoachQueryAnalyzer.analyze()
          -> query mode 분류
          -> intent 분류
          -> meaning lookup spec 생성
      -> meaning lookup이면
          -> deterministic 표현 생성 시도
          -> unresolved slot 있으면 slot translation fallback
          -> 그래도 부족하면 OpenAI fallback
      -> writing support이면
          -> OpenAI 시도
          -> 실패 시 로컬 fallback
      -> coachReply + expressions 반환
```

핵심 철학은 단순합니다.

> 먼저 사용자가 무엇을 말하고 싶은지 파악하고, 그 뜻에 맞는 표현을 추천한다.

즉 예전처럼 문장 표면만 보고 패턴 하나씩 추가하는 구조가 아니라,
`질문 목적 -> 의미 구조 -> 표현 생성` 순서로 가고 있습니다.

---

## 3. Controller 역할

`CoachController`는 최대한 얇게 유지됩니다.

### `help()`

역할:

- 요청값 검증
- `coachService.help(request)` 호출

여기에는 비즈니스 로직이 거의 없습니다.

### `checkUsage()`

역할:

- `promptId`, `answer`, `expressions` 기본 검증
- `coachService.checkUsage(request)` 호출

즉 실제 판단과 처리 책임은 서비스 레이어에 있습니다.

---

## 4. CoachService.help() 상세 흐름

`CoachService.help()`는 코치 응답 생성의 중심입니다.

### 4.1 프롬프트와 힌트 조회

먼저 현재 작문 프롬프트를 읽어옵니다.

- `requirePrompt(promptId)`
- `promptService.findHintsByPromptId(prompt.id())`

이때 가져오는 정보:

- 질문 주제
- 난이도
- 영어 질문
- 한국어 질문
- tip
- 기존 hint 목록

이 정보는 이후:

- 질문 분석
- OpenAI 프롬프트 생성
- fallback 표현 선택

에 모두 사용됩니다.

### 4.2 질문 분석

다음으로 `CoachQueryAnalyzer.analyze(prompt, userQuestion)`를 호출합니다.

분석 결과에는 아래 정보가 들어 있습니다.

- `rawQuestion`
- `normalizedQuestion`
- `intents`
- `lookup`

여기서 가장 중요한 것은 `lookup`입니다.

- `lookup`이 있으면: 이 질문은 `뜻/표현 조회형`
- `lookup`이 없으면: 이 질문은 `작문 지원형`

예:

- `친구 만난다고 말하고 싶어`
- `스페인어를 배워야한다고 말 하고싶어`
- `인터넷에서의 만남이 자연스러워졌다고 어떻게 말해`

이런 질문은 `meaning lookup`으로 가야 합니다.

반대로:

- `이유 표현 알려줘`
- `예시 붙이는 표현 알려줘`
- `비교할 때 쓸 표현 알려줘`

이런 질문은 `writing support`입니다.

### 4.3 meaning lookup branch

`lookup`이 존재하면 meaning lookup 흐름으로 처리합니다.

여기서 최근 변경의 핵심은:

1. deterministic 의미 조회를 먼저 시도
2. unresolved slot이 있으면 slot translation fallback 수행
3. 그래도 결과가 부족하면 OpenAI fallback

즉, 뜻 조회형 질문은 이제 OpenAI보다 먼저 서버 로직으로 가능한 만큼 안정적으로 처리합니다.

### 4.4 slot translation fallback

최근에 추가된 부분입니다.

예전에는:

- `유도 -> judo`처럼 사전에 등록된 대상어만 deterministic하게 처리 가능
- `스페인어`처럼 사전에 없는 대상어는 곧바로 실패

였는데, 지금은 다릅니다.

meaning lookup spec 안에 unresolved slot이 있으면:

1. 먼저 메모리 캐시에서 찾고
2. 캐시에 없으면 OpenAI에게 `slot만 번역` 요청
3. 번역 결과를 캐시에 저장
4. 그 결과로 deterministic 문장을 다시 조립

예:

- 입력: `스페인어를 배워야한다고 말 하고싶어`
- unresolved target slot: `스페인어`
- slot translation fallback 결과: `Spanish`
- 최종 deterministic 표현:
  - `I want to learn Spanish.`
  - `I want to start learning Spanish.`
  - `practice Spanish`
  - `get better at Spanish`

즉 전체 문장을 OpenAI에게 맡기지 않고, 필요한 슬롯만 번역해서 나머지는 deterministic하게 유지합니다.

### 4.5 meaning lookup에서 OpenAI fallback

deterministic 표현이 충분히 만들어지지 않으면 OpenAI fallback을 시도합니다.

이때 중요한 점은:

- `query mode = meaning_lookup`
- `core meaning`
- `intents`

정보를 함께 OpenAI에 전달한다는 점입니다.

즉 OpenAI는 단순 raw question만 받는 것이 아니라,
서버가 1차로 분석한 의미 구조를 함께 받습니다.

### 4.6 writing support branch

질문이 `meaning lookup`이 아니면 `writing support`로 처리합니다.

이 흐름은 아래와 같습니다.

1. OpenAI 먼저 시도
2. 실패하거나 결과 품질이 낮으면 로컬 fallback

주로 이런 질문이 여기에 해당합니다.

- `이 질문에서 쓸 수 있는 이유 표현 알려줘`
- `첫 문장을 시작하는 자연스러운 표현 알려줘`
- `비교하거나 반대 의견 넣는 표현 알려줘`

### 4.7 coachReply 문구 생성

표현 목록이 정해지면 `buildCoachReply(...)`로 상단 설명 문구를 만듭니다.

예:

- meaning lookup:
  - `표현하고 싶은 뜻에 가까운 표현을 먼저 골랐어요.`
- writing support:
  - `이 질문에서는 이유와 예시를 붙이면 더 자연스러워요.`

즉 coach reply도 질문 성격에 따라 달라집니다.

---

## 5. CoachQueryAnalyzer가 하는 일

`CoachQueryAnalyzer`는 현재 구조의 핵심입니다.

역할은 크게 네 가지입니다.

1. 질문 정규화
2. intent 분류
3. query mode 분류
4. meaning lookup spec 생성

### 5.1 normalize

먼저 텍스트를 정규화합니다.

- `Normalizer.NFKC`
- lowercase
- 특수문자 정리
- 공백 정리

이 단계는 같은 뜻인데 표면이 조금 다른 입력을 최대한 하나로 묶기 위해 필요합니다.

### 5.2 intent category 분류

`inferIntentCategories()`는 질문이 어떤 도움을 원하는지 분류합니다.

주요 category:

- `REASON`
- `EXAMPLE`
- `OPINION`
- `COMPARISON`
- `STRUCTURE`
- `BALANCE`
- `HABIT`
- `FUTURE`
- `DETAIL`

예:

- `이유 표현 알려줘`
  -> `REASON`
- `예시 붙일 때 쓸 표현 알려줘`
  -> `EXAMPLE`
- `비교하거나 장단점 표현 알려줘`
  -> `COMPARISON`, `BALANCE`

### 5.3 query mode 판정

`detectLookup()`는 질문이 `WRITING_SUPPORT`인지 `MEANING_LOOKUP`인지 판정합니다.

현재는 단순 exact string 대신, 변형을 더 잘 잡도록 cue 기반으로 처리합니다.

예를 들어 아래와 같은 표현을 meaning lookup cue로 인식합니다.

- `말하고 싶어`
- `말 하고싶어`
- `말 하고 싶어`
- `어떻게 말해`
- `어케 말해`
- `영어로 뭐야`
- `뜻이 뭐야`

즉 최근에는 `말 하고싶어`처럼 띄어쓰기 변형도 잡을 수 있게 meaning lookup 감지를 강화했습니다.

반대로 아래처럼 구조 도움 요청은 writing support로 남깁니다.

- `구조 알려줘`
- `첫 문장 스타터 알려줘`
- `이유 표현 알려줘`

### 5.4 meaning lookup spec 생성

lookup으로 판정되면 `MeaningLookupSpec`을 생성합니다.

여기에는 아래 정보가 들어갑니다.

- `surfaceMeaning`
- `MeaningFrame`
- `translatedSlots`
- `unresolvedSlots`

즉 사용자가 말하고 싶은 뜻을 바로 표현 생성에 쓸 수 있는 구조로 바꾸는 단계입니다.

### 5.5 meaning family

현재 주요 meaning family는 아래와 같습니다.

- `SOCIALIZE`
- `LEARN`
- `SLEEP`
- `STUDY`
- `REST`
- `STATE_CHANGE`
- `UNKNOWN`

예:

- `친구 만난다고 말하고 싶어`
  -> `SOCIALIZE`
- `유도를 배우고 싶어`
  -> `LEARN`
- `잔다고 말하고 싶어`
  -> `SLEEP`
- `인터넷에서의 만남이 자연스러워졌다`
  -> `STATE_CHANGE`

핵심은 문장 하나씩 대응하는 것이 아니라,
`의미 family` 단위로 묶어서 처리한다는 점입니다.

### 5.6 translation slot

family만 정하는 것이 아니라, 필요한 경우 슬롯 번역도 같이 계산합니다.

예:

- `유도를 배우고 싶어`
  - target slot: `유도`
  - translated target: `judo`

- `인터넷에서의 만남이 자연스러워졌다`
  - topic slot: `인터넷에서 사람 만나는 것`
  - translated topic: `meeting people online`
  - qualifier slot: `자연스럽다`
  - translated qualifier: `natural`

중요한 점은 최근부터:

- 이미 사전에 있는 슬롯은 바로 번역
- 사전에 없는 슬롯은 unresolved로 남김
- 이후 `CoachService`에서 slot translation fallback 수행

구조로 바뀌었다는 것입니다.

---

## 6. deterministic 의미 조회

`buildMeaningLookupExpressions(...)`는 meaning family와 translated slot을 바탕으로 표현을 직접 생성합니다.

### 6.1 SOCIALIZE

예:

- `meet my friends`
- `hang out with my friends`
- `catch up with my friends`
- `get together with my friends`

### 6.2 LEARN

예:

- `I want to learn judo.`
- `I want to start learning judo.`
- `practice judo`
- `get better at judo`

slot translation fallback이 붙은 뒤에는 `judo`뿐 아니라 `Spanish` 같은 동적 슬롯도 이 패턴으로 처리할 수 있습니다.

### 6.3 SLEEP / STUDY / REST

예:

- sleep:
  - `go to bed`
  - `go to sleep`
  - `fall asleep`

### 6.4 STATE_CHANGE

예:

- `Meeting people online has become more natural.`
- `It has become more natural to meet people online.`
- `People have become more comfortable meeting online.`

즉 state-change 계열은 단순 단어 추천이 아니라, 의미를 문장 패턴으로 직접 조립합니다.

---

## 7. OpenAiCoachClient 역할

`OpenAiCoachClient`는 OpenAI 호출을 전담합니다.

역할:

1. Responses API 요청 body 생성
2. OpenAI 호출
3. 구조화된 응답 파싱
4. DTO로 변환

### 7.1 전체 코치 도움 요청

`help(...)`는 OpenAI에게 코치 응답 전체를 요청합니다.

여기에는 다음 정보가 들어갑니다.

- prompt topic
- difficulty
- English question
- Korean question
- tip
- learner question
- query mode
- core meaning
- detected intent categories
- prompt hints

즉 OpenAI도 이미 분석된 맥락을 받고 답합니다.

### 7.2 slot translation 전용 요청

최근 추가된 `translateMeaningSlot(...)`는 전체 코치 응답이 아니라,
불명확한 슬롯 하나만 영어로 옮기는 데 사용됩니다.

예:

- slot type: `TARGET`
- source text: `스페인어`
- result: `Spanish`

이 방식의 장점:

- 전체 문장을 모델에 맡기지 않아도 됨
- deterministic 문장 생성은 유지됨
- 비용과 흔들림이 줄어듦

### 7.3 OpenAI 응답 형식

OpenAI는 자유 텍스트가 아니라 JSON schema 기반으로 응답합니다.

전체 코치 응답의 필수 필드:

- `coachReply`
- `expressions[]`

slot translation 응답의 필수 필드:

- `englishText`

---

## 8. 로컬 fallback

OpenAI가 실패하거나 충분히 좋은 결과를 주지 못하면 로컬 fallback이 동작합니다.

### 8.1 writing support용 local expressions

`buildLocalExpressions(...)`

구성 요소:

- generic expressions
- prompt hint 기반 expressions
- intent별 fallback expressions

### 8.2 meaning lookup의 최종 fallback

meaning lookup에서도:

- deterministic 실패
- slot translation fallback 실패
- OpenAI fallback 실패

가 모두 겹치면 마지막에 generic fallback으로 내려갈 수 있습니다.

다만 구조적으로는 이 generic fallback까지 내려가는 빈도를 줄이는 것이 목표입니다.

그래서 최근에는:

- meaning lookup 감지 강화
- family 분류 강화
- slot translation fallback 추가

로 그 빈도를 줄이고 있습니다.

---

## 9. usage-check 로직

`checkUsage(...)`는 추천 표현을 사용자가 실제로 썼는지 확인합니다.

처리 순서:

1. 답변 normalize
2. 추천 표현 normalize
3. expression별 매칭
4. used / unused 분리
5. 관련 질문 추천 생성
6. 사용한 표현을 DB에 저장

결과는 아래에 활용됩니다.

- 피드백 단계의 `잘 사용한 표현`
- 작문 기록의 `내가 실제로 써본 표현`

---

## 10. 왜 이제는 문장별 예외처리보다 의미 추출형인가

예전 방식의 문제는 명확합니다.

문장이 조금만 달라져도 새 if가 필요해집니다.

예:

- `친구 만난다고 말하고 싶어`
- `친구를 만난다고 말하고 싶어`
- `친구들이랑 어울린다고 말하고 싶어`

이걸 문장 단위로 하나씩 추가하면 유지보수가 급격히 어려워집니다.

현재 방향은 아래와 같습니다.

- 문장 표면보다 `말하고 싶은 뜻`을 본다
- 그 뜻을 `의미 family`와 `slot`으로 구조화한다
- deterministic으로 가능한 만큼 처리한다
- 부족한 슬롯만 OpenAI로 보강한다

즉:

- `문장별 rule 추가`가 아니라
- `의미 family 확장 + slot 처리 강화`

방향입니다.

---

## 11. 앞으로의 확장 포인트

### 11.1 meaning family 확장

예:

- 감정 변화
- 부담 / 익숙함 / 편안함
- 원인 / 결과 상태 변화
- 사회적 관계의 거리감

### 11.2 MeaningFrame 확장

현재보다 더 풍부한 slot이 필요할 수 있습니다.

예:

- action
- target
- topic
- qualifier
- polarity
- time nuance

### 11.3 deterministic와 OpenAI의 역할 분리 강화

방향:

- 명확한 lookup은 deterministic 우선
- 애매한 slot이나 추상 의미만 OpenAI가 보강

### 11.4 테스트 매트릭스 확대

문장 단위 테스트보다 family 단위 테스트가 중요합니다.

예:

- `SOCIALIZE` family 다양한 입력
- `LEARN` family 다양한 활용형
- `STATE_CHANGE` family 다양한 topic/qualifier 조합
- spacing variant:
  - `말하고 싶어`
  - `말 하고싶어`
  - `말 하고 싶어`

---

## 12. 관련 테스트 파일

현재 코치 로직 검증은 주로 아래 파일들에 있습니다.

- `apps/backend/src/test/java/com/writeloop/service/CoachServiceTest.java`
- `apps/backend/src/test/java/com/writeloop/service/CoachQueryAnalyzerTest.java`

추천 검증 포인트:

1. query mode가 맞는지
2. family 분류가 맞는지
3. deterministic이면 OpenAI를 건너뛰는지
4. unresolved slot이면 slot translation fallback이 동작하는지
5. 그래도 안 되면 OpenAI fallback으로 넘어가는지
6. generic fallback이 meaning lookup을 가로채지 않는지

---

## 13. 요약

현재 코치 백엔드의 핵심 방향은 아래 한 문장으로 정리할 수 있습니다.

> 먼저 사용자가 무엇을 말하고 싶은지 구조화하고, 그 뜻에 맞는 표현을 안정적으로 추천한다.

즉 지금은:

- `문장 패턴 하나씩 추가`보다 `의미 family`
- `무조건 OpenAI`보다 `deterministic 우선`
- `사전 없는 슬롯은 실패`보다 `slot translation fallback`

구조로 발전하고 있습니다.

이 방향이 계속 강화되면, 앞으로 더 다양한 한국어 표현 요청도 문장별 예외처리 없이 더 안정적으로 처리할 수 있습니다.
