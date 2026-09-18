import type { ParsedBook } from '../types'
import { decodeText, parseText, splitParagraphs } from './text'

export async function parseFile(file: File): Promise<ParsedBook> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'txt') return parseText(await decodeText(await file.arrayBuffer()), file.name.replace(/\.txt$/i, ''))
  if (ext === 'pdf') return parsePdf(file)
  if (ext === 'epub') return parseEpub(file)
  throw new Error('Choose a TXT, PDF, or EPUB file.')
}

export async function parsePdf(file: File): Promise<ParsedBook> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const blocks: Array<{ text: string; pageIndex: number }> = []
  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
    const page = await pdf.getPage(pageIndex + 1); const content = await page.getTextContent()
    const text = content.items.map(item => 'str' in item ? item.str : '').join(' ').replace(/\s+/g, ' ').trim()
    if (text) splitParagraphs(text).forEach(part => blocks.push({ text: part, pageIndex }))
  }
  const chapters = []
  for (let i = 0; i < blocks.length; i += 60) chapters.push({ title: `Pages ${Math.floor(i / 60) + 1}`, blocks: blocks.slice(i, i + 60) })
  return { title: file.name.replace(/\.pdf$/i, ''), author: '', format: 'pdf', chapters: chapters.length ? chapters : [{ title: 'Document', blocks: [{ text: 'No selectable text was found in this PDF.', pageIndex: 0 }] }] }
}

export async function parseEpub(file: File): Promise<ParsedBook> {
  const { default: ePub } = await import('epubjs')
  const book = ePub(await file.arrayBuffer()); await book.ready
  const metadata = await book.loaded.metadata
  const navigation = await book.loaded.navigation
  const tocMap = new Map(navigation.toc.map((x: any) => [x.href.split('#')[0], x.label.trim()]))
  const chapters: ParsedBook['chapters'] = []
  for (const item of (book.spine as any).spineItems) {
    const root = await item.load(book.load.bind(book)) as Element
    const elements = Array.from(root.querySelectorAll?.('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre') ?? [])
    const texts = elements.map(node => node.textContent?.replace(/\s+/g, ' ').trim() || '').filter(Boolean)
    const fallback = root.textContent?.replace(/\s+/g, ' ').trim() || ''
    const blocks = (texts.length ? texts : (fallback ? [fallback] : [])).map(text => ({ text }))
    if (blocks.length) chapters.push({ title: tocMap.get(item.href.split('#')[0]) || `Section ${chapters.length + 1}`, blocks })
    item.unload()
  }
  book.destroy()
  return { title: metadata.title || file.name.replace(/\.epub$/i, ''), author: metadata.creator || '', format: 'epub', chapters: chapters.length ? chapters : [{ title: 'Document', blocks: [{ text: 'No readable text was found in this EPUB.' }] }] }
}
