// pages/EDAsections.jsx — EDA 탭 섹션 데이터 팩토리
import { CatDurationChart, YearTrendChart, TDIChart, IQRChart, WeekdayChart, ScatterChart, RankChart, ClusterShareChart } from './EDACharts'

export function makeEDASections(data) {
  return [
    {
      id:'catdur', tag:'RQ1', shortTitle:'카테고리 지속', title:'카테고리별 지속 시간',
      Chart: () => <CatDurationChart data={data}/>,
      findings:[
        'Education · Lifestyle 중앙값 192h — Entertainment(96h)의 2배.',
        'Kruskal-Wallis H=991.13 (p<0.001) — 카테고리 간 유의미한 차이 확인.',
        'Education ↔ Lifestyle 쌍만 Tukey HSD n.s. (p=0.41) — 나머지 9/10쌍 유의.',
      ],
      note:'η²=0.041 (중간 효과) · 전체 34,964 이벤트 기준',
    },
    {
      id:'yeartrend', tag:'추세', shortTitle:'연도별 추세', title:'연도별 카테고리 점유율 변화',
      Chart: () => <YearTrendChart data={data}/>,
      findings:[
        'Entertainment 2022~2025 꾸준히 50%대 유지 (58.0%→52.6%).',
        'Lifestyle 완만한 성장 (21.2%→30.6%) — 생활밀착형 콘텐츠 확대.',
        'Music 점진적 감소 (15.1%→14.8%). News 2024 급감 (4.4%→1.5%).',
      ],
      note:'2025년은 상반기(~06) 기준',
    },
    {
      id:'tdi', tag:'TDI', shortTitle:'TDI 분포', title:'TDI 분포 및 임계값 설정',
      Chart: () => <TDIChart data={data}/>,
      findings:[
        'TDI = (trending_duration / cat_q95) × rank_score · 0~1 범위.',
        `TDI < 0.1 구간이 10,917개(31.2%)로 가장 많음 — 단명 이벤트 집중.`,
        `threshold 0.4 기준 고지속 ${data.tdiPosPct}% / 단명 ${(100-data.tdiPosPct).toFixed(1)}% — tdi_label로 사용.`,
      ],
      note:'TDI는 사후 분석 지표 — 예측 피처 사용 금지',
    },
    {
      id:'iqr', tag:'수명', shortTitle:'수명 IQR', title:'카테고리별 수명 분포 (IQR)',
      Chart: () => <IQRChart data={data}/>,
      findings:[
        'Lifestyle IQR 42h~300h (중앙값 192h) — 가장 넓은 분포.',
        'News IQR 18h~180h (중앙값 66h) — 짧고 집중적인 이슈 소비형 패턴.',
        'Education Q1=30h지만 중앙값 192h — 양극화된 수명 분포 특징.',
      ],
      note:'상위 1% 이상치 제거 후 (event_split 6h 기준)',
    },
    {
      id:'weekday', tag:'업로드', shortTitle:'요일별 업로드', title:'업로드 요일별 이벤트 수',
      Chart: () => <WeekdayChart data={data}/>,
      findings:[
        `금요일이 ${data.weekday[4].toLocaleString()}건으로 가장 많고 토요일이 ${data.weekday[5].toLocaleString()}건으로 가장 적음.`,
        '평일 평균 5,183건 > 주말 평균 4,524건 — 평일 업로드가 트렌딩 유리.',
        'published_weekday는 T0/24h 모델 모두 입력 피처로 사용.',
      ],
      note:'published_weekday (0=월 ~ 6=일) 기준',
    },
    {
      id:'scatter', tag:'피처', shortTitle:'조회수 vs 지속', title:'view_growth_24h vs 트렌딩 지속 시간',
      Chart: () => <ScatterChart/>,
      findings:[
        '초기 24h 조회수 증가 ↑ → 지속 시간 ↑ 약한 양의 상관 관계.',
        `has_24h_observation True: ${data.has24h['obs'].toLocaleString()}개 (78.0%) / False: ${data.has24h['not_obs'].toLocaleString()}개 (22.0%).`,
        'view_growth_24h_log는 24h 모델 전용 피처 — T0 모델에서는 누수 방지로 제외.',
      ],
      note:'Winsorized (q01~q99) 범위 기준 시각화',
    },
    {
      id:'rank', tag:'순위', shortTitle:'진입 순위', title:'트렌딩 진입 순위 분포',
      Chart: () => <RankChart data={data}/>,
      findings:[
        '1~20위 진입이 12,480건(35.7%)으로 압도적 다수 — 상위 진입 편중.',
        `중앙값 ${data.rankQ.med}위, 평균 ${data.rankQ.mean}위 — 분포 우측 꼬리 존재 (고순위 장기 잔류형).`,
        'entry_rank_log = log1p(entry_rank) 로 변환해 모델 입력.',
      ],
      note:'entry_rank 1~200 범위 · T0 예측 피처',
    },

    {
      id:'cluster', tag:'군집', shortTitle:'클러스터링', title:'K-Means K=4 기반 트렌딩 패턴 클러스터링',
      Chart: () => <ClusterShareChart data={data}/>,
      findings:[
        'K-Means K=4로 트렌딩 이벤트를 C0~C3 패턴으로 분류하고, 카테고리별 클러스터 비율을 비교.',
        `카테고리 × 클러스터 카이제곱 검정 결과 p<0.001, Cramer's V=${data.clusterStats?.cramersV ?? 0.147} — 약한~중간 수준의 연관성 확인.`,
        'Music은 C0 비중이 상대적으로 높고, News는 C3 비중이 높아 카테고리별 트렌딩 지속 패턴 차이가 드러남.',
      ],
      note:'화면에는 누적 막대로 직관화 · PCA 산점도는 발표/부록용 시각화로 활용 권장',
    },
  ]
}
