/**
 * # Type Definitions
 *
 * Core interfaces used by the extension.
 *
 * Author: Unknown
 * Update: Initial version
 */

import * as vscode from 'vscode'

export interface ExcerptInfo {
  id: string
  fileUri: vscode.Uri
  buffer: vscode.TextDocument
  sourceRange: vscode.Range
  multiBufferRange: vscode.Range
  contextBefore: number
  contextAfter: number
  isMatch: boolean
  originalText: string
}

export interface MultiBufferMapping {
  lineToExcerpt: Map<number, ExcerptInfo>
  excerpts: Map<string, ExcerptInfo>
  excerptsByFile: Map<string, ExcerptInfo[]>
}

export interface SearchOptions {
  query: string
  isRegex: boolean
  isCaseSensitive: boolean
  matchWholeWord: boolean
  includePattern?: string
  excludePattern?: string
  contextLines: number
  maxResults?: number
}

export interface ReplaceOptions extends SearchOptions {
  replacement: string
}

export interface MultiBufferDocument {
  content: string
  mapping: MultiBufferMapping
  searchOptions: SearchOptions
  replaceOptions?: ReplaceOptions
  uri: vscode.Uri
}
