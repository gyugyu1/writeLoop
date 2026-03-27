# Coach Used Expression Extraction

`잘 사용한 표현` 섹션이 어떤 기준으로 채워지는지, 그리고 최근에 `self-discovered = OpenAI 추출 + deterministic 검증` 구조로 어떻게 바뀌었는지를 정리한 문서입니다.

## 목적

`잘 사용한 표현`은 두 종류를 함께 보여줍니다.

1. AI 코치가 추천했던 표현을 사용자가 실제 답변에 쓴 경우
2. AI가 추천하지 않았지만 사용자가 스스로 잘 쓴 표현

즉 단순히 `추천 표현 매칭 결과`만 보여주는 것이 아니라, 답변 안에서 실제로 잘 살아난 표현을 보여주는 패널로 동작합니다.

## 전체 흐름

1. 프론트가 `usage-check`를 호출합니다.
2. 백엔드가 추천 표현 사용 여부를 deterministic하게 판정합니다.
3. 백엔드가 self-discovered 후보를 OpenAI에게 먼저 요청합니다.
4. 서버가 OpenAI 후보를 deterministic 규칙으로 다시 검증합니다.
5. OpenAI 후보가 부족하면 정규식 기반 fallback으로 self-discovered를 보충합니다.
6. 최종 `usedExpressions / unusedExpressions`를 응답으로 반환합니다.
7. 같은 결과를 `answer_attempts`와 `coach_interactions`에도 저장합니다.

주요 진입점:

- 프론트 호출: [answer-loop.tsx](C:/WriteLoop/apps/frontend/app/answer-loop.tsx#L1527)
- 컨트롤러: [CoachController.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/controller/CoachController.java#L40)
- 메인 로직: [CoachService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachService.java#L478)

## deterministic vs OpenAI 역할 분담

| 대상 | 현재 담당 | 이유 |
| --- | --- | --- |
| AI 추천 표현을 실제로 썼는지 판정 | deterministic | 기준이 명확하고, 같은 입력에 결과가 흔들리면 안 되기 때문 |
| 사용자가 스스로 잘 쓴 표현 후보 찾기 | OpenAI 우선 | 문맥과 뉘앙스를 봐야 해서 규칙만으로는 recall이 낮기 때문 |
| OpenAI가 뽑은 self-discovered 후보 최종 채택 | deterministic | hallucination, 과도한 일반화, 문장 전체 추출을 걸러내기 위해 |
| OpenAI 실패 시 self-discovered 보강 | deterministic fallback | API 실패나 품질 저하가 있어도 기능이 완전히 비지 않게 하기 위해 |

한 줄로 요약하면:

- `추천 표현 사용 여부`는 규칙 기반 유지
- `직접 잘 쓴 표현 찾기`는 OpenAI가 먼저 후보를 제안
- `최종 채택`은 서버가 다시 검증

## 1. 추천 표현 사용 여부 판정

추천 표현 매칭은 지금도 deterministic입니다.

구현 위치:

- 루프 진입: [CoachService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachService.java#L491)
- 매칭 함수: [CoachService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachService.java#L1775)

판정 단계:

1. `EXACT`
   추천 표현 원문이 답변에 그대로 들어간 경우
2. `NORMALIZED`
   구두점, `...` 같은 장식을 정리한 뒤 들어간 경우
3. `PARAPHRASED`
   의미 있는 토큰이 같은 순서로, 짧은 구간 안에 실제로 모여 있는 경우

최근 변경점:

- 예전에는 `answerTokens.containsAll(expressionTokens)`처럼 토큰만 있으면 `PARAPHRASED`로 잡혔습니다.
- 지금은 [CoachService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachService.java#L1963) 의 compact ordered window 검사로 바뀌어서, 비슷한 단어가 흩어져 있는 false positive를 줄였습니다.

## 2. self-discovered 추출 구조

### 2-1. 왜 구조를 바꿨는가

기존 방식은 정규식 기반 후보 추출만 사용했습니다.

장점:

- 빠름
- 안정적
- 결과가 흔들리지 않음

한계:

- 다양한 문맥 표현을 놓치기 쉬움
- 새 표현 family가 생길 때마다 패턴을 계속 추가해야 함
- `직접 사용한 좋은 표현`의 recall이 낮음

그래서 현재는 `OpenAI 추출 + deterministic 검증 + regex fallback` 구조로 바꿨습니다.

### 2-2. OpenAI 후보 추출

OpenAI는 self-discovered 후보를 최대 3개까지 제안합니다.

구현 위치:

- 호출: [CoachService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachService.java#L640)
- 클라이언트 메서드: [OpenAiCoachClient.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/OpenAiCoachClient.java#L95)
- DTO: [CoachSelfDiscoveredCandidateDto.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/dto/CoachSelfDiscoveredCandidateDto.java#L1)

OpenAI에 넘기는 정보:

- 현재 프롬프트 주제 / 난이도 / 질문
- 사용자가 실제로 제출한 답변
- AI가 추천했던 표현 목록
- 피드백의 `KEEP` 구간

OpenAI가 내려주는 구조:

- `matchedSpan`
  답변에서 그대로 복사한 짧은 표현
- `usageTip`
  왜 좋은 표현인지에 대한 한국어 설명
- `confidence`
  `HIGH | MEDIUM | LOW`

중요한 규칙:

- OpenAI는 새 문장을 만들어내면 안 됩니다.
- 반드시 답변 안의 실제 span만 반환해야 합니다.

### 2-3. deterministic 검증

OpenAI가 준 후보를 그대로 쓰지 않고 서버가 다시 거릅니다.

검증 위치:

- [CoachService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachService.java#L640)

검증 기준:

1. `confidence`가 `LOW`이면 버림
2. `matchedSpan`이 실제 답변 정규화 문자열 안에 있어야 함
3. 표현 길이가 너무 짧거나 의미 토큰이 부족하면 버림
4. 이미 추천 표현으로 잡힌 문구와 완전히 같은 경우 버림
5. 중복 후보는 하나만 남김

즉 역할 분담은 다음과 같습니다.

- OpenAI: 후보를 찾기
- 서버: 진짜 답변 안에 있는지, 채택해도 되는지 확인하기

### 2-4. deterministic fallback

OpenAI 후보가 없거나 부족하면 기존 regex 기반 fallback으로 보충합니다.

구현 위치:

- fallback 조합: [CoachService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachService.java#L598)
- 패턴 후보 조합: [CoachService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachService.java#L623)
- 정규식 패턴: [CoachService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachService.java#L56)

현재 fallback 패턴이 주로 다루는 family:

- `I’d like to ...`, `I want to ...`, `I hope to ...`
- `I’m curious about ...`, `I’m interested in ...`
- `visit`, `experience`, `explore`, `enjoy`
- `meet`, `connect with`, `communicate with`
- `meet people online`, `build relationships online`

보조 처리:

- `KEEP` 구간이 있으면 그 안의 후보를 우선시함
- `because`, `since`, `while` 같은 뒤 꼬리는 [CoachService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachService.java#L723) 에서 잘라냄

## 3. 최종 `usedExpressions` 구성

최종 `usedExpressions`에는 두 출처가 섞입니다.

1. `source = RECOMMENDED`
   AI 추천 표현을 실제로 쓴 경우
2. `source = SELF_DISCOVERED`
   사용자가 스스로 잘 쓴 표현

DTO:

- [CoachExpressionUsageDto.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/dto/CoachExpressionUsageDto.java#L3)

프론트에서는 이 `source`로 배지를 구분합니다.

- `AI 추천`
- `직접 사용`

렌더 위치:

- [answer-loop.tsx](C:/WriteLoop/apps/frontend/app/answer-loop.tsx#L2066)

## 4. 저장 구조

### 4-1. answer_attempts

시도 레코드에는 최종 `usedExpressions`가 저장됩니다.

- 컬럼: `answer_attempts.used_coach_expressions_json`
- 엔티티: [AnswerAttemptEntity.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/persistence/AnswerAttemptEntity.java#L63)
- 저장 위치: [CoachService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachService.java#L534)

저장 payload에는 다음이 들어갑니다.

- `expression`
- `matchType`
- `matchedText`
- `source`

DTO:

- [AnswerHistoryUsedExpressionDto.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/dto/AnswerHistoryUsedExpressionDto.java#L3)

### 4-2. coach_interactions

코치 질문 단위 로그에도 같은 사용 결과를 저장합니다.

- `used_expressions_json`
- `usage_payload_json`

업데이트 위치:

- [CoachService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachService.java#L417)

이렇게 하면 나중에 다음 분석이 가능합니다.

- 어떤 추천 표현이 실제 사용률이 높은지
- 어떤 질문 유형에서 self-discovered가 많이 나오는지
- 추천 표현과 self-discovered의 품질 차이가 어떤지
- OpenAI/규칙 기반 결과를 어떻게 더 개선할지

## 5. 테스트 포인트

관련 회귀 테스트:

- 추천 표현 compact paraphrase 검증:
  [CoachServiceTest.java](C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/CoachServiceTest.java#L449)
- `KEEP` 구간 fallback 검증:
  [CoachServiceTest.java](C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/CoachServiceTest.java#L480)
- curiosity 표현 regex fallback:
  [CoachServiceTest.java](C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/CoachServiceTest.java#L542)
- OpenAI self-discovered 후보 채택:
  [CoachServiceTest.java](C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/CoachServiceTest.java#L572)
- OpenAI low confidence 후보 무시 후 fallback:
  [CoachServiceTest.java](C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/CoachServiceTest.java#L615)

## 6. 운영 반영 메모

이번 변경은 DDL 변경이 없습니다.

이유:

- `answer_attempts.used_coach_expressions_json`은 이미 존재
- `coach_interactions.used_expressions_json`, `usage_payload_json`도 이미 존재
- 이번 변경은 extraction 전략과 JSON payload 내용 개선만 포함

즉 운영 반영은 스키마 변경 없이 애플리케이션 배포로 처리하면 됩니다.

## 요약

현재 `잘 사용한 표현`은 다음 3단계의 결과입니다.

1. 추천 표현은 deterministic하게 판정
2. self-discovered는 OpenAI가 후보를 제안
3. 서버가 deterministic하게 다시 검증하고, 부족하면 fallback으로 보충

즉 지금 구조는 `전부 하드코딩`도 아니고, `전부 OpenAI에게 맡김`도 아닙니다.

`찾는 건 OpenAI, 믿는 건 서버`라는 하이브리드 구조로 운영됩니다.
