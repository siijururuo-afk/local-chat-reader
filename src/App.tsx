import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, ArrowUp, Check, ChevronDown, FileText, Menu, Mic, Moon, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Share2, Sun, Trash2, Upload, X } from 'lucide-react'
import { db, loadBlocks, removeBook, repairLibrary, saveBook, saveProgress } from './lib/db'
import { materialize } from './lib/book'
import { parseCommand } from './lib/commands'
import { parseFile } from './lib/parsers'
import type { Book, ContentBlock, ReadingProgress, UserPreferences } from './types'
import { parseText } from './lib/text'

const defaultPreferences: UserPreferences = { theme: 'system', fontSize: 13, lineHeight: 1.65, contentWidth: 576, paragraphSpacing: 10, showRealTitle: false }
const CHUNK = 18
const APPEARANCE_VERSION = 'chatgpt-v2'
const PERSONAL_THEME = import.meta.env.DEV

function PersonalThemeMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" width="25" height="25"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>
}

function usePreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('workspace-preferences') || '{}')
      if (localStorage.getItem('workspace-appearance-version') !== APPEARANCE_VERSION) {
        localStorage.setItem('workspace-appearance-version', APPEARANCE_VERSION)
        return { ...defaultPreferences, ...saved, fontSize: 13, lineHeight: 1.65, contentWidth: 576, paragraphSpacing: 10 }
      }
      return { ...defaultPreferences, ...saved }
    } catch { return defaultPreferences }
  })
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

  useEffect(() => { if (PERSONAL_THEME) document.title = 'ChatGPT' }, [])

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
  function continueReading() {
    if (!activeBook) return
    if (visibleCount < blocks.length) setVisibleCount(n => Math.min(blocks.length, n + CHUNK))
    else if (chapterIndex < activeBook.chapters.length - 1) void changeChapter(chapterIndex + 1)
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
    if (!activeBook) { setStatus('Upload a document to start this local chat.'); return }
    if (cmd.type === 'continue') continueReading()
    else if (cmd.type === 'nextChapter') void changeChapter(chapterIndex + 1)
    else if (cmd.type === 'previousChapter') void changeChapter(chapterIndex - 1)
    else if (cmd.type === 'chapter') void changeChapter(Number(cmd.value) - 1)
    else if (cmd.type === 'search') { setQuery(String(cmd.value)); setSearchOpen(true) }
    else setStatus('AI actions need an optional provider. Reading and search work fully offline.')
  }
  async function sharePage() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setStatus('页面链接已复制；本地文档不会随链接分享。')
    } catch { setStatus('无法复制链接，请从浏览器地址栏复制。') }
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
    <aside className={sidebar ? 'sidebar open' : 'sidebar'} aria-label={PERSONAL_THEME ? 'ChatGPT sidebar' : 'Workspace sidebar'}>
      <div className="side-top"><button className="brand" aria-label="New chat" onClick={() => { setActiveBook(null); setUserMessages([]) }}><span className={PERSONAL_THEME ? 'brand-mark personal-theme-mark' : 'brand-mark'}>{PERSONAL_THEME ? <PersonalThemeMark/> : 'W'}</span><span>{PERSONAL_THEME ? 'ChatGPT' : 'Workspace'}</span></button><button className="icon-btn desktop" onClick={() => setSidebar(false)} aria-label="Collapse sidebar"><PanelLeftClose size={18}/></button></div>
      <nav>
        <button className="nav-item" onClick={() => { setActiveBook(null); setUserMessages([]) }}><Plus size={18}/>New chat</button>
        <button className="nav-item" onClick={() => setSearchOpen(true)}><Search size={17}/>Search <kbd>⌘K</kbd></button>
        <button className="nav-item" onClick={() => setDocuments(true)}><Archive size={17}/>Documents</button>
      </nav>
      <div className="history-label">Recent</div><div className="history">{books.map(b => <button key={b.id} className={activeBook?.id === b.id ? 'history-item active' : 'history-item'} onClick={() => void openBook(b)}>{b.alias}<MoreHorizontal size={15}/></button>)}{import.meta.env.DEV && books.length === 0 && <button className="history-item demo" onClick={() => void loadDemo()}>Open demo document</button>}</div>
      <button className="profile" onClick={() => setSettings(true)}><span className="avatar">Y</span><span><strong>You</strong><small>{PERSONAL_THEME ? 'Personal theme' : 'Local workspace'}</small></span><Settings size={17}/></button>
    </aside>
    <main className={sidebar ? 'main shifted' : 'main'}>
      <header><button className="icon-btn" onClick={() => setSidebar(v => !v)} aria-label="Toggle sidebar">{sidebar ? <Menu size={19}/> : <PanelLeftOpen size={19}/>}</button><button className="model">{PERSONAL_THEME ? 'ChatGPT' : 'Workspace'} <ChevronDown size={15}/></button><div className="header-actions"><div className="privacy"><span></span>Local only</div><button className="share-button" onClick={() => void sharePage()} aria-label="分享页面链接"><Share2 size={16} strokeWidth={1.8}/><span>分享</span></button></div></header>
      <div className="conversation" ref={scroller} onScroll={e => { if (activeBook && e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight < 900) setVisibleCount(n => Math.min(blocks.length, n + CHUNK)) }}>
        {(!activeBook || quickHidden) ? <div className="empty"><div className="spark">✦</div><h1>What can I help with?</h1></div> : <div className="thread" style={{ maxWidth: prefs.contentWidth, fontSize: prefs.fontSize, lineHeight: prefs.lineHeight }}>
          <div className="thread-meta">{prefs.showRealTitle ? activeBook.title : activeBook.alias}<span> / {activeBook.chapters[chapterIndex]?.title}</span></div>
          {userMessages.slice(-2).map((m, i) => <div className="user-message" key={i}>{m}</div>)}
          <article className="assistant" aria-live="polite">{visible.map(block => <p id={`block-${block.index}`} key={block.id} style={{ marginBottom: prefs.paragraphSpacing }}>{block.text}</p>)}</article>
          {(visibleCount < blocks.length || chapterIndex < activeBook.chapters.length - 1) && <button className="continue" onClick={continueReading}>Continue <ChevronDown size={15}/></button>}
          {visibleCount >= blocks.length && chapterIndex === activeBook.chapters.length - 1 && <p className="document-end">End of document</p>}
        </div>}
      </div>
      <div className="composer-wrap"><div className="composer">
        <textarea rows={1} aria-label="本地文档指令" placeholder={PERSONAL_THEME ? '问问 ChatGPT' : '问问本地文档'} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}/>
        <div className="composer-actions"><div className="plus-wrap"><button className="round" onClick={() => setMenu(v => !v)} aria-label="Add"><Plus size={20}/></button>{menu && <div className="plus-menu"><button onClick={() => fileRef.current?.click()}><Upload size={18}/>Upload file</button><button onClick={() => { setActiveBook(null); setMenu(false) }}><Plus size={18}/>New chat</button></div>}</div><button className="mic-button" type="button" onClick={() => setStatus('当前版本暂不支持语音输入。')} aria-label="语音输入暂不可用"><Mic size={17} strokeWidth={1.9}/></button><button className="send" disabled={!input.trim()} onClick={submit} aria-label="Send"><ArrowUp size={19} strokeWidth={3}/></button></div>
      </div><p className="notice">{PERSONAL_THEME ? 'ChatGPT 可能会犯错误。请核查重要信息。' : '仅本地处理文档；此页面不是 ChatGPT 官方服务。· v1.0.7'}</p></div>
      {status && <button className="toast" onClick={() => setStatus('')}>{busy ? <span className="spinner"/> : <Check size={16}/>} {status}<X size={14}/></button>}
    </main>
    {documents && <div className="overlay" onMouseDown={() => setDocuments(false)}><section className="dialog wide" onMouseDown={e => e.stopPropagation()}><div className="dialog-head"><div><h2>Documents</h2><p>Files available on this device</p></div><button className="icon-btn" onClick={() => setDocuments(false)}><X size={20}/></button></div><div className="doc-list">{books.length === 0 ? <div className="blank-list">No documents yet.</div> : books.map(b => <div className="doc" key={b.id}><FileText size={20}/><div><strong>{b.alias}</strong><span>{new Date(b.lastOpenedAt).toLocaleDateString()} · {(b.size / 1024 / 1024).toFixed(1)} MB</span></div><button onClick={() => void openBook(b)}>Open</button><button aria-label="Rename alias" onClick={async () => { const alias = prompt('Display alias', b.alias); if (alias?.trim()) { await db.books.update(b.id, { alias: alias.trim() }); void refreshBooks() } }}>Rename</button><button className="danger" aria-label="Remove document" onClick={async () => { if (confirm('Remove this local document?')) { await removeBook(b.id); if (activeBook?.id === b.id) setActiveBook(null); void refreshBooks() } }}><Trash2 size={16}/></button></div>)}</div><button className="primary" onClick={() => fileRef.current?.click()}><Upload size={17}/>Import document</button></section></div>}
    {searchOpen && <div className="overlay top" onMouseDown={() => setSearchOpen(false)}><section className="dialog search-dialog" onMouseDown={e => e.stopPropagation()}><div className="search-box"><Search size={20}/><input ref={searchRef} autoFocus placeholder="Search documents and content" value={query} onChange={e => setQuery(e.target.value)}/><kbd>ESC</kbd></div><div className="results">{query && !results.length && <div className="blank-list">No matching local content.</div>}{results.map((r, i) => <button key={i} onClick={() => { void openBook(r.book, r.chapterIndex, r.blockIndex); setSearchOpen(false) }}><FileText size={17}/><span><strong>{r.label}</strong><small>{r.excerpt}</small></span></button>)}</div></section></div>}
    {settings && <div className="overlay" onMouseDown={() => setSettings(false)}><section className="dialog" onMouseDown={e => e.stopPropagation()}><div className="dialog-head"><div><h2>Settings</h2><p>Appearance</p></div><button className="icon-btn" onClick={() => setSettings(false)}><X size={20}/></button></div><Setting label="Font size" value={prefs.fontSize} min={12} max={20} onChange={v => setPrefs({ ...prefs, fontSize: v })}/><Setting label="Line height" value={prefs.lineHeight} min={1.4} max={2.2} step={.05} onChange={v => setPrefs({ ...prefs, lineHeight: v })}/><Setting label="Content width" value={prefs.contentWidth} min={520} max={860} step={20} onChange={v => setPrefs({ ...prefs, contentWidth: v })}/><Setting label="Paragraph spacing" value={prefs.paragraphSpacing} min={6} max={24} onChange={v => setPrefs({ ...prefs, paragraphSpacing: v })}/><label className="setting toggle"><span>Show real book title<small>Otherwise only your display alias is shown</small></span><input type="checkbox" checked={prefs.showRealTitle} onChange={e => setPrefs({ ...prefs, showRealTitle: e.target.checked })}/></label><div className="themes"><button className={prefs.theme === 'light' ? 'selected' : ''} onClick={() => setPrefs({ ...prefs, theme: 'light' })}><Sun size={17}/>Light</button><button className={prefs.theme === 'dark' ? 'selected' : ''} onClick={() => setPrefs({ ...prefs, theme: 'dark' })}><Moon size={17}/>Dark</button><button className={prefs.theme === 'system' ? 'selected' : ''} onClick={() => setPrefs({ ...prefs, theme: 'system' })}>System</button></div></section></div>}
  </div>
}

function Setting({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return <label className="setting"><span>{label}<small>{value}</small></span><input type="range" value={value} min={min} max={max} step={step} onChange={e => onChange(Number(e.target.value))}/></label>
}
