import type { ParsedBook } from '../types'

export const chapterPattern = /^\s*(第\s*[0-9零〇一二两三四五六七八九十百千万]+\s*[章节回卷篇部]|chapter\s+\d+\b)/i
export function splitParagraphs(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split(/\n\s*\n|\n(?=[“「『A-Z\u4e00-\u9fff])/).map(v => v.trim()).filter(v => v.length > 0)
}
export function parseText(text: string, title = 'Untitled document'): ParsedBook {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
  const headings = lines.map((line, i) => chapterPattern.test(line) ? i : -1).filter(i => i >= 0)
  const chapters: ParsedBook['chapters'] = []
  if (!headings.length) {
    const paras = splitParagraphs(text)
    for (let i = 0; i < paras.length; i += 80) chapters.push({ title: `Section ${chapters.length + 1}`, blocks: paras.slice(i, i + 80).map(t => ({ text: t })) })
  } else {
    if (headings[0] > 0) headings.unshift(0)
    headings.forEach((start, idx) => {
      const end = headings[idx + 1] ?? lines.length
      const isHeading = chapterPattern.test(lines[start])
      const chapterTitle = isHeading ? lines[start].trim() : 'Preface'
      const content = lines.slice(start + (isHeading ? 1 : 0), end).join('\n')
      const blocks = splitParagraphs(content).map(t => ({ text: t }))
      if (blocks.length) chapters.push({ title: chapterTitle, blocks })
    })
  }
  if (!chapters.length) chapters.push({ title: 'Section 1', blocks: [{ text: text.trim() || 'This document is empty.' }] })
  return { title, author: '', format: 'txt', chapters }
}
export async function decodeText(buffer: ArrayBuffer): Promise<string> {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  const bad = (utf8.match(/�/g) ?? []).length
  if (bad < Math.max(2, utf8.length * .002)) return utf8
  try { return new TextDecoder('gb18030').decode(buffer) } catch { return utf8 }
}
