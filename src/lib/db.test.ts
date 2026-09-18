import { beforeEach, describe, expect, it } from 'vitest'
import { db, removeBook, saveBook, saveProgress } from './db'
import type { Book } from '../types'
const book: Book = { id:'b', originalFileName:'a.txt', title:'A', author:'', alias:'Notes', format:'txt', size:1, createdAt:1, lastOpenedAt:1, metadata:{}, chapters:[{ id:'c', bookId:'b', index:0, title:'One', blockCount:1 }] }
describe('IndexedDB persistence', () => {
  beforeEach(async () => { await db.delete(); await db.open() })
  it('saves progress, aliases, and deletes document data', async () => { await saveBook(book, [{ id:'x', chapterId:'c', index:0, text:'hello' }]); await db.books.update('b', { alias:'Renamed' }); await saveProgress({ bookId:'b', chapterId:'c', blockIndex:0, scrollOffset:12, lastOpenedAt:2, readingPercentage:50 }); expect((await db.books.get('b'))?.alias).toBe('Renamed'); expect((await db.progress.get('b'))?.scrollOffset).toBe(12); await removeBook('b'); expect(await db.books.count()).toBe(0); expect(await db.blocks.count()).toBe(0) })
})
