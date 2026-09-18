import type { Book, ContentBlock, ParsedBook } from '../types'
const aliases = ['Q3 Project Notes', 'Product Research', 'Meeting Follow-up', 'Market Analysis', 'Document Review']
export function materialize(parsed: ParsedBook, file: File): { book: Book; blocks: ContentBlock[] } {
  const id = crypto.randomUUID(); const blocks: ContentBlock[] = []
  const sourceChapters = parsed.chapters.length ? parsed.chapters : [{ title: 'Document', blocks: [{ text: 'No readable text was found in this document.' }] }]
  const chapters = sourceChapters.map((chapter, index) => {
    const chapterId = crypto.randomUUID(); chapter.blocks.forEach((block, blockIndex) => blocks.push({ id: crypto.randomUUID(), chapterId, index: blockIndex, text: block.text, pageIndex: block.pageIndex }))
    if (!chapter.blocks.length) blocks.push({ id: crypto.randomUUID(), chapterId, index: 0, text: 'No readable text was found in this section.' })
    return { id: chapterId, bookId: id, index, title: chapter.title || `Section ${index + 1}`, blockCount: Math.max(1, chapter.blocks.length) }
  })
  const now = Date.now()
  return { book: { id, originalFileName: file.name, title: parsed.title, author: parsed.author, alias: aliases[Math.floor(Math.random() * aliases.length)], format: parsed.format, size: file.size, createdAt: now, lastOpenedAt: now, chapters, metadata: {} }, blocks }
}
