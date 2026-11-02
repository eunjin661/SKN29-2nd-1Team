import VerifiedEvaluation from '../components/VerifiedEvaluation'

export default function ModelInterpretPage({ onBack }) {
  return <VerifiedEvaluation onBack={onBack} explain />
}
