# 2026-10-22 T0 v2 화면 연동 검증

승인된 다음 작업 계획 1~5를 구현했다. 추가 통계 실험(여러 시드·오차 범위)은 실행하지 않았다. 기준 실험은 `t0-v2-cpu-20261022-audit`이며 모델과 학습 결과는 이번 화면 연결에서 변경하지 않았다.

## 구현 결과

| 영역 | 변경 내용 | 주요 소스 |
|---|---|---|
| 예측 입력 | KST 최초 진입/발행 시각, 초기 순위·조회수·댓글·학습 카테고리 입력. 임의 시각·순위 보충 없음 | `frontend/src/pages/PredictionPage.jsx` |
| 예측 출력 | 빈 초기 상태, 입력만 채우는 샘플, 실제 API 응답의 점수·임계값·분류·모델/실험 ID·입력 사본 | 같은 파일, `frontend/src/lib/verifiedApi.js` |
| 요청 수명 | 12초 시간 제한, 중복 제출 방지, 입력 변경 시 취소, 요청 순번으로 늦은 응답 배제, 재시도 | 같은 파일 |
| 서버 계약 | bool·문자열·소수 건수 거부, 브라우저와 같은 안전한 정수 범위. 잘못된 관측은 422 | `backend/api/routes/t0_verified.py` |
| 평가 공급 | `GET /predict/t0-verified/evaluation`. 검증 보고서에서 모델별 Val/Test·선택 기준·표본·한계 공급. 잘못된 지표/표본은 503 | 같은 파일, `backend/tests/test_verified_api.py` |
| 성능 표시 | 모델/해석/첫 화면/분석 개요/대시보드가 같은 평가 API 사용. 과거 고정 점수 기본값 제거 | `VerifiedEvaluation.jsx`, `ModelPage.jsx`, `ModelInterpretPage.jsx`, `LandingPage.jsx`, `TrendingPage.jsx`, `DashboardPage.jsx` |
| 설명 범위 | SHAP·기여도·성공 확률 표현 제거. 실제 혼동행렬, 입력 정의와 한계 표시 | `frontend/src/constants/mlProjectData.js`, `VerifiedEvaluation.jsx` |
| 실시간 영상 | 현재 통계의 `/predict/bulk` 전달·규칙 AI 점수·가상 24h 상승 곡선 제거. 현재 관측 통계와 T0 초기 관측을 구분 | `frontend/src/pages/VideoPage.jsx` |
| 모바일 | 입력 단일 열, 결과 읽기, 넓은 표의 좌우 스크롤·키보드 포커스·안내 | `frontend/src/styles/PredictionPage.css` |

T0 v2가 출력하지 않는 예상 지속 시간·24h 조회수·가짜 신뢰구간은 새 예측 화면에 표시하지 않는다. 기존 분석 파트는 초기 기록이라는 안내를 붙였다. 지속성/캠페인 등 레거시 데모 전부를 새 모델로 이식한 작업은 아니다.

## 검증 결과와 범위

- Python 회귀 테스트 50개: 기존 `.venv`와 잠금 파일만으로 구성한 독립 환경에서 각각 통과.
- Chromium 브라우저 테스트 14개: 재시도 0회 설정으로 전체 통과. 실제 API를 사용하는 성공 흐름과 오류를 주입한 흐름을 아래와 같이 구분.
- 프론트엔드 빌드 통과. 새 검증 화면·평가 구성요소·API 도우미·시험 코드의 지정 정적 검사 통과.
- 전체 저장소의 정적 검사는 기존 오류 35개/경고 1개가 남아 통과하지 않는다. 기존 52개/3개에서 줄었지만 이번 작업의 완료 기준을 저장소 전체 정리로 확대하지 않았다.
- 원본 보고서에 기록된 ML 소스 해시와 현재 학습·추론 소스가 일치한다. 화면 작업을 위해 학습 결과나 Test 임계값을 다시 고르지 않았다.

| 구분 | 검증 시나리오 |
|---|---|
| 실제 API | 입력 전/샘플 후 결과 없음 → 제출 응답과 점수·판정·임계값·모델·실험 ID·입력 일치 → 새로고침 초기화 |
| 실제 화면 입력 | 빈값·발행/진입 순서 오류·순위 201·음수 조회수·소수 댓글·누락 날짜를 서버 호출 전에 차단 |
| 주입 오류 + 실제 재시도 | POST 503, 네트워크 실패, 12초 시간 초과 뒤 임의 결과 없음·실제 API 재시도 성공 |
| 지연 주입 + 실제 API | 중복 제출 1회 전송, 요청 중 입력 변경 시 취소, 늦은 응답 배제, 새 입력의 실제 응답 일치 |
| 주입 응답 | 잘못된 응답 구조, 422 필드 오류 표시 |
| 실제 API | 모델/해석 화면의 지표와 표본 수가 평가 응답과 일치, 8개 모델 행 표시 |
| 주입 오류 | 보고서 503에서 성능 기본값 없음·재시도 성공, 모델 상태 503에서 카테고리 기본값/제출 없음 |
| 실제 API + 모바일 | 390×844에서 제출·결과·새로고침·가로 넘침 검사. 넓은 표를 스크롤해 임계값 열까지 읽기 |
| 모의 영상 피드 | 응답에 과거 AI 점수가 들어 있어도 미표시, 추론 POST 0건. 외부 YouTube API의 최신성 검증은 아님 |
| 실제 API/주입 오류 | 첫 화면·분석 개요·대시보드의 같은 실행/지표 표시와 실패 시 기본 점수 미표시 |

시간 초과는 실제로 12초를 기다리는 부하·지연 측정이 아니라 브라우저 가상 시계로 제한 동작을 확인했다. 모바일 검증은 Chromium의 390px 화면이며 iOS Safari의 기기 검증을 뜻하지 않는다.

## 실제 응답 예시

`backend/examples/t0_request.json`의 초기 순위 30·조회수 100,000·댓글 250·Entertainment 관측을 전송했다.

- 실제 점수: `0.4859521985054016`, 화면: `0.4860`.
- 판정: `1`(고지속 후보), 판정 임계값: `0.44`.
- 모델: `embedding_mlp`, 대상: `tdi_v2`.
- 실행 ID: `t0-v2-cpu-20261022-audit`.

[실제 요청/응답](ui_evidence/real-api-response.json) · [평가 응답](ui_evidence/real-evaluation.json)

## 원시 증거

- [검증 요약 JSON](ui_integration_verification.json): 수치 비교 계산, 검사 범위, 소스/증거 해시.
- [백엔드 검사 로그](ui_evidence/backend-tests-final.log), [독립 환경 로그](ui_evidence/fresh-environment-tests.log), [브라우저 로그](ui_evidence/browser-final.log), [브라우저 기계 판독 결과](ui_evidence/browser-results.json), [최종 검사 종료 코드](ui_evidence/final-checks.json).
- [수정 전 소스 식별](ui_evidence/baseline-source-manifest.json), [구현 후 소스 식별](ui_evidence/final-source-manifest.json), [기존 검사 로그](ui_evidence/baseline-lint.log), [현재 전체 검사](ui_evidence/lint-final.json).
- [데스크톱 예측](ui_evidence/prediction-desktop.png), [모바일 예측](ui_evidence/prediction-mobile.png), [데스크톱 평가](ui_evidence/evaluation-desktop.png), [모바일 평가](ui_evidence/evaluation-mobile.png).

전체 화면 캡처를 위해 기존 고정 높이 body의 캡처 경계만 임시로 확장했다. 제품의 입력·결과·색상·폭을 변경하지 않았다. 동작 검증은 기본 1280×720와 모바일 390×844 화면에서 수행했다.

## 발생했던 검사 환경 문제

1. Chromium 최초 실행 시 `libnspr4.so` 누락으로 12건이 브라우저 시작 전에 실패. Playwright의 Linux 의존성 설치 후 실행 가능. 서비스 동작 실패와 구분해 보관.
2. 두 번째 실행 13/14: 개발 StrictMode의 재요청이 1회짜리 503 주입을 소진. 해제 전까지 오류 주입을 유지하도록 시험 조건 보완 후 전체 통과. 정상 API를 실패로 위장한 성공 수치는 아님.
3. 전체 페이지 캡처가 기존 body 스크롤 구조 때문에 뷰포트 높이로 잘려 캡처 범위를 조정. 모바일 표는 실제 가로 스크롤도 추가 검사.

## 재현 방법

먼저 README에 따라 Python 환경을 설치하고 8개 모델을 재현해 완료된 실험을 만든다. 현재 로컬 실험 산출물은 Git에서 제외되어 있어 코드만 복제한 상태에서는 503이 정상이다.

```bash
# 저장소 루트: Python 회귀 검사
.venv/bin/python -B -m pytest -q

# frontend에서 실행. 확인한 Node 버전은 24.20.0.
npm ci
npx playwright install --with-deps chromium
TRENDIT_TEST_RUN_ID=t0-v2-reproduce npm run test:e2e
npm run build
```

테스트 설정은 별도 로컬 포트 18000/API와 15173/Vite를 시작하고 종료한다. DB/YouTube 설정은 테스트용 오프라인 값으로 고정하며 예측·평가 성공에는 외부 API나 GPU가 필요하지 않다. 일반 화면은 `VITE_API_URL`로 API 주소를 지정한다.

사용한 Playwright 기능의 공식 문서: [테스트 서버 실행](https://playwright.dev/docs/test-webserver), [시계 제어](https://playwright.dev/docs/clock).

## 후속 작업

현재 UI/API 연결을 기반으로 의존성 패치와 레거시 정적 검사 정리, 영상 단위 부트스트랩 오차 범위, 사전 고정한 여러 시드 평가를 진행할 수 있다. Test 성능을 보고 지금 선택한 모델을 교체하지 않는다. [취업용 근거 원장](../CAREER_EVIDENCE.md)에 완료한 사실과 미실행 과제를 구분해 두었다.
