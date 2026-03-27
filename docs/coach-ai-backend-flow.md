# Coach AI Backend Flow

writeLoop의 `AI 표현 코치`가 백엔드에서 어떻게 질문을 해석하고, 표현을 만들고, 사용 결과와 평가 로그까지 저장하는지 정리한 문서입니다.

관련 핵심 파일:

- `apps/backend/src/main/java/com/writeloop/controller/CoachController.java`
- `apps/backend/src/main/java/com/writeloop/service/CoachService.java`
- `apps/backend/src/main/java/com/writeloop/service/CoachQueryAnalyzer.java`
- `apps/backend/src/main/java/com/writeloop/service/OpenAiCoachClient.java`
- `apps/backend/src/main/java/com/writeloop/persistence/CoachInteractionEntity.java`
- `apps/backend/src/main/java/com/writeloop/service/CoachEvaluationService.java`
- `apps/backend/src/main/java/com/writeloop/service/OpenAiCoachEvaluationClient.java`

이 문서는 특히 아래를 설명합니다.

1. `/api/coach/help` 요청이 어떤 흐름으로 처리되는지
2. `WRITING_SUPPORT`, `IDEA_SUPPORT`, `MEANING_LOOKUP`이 어떻게 갈리는지
3. `STARTER` intent, `meaning family`, `slot translation fallback`이 어떤 역할을 하는지
4. `coach_interactions` 로그, `usage-check`, OpenAI 평가 배치가 어떻게 연결되는지

---

## 1. 코치 API 개요

코치 관련 엔드포인트는 두 개입니다.

### `POST /api/coach/help`

사용자가 AI 코치에게 질문하면 표현 추천 결과를 반환합니다.

예:

- `첫 문장을 시작하는 자연스러운 표현 알려줘`
- `이 질문에 쓸 수 있는 이유가 뭐가 있을까`
- `친구 만난다고 말하고 싶어`
- `인터넷에서의 만남이 자연스러워졌다를 어떻게 말해`

역할:

- `promptId`, `question` 검증
- `CoachService.help(...)` 호출
- 코치 interaction 로그 생성

### `POST /api/coach/usage-check`

코치가 추천한 표현을 사용자가 실제 답변에 썼는지 확인합니다.

결과 사용처:

- 피드백 화면의 `잘 사용한 표현`
- 작문 기록의 `내가 실제로 써본 표현`
- `coach_interactions`의 사용 결과 업데이트

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
      -> query mode 별 처리
          -> MEANING_LOOKUP
              -> deterministic 표현 생성
              -> unresolved slot 있으면 slot translation fallback
              -> 부족하면 OpenAI meaning-lookup fallback
              -> 필요 시 support intent 보조 주입
          -> IDEA_SUPPORT
              -> OpenAI idea-support 우선
              -> 실패 시 로컬 아이디어 fallback
          -> WRITING_SUPPORT
              -> OpenAI writing-support 우선
              -> starter intent면 starter-only 후처리
              -> 실패 시 로컬 fallback
      -> interaction 로그 저장
      -> interactionId 포함 응답 반환
```

핵심 철학은 이렇습니다.

> 먼저 사용자가 무엇을 원하는지 좁게 분류하고, 그 목적에 맞는 표현만 추천한다.

즉 지금 구조는 단순한 `문장 패턴 추가형`이 아니라:

- `query mode`로 큰 가지를 나누고
- `intent`로 세부 목적을 분류하고
- `meaning family + slot`으로 의미를 구조화한 뒤
- deterministic과 OpenAI를 역할 분담해서 사용하는 구조입니다.

---

## 3. Controller 역할

`CoachController`는 얇게 유지됩니다.

### `help()`

역할:

- 요청값 검증
- `coachService.help(request)` 호출

### `checkUsage()`

역할:

- `promptId`, `answer`, `expressions` 기본 검증
- `coachService.checkUsage(request)` 호출

비즈니스 로직은 대부분 서비스 레이어에 있습니다.

---

## 4. CoachService.help() 상세 흐름

`CoachService.help()`는 코치 응답 생성의 중심입니다.

### 4-1. 프롬프트와 힌트 조회

먼저 현재 작문 프롬프트와 힌트를 읽어옵니다.

사용 정보:

- prompt topic
- difficulty
- English question
- Korean question
- tip
- hint 목록

이 정보는 이후:

- 질문 분석
- OpenAI 프롬프트 생성
- fallback 표현 선택

에 모두 사용됩니다.

### 4-2. 질문 분석

다음으로 `CoachQueryAnalyzer.analyze(prompt, userQuestion)`를 호출합니다.

분석 결과에는 아래 정보가 포함됩니다.

- `rawQuestion`
- `normalizedQuestion`
- `queryMode`
- `intents`
- `lookup`

이 단계가 전체 흐름의 첫 번째 관문입니다.

### 4-3. QueryMode 분기

현재 QueryMode는 세 가지입니다.

- `WRITING_SUPPORT`
- `IDEA_SUPPORT`
- `MEANING_LOOKUP`

이 셋은 아래처럼 역할이 다릅니다.

#### `WRITING_SUPPORT`

표현 자체를 물어보는 질문입니다.

예:

- `이유 표현 알려줘`
- `예시 붙일 때 쓸 표현 알려줘`
- `첫 문장을 시작하는 자연스러운 표현 알려줘`

#### `IDEA_SUPPORT`

답변 내용 아이디어를 물어보는 질문입니다.

예:

- `이 질문에 쓸 수 있는 이유가 뭐가 있을까`
- `사례 뭐 넣지`
- `이 질문 이유 아이디어`

#### `MEANING_LOOKUP`

내가 하고 싶은 말을 영어로 어떻게 말할지 묻는 질문입니다.

예:

- `친구 만난다고 말하고 싶어`
- `근력을 키우고 싶다`
- `매력적으로 보이고 싶다`
- `인터넷에서의 만남이 자연스러워졌다를 어떻게 말해`

### 4-4. `WRITING_SUPPORT` 처리

`WRITING_SUPPORT`는 기본적으로 OpenAI를 먼저 시도합니다.

흐름:

1. `tryOpenAiHelp(..., false)` 호출
2. 응답을 `intent` 기준으로 정렬/필터링
3. 부족하면 로컬 fallback으로 보충

최근 중요한 변경은 `STARTER` intent입니다.

이제 `첫 문장을 시작하는 자연스러운 표현 알려줘`는 넓은 writing support가 아니라 `starter-only` 요청으로 처리됩니다.

즉:

- `On one hand ...`
- `Overall ...`
- `Specifically ...`

같은 body/conclusion marker는 제거하고,

- `These days, ...`
- `Recently, ...`
- `Technology has greatly changed ...`

처럼 첫 문장을 여는 표현만 남기게 됩니다.

### 4-5. `IDEA_SUPPORT` 처리

`IDEA_SUPPORT`는 표현 카드보다 먼저 `답변에 넣을 이유/아이디어`를 주는 모드입니다.

예:

- `이 질문에 쓸 수 있는 이유가 뭐가 있을까`
- `사례 뭐 넣지`

이 모드에서는:

1. OpenAI에 `idea-support` 성격으로 요청
2. 짧은 아이디어형 표현과 예문을 우선 반환
3. 실패 시 로컬 idea fallback

즉 `One reason is that ...` 같은 연결 표현보다
`companies can create job opportunities`
같은 내용 아이디어를 먼저 추천하는 쪽입니다.

### 4-6. `MEANING_LOOKUP` 처리

`MEANING_LOOKUP`은 뜻 조회형 질문을 다룹니다.

흐름:

1. deterministic 의미 조회 시도
2. unresolved slot이 있으면 slot translation fallback
3. 그래도 부족하면 OpenAI meaning-lookup fallback
4. 필요하면 보조 support intent도 섞음

즉 전체 문장을 처음부터 OpenAI에게 맡기지 않고:

- 가능한 의미는 서버가 안정적으로 만들고
- 모르는 slot만 모델로 보강하는 구조입니다.

### 4-7. Hybrid는 별도 QueryMode가 아니다

중요한 점은 `hybrid`가 별도 QueryMode는 아니라는 것입니다.

현재 analyzer는 아래처럼 동작합니다.

- `meaning lookup` 성격이 강하고
- 동시에 `support meta cue`가 있으면
- `MEANING_LOOKUP`으로 유지하되 `cue = hybrid_meaning_support`로 기록

즉 hybrid는:

- QueryMode는 `MEANING_LOOKUP`
- 처리 단계에서 secondary support intent를 보조로 주입

하는 형태입니다.

예:

- `친구 만난다고 어떻게 말하고, 예시도 하나 붙여줘`
- `이 뜻을 영어로 어떻게 말하는지랑 첫 문장도 알려줘`

### 4-8. coachReply 문구 생성

표현 목록이 정해지면 `buildCoachReply(...)`가 상단 설명 문구를 만듭니다.

예:

- `MEANING_LOOKUP`
  - `표현하고 싶은 뜻에 가까운 표현을 먼저 골랐어요.`
- `IDEA_SUPPORT`
  - `이 질문에 넣을 만한 이유와 아이디어를 먼저 골랐어요.`
- `WRITING_SUPPORT + STARTER`
  - `첫 문장을 자연스럽게 열 수 있는 표현부터 골랐어요.`

---

## 5. CoachQueryAnalyzer가 하는 일

`CoachQueryAnalyzer`는 현재 구조의 핵심입니다.

역할은 크게 네 가지입니다.

1. 질문 정규화
2. intent 분류
3. query mode 분류
4. meaning lookup spec 생성

### 5-1. normalize

먼저 텍스트를 정규화합니다.

- `Normalizer.NFKC`
- lowercase
- 특수문자 정리
- 공백 정리

이 단계는 `말하고 싶어`, `말 하고싶어`, `말 하고 싶어` 같은 변형을 최대한 하나로 묶기 위해 필요합니다.

### 5-2. intent category 분류

`inferIntentCategories()`는 질문이 어떤 도움을 원하는지 분류합니다.

현재 주요 intent:

- `starter`
- `reason`
- `example`
- `opinion`
- `comparison`
- `habit`
- `future`
- `detail`
- `structure`
- `balance`

예:

- `첫 문장을 시작하는 자연스러운 표현 알려줘`
  - `starter`
- `짧은 예시를 붙일 때 쓸 표현 알려줘`
  - `example`
- `비교하거나 반대 의견 넣는 표현 알려줘`
  - `comparison`, `balance`

한 질문에 intent가 하나만 붙는 것은 아닙니다.

예:

- `첫 문장도 알려주고 반대 의견 넣는 표현도 알려줘`
  - `starter + balance`

### 5-3. query mode 판정

`detectLookup()`는 질문이 어느 큰 가지인지 판단합니다.

대표 cue:

#### meaning lookup cue

- `말하고 싶어`
- `말 하고싶어`
- `어떻게 말해`
- `영어로 뭐야`
- `뜻이 뭐야`
- 암시적 meaning statement
  - `근력을 키우고 싶다`
  - `매력적으로 보이고 싶다`

#### idea support cue

- `이 질문 이유 아이디어`
- `사례 뭐 넣지`
- `무슨 이유를 들 수 있을까`

#### writing support cue

- `이유 표현 알려줘`
- `첫 문장 스타터 알려줘`
- `연결 표현 알려줘`

또한 구조적으로 아래 override가 들어갑니다.

- `support_meta`가 분명하면 support 우선
- `hybrid_meaning_support`면 meaning lookup 유지 + 보조 intent 주입
- `structure_override`면 lookup보다 support 우선

### 5-4. meaning lookup spec 생성

lookup으로 판정되면 `MeaningLookupSpec`을 생성합니다.

여기에는 아래 정보가 들어갑니다.

- `surfaceMeaning`
- `MeaningFrame`
- `translations`
- `unresolvedSlots`

즉 사용자가 하고 싶은 말을 `표현 생성 가능한 구조`로 바꾸는 단계입니다.

---

## 6. MeaningFrame, family, slot

### 6-1. meaning family

현재 주요 family는 아래와 같습니다.

- `SOCIALIZE`
- `LEARN`
- `GROWTH_CAPABILITY`
- `REDUCE_MANAGE`
- `SLEEP`
- `STUDY`
- `REST`
- `STATE_CHANGE`
- `VISIT_INTEREST`
- `UNKNOWN`

예:

- `친구 만난다고 말하고 싶어`
  - `SOCIALIZE`
- `유도를 배우고 싶어`
  - `LEARN`
- `근력을 키우고 싶다`
  - `GROWTH_CAPABILITY`
- `스트레스를 줄이고 싶다`
  - `REDUCE_MANAGE`
- `잔다고 말하고 싶어`
  - `SLEEP`
- `인터넷에서의 만남이 자연스러워졌다`
  - `STATE_CHANGE`

핵심은 문장 하나씩 대응하는 것이 아니라,
의미 family 단위로 묶어서 처리한다는 점입니다.

### 6-2. slot

현재 주요 slot은 아래와 같습니다.

- `TARGET`
- `TOPIC`
- `QUALIFIER`

예:

- `유도를 배우고 싶어`
  - `TARGET = 유도`
- `근력을 키우고 싶다`
  - `TARGET = 근력`
- `인터넷에서의 만남이 자연스러워졌다`
  - `TOPIC = 인터넷에서 사람 만나는 것`
  - `QUALIFIER = 자연스럽다`

### 6-3. 사전 번역 + unresolved slot

일부 slot은 analyzer가 즉시 번역합니다.

예:

- `유도 -> judo`
- `근력 -> strength`

하지만 사전에 없는 값은 unresolved로 남깁니다.

예:

- `스페인어`
- 새로운 고유명사
- 사전에 없는 추상 대상어

이 unresolved slot은 이후 `CoachService`가 fallback 번역을 시도합니다.

---

## 7. deterministic 의미 조회

`buildMeaningLookupExpressions(...)`는 family와 translated slot을 바탕으로 표현을 직접 생성합니다.

예:

### `SOCIALIZE`

- `meet my friends`
- `hang out with my friends`
- `catch up with my friends`

### `LEARN`

- `I want to learn judo.`
- `I want to start learning judo.`
- `practice judo`

### `GROWTH_CAPABILITY`

- `I want to build my strength.`
- `I want to improve my confidence.`
- `I want to increase my stamina.`

### `REDUCE_MANAGE`

- `I want to reduce my stress.`
- `I want to manage my spending better.`

### `STATE_CHANGE`

- `Meeting people online has become more natural.`
- `It has become more natural to meet people online.`

deterministic의 의미는 단순합니다.

> 같은 입력이면 항상 같은 규칙으로 같은 결과가 나온다.

즉 모델의 즉흥 판단이 아니라 서버 규칙 기반 처리입니다.

---

## 8. slot translation fallback

이건 최근 구조에서 가장 중요한 개선 중 하나입니다.

예전에는:

- 사전에 있는 `TARGET`만 deterministic 처리 가능
- 없는 대상어는 곧바로 실패

였지만, 지금은 아래처럼 바뀌었습니다.

1. unresolved slot 발견
2. 메모리 캐시 조회
3. 캐시에 없으면 OpenAI에게 `slot만 번역` 요청
4. 결과를 캐시에 저장
5. 그 결과로 deterministic 문장을 다시 조립

예:

- 입력: `스페인어를 배우고 싶어`
- unresolved slot: `스페인어`
- slot translation fallback 결과: `Spanish`
- 최종 표현:
  - `I want to learn Spanish.`
  - `I want to start learning Spanish.`
  - `practice Spanish`

즉 전체 문장을 OpenAI에 넘기는 것이 아니라,
필요한 slot만 번역하고 표현 패턴은 deterministic하게 유지합니다.

---

## 9. OpenAiCoachClient 역할

`OpenAiCoachClient`는 OpenAI 호출을 전담합니다.

역할:

1. Responses API 요청 body 생성
2. OpenAI 호출
3. 구조화된 응답 파싱
4. DTO로 변환

### 9-1. 전체 코치 도움 요청

`help(...)`는 코치 응답 전체를 요청합니다.

OpenAI에 전달되는 주요 정보:

- prompt topic
- difficulty
- English question
- Korean question
- learner question
- query mode
- core meaning
- detected intents
- prompt hints

즉 OpenAI도 raw question만 받는 것이 아니라,
서버가 1차 분석한 결과를 함께 받습니다.

### 9-2. starter-only 프롬프트 강화

최근 추가된 중요한 변경:

`STARTER` intent가 잡히면 OpenAI에게 아래 규칙을 강하게 줍니다.

- 첫 문장 opener만 추천
- conclusion phrase 제외
- contrast marker 제외
- example linker 제외
- body transition 제외

그래도 모델이 섞어서 답할 수 있기 때문에,
서비스 레이어에서 다시 starter-only 필터를 한 번 더 적용합니다.

### 9-3. slot translation 전용 요청

`translateMeaningSlot(...)`는 전체 코치 응답이 아니라,
불명확한 slot 하나만 영어로 옮기는 데 사용됩니다.

예:

- slot type: `TARGET`
- source text: `스페인어`
- result: `Spanish`

이 방식의 장점:

- 전체 응답을 모델에 맡기지 않아도 됨
- deterministic 표현 생성 유지
- 비용과 흔들림이 줄어듦

---

## 10. OpenAI 응답 후처리

OpenAI를 썼다고 해서 결과를 그대로 믿지는 않습니다.

`CoachService`는 응답을 후처리합니다.

### 10-1. intent 기반 필터링

예:

- `starter` 요청이면 starter 표현만 남김
- `idea support`면 아이디어 성격이 약한 generic phrase는 제외

### 10-2. generic meaning 응답 downgrade

의미 lookup인데도 OpenAI가:

- `One reason is that ...`
- `For example, ...`

처럼 generic support 표현만 주는 경우가 있습니다.

이 경우 해당 응답은 meaning lookup으로 채택하지 않고,
support 쪽 fallback 또는 재조합으로 내려보냅니다.

즉 `query mode`가 잘못 해석된 흔적을 후처리에서 한 번 더 막습니다.

### 10-3. starter top-up

starter 요청인데 OpenAI가 1~2개만 유효 starter를 준 경우:

1. 살아남은 starter는 보존
2. 부족한 수만큼 로컬 starter expression으로 보충

즉 `starter-only`와 `개수 확보`를 동시에 만족시키는 구조입니다.

---

## 11. 로컬 fallback

OpenAI가 실패하거나 충분히 좋은 결과를 못 주면 로컬 fallback이 동작합니다.

### 11-1. writing support local fallback

구성 요소:

- generic expressions
- prompt hint 기반 expressions
- intent별 fallback expressions

예:

- `reason`
- `example`
- `comparison`
- `detail`
- `starter`

### 11-2. idea support local fallback

아이디어성 질문은 generic 연결 표현보다
짧은 내용 아이디어를 우선 만들도록 fallback이 구성됩니다.

### 11-3. meaning lookup 최종 fallback

meaning lookup에서도:

- deterministic 실패
- slot translation fallback 실패
- OpenAI meaning fallback 실패

가 모두 겹치면 마지막에 generic fallback으로 내려갈 수 있습니다.

구조적으로는 이 generic fallback까지 내려가는 빈도를 줄이는 것이 목표입니다.

---

## 12. interaction 로그와 interactionId

`/api/coach/help`는 응답만 돌려주는 것이 아니라,
동시에 `coach_interactions`에 interaction 로그를 저장합니다.

이 레코드에는 대략 아래가 들어갑니다.

- prompt 정보
- user question
- normalized question
- query mode
- intent
- meaning family / lookup payload
- coach reply
- expressions
- response source
- answer snapshot

그리고 이 interaction의 고유 키인 `interactionId`를 help 응답에 실어 프론트에 내려줍니다.

프론트는 이후 `usage-check`를 호출할 때 같은 `interactionId`를 다시 보냅니다.

이렇게 하면 백엔드는:

- help 시점의 질문/추천
- usage-check 시점의 실제 사용 결과

를 같은 interaction 레코드에 묶어 저장할 수 있습니다.

즉 한 interaction이 다음 흐름 전체를 대표합니다.

`질문 -> 코치 응답 -> 실제 사용 결과 -> 평가`

---

## 13. usage-check 로직

`checkUsage(...)`는 추천 표현 사용 여부를 확인합니다.

흐름:

1. 사용자 답변 normalize
2. 추천 표현별 deterministic 매칭
3. `used / unused` 분리
4. self-discovered 표현 후보 추출
5. 결과를 `answer_attempts`와 `coach_interactions`에 저장

추천 표현 매칭은 deterministic이 유지됩니다.

즉:

- `exact`
- `normalized`
- 짧은 ordered paraphrase

기준으로 판정합니다.

자세한 self-discovered 로직은 별도 문서:

- `docs/coach-used-expression-extraction.md`

를 참고하면 됩니다.

---

## 14. coach_interactions 평가 배치

최근에는 `coach_interactions`를 OpenAI로 다시 평가하는 관리자 작업도 붙어 있습니다.

구성:

- `CoachEvaluationService`
- `OpenAiCoachEvaluationClient`
- `AdminCoachEvaluationController`
- `CoachEvaluationJob`

흐름:

1. `NOT_EVALUATED` interaction 조회
2. OpenAI가 질문 대비 코치 답변의 적절성을 평가
3. `APPROPRIATE / INAPPROPRIATE / NEEDS_REVIEW` 저장
4. score / summary / verdict / payload 저장

관리자 API:

- `GET /api/admin/coach-evaluations/summary`
- `POST /api/admin/coach-evaluations/run?limit=...`

자동 배치는 설정이 켜졌을 때만 동작합니다.

즉 `coach_interactions`는 단순 로그가 아니라,
나중에 코치 엔진을 개선하기 위한 학습/운영 데이터 저장소 역할도 합니다.

---

## 15. 현재 구조에서 중요한 설계 포인트

### 15-1. `STARTER`는 QueryMode가 아니라 intent다

이건 자주 헷갈리는 포인트입니다.

- `WRITING_SUPPORT`는 큰 가지
- `STARTER`는 그 안의 세부 의도

즉 `첫 문장 스타터 알려줘`는:

- QueryMode: `WRITING_SUPPORT`
- Intent: `starter`

입니다.

### 15-2. `hybrid`도 QueryMode가 아니라 cue/처리 전략이다

현재 hybrid는 별도 enum 모드가 아닙니다.

- QueryMode는 `MEANING_LOOKUP`
- cue는 `hybrid_meaning_support`
- 서비스에서 support intent를 보조로 주입

하는 방식입니다.

### 15-3. deterministic와 OpenAI는 경쟁 관계가 아니라 역할 분담이다

- deterministic
  - 빠름
  - 안정적
  - 같은 입력이면 같은 결과
- OpenAI
  - 추상 의미
  - 사전에 없는 slot
  - 아이디어/보조 해석

즉 지금 구조는 `무조건 OpenAI`가 아니라
`deterministic 우선 + OpenAI 보강` 쪽입니다.

---

## 16. 테스트 관점에서 무엇을 봐야 하나

현재 코치 로직 검증은 주로 아래 파일들에서 합니다.

- `apps/backend/src/test/java/com/writeloop/service/CoachQueryAnalyzerTest.java`
- `apps/backend/src/test/java/com/writeloop/service/CoachServiceTest.java`

중요 검증 포인트:

1. query mode가 맞는지
2. `starter / example / balance / structure` intent가 맞게 잡히는지
3. `MEANING_LOOKUP`이면 family 분류가 맞는지
4. unresolved slot이면 slot translation fallback이 도는지
5. starter 요청에서 non-starter 카드가 제거되는지
6. idea-support compact phrasing이 generic support로 안 새는지
7. hybrid cue일 때 support intent가 같이 주입되는지
8. interactionId가 생성되고 usage-check로 이어지는지
9. evaluation pipeline이 `NOT_EVALUATED`를 처리하는지

---

## 17. 앞으로의 확장 포인트

### 17-1. meaning family 확장

아직도 반복적으로 실패하는 family는 늘어날 수 있습니다.

예:

- 감정 변화
- 사회적 거리감
- 부담/익숙함/편안함
- appearance/perception 계열

### 17-2. intent compact phrasing 확장

짧고 부정확한 질문은 앞으로도 계속 나올 수 있습니다.

예:

- `사례 뭐 넣지`
- `첫문장 뭐로 열지`
- `균형감 있게 말하는 법`

즉 intent는 긴 정식 문장뿐 아니라 compact phrasing도 계속 보강해야 합니다.

### 17-3. interaction 기반 품질 개선

이미 저장되는 데이터:

- 질문
- 분류 결과
- 추천 결과
- 사용 결과
- OpenAI 적절성 평가

를 이용하면 앞으로는 실패 유형을:

- 문장 단위가 아니라
- family / intent / query mode 단위로

더 체계적으로 보강할 수 있습니다.

---

## 18. 요약

현재 코치 백엔드의 핵심 방향은 아래 한 문장으로 정리할 수 있습니다.

> 먼저 사용자가 원하는 도움의 종류를 좁게 분류하고, 그 목적에 맞는 표현만 안정적으로 추천한다.

즉 지금 구조는:

- `문장 패턴 하나씩 추가`보다 `query mode + intent + meaning family`
- `무조건 OpenAI`보다 `deterministic 우선 + slot translation fallback`
- `응답만 반환`보다 `interaction logging + usage-check + evaluation`

구조로 발전해 있습니다.

이 방향이 계속 강화되면, 더 다양한 한국어 질문도 문장별 예외처리 없이 점점 더 안정적으로 처리할 수 있습니다.
