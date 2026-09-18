export type Command = { type: 'continue'|'nextChapter'|'previousChapter'|'search'|'chapter'|'ai'; value?: string|number }
export function parseCommand(input: string): Command {
  const q = input.trim(); const lower = q.toLowerCase()
  if (/^(继续|下一段|continue|next)$/.test(lower)) return { type: 'continue' }
  if (/^(下一章|next chapter)$/.test(lower)) return { type: 'nextChapter' }
  if (/^(上一章|previous|previous chapter)$/.test(lower)) return { type: 'previousChapter' }
  const search = q.match(/^(?:搜索|search)\s+(.+)/i); if (search) return { type: 'search', value: search[1] }
  const chapter = q.match(/^(?:跳到第?\s*|chapter\s*)(\d+)\s*章?$/i); if (chapter) return { type: 'chapter', value: Number(chapter[1]) }
  return { type: 'ai', value: q }
}
