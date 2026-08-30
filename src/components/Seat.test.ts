import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { chips } from '../domain/game/types'
import type { PublicHandPlayer } from '../domain/holdem/public'
import { Seat } from './Seat'

const cpu = { id: 'rock', name: 'The Rock', kind: 'cpu', seat: 0, bankroll: chips(1_000_000), isEliminated: false, stack: chips(1_000_000), streetContribution: chips(0), totalContribution: chips(0), folded: false, allIn: false } as PublicHandPlayer
const cards = [{ rank: 'T', suit: 'hearts' }, { rank: 'A', suit: 'spades' }] as const

describe('seat card presentation', () => {
  it('uses the revealed CPU presentation only for supplied public showdown cards', () => {
    const revealed = renderToStaticMarkup(createElement(Seat, { player: cpu, visibleCards: cards }))
    const concealed = renderToStaticMarkup(createElement(Seat, { player: cpu }))

    expect(revealed).toContain('seat--revealed')
    expect(revealed).toContain('10♥')
    expect(revealed).toContain('A♠')
    expect(concealed).not.toContain('seat--revealed')
    expect(concealed).toContain('playing-card--back')

    const folded = renderToStaticMarkup(createElement(Seat, { player: { ...cpu, folded: true }, visibleCards: cards }))
    expect(folded).not.toContain('seat--revealed')
    expect(folded).toContain('playing-card--back')
  })
})
