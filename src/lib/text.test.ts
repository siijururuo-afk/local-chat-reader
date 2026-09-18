import { describe, expect, it } from 'vitest'
import { chapterPattern, parseText } from './text'

describe('TXT import and chapter recognition', () => {
  it.each(['第1章 开始', '第一章', '第 20 章 归来', 'Chapter 1 Arrival', 'CHAPTER 12'])('recognizes %s', heading => expect(chapterPattern.test(heading)).toBe(true))
  it('parses text into chapters and blocks', () => { const result = parseText('第一章\n开头。\n\n第二段。\n第二章\n结尾。', 'Test'); expect(result.chapters).toHaveLength(2); expect(result.chapters[0].blocks.length).toBeGreaterThan(0) })
  it('splits very large unchaptered text', () => { const text = Array.from({ length: 250 }, (_, i) => `Paragraph ${i}`).join('\n\n'); expect(parseText(text).chapters.length).toBe(4) })
})
