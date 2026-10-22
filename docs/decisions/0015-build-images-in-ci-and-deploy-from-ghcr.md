---
status: accepted
date: 2026-10-22
decision-makers: gyuwon
---

# 이미지는 GitHub Actions에서 빌드해 GHCR에 올리고, 운영 서버는 받아서 실행만 한다

## Context and Problem Statement

지금까지는 운영 서버에서 `git pull` 후 `docker compose up -d --build`로 배포했다. 운영 서버(Lightsail)는 메모리가 약 1.9GB이고 스왑이 없다. 실행 중인 서비스만으로 약 1GB를 쓴다. 이 상태에서 Gradle 빌드를 돌리면 메모리가 모자란다.

2026-10-22 배포 중에 서버에서 백엔드 이미지를 빌드하다 메모리가 바닥나 서버가 응답하지 않았고, 콘솔에서 재부팅할 때까지 서비스가 멈췄다. 배포 때마다 같은 위험이 있었다. 테스트도 배포 전에 자동으로 돌지 않았다.

## Decision Drivers

* 배포가 운영 서버의 메모리를 쓰지 않아야 한다.
* 테스트와 빌드를 통과한 커밋만 운영에 나가야 한다.
* 배포 전 DB 백업(ADR-0013)을 빠뜨리지 않아야 한다.
* 문제가 생기면 이전 커밋으로 쉽게 되돌릴 수 있어야 한다.
* 추가 비용이 없어야 한다.

## Considered Options

* 서버에서 계속 빌드하고, 스왑을 추가한다.
* 개발 PC에서 이미지를 빌드해 `docker save`로 서버에 보낸다.
* GitHub Actions에서 빌드해 GHCR(GitHub Container Registry)에 올리고, 서버는 받아서 실행한다. 배포는 수동으로 한다.
* GitHub Actions에서 빌드해 GHCR에 올리고, main push 후 자동 배포한다.

## Decision Outcome

Chosen option: "GitHub Actions 빌드 + GHCR + main push 후 자동 배포", because 서버가 빌드하지 않고, 테스트를 통과한 커밋만 배포되며, 공개 저장소라 Actions와 GHCR를 무료로 쓸 수 있기 때문이다. 스왑만 추가하면 빌드는 끝나도 매우 느려지고 실행 중인 서비스도 함께 느려진다. 개발 PC 빌드는 사람마다 결과가 다를 수 있고, 테스트를 건너뛰기 쉽다.

* `.github/workflows/ci.yml`
  * PR과 main push에서 백엔드 테스트, 웹 빌드, 모바일 타입 검사, 피드백 채점 규칙 테스트를 돌린다.
  * 문서만 바꾼 커밋(`docs/**`, `*.md`, `.claude/**`)은 돌리지 않는다.
  * main push에서 모두 통과하면 `ghcr.io/gyugyu1/writeloop-backend`, `writeloop-frontend` 이미지를 커밋 SHA와 `latest` 태그로 올린다.
  * 이어서 `deploy.yml`을 호출한다.
* `.github/workflows/deploy.yml`
  * 저장소 시크릿의 SSH 키로 운영 서버에 접속한다.
  * 서버 저장소를 배포할 커밋으로 맞추고 `scripts/ops/deploy.sh`를 실행한다.
  * Actions 화면에서 커밋 SHA를 넣어 직접 실행할 수도 있다(재배포, 롤백).
  * GHCR 로그인에는 작업마다 새로 발급되는 `GITHUB_TOKEN`(패키지 읽기 권한)을 쓴다. 서버에 오래 남는 토큰을 두지 않는다.
* `scripts/ops/deploy.sh`(서버에서 실행)
  1. 운영 DB를 `~/db-backups`에 백업하고, 덤프가 끝까지 됐는지 확인한다.
  2. 이 커밋의 이미지를 받아 `:latest`로 태그한다.
  3. 백엔드·프론트엔드를 다시 만들고, 백엔드 기동(Flyway 포함)과 프론트엔드 상태를 확인한다.
  4. 지난 배포 이후 `infra/nginx`가 바뀌었으면 nginx를 다시 만든다.
  5. 배포한 커밋을 `~/writeloop-deployed-sha`에 기록하고 공개 주소로 응답을 확인한다.
* `docker-compose.yml`은 백엔드·프론트엔드에 GHCR 이미지 이름을 지정한다. `build:` 설정은 로컬 개발용으로 남긴다.
* 웹의 공개 API 주소(`NEXT_PUBLIC_API_BASE_URL=https://api.writeloop.kr`)는 빌드할 때 번들에 들어가므로 `ci.yml`에 적었다.

### Consequences

* Good, because 서버는 이미지를 받아 실행만 해서, 배포 중 메모리 사용이 거의 늘지 않는다.
* Good, because 테스트에 실패한 커밋은 이미지가 만들어지지 않아 배포되지 않는다.
* Good, because 모든 배포 전에 DB 백업이 자동으로 남는다.
* Good, because 커밋마다 이미지가 남아 있어, SHA만 넣으면 그 커밋으로 되돌릴 수 있다.
* Bad, because main에 push하면 바로 운영에 배포된다. 운영에 내보내지 않을 작업은 브랜치에서 하고 PR로 합친다.
* Bad, because 이 결정 이전의 커밋에는 `scripts/ops/deploy.sh`와 GHCR 이미지가 없어서, 그 커밋으로는 이 방식으로 되돌릴 수 없다.
* Bad, because 백엔드가 뜨지 않으면 배포 작업은 실패로 끝나지만 자동으로 되돌리지는 않는다. 이전 SHA로 `Deploy`를 직접 실행하고, 필요하면 출력된 백업으로 DB를 복구한다.
* Bad, because 서버 호스트 키를 배포할 때마다 `ssh-keyscan`으로 받아 믿는다(처음 접속 시 신뢰). 호스트 키를 시크릿으로 고정하면 더 안전하다.
* Bad, because 운영에서 쓰는 비밀값은 여전히 서버의 `.env`에 있다. 비밀값을 바꾸는 작업은 이 파이프라인 밖에서 한다.

### Confirmation

* `actionlint`로 워크플로 문법을 검사했다(2026-10-22).
* 첫 main push 후 Actions 실행 결과, GHCR 패키지, 운영 컨테이너 이미지 이름, 공개 주소 응답으로 확인한다.

## More Information

* 이미지에는 `org.opencontainers.image.source` 라벨을 붙여 GHCR 패키지를 이 저장소에 연결한다. 그래야 배포 작업의 `GITHUB_TOKEN`으로 이미지를 받을 수 있다.
* `scripts/ops/prod-db.sh`는 실행 중인 백엔드 컨테이너의 환경변수에서 DB 접속 정보를 읽어 `mysql`·`mysqldump`를 실행한다. 비밀번호와 DB 주소를 저장소에 적지 않는다.
* 개선점: 서버 스왑 추가, 배포 실패 시 자동 롤백, 백엔드 헬스체크.
