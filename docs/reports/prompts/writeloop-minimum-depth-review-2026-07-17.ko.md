# minimumDepthSlots=2 문항 전수 재검토 보고서

- 검토일: 2026-07-17
- 전체 질문: 1,446건
- 기존 `minimumDepthSlots=2`: 21건
- `2 → 1` 하향: 21건
- `2` 유지: 0건

## 결론

기존 21건은 모두 난이도 `C`의 `OPINION_REASON` 문항이며, 필수 슬롯은 `OPINION` 하나였다. 그러나 질문 문구는 이유·예시·결과 등 서로 다른 보강 정보 두 종류를 모두 요구하지 않았다. 주제가 포괄적이거나 사회적으로 중요하다는 이유만으로 깊이 슬롯 두 개를 강제하면, 구체적인 의견과 충분한 근거를 이미 쓴 답변에도 예시나 결과를 추가로 요구하게 된다.

따라서 21건 모두 `minimumDepthSlots=1`로 낮췄다. 이제 다음 조건이면 완료할 수 있다.

1. 필수 `OPINION`이 구체적으로 충족된다.
2. 선택 슬롯 중 `REASON`, `EXAMPLE`, `RESULT` 등 하나가 구체적으로 충족된다.
3. 막연한 표현은 `GENERIC`으로 판정되므로 깊이 충족으로 계산하지 않는다.

예를 들어 `Companies should protect user data because privacy matters.`는 `OPINION + REASON`을 충족하므로 더 이상 별도의 예시를 강요하지 않는다. 반면 `Companies should act responsibly because it is important.`처럼 내용이 막연하면 `REASON=GENERIC`이므로 여전히 이유를 구체화해야 한다.

## 문항별 판정

| 문항 ID | 질문 | 판정 |
|---|---|---|
| `prompt-c-2` | What social responsibilities should successful companies have in modern society? | `2 → 1` |
| `prompt-opinion-01` | What social responsibilities should successful companies have in modern society? | `2 → 1` |
| `prompt-opinion-06` | What responsibilities should public transportation in big cities have in modern society? | `2 → 1` |
| `prompt-opinion-11` | What responsibilities should schools that teach financial skills have in modern society? | `2 → 1` |
| `prompt-opinion-1102` | What responsibilities should public museums have in the community today? | `2 → 1` |
| `prompt-opinion-1104` | What role should universities play in modern society? | `2 → 1` |
| `prompt-opinion-1105` | What responsibilities should local news outlets have in the community today? | `2 → 1` |
| `prompt-opinion-1108` | What responsibilities should public health campaigns have in the community today? | `2 → 1` |
| `prompt-opinion-1109` | In your opinion, what should companies using AI do for people in modern society? | `2 → 1` |
| `prompt-opinion-1111` | What responsibilities should public broadcasters have in the community today? | `2 → 1` |
| `prompt-opinion-1114` | What responsibilities should after-school programs have in the community today? | `2 → 1` |
| `prompt-opinion-1115` | In your opinion, how should train stations serve people and communities today? | `2 → 1` |
| `prompt-opinion-1117` | What responsibilities should employers offering internships have in the community today? | `2 → 1` |
| `prompt-opinion-1120` | What responsibilities should local governments running heat shelters have in the community today? | `2 → 1` |
| `prompt-opinion-1126` | What responsibilities should public swimming pools have in the community today? | `2 → 1` |
| `prompt-opinion-21` | What responsibilities should social media platforms have in modern society? | `2 → 1` |
| `prompt-opinion-28` | How important are public libraries for communities today? | `2 → 1` |
| `prompt-opinion-33` | How important are school uniforms in public schools for communities today? | `2 → 1` |
| `prompt-opinion-38` | How important are recycling programs for communities today? | `2 → 1` |
| `prompt-opinion-43` | How important are part-time jobs for teenagers for communities today? | `2 → 1` |
| `prompt-opinion-48` | How important are community arts programs for communities today? | `2 → 1` |

## 재발 방지 기준

- 난이도 `C`, 사회적 중요성, 넓은 주제라는 이유만으로 `2`를 선택하지 않는다.
- 질문에 여러 대상이 등장해도 각각의 답변 절을 요구하지 않으면 깊이 두 개를 강제하지 않는다.
- 질문이 두 가지 내용을 명시적으로 요구하면 `minimumDepthSlots=2`로 숨기지 않고 각각을 `REQUIRED` 슬롯으로 등록한다.
- 필수 답과 구체적인 보강 정보 하나로 질문에 충분히 답할 수 있으면 `minimumDepthSlots=1`을 사용한다.

## 반영 및 검증

- 수동 검토 원본, 영어 검토 사유, 한국어 검토 사유를 함께 수정했다.
- 통합 메타데이터와 `087`, `088` 생성 SQL을 다시 생성했다.
- 기존 개발 DB를 위한 `092-lower-overstrict-opinion-depth.sql`을 추가했다.
- 메타데이터 생성 검증: 1,446건 통과, `minimumDepthSlots=2` 0건.
- 백엔드 정책 회귀 테스트: 통과.
- 임시 MySQL 마이그레이션 검증: 1,446개 프로필, 검토 사유, 활성 슬롯 8,474건이 두 번 실행 후에도 원본과 일치.
- 개발 DB 적용 전: `minimum_depth_slots=2` 21건.
- 개발 DB 적용 후: `minimum_depth_slots=2` 0건, 대상 21건 모두 `1`.
