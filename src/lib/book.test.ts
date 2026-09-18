import { describe, expect, it, vi } from 'vitest'
import { materialize } from './book'
Object.defineProperty(globalThis, 'crypto', { value: { randomUUID: vi.fn(() => `${Math.random()}`) }, configurable: true })
describe('book materialization', () => {
  it('uses generated ids and an alias', () => { const file = new File(['x'], 'a.txt'); const { book, blocks } = materialize({ title: 'A', author: '', format: 'txt', chapters: [{ title: 'One', blocks: [{ text: 'Hello' }] }] }, file); expect(book.id).not.toBe(file.name); expect(book.alias).toBeTruthy(); expect(blocks[0].chapterId).toBe(book.chapters[0].id) })
})
