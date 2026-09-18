import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, ArrowUp, Check, ChevronDown, FileText, Menu, Moon, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Sun, Trash2, Upload, X } from 'lucide-react'
import { db, loadBlocks, removeBook, repairLibrary, saveBook, saveProgress } from './lib/db'
import { materialize } from './lib/book'
import { parseCommand } from './lib/commands'
import { parseFile } from './lib/parsers'
import type { Book, ContentBlock, ReadingProgress, UserPreferences } from './types'
import { parseText } from './lib/text'

const defaultPreferences: UserPreferences = { theme: 'system', fontSize: 16, lineHeight: 1.75, contentWidth: 768, paragraphSpacing: 16, showRealTitle: false }
const CHUNK = 18

function usePreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(() => { try { return { ...defaultPreferences, ...JSON.parse(localStorage.getItem('workspace-preferences') || '{}') } } catch { return defaultPreferences } })
  useEffect(() => { localStorage.setItem('workspace-preferences', JSON.stringify(prefs)); const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.classList.toggle('dark', dark) }, [prefs])
  return [prefs, setPrefs] as const
}

export default function App() {
  const [books, setBooks] = useState<Book[]>([]), [activeBook, setActiveBook] = useState<Book | null>(null), [blocks, setBlocks] = useState<ContentBlock[]>([])
  const [chapterIndex, setChapterIndex] = useState(0), [visibleCount, setVisibleCount] = useState(CHUNK), [sidebar, setSidebar] = useState(() => window.innerWidth > 800)
  const [menu, setMenu] = useState(false), [documents, setDocuments] = useState(false), [settings, setSettings] = useState(false), [searchOpen, setSearchOpen] = useState(false)
  const [quickHidden, setQuickHidden] = useState(false), [input, setInput] = useState(''), [query, setQuery] = useState(''), [userMessages, setUserMessages] = useState<string[]>([])
  const [status, setStatus] = useState(''), [busy, setBusy] = useState(false), [prefs, setPrefs] = usePreferences()
  const fileRef = useRef<HTMLInputElement>(null), scroller = useRef<HTMLDivElement>(null), searchRef = useRef<HTMLInputElement>(null)

  const refreshBooks = async () => setBooks(await db.books.orderBy('lastOpenedAt').reverse().toArray())
  // IndexedDB is the external source of truth for the local document list.
  useEffect(() => { void repairLibrary().then(refreshBooks) }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (e.key === 'Escape' || (mod && e.shiftKey && e.key.toLowerCase() === 'h')) { e.preventDefault(); setQuickHidden(v => !v) }
      else if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 0) }
      else if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); setActiveBook(null); setQuickHidden(false); setUserMessages([]) }
    }
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey)
  }, [])

  async function openBook(book: Book, targetChapter?: number, targetBlock?: number) {
    if (!Array.isArray(book.chapters) || !book.chapters.length) {
      setActiveBook(null); setStatus('This import contains no readable chapters. Remove it and re-import the original file.'); return
    }
    const progress = await db.progress.get(book.id)
    const restoredIndex = book.chapters.findIndex(c => c.id === progress?.chapterId)
    const ci = Math.max(0, Math.min(book.chapters.length - 1, targetChapter ?? (restoredIndex >= 0 ? restoredIndex : 0)))
    setActiveBook(book); setQuickHidden(false); setChapterIndex(ci); setVisibleCount(Math.max(CHUNK, (targetBlock ?? progress?.blockIndex ?? 0) + CHUNK)); setBlocks(await loadBlocks(book.chapters[ci].id)); setDocuments(false)
    const updated = { ...book, lastOpenedAt: Date.now() }; await db.books.put(updated); setActiveBook(updated); void refreshBooks()
    requestAnimationFrame(() => { if (scroller.current) scroller.current.scrollTop = targetBlock ? targetBlock * 70 : (progress?.scrollOffset ?? 0) })
  }
  async function changeChapter(next: number) {
    if (!activeBook) return; const ci = Math.max(0, Math.min(activeBook.chapters.length - 1, next)); setChapterIndex(ci); setBlocks(await loadBlocks(activeBook.chapters[ci].id)); setVisibleCount(CHUNK); scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function importFile(file?: File) {
    if (!file) return; setBusy(true); setStatus(`Processing ${file.name} locally…`)
    try { const parsed = await parseFile(file); const created = materialize(parsed, file); await saveBook(created.book, created.blocks); await refreshBooks(); await openBook(created.book); setStatus('Document ready') }
    catch (e) { setStatus(e instanceof Error ? e.message : 'Import failed') } finally { setBusy(false); setMenu(false) }
  }
  async function loadDemo() {
    const text = `Chapter 1\nThe quiet office had emptied by six, leaving only the soft hum of the lights. Mara opened the last document in her queue and found a note addressed simply: Begin here.\n\nOutside, rain traced patient lines down the glass. She read on.\n\nChapter 2\nBy morning the city looked newly drawn. Every familiar corner seemed to hold a question, and every answer led to another page.`
    const file = new File([text], 'demo-document.txt', { type: 'text/plain' }); const created = materialize(parseText(text, 'The Last Document'), file); await saveBook(created.book, created.blocks); await refreshBooks(); await openBook(created.book)
  }
  async function persistProgress() {
    if (!activeBook || quickHidden || !Array.isArray(activeBook.chapters) || !activeBook.chapters[chapterIndex]) return
    const total = activeBook.chapters.reduce((n, c) => n + c.blockCount, 0), before = activeBook.chapters.slice(0, chapterIndex).reduce((n, c) => n + c.blockCount, 0)
    const p: ReadingProgress = { bookId: activeBook.id, chapterId: activeBook.chapters[chapterIndex].id, blockIndex: Math.max(0, visibleCount - CHUNK), scrollOffset: scroller.current?.scrollTop ?? 0, lastOpenedAt: Date.now(), readingPercentage: Math.min(100, ((before + visibleCount) / total) * 100) }
    await saveProgress(p)
  }
  // Persist after navigation settles; the individual scalar dependencies are intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = setTimeout(() => void persistProgress(), 350); return () => clearTimeout(timer) }, [activeBook?.id, chapterIndex, visibleCount, quickHidden])

  function submit() {
    if (!input.trim()) return; const raw = input.trim(); setInput(''); setUserMessages(m => [...m, raw]); const cmd = parseCommand(raw)
    if (!activeBook) { setStatus('Upload a document to start this local workspace.'); return }
    if (cmd.type === 'continue') setVisibleCount(n => Math.min(blocks.length, n + CHUNK))
    else if (cmd.type === 'nextChapter') void changeChapter(chapterIndex + 1)
    else if (cmd.type === 'previousChapter') void changeChapter(chapterIndex - 1)
    else if (cmd.type === 'chapter') void changeChapter(Number(cmd.value) - 1)
    else if (cmd.type === 'search') { setQuery(String(cmd.value)); setSearchOpen(true) }
    else setStatus('AI actions need an optional provider. Reading and search work fully offline.')
  }
  const results = useMemo(() => {
    const q = query.trim().toLowerCase(); if (!q) return []
    const out: Array<{ book: Book; chapterIndex: number; blockIndex?: number; label: string; excerpt: string }> = []
    for (const book of books) for (const ch of book.chapters) if (ch.title.toLowerCase().includes(q) || book.originalFileName.toLowerCase().includes(q)) out.push({ book, chapterIndex: ch.index, label: book.alias, excerpt: ch.title })
    if (activeBook) blocks.forEach((b, i) => { const at = b.text.toLowerCase().indexOf(q); if (at >= 0 && out.length < 80) out.push({ book: activeBook, chapterIndex, blockIndex: i, label: activeBook.alias, excerpt: b.text.slice(Math.max(0, at - 45), at + q.length + 80) }) })
    return out.slice(0, 80)
  }, [query, books, blocks, activeBook, chapterIndex])
  const visible = quickHidden ? [] : blocks.slice(0, visibleCount)

  return <div className="app" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void importFile(e.dataTransfer.files[0]) }}>
    <input ref={fileRef} hidden type="file" accept=".txt,.pdf,.epub" onChange={e => void importFile(e.target.files?.[0])}/>
    <aside className={sidebar ? 'sidebar open' : 'sidebar'} aria-label="Workspace sidebar">
      <div className="side-top"><button className="brand" aria-label="New chat" onClick={() => { setActiveBook(null); setUserMessages([]) }}><span className="brand-mark">W</span><span>Workspace</span></button><button className="icon-btn desktop" onClick={() => setSidebar(false)} aria-label="Collapse sidebar"><PanelLeftClose size={18}/></button></div>
      <nav>
        <button className="nav-item" onClick={() => { setActiveBook(null); setUserMessages([]) }}><Plus size={18}/>New chat</button>
        <button className="nav-item" onClick={() => setSearchOpen(true)}><Search size={17}/>Search <kbd>⌘K</kbd></button>
        <button className="nav-item" onClick={() => setDocuments(true)}><Archive size={17}/>Documents</button>
      </nav>
      <div className="history-label">Recent</div><div className="history">{books.map(b => <button key={b.id} className={activeBook?.id === b.id ? 'history-item active' : 'history-item'} onClick={() => void openBook(b)}>{b.alias}<MoreHorizontal size={15}/></button>)}{import.meta.env.DEV && books.length === 0 && <button className="history-item demo" onClick={() => void loadDemo()}>Open demo document</button>}</div>
      <button className="profile" onClick={() => setSettings(true)}><span className="avatar">Y</span><span><strong>You</strong><small>Local workspace</small></span><Settings size={17}/></button>
    </aside>
    <main className={sidebar ? 'main shifted' : 'main'}>
      <header><button className="icon-btn" onClick={() => setSidebar(v => !v)} aria-label="Toggle sidebar">{sidebar ? <Menu size={19}/> : <PanelLeftOpen size={19}/>}</button><button className="model">Workspace <ChevronDown size={15}/></button><div className="privacy"><span></span>Local only</div></header>
      <div className="conversation" ref={scroller} onScroll={e => { if (activeBook && e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight < 500) setVisibleCount(n => Math.min(blocks.length, n + CHUNK)) }}>
        {(!activeBook || quickHidden) ? <div className="empty"><div className="spark">✦</div><h1>What can I help with?</h1></div> : <div className="thread" style={{ maxWidth: prefs.contentWidth, fontSize: prefs.fontSize, lineHeight: prefs.lineHeight }}>
          <div className="thread-meta">{prefs.showRealTitle ? activeBook.title : activeBook.alias}<span> / {activeBook.chapters[chapterIndex]?.title}</span></div>
          {userMessages.slice(-2).map((m, i) => <div className="user-message" key={i}>{m}</div>)}
          <article className="assistant" aria-live="polite">{visible.map(block => <p id={`block-${block.index}`} key={block.id} style={{ marginBottom: prefs.paragraphSpacing }}>{block.text}</p>)}</article>
          {visibleCount < blocks.length && <button className="continue" onClick={() => setVisibleCount(n => Math.min(blocks.length, n + CHUNK))}>Continue <ChevronDown size={15}/></button>}
        </div>}
      </div>
      <div className="composer-wrap"><div className="composer">
        <textarea rows={1} aria-label="Message Workspace" placeholder="Message Workspace" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}/>
        <div className="composer-actions"><div className="plus-wrap"><button className="round" onClick={() => setMenu(v => !v)} aria-label="Add"><Plus size={20}/></button>{menu && <div className="plus-menu"><button onClick={() => fileRef.current?.click()}><Upload size={18}/>Upload file</button><button onClick={() => { setActiveBook(null); setMenu(false) }}><Plus size={18}/>New workspace</button></div>}</div><button className="send" disabled={!input.trim()} onClick={submit} aria-label="Send"><ArrowUp size={19}/></button></div>
      </div><p className="notice">Your documents stay on this device. Workspace can make mistakes. · v1.0.2</p></div>
      {status && <button className="toast" onClick={() => setStatus('')}>{busy ? <span className="spinner"/> : <Check size={16}/>} {status}<X size={14}/></button>}
    </main>
    {documents && <div className="overlay" onMouseDown={() => setDocuments(false)}><section className="dialog wide" onMouseDown={e => e.stopPropagation()}><div className="dialog-head"><div><h2>Documents</h2><p>Files available on this device</p></div><button className="icon-btn" onClick={() => setDocuments(false)}><X size={20}/></button></div><div className="doc-list">{books.length === 0 ? <div className="blank-list">No documents yet.</div> : books.map(b => <div className="doc" key={b.id}><FileText size={20}/><div><strong>{b.alias}</strong><span>{new Date(b.lastOpenedAt).toLocaleDateString()} · {(b.size / 1024 / 1024).toFixed(1)} MB</span></div><button onClick={() => void openBook(b)}>Open</button><button aria-label="Rename alias" onClick={async () => { const alias = prompt('Display alias', b.alias); if (alias?.trim()) { await db.books.update(b.id, { alias: alias.trim() }); void refreshBooks() } }}>Rename</button><button className="danger" aria-label="Remove document" onClick={async () => { if (confirm('Remove this local document?')) { await removeBook(b.id); if (activeBook?.id === b.id) setActiveBook(null); void refreshBooks() } }}><Trash2 size={16}/></button></div>)}</div><button className="primary" onClick={() => fileRef.current?.click()}><Upload size={17}/>Import document</button></section></div>}
    {searchOpen && <div className="overlay top" onMouseDown={() => setSearchOpen(false)}><section className="dialog search-dialog" onMouseDown={e => e.stopPropagation()}><div className="search-box"><Search size={20}/><input ref={searchRef} autoFocus placeholder="Search documents and content" value={query} onChange={e => setQuery(e.target.value)}/><kbd>ESC</kbd></div><div className="results">{query && !results.length && <div className="blank-list">No matching local content.</div>}{results.map((r, i) => <button key={i} onClick={() => { void openBook(r.book, r.chapterIndex, r.blockIndex); setSearchOpen(false) }}><FileText size={17}/><span><strong>{r.label}</strong><small>{r.excerpt}</small></span></button>)}</div></section></div>}
    {settings && <div className="overlay" onMouseDown={() => setSettings(false)}><section className="dialog" onMouseDown={e => e.stopPropagation()}><div className="dialog-head"><div><h2>Settings</h2><p>Appearance</p></div><button className="icon-btn" onClick={() => setSettings(false)}><X size={20}/></button></div><Setting label="Font size" value={prefs.fontSize} min={14} max={22} onChange={v => setPrefs({ ...prefs, fontSize: v })}/><Setting label="Line height" value={prefs.lineHeight} min={1.4} max={2.2} step={.05} onChange={v => setPrefs({ ...prefs, lineHeight: v })}/><Setting label="Content width" value={prefs.contentWidth} min={620} max={960} step={20} onChange={v => setPrefs({ ...prefs, contentWidth: v })}/><Setting label="Paragraph spacing" value={prefs.paragraphSpacing} min={8} max={28} onChange={v => setPrefs({ ...prefs, paragraphSpacing: v })}/><label className="setting toggle"><span>Show real book title<small>Otherwise only your display alias is shown</small></span><input type="checkbox" checked={prefs.showRealTitle} onChange={e => setPrefs({ ...prefs, showRealTitle: e.target.checked })}/></label><div className="themes"><button className={prefs.theme === 'light' ? 'selected' : ''} onClick={() => setPrefs({ ...prefs, theme: 'light' })}><Sun size={17}/>Light</button><button className={prefs.theme === 'dark' ? 'selected' : ''} onClick={() => setPrefs({ ...prefs, theme: 'dark' })}><Moon size={17}/>Dark</button><button className={prefs.theme === 'system' ? 'selected' : ''} onClick={() => setPrefs({ ...prefs, theme: 'system' })}>System</button></div></section></div>}
  </div>
}

function Setting({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return <label className="setting"><span>{label}<small>{value}</small></span><input type="range" value={value} min={min} max={max} step={step} onChange={e => onChange(Number(e.target.value))}/></label>
}
