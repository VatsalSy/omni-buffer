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
  validate?(): ValidationResult
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export function validateMultiBufferMapping(mapping: MultiBufferMapping): ValidationResult {
  const errors: string[] = []
  
  // Check that all excerpts in lineToExcerpt exist in excerpts map
  for (const [line, excerpt] of mapping.lineToExcerpt) {
    if (!mapping.excerpts.has(excerpt.id)) {
      errors.push(`Excerpt ${excerpt.id} at line ${line} not found in excerpts map`)
    }
  }
  
  // Check that all excerpts in excerptsByFile exist in excerpts map
  for (const [filePath, fileExcerpts] of mapping.excerptsByFile) {
    for (const excerpt of fileExcerpts) {
      if (!mapping.excerpts.has(excerpt.id)) {
        errors.push(`Excerpt ${excerpt.id} for file ${filePath} not found in excerpts map`)
      }
    }
  }
  
  // Check that all excerpts in excerpts map are referenced somewhere
  const referencedIds = new Set<string>()
  
  // Collect IDs from lineToExcerpt
  for (const excerpt of mapping.lineToExcerpt.values()) {
    referencedIds.add(excerpt.id)
  }
  
  // Collect IDs from excerptsByFile
  for (const fileExcerpts of mapping.excerptsByFile.values()) {
    for (const excerpt of fileExcerpts) {
      referencedIds.add(excerpt.id)
    }
  }
  
  // Check for orphaned excerpts
  for (const [id, excerpt] of mapping.excerpts) {
    if (!referencedIds.has(id)) {
      errors.push(`Excerpt ${id} exists in excerpts map but is not referenced in lineToExcerpt or excerptsByFile`)
    }
  }
  
  // Verify excerptsByFile contains all excerpts grouped correctly
  const fileExcerptMap = new Map<string, Set<string>>()
  for (const [id, excerpt] of mapping.excerpts) {
    const filePath = excerpt.fileUri.fsPath
    if (!fileExcerptMap.has(filePath)) {
      fileExcerptMap.set(filePath, new Set())
    }
    fileExcerptMap.get(filePath)!.add(id)
  }
  
  for (const [filePath, expectedIds] of fileExcerptMap) {
    const actualExcerpts = mapping.excerptsByFile.get(filePath) || []
    const actualIds = new Set(actualExcerpts.map(e => e.id))
    
    for (const id of expectedIds) {
      if (!actualIds.has(id)) {
        errors.push(`Excerpt ${id} for file ${filePath} missing from excerptsByFile`)
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
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
