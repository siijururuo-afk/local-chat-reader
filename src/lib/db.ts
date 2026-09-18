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
