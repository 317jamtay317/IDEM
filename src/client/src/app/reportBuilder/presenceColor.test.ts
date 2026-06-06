import { describe, it, expect } from 'vitest'
import { initialsFor } from './presenceColor'

describe('initialsFor', () => {
  it('takes the first letter of the first two words, uppercased', () => {
    expect(initialsFor('Ada Lovelace')).toBe('AL')
    expect(initialsFor('Site Administrator')).toBe('SA')
  })

  it('uses a single initial for a one-word name', () => {
    expect(initialsFor('grace')).toBe('G')
  })

  it('ignores extra whitespace between and around words', () => {
    expect(initialsFor('  Ada   Lovelace  ')).toBe('AL')
  })

  it('falls back to a placeholder for a blank name', () => {
    expect(initialsFor('')).toBe('?')
    expect(initialsFor('   ')).toBe('?')
  })
})
