export type BookFormat = 'txt' | 'pdf' | 'epub'
export interface ContentBlock { id: string; chapterId: string; index: number; text: string; pageIndex?: number }
export interface Chapter { id: string; bookId: string; index: number; title: string; blockCount: number; sourceHref?: string }
export interface Book { id: string; originalFileName: string; title: string; author: string; alias: string; format: BookFormat; size: number; createdAt: number; lastOpenedAt: number; chapters: Chapter[]; metadata: Record<string, string> }
export interface ReadingProgress { bookId: string; chapterId: string; blockIndex: number; scrollOffset: number; lastOpenedAt: number; readingPercentage: number }
export interface WorkspaceConversation { id: string; bookId?: string; alias: string; updatedAt: number }
export interface UserPreferences { theme: 'light' | 'dark' | 'system'; fontSize: number; lineHeight: number; contentWidth: number; paragraphSpacing: number; showRealTitle: boolean }
export interface ParsedBook { title: string; author: string; format: BookFormat; chapters: Array<{ title: string; blocks: Array<{ text: string; pageIndex?: number }> }> }
