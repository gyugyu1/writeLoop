# 라이트루프 프로젝트 코드·성능·보안 점검

검토 기준: 로컬 `main`, 커밋 `00648a6`. 요청 범위는 문제 발견과 설명이며, 제품 코드나 운영 설정을 수정하지 않았다.

## 우선순위 요약

P1은 먼저 조치할 보안·데이터 보존·서비스 안정성 문제, P2는 다음 개선 작업에 포함할 정확성·성능·유지보수 문제다. CVSS 점수가 아니라 이 프로젝트의 작업 우선순위다.

| 번호 | 우선순위 | 발견 사항 | 검증 수준 |
| --- | --- | --- | --- |
| 1 | P1 | 비밀번호 재설정의 최종 API에 요청 제한이 없음 | 필터 재현 + 서비스 경로 확인 |
| 2 | P1 | 전달 IP 헤더를 조작해 IP 기반 요청 제한을 우회할 수 있음 | IP 판별 재현 + nginx 설정 확인 |
| 3 | P1 | guestId를 생략하면 비회원 이용 제한이 빠짐 | 세션 생성·횟수 검사 재현 |
| 4 | P1 | 통신 장애 중 글 저장 시 기존 미동기화 글이 사라질 수 있음 | 실제 TS 모듈 + 저장소/API mock 재현 |
| 5 | P1 | 토큰으로 로그인한 모바일 사용자의 회원 탈퇴 실패 | 서비스 재현 + 모바일 호출 경로 확인 |
| 6 | P1 | 앱·프록시·LLM의 대기 시간이 맞지 않음 | 설정·요청 경로 확인 |
| 7 | P1 | LLM 대기 중 DB 연결을 점유하고 실패 로그에 추가 연결이 필요함 | 트랜잭션 경로 확인, 부하 시험 미실시 |
| 8 | P2 | 최초 피드백 요청 재전송과 동시 요청의 중복 방지가 불완전함 | 최초 세션 생성 재현 + 저장 순서 확인 |
| 9 | P2 | 없는 질문 ID를 첫 번째 다른 질문으로 대체함 | 서비스 재현 |
| 10 | P2 | 자주 하는 실수 통계가 다중 교정과 오류 종류를 잘못 집계함 | 분류 함수 재현 + 추출 로직 확인 |
| 11 | P2 | 기록·통계 조회가 사용자의 전체 이력에 비례해 무거워짐 | 서비스·Repository 조회 경로 확인 |
| 12 | P2 | refresh token 교체가 원자적이지 않음 | 코드 경로 확인, Redis 동시성 시험 미실시 |
| 13 | P2 | 웹·모바일 의존성에 보안 경고가 있으며 노출 범위별 업데이트가 필요함 | npm audit 실행 + 주요 의존 경로 확인 |

## 1. 비밀번호 재설정 최종 API의 요청 제한 누락

근거: [RequestRateLimitFilter.java:75](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/config/RequestRateLimitFilter.java:75), [AuthController.java:178](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/controller/AuthController.java:178), [AuthService.java:305](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/AuthService.java:305).

현재 제한 목록에는 `/password-reset/send-code`, `/password-reset/verify-code`가 있지만 `/password-reset/complete`는 없다. 최종 API는 이메일·코드·새 비밀번호를 받아 직접 코드를 확인하고 비밀번호를 변경한다. 앞의 `verify-code`를 통과했다는 별도의 증명은 요구하지 않는다.

따라서 화면의 정상 순서를 따르지 않고 최종 API에 코드를 계속 제출하면, 앞 단계의 요청 제한을 받지 않는다. 코드가 일치해야 비밀번호가 바뀌므로 즉시 계정 탈취가 가능하다는 뜻은 아니다. 다만 활성 재설정 코드에 대한 반복 추측을 막는 핵심 방어가 빠져 있다. 같은 필터에서 `/register/complete`, 메일 발송을 포함하는 기존 `/register`도 빠져 있다.

개선: 최종 API까지 요청 제한을 적용하고, IP 외에 계정·발급된 코드 단위의 실패 횟수를 관리해야 한다. 코드 확인과 최종 변경이 동일한 시도 예산을 사용하도록 만들고, 초과하면 해당 코드를 폐기한다. 코드 검증 후 제한된 일회용 재설정 증명을 발급하는 방법도 가능하다. 실제 계정을 공격자가 잠그는 형태가 되지 않도록 설계해야 한다.

추가로 [AuthService.java:1334](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/AuthService.java:1334)의 6자리 코드 생성은 `ThreadLocalRandom`을 사용한다. 인증용 코드는 `SecureRandom`으로 바꾸는 것이 맞다. 안전한 난수와 반복 추측 방어를 함께 적용해야 한다. [OWASP 비밀번호 재설정 지침](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

검증: 세 최종/기존 경로에서 `shouldNotFilter=true`, 비교 대상 `verify-code`에서는 `false`인 것을 로컬에서 확인했다. 실제 사용자 코드 추측이나 운영 API 호출은 하지 않았다.

## 2. 전달 IP 헤더를 통한 요청 제한 우회

근거: [RequestRateLimitFilter.java:294](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/config/RequestRateLimitFilter.java:294), [prod.conf:57](C:/WriteLoop/infra/nginx/prod.conf:57).

백엔드는 접속 주소가 사설 IP이면 신뢰할 프록시로 간주하고 `X-Forwarded-For`의 첫 번째 값을 사용자 IP로 채택한다. nginx는 `$proxy_add_x_forwarded_for`로 기존 헤더 뒤에 실제 접속 주소를 추가한다. 이는 nginx의 문서화된 동작이다. [nginx 공식 설명](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#var_proxy_add_x_forwarded_for).

외부 요청이 임의의 IP를 헤더에 먼저 넣으면 백엔드가 그 임의 값을 제한 기준으로 사용할 수 있다. 같은 사람이 첫 번째 값만 바꿔 다른 사용자처럼 보이는 구조다. 로그인·인증 메일·비회원 피드백의 IP 제한이 영향을 받는다. 로그인한 사용자의 `user:id` 기반 제한까지 모두 무력화되는 것은 아니다.

개선: 공개 진입점 nginx가 직접 클라이언트를 받는 구성이라면 외부 전달 헤더를 덮어쓰고 실제 접속 주소만 전달한다. 앞에 로드밸런서나 CDN이 있다면 신뢰할 프록시를 정확히 지정하고, 오른쪽부터 신뢰 관계를 확인해 클라이언트 IP를 결정해야 한다. 모든 사설 IP를 무조건 신뢰하는 규칙은 줄여야 한다.

검증: 동일한 실제 IP와 동일한 프록시 주소에서 전달 헤더 첫 값만 변경했을 때 제한 키에 쓰이는 IP가 바뀌었다. 실제 운영의 추가 WAF/CDN 방어 유무는 확인하지 않았다.

## 3. guestId 생략으로 비회원 제한 우회

근거: [FeedbackController.java:35](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/controller/FeedbackController.java:35), [FeedbackService.java:336](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java:336), [FeedbackService.java:398](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java:398).

비회원의 세션 생성 제한과 수정 횟수 제한은 모두 `guestId != null`일 때만 적용된다. 그런데 API는 익명 요청의 guestId를 필수로 요구하지 않는다. 이를 생략하면 userId와 guestId가 모두 없는 세션을 만들 수 있고, 해당 횟수 검사도 건너뛴다.

영향: 앱 UI에서는 체험 횟수가 제한되어 보여도 직접 API를 호출하면 그 제한을 벗어나 LLM 비용을 발생시킬 수 있다. 일반 요청 속도 제한은 별도로 남아 있지만 2번 문제와 결합하면 방어력이 더 약해진다. 소유자가 없는 세션은 소유권 검사 기준도 약해진다. 다만 세션 UUID만으로 다른 사용자의 기록을 추측해서 읽을 수 있다고 확인한 것은 아니다.

개선: 익명 요청은 서버가 확인할 수 있는 비회원 식별 수단을 반드시 요구해야 한다. 클라이언트가 임의로 새 guestId를 계속 만들 수 있으므로 null 검사만 추가해서는 충분하지 않다. 서버 발급 식별자, 세션 귀속, IP 제한, 전체 무료 사용 예산을 함께 적용한다.

검증: guestId 없는 익명 세션이 생성되고, 시도 횟수를 99로 설정한 mock에서도 횟수 조회 자체를 하지 않는 것을 확인했다.

## 4. 오프라인 저장이 기존 미동기화 글을 덮어씀

근거: [now-in-english.ts:362](C:/WriteLoop/apps/mobile/src/lib/now-in-english.ts:362), [now-in-english.ts:371](C:/WriteLoop/apps/mobile/src/lib/now-in-english.ts:371), [now-in-english.ts:546](C:/WriteLoop/apps/mobile/src/lib/now-in-english.ts:546).

현재 저장할 때마다 `getCurrentUser()`를 호출한다. 통신 실패를 포함한 모든 예외를 잡아서 `ownerId=null`, 즉 비회원처럼 처리한다. 기존 캐시에 로그인 사용자의 ownerId가 있으면 읽기 함수는 빈 목록을 반환한다. 이후 새 글을 이 빈 목록에 추가해 같은 저장 키에 쓰고, 기존 owner 표시까지 지운다.

발생 예: 사용자의 글 A가 서버에 올라가지 못하고 기기에만 남아 있다. 통신이 끊긴 상태에서 글 B를 저장한다. 서버에서 사용자를 확인하지 못해 기존 목록을 빈 것으로 보고 B만 저장한다. A는 동기화 대기 ID만 남고 내용이 사라질 수 있다. 서버에 이미 저장된 글은 재조회로 회복할 수 있지만, 아직 동기화하지 않은 글은 그렇지 않다.

개선: 네트워크 오류와 실제 로그아웃을 구분한다. 오프라인에서는 이미 확인된 세션의 사용자 ID를 유지하고, `entries:userId`, `pending:userId`, `reflection:userId`처럼 저장소를 계정별로 분리한다. 다른 계정이나 비회원으로 옮기는 처리는 명시적인 절차로 만들고, 확인 불가 상태에서 기존 데이터를 덮어쓰지 않는다.

검증: 실제 TypeScript 파일을 변환해 실행하고 API·AsyncStorage만 mock 처리했다. 기존 미동기화 A가 있는 상태에서 사용자 조회 실패 후 B를 저장하자 저장 목록이 B 한 개로 바뀌고 owner 키가 삭제됐다.

참고: AI 회고 캐시도 계정별 분리는 없지만 현재 화면에 `entrySignature` 일치 검사가 있다. 따라서 이 점만으로 타 계정 회고가 그대로 노출된다고 단정하지 않았다.

## 5. 모바일 토큰 인증과 회원 탈퇴의 사용자 확인 방식 불일치

근거: [AuthService.java:568](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/AuthService.java:568), [TokenAuthService.java:70](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/TokenAuthService.java:70), [api.ts:1123](C:/WriteLoop/apps/mobile/src/lib/api.ts:1123).

모바일은 Bearer 토큰을 보내고, 토큰 인증은 request 속성에 사용자 ID를 기록한다. 그런데 회원 탈퇴는 `getCurrentUserId(session)`으로 HTTP 세션만 본다. 다른 API가 사용하는 request+session 통합 확인을 사용하지 않는다.

따라서 토큰만으로 정상 로그인한 사용자도 탈퇴 요청에서는 401이 날 수 있다. 세션 쿠키까지 같이 존재하는 환경에서는 드러나지 않을 수 있어 웹 중심 테스트만으로 놓치기 쉽다.

개선: 다른 API와 동일한 인증 사용자 resolver를 사용한다. 토큰 전용 요청에서 HTTP 세션이 없을 수도 있으므로 세션 무효화도 null-safe하게 처리한다. 비밀번호 확인이나 탈퇴 확인 문구는 유지하고, 세션 로그인·토큰 로그인·소셜 로그인별 탈퇴 테스트를 추가한다.

검증: 동일 request의 통합 resolver는 사용자 123을 반환했지만, 탈퇴 메서드는 본문 검증 전에 401을 반환했다. 실제 계정을 삭제하지 않았다.

## 6. 앱·nginx·LLM의 타임아웃 불일치

근거: [api.ts:80](C:/WriteLoop/apps/mobile/src/lib/api.ts:80), [api.ts:756](C:/WriteLoop/apps/mobile/src/lib/api.ts:756), [application.yml:71](C:/WriteLoop/apps/backend/src/main/resources/application.yml:71), [prod.conf:54](C:/WriteLoop/infra/nginx/prod.conf:54), [OpenAiFeedbackClient.java:167](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/OpenAiFeedbackClient.java:167).

| 구간 | 코드/기본 설정 |
| --- | --- |
| 모바일 질문·일기 피드백 | 90초 후 요청 취소 |
| 모바일 AI 코치·지금 영어로 회고/코치 | 45초 후 요청 취소 |
| 백엔드 OpenAI 피드백·일기·코치 | 개별 호출 기본 120초 |
| nginx API 응답 읽기 | 120초 |

예를 들어 질문 피드백이 100초에 성공하면 백엔드 기준으로는 정상일 수 있지만 모바일은 90초에 이미 오류를 보여준다. 계약 오류를 받은 뒤 재호출하는 경우에는 각 호출의 허용 시간이 다시 적용된다. 일시적인 공급자 오류 재시도도 있어 요청 전체 시간이 더 길어질 수 있다. 현재 전체 작업에 대한 공유 마감 시간이 없다.

영향: 사용자는 실패했다고 생각해 다시 요청하고, 백엔드에서는 기존 요청을 계속 처리하거나 저장할 수 있다. 결과 누락처럼 보이는 UX, 중복 호출 비용, 8번 중복 방지 문제와 연결된다. 과거 모든 실패가 이 원인이었다는 의미는 아니며, 이번 검토에서는 운영 로그를 조회하지 않았다.

개선: 개별 LLM 호출이 아니라 전체 작업의 최대 시간을 정하고, 재시도는 남은 시간 안에서만 수행한다. 클라이언트와 프록시는 이 작업 시간에 여유를 더한 값으로 맞춘다. 긴 작업을 허용할 계획이라면 작업 ID를 즉시 반환하고 상태·결과를 조회하는 비동기 방식이 더 안정적이다. 모바일 시간 제한 수정은 앱 반영도 필요하다.

## 7. LLM 대기 중 DB 연결을 점유하는 구조

근거: [FeedbackService.java:73](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java:73), [FeedbackService.java:111](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java:111), [FeedbackDiagnosisLogRecorder.java:28](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackDiagnosisLogRecorder.java:28).

`review()` 전체가 트랜잭션이다. 질문 조회와 세션 저장으로 DB를 사용한 다음, 트랜잭션을 유지한 채 LLM을 기다린다. 실패 시에는 `REQUIRES_NEW`로 별도 트랜잭션을 열어 실패 로그를 저장한다.

예를 들어 연결 풀이 10개인 환경에서 느린 피드백 요청 10개가 각 연결을 잡고 있으면, 다른 DB 요청들이 기다릴 수 있다. 이 요청들이 동시에 실패해 추가 로그 연결까지 요구하면 연결 고갈이 더 심해진다. 실제 운영 풀 크기와 처리량은 이번에 측정하지 않았다. 이는 조건부 부하 위험이지만 코드상 자원 점유 구조는 확인됐다. Spring 공식 문서도 외부 트랜잭션을 유지한 상태의 `REQUIRES_NEW`가 연결 풀 고갈을 일으킬 수 있다고 설명한다. [Spring 트랜잭션 전파 문서](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html).

개선: 짧은 준비 트랜잭션, 트랜잭션 밖 LLM 호출, 짧은 결과 확정 트랜잭션으로 분리한다. 단순히 어노테이션만 제거해서는 안 된다. 처리 중 상태와 중복 요청 방지, 사용자·질문의 유효성 재확인을 함께 설계해야 한다. 풀 크기 증가는 임시 완화책이지 근본 해결책은 아니다.

실패 원문과 오류 이유를 남기는 현재 정책은 유지할 가치가 있다. 로그를 없애는 대신 저장 시점과 자원 사용 방식을 고치는 문제다.

## 8. 최초 요청과 동시 요청의 중복 방지 부족

근거: [FeedbackService.java:91](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java:91), [FeedbackService.java:102](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/FeedbackService.java:102), [097-add-visible-feedback-attempt-lifecycle.sql:40](C:/WriteLoop/infra/mysql/schema/097-add-visible-feedback-attempt-lifecycle.sql:40).

현재 순서는 세션 생성/조회 후 `(sessionId, submissionId)`로 기존 결과 확인이다. 최초 요청의 응답을 받지 못하면 클라이언트는 sessionId를 아직 모른다. 같은 submissionId로 다시 보내도 새 세션부터 만들어져 기존 결과를 찾을 수 없다.

로그인 사용자는 동일 작업이 별도 세션과 LLM 호출로 처리될 수 있다. 비회원은 재시도가 체험 한도 초과로 거절될 수도 있다. 기존 세션에서도 두 요청이 동시에 도착하면 둘 다 기존 결과 없음과 같은 `attemptNo`를 확인한 뒤 유료 호출을 시작할 수 있다. DB의 unique key는 최종 중복 저장을 막지만 이미 발생한 LLM 호출 비용까지 막지는 못한다.

개선: 세션 ID를 모르는 최초 요청도 식별할 수 있도록 인증된 소유자와 submissionId 기준으로 작업을 먼저 확보한다. 처리 중이면 같은 작업 상태를 반환하고, 완료됐으면 기존 결과를 반환한다. 같은 ID로 다른 입력을 보내는 경우에는 충돌로 거절해야 한다. DB unique key와 진행 상태를 이용해 여러 서버에서도 한 작업만 실행하도록 한다.

검증: 같은 사용자와 최초 submissionId로 `resolveSession`을 두 번 실행했을 때 다른 세션 ID가 생성됐다. 동시 LLM 호출 비용이나 실제 DB unique 충돌은 이번에 실행하지 않았다.

## 9. 잘못된 질문 ID를 다른 질문으로 조용히 대체

근거: [PromptService.java:67](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/PromptService.java:67).

요청한 질문이 없거나 비활성 상태이면 `findAll().findFirst()`로 첫 번째 활성 질문을 반환한다. 사용자 답변은 원래 질문을 보고 작성했는데, 서버는 다른 질문과 슬롯으로 평가할 수 있다. 오래된 앱 화면에서 비활성화된 질문을 제출하는 경우에도 발생할 수 있다.

개선: 질문 조회 API와 피드백 평가에서는 명시적인 404 또는 비활성 상태 오류를 반환해야 한다. 대체 질문 추천은 별도 기능으로 제공하고 사용자가 바뀐 질문을 확인하도록 한다. 기존 기록을 어떤 질문 문구로 보여줄지는 별도 제품 정책이며, 이 문제를 고치기 위해 반드시 질문 스냅샷을 도입할 필요는 없다.

검증: 없는 ID 요청이 오류 대신 별도의 첫 번째 PromptDto를 반환했다.

## 10. 자주 하는 실수 통계의 집계 오류

근거: [AnswerHistoryService.java:271](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/AnswerHistoryService.java:271), [AnswerHistoryService.java:315](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/AnswerHistoryService.java:315).

현재 피드백은 여러 `languageCorrections`를 저장하지만 통계 추출은 개별 교정 목록을 읽지 않고 coachMove의 대표 문구와 전체 교정 답변을 한 건으로 만든다. 한 번에 세 가지를 교정해도 세 교정을 독립적으로 집계하지 못한다.

분류 역시 전체 문자열에 `a `, `an `, `the `가 있으면 관사 문제를 우선 반환한다. 예를 들어 시제 교정 결과가 `I went to the park.`이면 정상적인 `the`가 포함돼 있다는 이유로 관사 오류가 된다. 일반 단어가 있다는 사실과 그 단어가 오류였다는 사실을 혼동한다.

개선: 실제 노출·저장된 `languageCorrections`를 교정 단위로 집계해야 한다. 종류를 확실히 식별할 수 없으면 일반 문법 범주로 남기는 편이 부정확한 관사 통계보다 낫다. 명시적인 오류 종류 메타데이터 도입 여부는 별도로 결정할 수 있으며, 과거에 삭제한 LLM 필드를 자동으로 되살릴 필요는 없다.

검증: 분류 함수에 `tense`와 `I went to the park.`를 전달했을 때 결과가 `articles`였다.

## 11. 이력이 쌓일수록 기록과 홈 조회가 무거워짐

근거: [AnswerHistoryService.java:57](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/AnswerHistoryService.java:57), [AnswerHistoryService.java:186](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/AnswerHistoryService.java:186), [AnswerHistoryService.java:232](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/AnswerHistoryService.java:232), [DiaryService.java:111](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/DiaryService.java:111), [MobileHomeController.java:40](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/controller/MobileHomeController.java:40).

질문 기록은 사용자의 전체 세션과 전체 시도를 가져온다. 일기 목록도 전체 일기와 각 일기의 피드백 시도를 함께 가져온다. 자주 하는 실수는 모든 시도의 JSON을 확인한 뒤 마지막에 상위 5개를 남긴다. 홈의 연속 학습일 계산도 전체 완료 세션을 읽는다.

따라서 오래 사용하는 사람일수록 DB에서 읽는 양, JSON 변환량, 응답 크기가 늘어난다. 조회를 IN 방식으로 묶고 있어 모든 부분을 단순 N+1 문제라고 부르는 것은 정확하지 않다. 핵심은 요청 한 번에 읽는 데이터 범위가 제한되지 않는다는 점이다.

개선: 목록은 커서 기반 페이지와 요약 필드만 반환하고, 시도별 전체 피드백은 상세 화면에서 조회한다. 통계는 일자별/교정 종류별 집계로 분리한다. 긴 연속 학습 기록을 잘못 끊지 않도록 연속일 계산은 무작정 최근 30일만 읽는 식으로 바꾸지 말고, 일별 완료 정보에서 필요한 만큼 탐색한다. 개선 효과는 긴 이력을 넣은 부하 시험으로 확인해야 한다.

## 12. refresh token 교체의 경쟁 조건

근거: [TokenAuthService.java:34](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/TokenAuthService.java:34), [RefreshTokenService.java:37](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/RefreshTokenService.java:37), [RefreshTokenService.java:52](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/RefreshTokenService.java:52).

현재는 기존 토큰으로 사용자 조회, 기존 토큰 삭제, 새 토큰 발급이 서로 분리돼 있다. 같은 토큰의 요청 A와 B가 삭제 전에 모두 조회에 성공하면 두 요청이 모두 새 토큰을 받을 수 있다. 모바일의 단일 `refreshPromise`는 한 앱 프로세스의 정상 요청 중복을 줄일 뿐 서버의 동시 요청을 보장하지 않는다.

영향: 교체된 토큰을 다시 쓰지 못하게 하려는 일회용 특성이 경쟁 조건에서 깨진다. 토큰 탈취 없이 임의 계정으로 로그인할 수 있다는 뜻은 아니며, 유효 토큰 재사용·동시 요청 조건의 위험이다.

개선: Redis의 원자적 소비 연산 또는 Lua로 기존 토큰 검증·소비를 한 단계로 묶는다. 더 강한 보안이 필요하면 토큰 계열과 재사용 감지를 설계한다. 동시에 사용자 세트 정리, 장애 시 처리, 로그아웃·비밀번호 재설정과 교체의 경합을 테스트해야 한다. 이번에는 실제 Redis 동시성 테스트까지 실행하지 않았다.

## 13. 의존성 보안 업데이트 필요

근거: [frontend/package.json:14](C:/WriteLoop/apps/frontend/package.json:14), [mobile/package.json:32](C:/WriteLoop/apps/mobile/package.json:32), [package-lock.json](C:/WriteLoop/package-lock.json), [mobile/package-lock.json](C:/WriteLoop/apps/mobile/package-lock.json).

점검 중 `npm audit --omit=dev --json`을 실행한 결과다. 숫자는 영향받는 패키지 항목 수이며, 독립적으로 악용 가능한 공격 수가 아니다.

| 대상 | 결과 |
| --- | --- |
| 루트/웹 의존성 | high 4개: next, postcss, sharp, nanoid |
| 모바일 의존성 | critical 1개, high 12개, moderate 18개, low 1개 |

웹은 Next.js 15.5.18이고 audit는 같은 15.5 계열의 15.5.25를 수정 후보로 제시했다. 다만 개별 경고의 실제 적용 조건을 구분해야 한다. 예를 들어 확인한 Server Actions DoS 권고는 Server Action을 사용하는 앱이 대상이며, 이번 소스 검색에서는 해당 사용을 찾지 못했다. 현재 `images.unoptimized=true` 설정도 이미지 최적화 관련 경고의 노출 판단에 반영해야 한다. [Next.js 공식 보안 권고](https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj).

모바일 critical 항목은 간접 의존성 `shell-quote`다. 확인한 의존 경로에 `react-native -> react-devtools-core -> shell-quote`가 포함된다. Expo/Metro 등 개발·빌드 도구가 일반 dependencies를 통해 들어오기 때문에 `--omit=dev` 결과만 보고 출시 앱에서 원격 코드 실행이 가능하다고 결론내리면 안 된다.

개선: 웹은 호환되는 보안 패치와 lockfile을 먼저 갱신하고 빌드·인증·화면 회귀를 확인한다. 모바일은 Expo SDK와 React Native의 호환 조합 안에서 패치한다. `npm audit fix --force`는 권장하지 않는다. 실제 audit 제안에도 expo-router의 큰 버전 변경이 포함돼 있어 자동 적용 시 앱 호환성이 깨질 수 있다. 변경 후 audit를 다시 실행해 남은 경고와 실행 환경 노출을 기록한다.

백엔드 Spring Boot 3.4.3과 개별 라이브러리도 별도 SCA 점검 대상이다. 이번 npm 결과에 Java 의존성까지 검증됐다고 포함하지 않았다.

## 추가 개선 후보

### 운영 스키마 변경 경로 단일화

[application.yml:40](C:/WriteLoop/apps/backend/src/main/resources/application.yml:40)에 `ddl-auto: update`가 공통 설정으로 들어 있다. 운영에서 별도로 덮어쓰지 않으면 번호순 SQL 적용과 Hibernate 자동 변경이 함께 동작한다. 자동 DDL만으로 SQL의 데이터 보정이나 모든 제약조건이 재현되는 것은 아니다. 운영은 명시적 마이그레이션과 검증 모드로 분리하고 적용 이력·checksum을 관리하는 편이 안전하다. 기존 DB에 도구를 도입할 때는 baseline 검토가 선행돼야 한다. 실제 운영 환경변수와 적용 이력은 이번에 확인하지 않았다.

### Docker 빌드 재현성과 이미지 크기

[Dockerfile:4](C:/WriteLoop/apps/frontend/Dockerfile:4)는 `npm install`을 사용한다. [docker-compose.yml:85](C:/WriteLoop/docker-compose.yml:85)의 프런트엔드 빌드 문맥은 `apps/frontend`인데, Git에 추적된 웹 lockfile은 저장소 루트에 있다. 따라서 저장소만으로 빌드하면 루트 lockfile이 이미지 설치 단계에 사용되지 않는다. 로컬에 별도의 비추적 lockfile을 두었는지에 따라 결과도 달라질 수 있다.

빌드 문맥과 workspace 설치를 정리해 권위 lockfile로 `npm ci`하도록 만들고, Next standalone 출력 등으로 실행에 필요한 파일만 이미지에 포함하는 개선을 검토할 수 있다. 현재 runner는 builder의 전체 node_modules를 복사한다. 이번 검토에서 Docker 이미지를 실제 재빌드하거나 크기를 측정하지는 않았다.

### 통합 회귀 검사 자동화

현재 테스트는 모두 통과했지만 이번에 확인한 최종 인증 API, 토큰 전용 탈퇴, 첫 요청 중복, 오프라인 저장 같은 경계 상황을 잡지 못했다. 저장소에서 `.github` 워크플로는 확인되지 않았으므로 기존 외부 CI 유무를 확인하고, 인증 필터+컨트롤러 통합 검사, 실제 DB/Redis 동시성 검사, 모바일 저장소 전환 검사를 배포 전 검사에 포함하는 것이 좋다.

## 검증 결과와 한계

| 실행 | 결과 |
| --- | --- |
| 백엔드 `gradlew test --rerun-tasks --no-daemon` | 41개 클래스, 257개 테스트, 실패/오류/스킵 0 |
| 모바일 `npm run typecheck` | 통과 |
| 웹 `npm run build --workspace @english-learning/frontend` | 빌드·타입/린트·정적 페이지 생성 통과 |
| Java 감사 probe | 대조군 포함 12개 assertion 완료 |
| 모바일 오프라인 저장 probe | 기존 미동기화 글 소실 재현 |
| npm audit | 위 13번 결과 확인 |

검증용 파일은 [.codex_logs/project-audit-2026-09-05/ReviewProbes.java](C:/WriteLoop/.codex_logs/project-audit-2026-09-05/ReviewProbes.java), [.codex_logs/project-audit-2026-09-05/mobile-cache-probe.cjs](C:/WriteLoop/.codex_logs/project-audit-2026-09-05/mobile-cache-probe.cjs)에 있다. API·Repository·저장소를 mock 처리한 단위 수준 재현이며 운영 침투 시험이 아니다.

운영 DB 조회·쓰기, 운영 API 공격성 요청, 유료 LLM 호출, 스토어 재배포는 하지 않았다. 기기 UI 전체 시나리오, 실제 동시 부하, Java 의존성 전체 취약점 스캔, Git 전체 이력의 비밀정보 검사는 미실시다. 따라서 전체 파일과 모든 실행 경로에 문제가 없음을 보증하는 감사는 아니다.

확인한 보호 장치도 있다. 주요 일기·지금 영어로 테이블에는 사용자 삭제 cascade SQL이 있고, 주요 조회에 소유권 확인이 있다. 노출 피드백 스냅샷, 실패 원문·재시도·토큰 사용량 로그도 마련돼 있다. 이런 장치를 없애거나 LLM의 의미 판정을 임의의 문자열 규칙으로 대체하는 방향은 권하지 않는다.

## 권장 작업 순서

1. 인증 최종 API 제한과 전달 IP 신뢰 경계, 익명 요청 식별을 함께 수정한다.
2. 오프라인 원문 보존과 토큰 전용 회원 탈퇴를 수정한다.
3. 전체 작업 시간·중복 요청 처리·트랜잭션 경계를 하나의 안정성 작업으로 정리한다.
4. 질문 ID 오류와 실수 통계 정확성을 수정하고 기록 조회를 페이지화한다.
5. 토큰 교체 원자성, 의존성 패치, 운영 스키마·빌드 재현성을 강화한다.

가장 큰 최적화 효과는 지금 단계에서 LLM 계약 필드를 더 줄이는 것보다, 실패 후 중복 호출을 막고 긴 외부 요청에서 DB 연결을 해제하는 데서 기대할 수 있다. 정확한 절감량은 호출 시간·중복률·동시 사용자 수를 측정한 뒤 산출해야 한다.
