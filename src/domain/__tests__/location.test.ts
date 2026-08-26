import { describe, expect, it } from 'vitest'
import {
  findLocationByName,
  normalizeLocationName,
  sameLocationName,
} from '@/domain/location'

describe('normalizeLocationName', () => {
  it('tira espaço das pontas e junta o do meio', () => {
    expect(normalizeLocationName('  UPA   Centro ')).toBe('UPA Centro')
    expect(normalizeLocationName('Hospital  São   Lucas')).toBe('Hospital São Lucas')
  })
})

describe('sameLocationName', () => {
  it('ignora maiúsculas e espaço sobrando', () => {
    expect(sameLocationName('UPA Centro', 'upa centro')).toBe(true)
    expect(sameLocationName('UPA Centro', '  upa   centro ')).toBe(true)
  })

  it('não junta lugares que são mesmo diferentes', () => {
    expect(sameLocationName('UPA Centro', 'UPA do Centro')).toBe(false)
    expect(sameLocationName('UPA Centro', 'UPA-Centro')).toBe(false)
    expect(sameLocationName('UPA Centro', 'UPA Centro Sul')).toBe(false)
  })
})

describe('findLocationByName', () => {
  const locations = [
    { id: 'l1', name: 'UPA Centro' },
    { id: 'l2', name: 'Hospital São Lucas' },
  ]

  it('acha pelo nome com grafia frouxa', () => {
    expect(findLocationByName(locations, ' upa   CENTRO ')?.id).toBe('l1')
  })

  it('devolve indefinido para um nome novo', () => {
    expect(findLocationByName(locations, 'Clínica Vida')).toBeUndefined()
  })
})
