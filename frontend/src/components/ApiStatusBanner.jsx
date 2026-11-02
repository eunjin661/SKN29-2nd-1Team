export default function ApiStatusBanner() {
  return (
    <div
      role="alert"
      style={{
        background: 'rgba(255, 140, 0, 0.1)',
        borderBottom: '1px solid rgba(255, 140, 0, 0.3)',
        color: '#FF8C00',
        fontSize: 13,
        fontWeight: 500,
        padding: '8px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      API 연결 상태를 확인할 수 없습니다. 각 화면의 오류 안내와 데이터 출처를 확인하세요.
    </div>
  )
}
