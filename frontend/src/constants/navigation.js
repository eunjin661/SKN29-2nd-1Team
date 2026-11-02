export const NAV_ITEMS = [
  { id: 'home', label: '홈', path: '/', shortLabel: '홈' },
  { id: 'analysis', label: '트렌딩 분석', path: '/analysis', shortLabel: '분석' },
  { id: 'video', label: '영상 분석', path: '/video', shortLabel: '영상' },
  { id: 'sustain', label: '지속성 분석', path: '/sustain', shortLabel: '지속성' },
  { id: 'campaign', label: '캠페인 플래너', path: '/campaign', shortLabel: '캠페인' },
  { id: 'dashboard', label: '대시보드', path: '/dashboard', shortLabel: '대시보드' },
]

export const ANALYSIS_MENU_ITEMS = [
  { id: 'analysis-overview', label: '분석 전체', path: '/analysis', desc: '9개 분석 파트 목록' },
  { id: 'eda', label: 'EDA', path: '/analysis/eda', desc: '자료 출처·분포·표본 수' },
  { id: 'feature', label: 'Feature Engineering', path: '/analysis/feature', desc: '파생 변수와 전처리' },
  { id: 'insight', label: '데이터 해석', path: '/analysis/insight', desc: '관측 분포와 지속 시간 비교' },
  { id: 'problem', label: '문제 정의', path: '/analysis/problem', desc: 'TDI v2 분류·시간 분할·표본' },
  { id: 'model', label: '모델 결과', path: '/analysis/model', desc: '성능 지표와 결과 비교' },
  { id: 'predict', label: '예측 시스템', path: '/analysis/predict', desc: '최초 관측값으로 T0 분류' },
  { id: 'strategy', label: '인사이트 & 전략', path: '/analysis/strategy', desc: '관측 비교와 활용 범위' },
]

export const QUICK_MENU_GROUPS = [
  {
    id: 'main-pages',
    title: '주요 페이지',
    items: NAV_ITEMS,
  },
  {
    id: 'analysis-parts',
    title: '분석 세부 메뉴',
    items: ANALYSIS_MENU_ITEMS,
  },
]

export const isActiveRoute = (pathname, item) => {
  if (item.path === '/') return pathname === '/'
  if (item.id === 'analysis') return pathname === '/analysis' || pathname.startsWith('/analysis/')
  return pathname === item.path || pathname.startsWith(`${item.path}/`)
}
