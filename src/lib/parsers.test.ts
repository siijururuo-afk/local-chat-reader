import { describe, expect, it, vi } from 'vitest'
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions:{}, getDocument: () => ({ promise: Promise.resolve({ numPages:1, getPage: async () => ({ getTextContent: async () => ({ items:[{ str:'PDF body text' }] }) }) }) }) }))
vi.mock('epubjs', () => ({ default: () => ({ ready:Promise.resolve(), loaded:{ metadata:Promise.resolve({ title:'E Book', creator:'Author' }), navigation:Promise.resolve({ toc:[{ href:'one.xhtml', label:'One' }] }) }, spine:{ spineItems:[{ href:'one.xhtml', load:async () => ({ querySelectorAll:() => [{ textContent:'EPUB body text' }], textContent:'EPUB body text' }), unload:vi.fn() }] }, load:vi.fn(), destroy:vi.fn() }) }))
import { parseEpub, parsePdf } from './parsers'
describe('document parsers', () => {
  it('extracts PDF text', async () => expect((await parsePdf(new File(['x'], 'a.pdf'))).chapters[0].blocks[0].text).toContain('PDF'))
  it('extracts EPUB metadata and text', async () => { const r = await parseEpub(new File(['x'], 'a.epub')); expect(r.title).toBe('E Book'); expect(r.chapters[0].blocks[0].text).toContain('EPUB') })
})
