import { describe, expect, it } from 'vitest'
import { parseCommand } from './commands'
describe('local commands', () => {
  it('handles bilingual navigation', () => { expect(parseCommand('继续').type).toBe('continue'); expect(parseCommand('next chapter').type).toBe('nextChapter') })
  it('handles search and jumps', () => { expect(parseCommand('搜索 海边')).toEqual({ type: 'search', value: '海边' }); expect(parseCommand('跳到第 20 章')).toEqual({ type: 'chapter', value: 20 }) })
})
