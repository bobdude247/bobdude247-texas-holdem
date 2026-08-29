import type { ReactNode } from 'react'

interface PlayingCardProps {
  readonly children?: ReactNode
  readonly faceDown?: boolean
  readonly label: string
}

export function PlayingCard({ children, faceDown = false, label }: PlayingCardProps) {
  return (
    <div aria-label={label} className={`playing-card${faceDown ? ' playing-card--back' : ''}`} role="img">
      {faceDown ? <span aria-hidden="true" className="card-pattern" /> : children}
    </div>
  )
}
