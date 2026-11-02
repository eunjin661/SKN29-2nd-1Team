// Descriptions only. Current scores, samples, thresholds and model versions come from the evaluation API.
export const T0_INPUT_DESCRIPTIONS = [
  ['entry_rank_log', '최초 차트 진입 순위의 log1p'],
  ['T0_view_log', '진입 당시 조회수의 log1p'],
  ['T0_engagement_ratio_log', '진입 당시 댓글 / 최대(조회수, 1)의 log1p'],
  ['latency_to_trend_log', '발행부터 최초 진입까지 걸린 시간의 log1p'],
  ['pretrend_view_velocity_log', '진입 조회수 / 최대(진입 지연 시간, 1)의 log1p'],
  ['weekday_sin / weekday_cos', '발행 요일의 주기 인코딩'],
  ['hour_sin / hour_cos', '발행 시각의 주기 인코딩'],
  ['category_group', '학습에 포함된 카테고리 그룹'],
]

export const EVALUATION_LIMITS_KO = [
  '기준 실험은 시드 42·한 시간 분할입니다. 여러 시드의 변동과 영상 단위 오차 범위는 별도 추가 진단에서 확인합니다. 새로운 외부 기간 검증은 남아 있습니다.',
  '앞선 분할에 등장한 영상의 이후 이벤트를 제외했습니다. 기존 영상의 재진입 성능을 뜻하지 않습니다.',
  '저장된 정제 이벤트부터 재현한 실험입니다. 원본 YouTube 수집 전체를 재구축한 결과는 아닙니다.',
  '정답 정의와 평가 분할이 달라 과거 프로젝트 점수와 직접 비교할 수 없습니다.',
  '과거 관측 기반 분류 검증입니다. 실시간 영상 성능, 지속 시간, 24시간 조회수와 매출 효과를 검증하지 않았습니다.',
]
