import '../styles/feedback.css'

function getProbabilityTone(value) {
  const n = Number(value || 0)
  if (n >= 75) return 'high'
  if (n >= 45) return 'medium'
  return 'low'
}

export default function ResultBadge({ value, label = '예측 확률' }) {
  const tone = getProbabilityTone(value)
  return (
    <span className={`result-badge result-badge--${tone}`}>
      <b>{Number(value || 0).toFixed(1)}%</b>
      <small>{label}</small>
    </span>
  )
}
