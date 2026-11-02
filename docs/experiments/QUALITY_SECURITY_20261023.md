# TrendIt 코드 검사·의존성 보안·누락 동작 점검

기록일: 2026-10-23 KST. 브랜치: `improve/trendit-reproducibility`. 이번 단계는 로컬 변경이며 GitHub push·배포·원격 CI 실행은 하지 않았다. 실행 증거 폴더 이름의 `20261022`는 점검을 시작한 날짜이고, 완료는 다음 날이다.

## 검증한 결과와 범위

| 항목 | 변경 전 | 변경 후 | 근거 |
|---|---:|---:|---|
| 저장소 전체 ESLint 오류 | 35 | 0 | [전](quality_evidence/before-lint.json), [후](quality_evidence/lint-final.json) |
| ESLint 경고 | 1 | 0 | 같은 JSON. `--max-warnings 0` 적용 |
| npm audit 패키지 경고 | 10 (high 8 / moderate 1 / low 1) | 0 | [전](quality_evidence/before-audit.json), [후](quality_evidence/audit-final.json) |
| 런타임 의존성 audit | 라우터 패키지 2개에 경고 | 0 | [개발 의존성 제외 감사](quality_evidence/audit-production-final.json) |
| 백엔드 회귀 검사 | 50 | 58 통과 | [기존 환경](quality_evidence/backend-second.log), [잠금 파일 독립 환경](quality_evidence/backend-independent-final.log) |
| Chromium 브라우저 검사 | 14 | 32 통과, 실패·재시도·flaky·skip 0 | [실행 로그](quality_evidence/browser-final.log), [전체 결과](quality_evidence/browser-final-results.json) |
| 배포용 빌드의 실제 브라우저 | 별도 확인 전 | 7개 경로 + 실제 예측·관측 분석 통과 | [결과](quality_evidence/production-browser.json) |
| 가장 큰 단일 JS 파일 | 빌드 출력 693.51 kB | 빌드 출력 361.03 kB | [전](quality_evidence/build-first.log), [후](quality_evidence/quality-check-final.log) |

`npm ci --ignore-scripts`로 `node_modules`를 새로 만든 뒤 전체 코드 검사·audit·빌드를 실행했다. 의존성 트리 검사와 `git diff --check`도 통과했다. [설치·실행 상태](quality_evidence/clean-verification.json), [최종 관문 결과](quality_evidence/final-audit-checks.json)에 종료 코드와 시간이 있다. 시간은 이 PC에서의 실행 기록이며 지연 시간 개선률이나 성능 벤치마크가 아니다.

JS 파일 수치는 페이지 분할과 화면 코드 정리를 함께 적용한 결과다. lazy import만의 효과를 따로 측정하지 않았고 전체 전송량·LCP·사용자 체감 속도 개선률도 측정하지 않았다. 경고 임계값을 올려 숨기지 않았다.

## 35개 오류의 원인과 수정

| 규칙 | 오류 수 | 실제 원인 | 수정 |
|---|---:|---|---|
| `no-unused-vars` | 30 | 사용하지 않는 import·상수·도우미·prop | 호출 여부와 부작용을 검토한 뒤 제거. [항목별 목록](quality_evidence/unused-cleanup.json) |
| `react-hooks/set-state-in-effect` | 4 | 라우트·요청·선택값에서 계산할 상태를 Effect에서 즉시 다시 저장 | Navbar는 경로 키로 초기화. 조회는 요청 키·시도 번호에서 로딩을 계산. 영상 선택은 ID로 현재 자료에서 파생 |
| `react-refresh/only-export-components` | 1 | 컴포넌트 파일에서 외부에 쓰이지 않는 일반 함수를 함께 export | `ResultBadge` 내부 함수로 제한 |

별도의 `react-hooks/exhaustive-deps` 경고 1개는 CountUp의 갱신 조건 누락이었다. 애니메이션을 경과 시간 기준으로 바꾸고 의존성·취소 처리를 반영했다. 소수·음수·단위·날짜·범위 문자열, 실행 중 duration 변경, reduced motion을 브라우저에서 확인했다. 검사 규칙 비활성화로 해결하지 않았다.

## 10건의 보안 경고가 뜻한 것

10건은 audit이 취약하다고 표시한 **패키지 항목 수**다. 서로 독립인 CVE 10개나 실제 침해 10건을 뜻하지 않는다. 하위 패키지의 권고가 상위 패키지에도 전파될 수 있다. 8개는 개발·빌드 의존성이고 2개는 런타임 라우터다. 권고별 상세 조건·링크는 원본 audit JSON에 보존했다.

| 패키지 | 당시 심각도 | 의존성 범위 | 잠금 버전 전 → 후 |
|---|---|---|---|
| `@babel/core` | low | 개발·빌드 | 7.29.0 → 7.29.7 |
| `baseline-browser-mapping` | moderate | 개발·빌드 | 2.10.24 → 2.11.30 |
| `brace-expansion` | high | 개발·빌드 | 5.0.5 → 5.0.12 |
| `browserslist` | high | 개발·빌드 | 4.28.2 → 4.29.4 |
| `nanoid` | high | 개발·빌드 | 3.3.11 → 3.3.20 |
| `postcss` | high | 개발·빌드 | 8.5.12 → 8.5.31 |
| `react-router` | high | 런타임 | 7.14.2 → 7.18.4 |
| `react-router-dom` | high | 런타임 | 7.14.2 → 7.18.4 |
| `source-map-js` | high | 개발·빌드 | 1.2.1 → 1.2.2 |
| `vite` | high | 개발·빌드 | 8.0.10 → 8.3.5 |

기존 선언 범위 안에서 `npm audit fix --ignore-scripts`를 적용했고 로그상 37개 패키지가 변경됐다. `--force`, 검사 제외 설정, 별도 강제 override는 추가하지 않았다. 이후 잠금 파일로 새로 설치하고 개발 의존성을 포함한 전체 감사와 런타임 감사 모두 0건임을 확인했다. 이는 감사 시점에 npm이 보고한 알려진 문제에 관한 결과이며 애플리케이션 전체의 무결함이나 모의해킹 통과를 뜻하지 않는다.

## 검사 숫자 밖에서 추가로 발견한 문제

1. **과거 관측 자료가 시작 시 로딩되지 않았다.** 로더에는 preload 함수가 있었지만 FastAPI 시작 경로에서 호출하지 않았다. parquet가 있어도 분석 API가 자료를 찾지 못했고 일부 화면이 대체 자료를 표시했다. lifespan에 로딩을 연결하고 `/api/status.analysis_data`에 준비 상태를 노출했다. 재로딩 전 캐시를 비워 삭제된 자료가 계속 남는 문제도 막았다. 선택 분석 자료가 없다고 검증 예측 API 전체를 중단시키지는 않는다.
2. **지속시간 분석의 500과 가공 수치가 가려졌다.** 대체 영상의 `duration`과 라우트가 기대한 `duration_h`가 달랐고, broad catch와 화면 예시가 이를 정상 분석처럼 보이게 했다. `/sustain`을 저장된 실제 이벤트의 지속시간·카테고리 중앙값·백분위 구간으로 정리했다. 임의 예측·모델 지표·가짜 기여도는 제거했다. 자료 없음·컬럼 없음·유효 시간 없음은 503, 화면은 오류와 재시도를 표시한다. 실제 API의 34,964개 이벤트를 브라우저와 Windows localhost에서 확인했다.
3. **느린 응답이 새 선택을 덮을 위험이 있었다.** 공통 요청 도우미에 시간 제한·본문 읽기 취소·정리 처리를 넣었다. EDA·대시보드·영상은 화면 이동/카테고리 변경/재시도 때 취소하고 늦은 응답을 무시한다. 영상 자동 갱신은 진행 중 요청과 겹치지 않으며 수동 갱신 실패 후에도 마지막 정상 캐시를 보존한다. 오래되거나 깨진 캐시는 검증 후 무시한다.
4. **내보내기의 필터와 값 처리가 달랐다.** 대시보드 필터 결과가 0건이면 CSV도 빈 결과를 내보낸다. 기존처럼 전체 행으로 되돌아가지 않는다. 외부 제목 등 수식처럼 보이는 문자열은 텍스트로 처리하고 따옴표를 이스케이프한다.
5. **메뉴와 상태 안내가 실제 화면 동작을 따라가지 못했다.** 모바일 메뉴의 경로 이동·뒤로/앞으로·Escape·크기 변경과 다크모드 보존을 확인했다. API 배너가 모든 페이지에 저장 결과가 있다고 일괄 주장하던 문구도 수정했다.
6. **복사 과정의 파일 실행 권한도 점검했다.** Windows에서 파일을 옮기며 생긴 실행 권한 변경을 원래 Git mode로 복구했다. 내용 변경이 없던 YouTube 라우트의 불필요한 변경 표시도 해소했다.

## 어떻게 재검증했는가

- 기존 14개에 18개 브라우저 사례를 추가했다. CountUp·모바일 메뉴·요청 지연/취소/시간 초과·CSV·영상 캐시·15개 공개 경로·관측 분석을 다룬다. 15개 경로 확인은 uncaught browser error와 정상 탐색 중 API 5xx가 없는지 보는 기본 검사이며, 모든 분석 수치의 의미를 감사한 것은 아니다.
- 실제 API 성공과 오류를 주입한 검사는 테스트 이름으로 구분한다. API 503·네트워크 실패·시간 초과·잘못된 응답을 정상 데이터로 대체하지 않는지 확인했다. 시간 초과는 가상 시계를 사용한 동작 검사다.
- 지속시간 관측·실패 응답·리터럴 검색·빈 결과·시작 로딩·재로딩을 위한 백엔드 8개 사례를 추가했다. 두 Python 환경에서 58개씩 통과했다.
- 배포용 `vite preview`로 7개 경로를 열고 실제 샘플 예측의 API 값 `0.4859521985054016`와 화면 `0.4860`이 일치함을 확인했다. 이 실행에서 browser error와 HTTP 400 이상 응답은 0건이었다. [예측 화면](quality_evidence/production-prediction.png), [관측 화면](quality_evidence/production-sustain.png). 캡처만을 위해 고정 높이 body를 펼쳐 전체 내용을 담았으며 데이터·너비는 바꾸지 않았다.
- 중간 브라우저 실행의 실패도 보관했다. 첫 확장은 29개 중 1개, 최종 확장 첫 실행은 32개 중 2개가 범용 선택자로 여러 요소를 찾아 실패했다. 실제 제품 결함인 sustain 500 수정과 테스트 선택자 수정을 구분한다. 최종 실행은 retries 0으로 32개 통과했다.
- `.github/workflows/frontend-quality.yml`에 잠금 파일 설치 → 전체 코드 검사 → audit → 빌드를 추가했다. 최소 읽기 권한과 고정된 Action commit을 사용한다. 시스템 YAML 파서와 실행 항목을 확인했고 같은 명령은 로컬에서 통과했다. **GitHub에서의 실행은 아직 하지 않았다.**

프론트엔드에서 재실행:

```bash
npm ci --ignore-scripts
npm run check
TRENDIT_TEST_RUN_ID=t0-v2-cpu-20261022-audit npm run test:e2e
```

새 환경은 README에 따라 Python 잠금 파일과 모델 산출물을 먼저 준비하고, 자신의 실험 ID를 사용한다. Chromium의 Linux 실행 라이브러리도 필요하다. 백엔드 검사는 저장소 루트에서 `.venv/bin/python -B -m pytest -q`로 실행한다.

## 남은 범위와 면접에서의 설명

HTTP 테스트 도구의 전환 예정 경고 1건은 남아 있으며 로그에 보존했다. npm 경고나 제품의 실행 실패는 아니다. 이 경고만 없애려고 Python 잠금 파일을 바꾸지 않았다.

기존 분석·캠페인의 모든 가정과 수치, 원본 수집·MySQL·실제 YouTube API 운영, Safari·실기기, 부하·접근성 전체·침투 테스트는 이번 통과 범위에 포함하지 않는다. 일부 과거 분석 화면의 역사적 대체 자료는 여전히 출처 안내와 함께 존재한다. 검증 T0 예측·평가와 지속시간 관측 화면은 임의 결과를 만들지 않는 경로로 확인했다.

모델 학습·입력 계약 8개 소스의 SHA-256이 기존 실험 보고서와 일치한다. Test AUC 0.8128 / F1 0.6653과 단일 시드·시간 분할의 한계는 그대로다. 코드 검사 정리와 패키지 갱신을 모델 성능 향상으로 표현하지 않는다.

면접 설명용 사실: “전체 코드 검사 오류 35개와 경고 1개를 원인별로 정리하고, 취약 패키지 경고 10건을 잠금 파일 갱신 후 0건으로 확인했다. 후속 동작 검사에서 발견한 시작 데이터 로딩 누락과 지속시간 화면의 예시 대체 문제를 수정했으며, 백엔드 58개·브라우저 32개 회귀 검사를 통과했다.” 실제 담당 범위와 도구 지원을 함께 설명하고 팀 전체 과거 구현을 개인 단독 기여로 서술하지 않는다.

전체 숫자·사례·패키지 버전·현재 소스 해시: [검증 JSON](quality_security_verification.json). 이전 단계의 [2026-10-22 UI 기록](UI_INTEGRATION_20261022.md)은 당시 상태로 보존한다.
