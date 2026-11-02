# TrendIt main 직접 반영과 공개 시점 재점검 — 2026-11-02

상태: **main 직접 반영 승인 · 전송 준비 완료**. **전송 후 원격 자동 검사 확인 예정**.

## 반영 방식과 사용자 결정

사용자가 PR 대신 개인 저장소 main 직접 푸시를 요청했다. 대상은 [eunjin661/SKN29-2nd-1Team](https://github.com/eunjin661/SKN29-2nd-1Team)의 main이다. 기존 10월 23일 공개 준비 문서의 PR 절차는 이번 결정으로 대체한다. 팀 원본에는 쓰지 않으며 PR은 생성하지 않는다. main 읽기 결과는 기준 SHA `f06c8175c0a2a6d611e21c9e72a9e0ca9e789a1c`와 같았고 보호 설정이 없었다. GitHub 연결 사용자는 eunjin661, push 권한과 기존 SSH 인증을 확인했다. 강제 푸시나 기존 이력 덮어쓰기를 사용하지 않는다.

## 기존 검증과 새 검사 구분

시작 시 소스 233개와 근거 129개의 해시가 2026-10-23 검증 기록과 일치했다. 기존 백엔드 107개·전체 브라우저 49개·별도 설치 기본 브라우저 47개, 8개 모델 39,888 Test 점수 재현은 [10월 결과](FOLLOWUP_RESULTS_20261023.md)에 보존한다. 이번에 학습을 다시 수행해 성능이 올랐다고 주장하지 않는다.

오늘 npm audit를 새로 실행하니 7개 패키지 항목(High 1, Moderate 6)이 잡혔다. 실제 취약점 근원은 minimatch와 Zod 두 종류다. 두 패키지는 이 잠금 파일에서 개발 도구 의존성이며 앱의 런타임 의존성 범위는 유지했다. 10월 23일 0건 로그를 수정하지 않고 날짜별 상태를 구분한다.

- [minimatch 공지](https://github.com/advisories/GHSA-g3hv-75wg-m249)는 11.0.1 미만의 패턴 처리 증폭을 다룬다. 최신 ESLint의 일반 업데이트도 10.x를 요구해 자동 수정안만으로 해결되지 않았다. ESLint와 @eslint/config-array의 소비 지점 두 곳에 한정해 11.0.1 override를 지정했다. 상위 도구의 선언 범위를 넘는 수정이므로 설치·검사 대상 파일·전체 브라우저 결과로 이번 프로젝트의 호환 범위를 확인했다. 모든 소비자의 보편적 호환성을 주장하지 않는다.
- [Zod 공지](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)의 수정 범위에 따라, 허용된 의존성 범위 안에서 4.3.6→4.6.7로 갱신했다. 이 공지의 최초 날짜를 오늘 발견 날짜와 혼동하지 않는다.
- npm audit fix --force, 검사 규칙 비활성화, audit 경고 무시는 사용하지 않았다. 일반 자동 수정 dry-run은 경고가 남는다는 원시 결과도 보존했다.

## 이번 재검증

- 잠금 파일 새 설치(npm ci --ignore-scripts), 전체 코드 검사·audit·빌드 통과.
- 코드 검사 대상 **113개가 이전과 동일**, 오류/경고 0. minimatch 교체로 검사 대상을 줄이지 않았다.
- 실제 기준 평가·추가 진단 API를 연결한 Chromium 전체 **49개 통과**, 실패·skip·flaky 0, retries 0.
- npm audit **7→0**. 변경 버전은 [의존성 차이](publication_evidence_20261102/dependency-change-summary.json), 전후 감사는 [이전](publication_evidence_20261102/npm-audit.json)·[이후](publication_evidence_20261102/audit-final.json)에 있다.
- 공개 후보에서 로컬 .env·새 모델 가중치·venv/node_modules·인증 정보 패턴·대용량 파일이 검출되지 않았다. 기존 저장소의 정제 parquet는 재현 입력으로 계속 추적한다.
- 근거 폴더는 Git의 줄바꿈 변환을 적용하지 않아 캡처 당시 바이트와 해시를 보존한다. 원시 도구 로그의 출력 공백은 그대로 남기고, 제품 소스의 공백·lint 검사는 유지한다.

## 반영 커밋

- 전송 전: 커밋 생성 대기

## 원격 자동 검사

- 전송 전: 실행 없음

모든 실행 결과는 해당 head SHA에 연결해 확인한다. main 반영은 서비스 배포와 별개이며 외부 YouTube/DB 운영·새 기간 일반화·실기기 전체 검증을 완료했다는 뜻은 아니다. [현재 전송/검사 상태](main_publication_verification_20261102.json), [실행 명령 결과](publication_evidence_20261102/verification-commands.json), [전체 브라우저 결과](publication_evidence_20261102/browser-results.json)를 함께 확인한다.
