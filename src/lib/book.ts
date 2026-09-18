import type { Book, ContentBlock, ParsedBook } from '../types'
const aliases = ['Q3 Project Notes', 'Product Research', 'Meeting Follow-up', 'Market Analysis', 'Document Review']
export function materialize(parsed: ParsedBook, file: File): { book: Book; blocks: ContentBlock[] } {
  const id = crypto.randomUUID(); const blocks: ContentBlock[] = []
  const chapters = parsed.chapters.map((chapter, index) => {
    const chapterId = crypto.randomUUID(); chapter.blocks.forEach((block, blockIndex) => blocks.push({ id: crypto.randomUUID(), chapterId, index: blockIndex, text: block.text, pageIndex: block.pageIndex }))
    return { id: chapterId, bookId: id, index, title: chapter.title, blockCount: chapter.blocks.length }
  })
  const now = Date.now()
  return { book: { id, originalFileName: file.name, title: parsed.title, author: parsed.author, alias: aliases[Math.floor(Math.random() * aliases.length)], format: parsed.format, size: file.size, createdAt: now, lastOpenedAt: now, chapters, metadata: {} }, blocks }
}
