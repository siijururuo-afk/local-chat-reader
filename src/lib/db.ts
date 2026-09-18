import Dexie, { type EntityTable } from 'dexie'
import type { Book, ContentBlock, ReadingProgress } from '../types'

export const db = new Dexie('local-chat-workspace') as Dexie & {
  books: EntityTable<Book, 'id'>
  blocks: EntityTable<ContentBlock, 'id'>
  progress: EntityTable<ReadingProgress, 'bookId'>
}
db.version(1).stores({ books: 'id,lastOpenedAt,alias,title', blocks: 'id,chapterId,[chapterId+index]', progress: 'bookId,lastOpenedAt' })

export async function saveBook(book: Book, blocks: ContentBlock[]) {
  await db.transaction('rw', db.books, db.blocks, async () => { await db.books.put(book); await db.blocks.bulkPut(blocks) })
}
export async function removeBook(id: string) {
  const book = await db.books.get(id)
  await db.transaction('rw', db.books, db.blocks, db.progress, async () => {
    if (book) for (const chapter of book.chapters) await db.blocks.where('chapterId').equals(chapter.id).delete()
    await db.books.delete(id); await db.progress.delete(id)
  })
}
export async function loadBlocks(chapterId: string) { return db.blocks.where('chapterId').equals(chapterId).sortBy('index') }
export async function saveProgress(progress: ReadingProgress) { await db.progress.put(progress) }

export async function repairLibrary(): Promise<number> {
  const books = await db.books.toArray()
  let repaired = 0
  await db.transaction('rw', db.books, db.blocks, async () => {
    for (const book of books) {
      if (Array.isArray(book.chapters) && book.chapters.length > 0) continue
      const chapterId = crypto.randomUUID()
      const chapter = { id: chapterId, bookId: book.id, index: 0, title: 'Document', blockCount: 1 }
      await db.blocks.put({ id: crypto.randomUUID(), chapterId, index: 0, text: 'This earlier import contained no readable text. Remove it and re-import the original document.' })
      await db.books.update(book.id, { chapters: [chapter] })
      repaired++
    }
  })
  return repaired
}
