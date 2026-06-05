import { describe, it, expect } from 'vitest'
import { elementTextCss } from './elementStyleCss'

describe('elementTextCss', () => {
  it('returns no overrides for an undefined style', () => {
    expect(elementTextCss(undefined, 100)).toEqual({})
  })

  it('maps font family, weight, italic, underline and colour', () => {
    expect(
      elementTextCss(
        { fontFamily: 'Inter', fontWeight: 'semibold', italic: true, underline: true, color: '#0F172A' },
        100,
      ),
    ).toEqual({
      fontFamily: 'Inter',
      fontWeight: 600,
      fontStyle: 'italic',
      textDecoration: 'underline',
      color: '#0F172A',
    })
  })

  it('scales font size from points to pixels at the zoom', () => {
    expect(elementTextCss({ fontSize: 12 }, 100).fontSize).toBe('16px') // 12pt → 16px
    expect(elementTextCss({ fontSize: 12 }, 200).fontSize).toBe('32px')
  })

  it('maps alignment to both text-align and flex justification', () => {
    expect(elementTextCss({ align: 'center' }, 100)).toEqual({
      textAlign: 'center',
      justifyContent: 'center',
    })
    expect(elementTextCss({ align: 'right' }, 100)).toEqual({
      textAlign: 'right',
      justifyContent: 'flex-end',
    })
    expect(elementTextCss({ align: 'left' }, 100)).toEqual({
      textAlign: 'left',
      justifyContent: 'flex-start',
    })
  })

  it('omits properties that are not set', () => {
    expect(elementTextCss({ color: '#ffffff' }, 100)).toEqual({ color: '#ffffff' })
  })
})
