import { useState, useEffect, useRef } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'

export default function CountUp({ value, duration = 1200 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const reducedMotion = useReducedMotion()
  // Preserve dates, ranges and labels containing multiple numbers as text.
  const match = String(value).match(/^([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)([^\d]*)$/)
  const target = match ? Number(match[1].replaceAll(',', '')) : null
  const decimals = match?.[1].split('.')[1]?.length || 0
  const suffix = match?.[2] || ''
  const animate = target !== null && Number.isFinite(target) && target !== 0 && Number.isFinite(duration) && duration > 0 && !reducedMotion
  const key = `${value}:${duration}`
  const [frame, setFrame] = useState({ key: null, number: 0 })

  useEffect(() => {
    if (!animate || !inView) return
    let start
    let handle
    const step = time => {
      start ??= time
      const progress = Math.min((time - start) / duration, 1)
      setFrame({ key, number: target * progress })
      if (progress < 1) handle = requestAnimationFrame(step)
    }
    handle = requestAnimationFrame(step)
    return () => cancelAnimationFrame(handle)
  }, [animate, inView, duration, key, target])

  if (!animate) return <span ref={ref}>{value}</span>
  const number = frame.key === key ? frame.number : 0
  return <span ref={ref}>{number.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>
}
