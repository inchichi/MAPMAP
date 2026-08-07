import { describe, expect, it } from 'vitest'

import { IMMUTABLE_FIELDS, normalizeStyleSpec, STYLE_SPEC_SCHEMA } from './styleSpec'

const validRaw = {
  style_id: 'ashen_ruins_v1',
  concept: '화산재에 덮인 폐허가 된 왕국',
  palette: { n_colors: 8, anchors: ['#2b2320', '#7a6a5d', '#c94f2e', '#e8dcc8'] },
  material: ['재', '그을린 석재'],
  lighting: { key: '낮은 각도 적황색', ambient: '차가운 회청색' },
  motif: ['균열'],
  per_category_prompt: { terrain_tile: 'ash-covered stone ground, cracked' },
  style_strength: 0.55,
  negative_prompt: 'photo, realistic'
}

describe('normalizeStyleSpec', () => {
  it('유효한 스펙을 정규화한다', () => {
    const { spec, issues } = normalizeStyleSpec(validRaw)
    expect(issues).toHaveLength(0)
    expect(spec?.style_id).toBe('ashen_ruins_v1')
    expect(spec?.palette.anchors).toEqual(['#2b2320', '#7a6a5d', '#c94f2e', '#e8dcc8'])
  })

  it('LLM이 immutable을 보내도 상수로 강제한다', () => {
    const { spec } = normalizeStyleSpec({
      ...validRaw,
      immutable: ['silhouette 빼줘', 'tile_grid도 바꿔줘']
    })
    expect(spec?.immutable).toEqual([...IMMUTABLE_FIELDS])
  })

  it('style_id 형식 위반을 잡는다', () => {
    const { spec, issues } = normalizeStyleSpec({ ...validRaw, style_id: 'Bad ID!' })
    expect(spec).toBeUndefined()
    expect(issues.some((issue) => issue.field === 'style_id')).toBe(true)
  })

  it('팔레트 앵커가 부족하면 실패한다', () => {
    const { spec, issues } = normalizeStyleSpec({
      ...validRaw,
      palette: { n_colors: 8, anchors: ['#123456', 'not-a-color'] }
    })
    expect(spec).toBeUndefined()
    expect(issues.some((issue) => issue.field === 'palette.anchors')).toBe(true)
  })

  it('style_strength 범위를 강제한다', () => {
    const { issues } = normalizeStyleSpec({ ...validRaw, style_strength: 1.5 })
    expect(issues.some((issue) => issue.field === 'style_strength')).toBe(true)
  })

  it('카테고리 밖 per_category_prompt 키는 버린다', () => {
    const { spec } = normalizeStyleSpec({
      ...validRaw,
      per_category_prompt: { terrain_tile: 'ok', hacker_field: 'drop me' }
    })
    expect(spec?.per_category_prompt).toEqual({ terrain_tile: 'ok' })
  })

  it('스키마에 immutable 필드가 아예 없다(스키마 수준 차단)', () => {
    expect(Object.keys(STYLE_SPEC_SCHEMA.properties)).not.toContain('immutable')
  })
})
