import { useState } from 'react'
import CountUp from '../../src/components/CountUp'

export default function Fixture() {
  const [value, setValue] = useState('0.8128')
  const [duration, setDuration] = useState(500)
  return <main style={{ padding: 90 }}>
    <label>표시 값<input aria-label="표시 값" value={value} onChange={event => setValue(event.target.value)} /></label>
    <label>애니메이션 시간<input aria-label="애니메이션 시간" type="number" value={duration} onChange={event => setDuration(Number(event.target.value))} /></label>
    <div data-testid="count-value"><CountUp value={value} duration={duration} /></div>
  </main>
}
