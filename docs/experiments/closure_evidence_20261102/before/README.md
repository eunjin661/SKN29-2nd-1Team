# TrendIt

YouTube KR 트렌딩에 진입한 시점의 정보로, 카테고리 기준의 지속형 이벤트를 분류하는 교육용 프로젝트입니다.

**2026-10-22 개선:** 공개 학습 경로의 미래 정보 누수를 제거하고, 같은 영상이 평가에 재등장하는 문제와 전체 기간 라벨 통계를 정리했습니다. 개인 MLP 실험 원본을 공통 평가 코드로 재구성했습니다.

| 현재 재현 결과 | 값 |
|---|---|
| 선택 모델 | embedding_mlp — Validation ROC-AUC 기준 |
| 별도 Test | 4,986개 이벤트 / 2,311개 고유 영상 |
| Test ROC-AUC / PR-AUC | 0.8128 / 0.6297 |
| Test F1 | 0.6653 — Validation 선택 임계값 0.44 |
| 실행 환경 | Python 3.10.21 · Linux/WSL · CPU · Seed 42 |

[전체 비교 결과](docs/experiments/T0_V2_RESULTS.md) · [기계 판독 보고서](docs/experiments/t0_v2_report.json) · [화면 연결 검증](docs/experiments/UI_INTEGRATION_20261022.md) · [면접용 근거 원장](docs/CAREER_EVIDENCE.md)

**2026-10-23 품질 점검:** 전체 코드 검사 35 errors/1 warning → 0/0, npm audit 패키지 경고 10 → 0. 시작 시 분석 자료 로딩 누락과 지속성 화면의 예시 대체를 수정했습니다. [원인·변경·검증 기록](docs/experiments/QUALITY_SECURITY_20261023.md).

**2026-10-23 후속 개선:** 관측 34,964건과 TDI v2 유효 표본 34,160건을 구분해 실제 집계에 연결했습니다. 캠페인은 사용자 조건 계산기로 정리했고, 기존 모델을 보존하며 5시드·영상 단위 재표집 진단을 추가했습니다. [결과·적용 범위](docs/experiments/FOLLOWUP_RESULTS_20261023.md) · [단계별 기록](docs/experiments/FOLLOWUP_WORK_LOG_20261023.md).

**2026-11-02 공개 점검:** 개인 저장소 main 직접 반영 절차를 선택했습니다. 공개 전 최신 감사에서 발견한 개발 도구 경고 7건을 해결했고, 새 설치·동일한 검사 파일 113개·브라우저 49개를 재확인했습니다. [반영 상태·수정 근거](docs/experiments/MAIN_PUBLICATION_20261102.md).

## 문제와 접근

트렌딩에 진입한 영상도 유지 기간과 순위가 다릅니다. 진입 순간의 순위·조회수·댓글·발행 시각으로 지속형 후보를 분류합니다. 현재 평가는 이후 기간의 새로운 영상에 대한 일반화를 대상으로 합니다. 콘텐츠 변경이나 광고 집행의 인과적 효과를 검증하지는 않았습니다.

`tdi_v2 = clip(duration / train_category_q95, 0, 1) * clip(1 - (best_rank - 1) / 200, 0, 1)`

TDI 0.4 이상을 양성으로 정의합니다. 지속 시간과 최고 순위는 **정답을 만드는 값**이며 입력에 포함하지 않습니다.

## 누수를 막는 평가 기준

- 입력은 초기 순위·조회수·댓글·발행 시각·카테고리에서 재계산한 9개 수치 피처와 카테고리 하나로 제한합니다.
- 최종 지속 시간, 다른 정답 라벨, 24h 증가량, 기존 파생 컬럼과 포화도는 입력에서 제외합니다.
- T0 순서 약 70% / 85% 시각으로 분할합니다. 같은 시각의 관측은 양쪽에 나누지 않습니다.
- 같은 `video_id`는 분할 사이에 겹치지 않으며, 경계 시점까지 종료를 확인할 수 없는 이벤트는 제외합니다.
- TDI 기준 통계, 결측 처리, 스케일링, 카테고리 사전은 Train에서만 학습합니다.
- 모델 선택과 F1 임계값은 Validation에서 확정하고 Test에 고정합니다.

## 개인 기여와 팀 역할

| 팀원 | 기존 프로젝트 담당 |
|---|---|
| 김은진 | 공동 데이터 전처리 · 개인 MLP/TabNet 딥러닝 실험 |
| 이동윤 | DB 구축 · 머신러닝 |
| 성주연 | 데이터 구축 · 머신러닝 |
| 한경찬 | 데이터 전처리 · 클러스터링 |
| 양정현 | 프론트엔드 · 백엔드 |

개인 실험의 재현 진입점은 [`backend/ml/train_weighted_ensemble.py`](backend/ml/train_weighted_ensemble.py), 원본 MLP 구조는 [`torch_models.py`](backend/ml/torch_models.py)에 있습니다. 이번 보완에서는 공유 학습 경로·검증·명시적 v2 추론 API를 추가했습니다. 원본 파일의 식별 정보는 [출처 기록](docs/experiments/ORIGINAL_EXPERIMENT_PROVENANCE.json)에 남겼습니다.

## WSL에서 재현

Ubuntu 24.04, Python 3.10, uv를 기준으로 합니다. 저장소 루트에서 실행합니다.

```bash
# LightGBM의 Linux 실행 라이브러리
sudo apt-get update
sudo apt-get install -y libgomp1

uv venv --python 3.10.21 .venv
uv pip sync --python .venv/bin/python backend/requirements-cpu.lock --index-strategy unsafe-best-match

# 회귀 테스트
.venv/bin/python -B -m pytest -q

# 같은 계약으로 기본 모델 + 개인 MLP + TabNet 비교
PYTHONPATH=backend .venv/bin/python -B -m ml.train_weighted_ensemble \
  --include-deep --include-tabnet --run-id t0-v2-reproduce
```

의존성 잠금 파일은 PyPI와 공식 PyTorch CPU 인덱스의 고정 버전을 사용합니다. `--index-strategy`는 두 인덱스에서 잠긴 버전을 찾기 위한 uv 옵션입니다. GPU와 외부 API 키는 필요하지 않습니다. 이미 존재하는 실험 ID는 덮어쓰지 않으며 다른 ID를 사용합니다.

필요 데이터는 `backend/data/video_trending_events_analysis.parquet`입니다. 기준 SHA-256은 `cb9a13ea1c4d60ffe72046c6c23f9aed3ca846a2409ef5038b2a872eda8d164e`입니다. 파일이 없거나 다르면 [보고서](docs/experiments/t0_v2_report.json)의 기준 데이터와 대조해야 합니다.

## 저장 모델로 다시 예측

```bash
PYTHONPATH=backend .venv/bin/python -B -m ml.inference \
  --run-dir backend/artifacts/t0-v2-reproduce \
  --input backend/examples/t0_request.json
```

입력의 `T0_view`와 `T0_comment`는 차트 진입 당시 관측값입니다. 현재 영상의 통계를 과거 T0 값으로 사용하면 이 평가 범위를 벗어납니다. 시간은 KST 또는 명시적 타임존으로 전달합니다. 출력 확률은 경험적으로 교정된 신뢰도 수치가 아닙니다.

## API 실행

```bash
cp backend/.env.example backend/.env
TRENDIT_T0_RUN_ID=t0-v2-reproduce PYTHONPATH=backend \
  .venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

- Swagger: `http://127.0.0.1:8000/docs`
- 새 모델 상태: `GET /predict/t0-verified/status`
- 검증 보고서 기반 성능·표본·선택 기준: `GET /predict/t0-verified/evaluation`
- 초기 관측 분류: `POST /predict/t0-verified` — `backend/examples/t0_request.json` 형식
- 실험을 아직 생성하지 않았으면 새 API는 503을 반환합니다. 산출물 SHA-256이 다르면 모델 로딩을 거부합니다.
- 관측 분석·대시보드·캠페인 참고 자료는 저장된 parquet를 사용합니다. 현재 영상 수집에는 별도 YouTube API 설정이 필요하며 일부 레거시 API는 MySQL을 사용할 수 있습니다. 기존 `/predict/preview`의 휴리스틱 혼합 결과는 위 v2 평가 수치와 연결하지 않습니다.

React 화면은 `frontend`에서 `npm ci --ignore-scripts`, `npm run dev`로 실행합니다. API 주소는 `VITE_API_URL`로 지정하며 기본값은 `http://localhost:8000`입니다. 확인한 Node 버전은 24.20.0이며 의존성은 `frontend/package-lock.json`으로 관리합니다.

- `/analysis/predict`: KST 최초 진입/발행 시각과 진입 당시 순위·조회수·댓글·학습 카테고리 입력 → 실제 T0 v2 분류. 샘플은 입력만 채우고 결과는 요청 성공 후 표시합니다.
- `/analysis/model`, `/analysis/explain`: 같은 검증 보고서의 지표·입력 정의·혼동행렬·한계 표시. 첫 화면·분석 개요·대시보드도 같은 평가 API를 사용합니다.
- `/sustain`: 저장된 실제 이벤트의 과거 지속 시간·분포를 집계합니다. 자료가 없으면 503과 재시도를 표시하며 예측 시간·가공 모델 지표를 만들지 않습니다.
- `/analysis/eda`, `/analysis/feature`, `/analysis/insight`, `/analysis/problem`, `/analysis/compare`, `/analysis/strategy`: 실제 관측 집계·현재 입력/정답 계약·적용 범위를 표시합니다. 중요도·클러스터 유의성·광고 효과를 예시로 채우지 않습니다.
- `/campaign`: 예산·CPM·CTR·클릭 대비 CVR·카테고리 배분을 직접 입력하는 계산기입니다. 샘플은 입력만 채우며 ROI나 실제 전환율을 예측하지 않습니다.
- `/dashboard`: 기간·카테고리의 실제 교집합을 집계합니다.
- `/video`: 현재 관측 통계만 표시합니다. 현재 통계와 화면 순서를 과거 최초 관측으로 바꾸어 추론하지 않습니다.
- 서버 실패·시간 초과·잘못된 응답에서 예측이나 성능을 임의 기본값으로 대체하지 않습니다. 입력 변경은 진행 중인 요청을 취소합니다.

브라우저 동작 검사에는 재현된 모델 산출물이 필요합니다. `frontend`에서 아래처럼 실행하며, 테스트가 별도 포트의 로컬 API와 화면을 시작하고 종료합니다.

```bash
npx playwright install --with-deps chromium
TRENDIT_TEST_RUN_ID=t0-v2-reproduce npm run test:e2e -- --grep-invert 'REAL diagnostic'
npm run check  # 전체 코드 검사 + audit + 빌드
```

백엔드는 기존·별도 설치 환경에서 **107개씩**, Chromium 전체 브라우저는 **49개**, 별도 설치 기본 모드는 **47개** 검사를 통과했습니다. 전체 ESLint 오류/경고 0, 전체·런타임 npm audit 0, 빌드 통과를 확인했습니다. 같은 WSL 호스트의 별도 checkout·새 venv/node_modules에서 8개 모델을 재학습했고 39,888 Test 점수의 최대 절대차는 0.0입니다. HTTP 테스트 도구의 전환 예정 경고 1개는 남아 있습니다.

## 추가 모델 진단 재현

기준 선택 모델이 Embedding MLP·시드 42인 실험을 대상으로 합니다. 기존 실험을 보존하고 4개 시드 신규 학습·기존 42 재사용, paired video_id bootstrap 2,000회를 수행합니다.

```bash
PYTHONPATH=backend .venv/bin/python -B -m ml.diagnostics \
  --run-dir backend/artifacts/t0-v2-reproduce \
  --run-id t0-v2-reproduce-diagnostics

# 두 ID가 같은 기준 실험을 가리켜야 추가 진단 API를 사용할 수 있습니다.
TRENDIT_T0_RUN_ID=t0-v2-reproduce \
TRENDIT_T0_DIAGNOSTICS_ID=t0-v2-reproduce-diagnostics PYTHONPATH=backend \
  .venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

`GET /predict/t0-verified/diagnostics`는 실험 ID·자료·파일 해시·표본·숫자를 검증합니다. 진단이 없으면 503과 사용 불가를 표시하고 기준 평가 기능은 계속 사용할 수 있습니다. 중단한 진단은 같은 소스·규칙에 한해 `--resume`으로 재개할 수 있습니다. 현재 진단은 5시드 AUC 평균 0.8130/표본 표준편차 0.0013, 기준 42 AUC 재표집 구간 0.8007~0.8237입니다. 새로운 외부 기간 평가나 5시드 평균의 신뢰구간이 아닙니다.

프론트엔드의 전체 모드는 두 실험을 준비한 뒤 다음처럼 실행합니다.

```bash
TRENDIT_TEST_RUN_ID=t0-v2-reproduce \
TRENDIT_TEST_DIAGNOSTICS_ID=t0-v2-reproduce-diagnostics npm run test:e2e
```

진단을 생성하지 않는 기본 검사 모드는 `TRENDIT_TEST_RUN_ID=t0-v2-reproduce npm run test:e2e -- --grep-invert 'REAL diagnostic'`입니다. 전체 진단을 실제로 읽는 2개 사례를 제외하고 미설정 상태 처리까지 확인합니다.

GitHub Actions는 프론트 품질 관문과 백엔드·CPU 재현·핵심 브라우저 관문을 수행합니다. 현재 상태: 프론트 품질·백엔드/CPU 재현/핵심 브라우저 원격 검사 모두 통과. 서비스 배포는 별도 범위입니다. [실제 반영·실행 기록](docs/experiments/MAIN_PUBLICATION_20261102.md)을 확인하세요. 5시드 전체 진단은 매 push마다 실행하지 않습니다. [최신 결과와 제한](docs/experiments/FOLLOWUP_RESULTS_20261023.md), [면접 근거](docs/CAREER_EVIDENCE.md), [공개 검토 목록](docs/experiments/PUBLICATION_REVIEW_20261023.md)을 참고하세요.

## 기존 결과와 남은 한계

기존 WeightedSoftVoting 메타데이터는 최종 지속 시간과 파생 라벨이 입력에 들어가 **T0 성능 근거에서 폐기**했습니다. 바이너리는 보존하고 자동 로딩을 차단했습니다. [과거 메타데이터](docs/experiments/legacy_weighted_soft_voting_metadata.json)는 역사 자료입니다.

과거 발표·보고서의 AUC 0.8284와 개인 실험의 AUC 0.7985는 다른 조건의 결과입니다. v2는 라벨과 평가 표본이 달라 우열을 직접 비교하지 않습니다. 발표 자료는 [기존 PDF](docs/assets/trendit-presentation.pdf)에 보존합니다.

기준 모델은 시드 42·한 시간 분할로 선택했습니다. 후속으로 같은 분할의 5시드 변동과 기준 모델의 영상 단위 재표집 구간을 추가했습니다. 다른 기간의 일반화와 개별 점수의 확률 교정은 검증하지 않았습니다. 반복 영상의 미래 이벤트, 원본 수집·정제 전체, 지속 시간 회귀, 24h 업데이트, 기존 데모 UX의 실서비스 효과는 별도 검증이 필요합니다.
