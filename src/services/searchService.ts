/**
 * # Search Service
 *
 * Provides workspace search capabilities.
 *
 * Author: Unknown
 * Update: Initial version
 *
 * TODO: Incremental updates have been implemented in IncrementalSearchService
 * See INCREMENTAL_UPDATES.md for design and incrementalSearchService.ts for implementation
 */

import * as vscode from 'vscode'
import { SearchOptions, ExcerptInfo, getContextValues } from '../models/types'
import { Excerpt } from '../models/excerpt'

// Minimal structural types to avoid dependency on VS Code's search type exports
type TextSearchMatchLike = {
  uri: vscode.Uri
  ranges?: vscode.Range[]
  range?: vscode.Range
  matches?: { range: vscode.Range }[]
}
type TextSearchQueryLike = {
  pattern: string
  isRegExp?: boolean
  isCaseSensitive?: boolean
  isWordMatch?: boolean
}

export class SearchService {
  private static readonly DEFAULT_CONTEXT_LINES = 2
  
  /**
   * Placeholder range used temporarily when creating excerpts.
   * This will be replaced with actual omni-buffer coordinates by the formatter.
   */
  private static readonly PLACEHOLDER_RANGE = new vscode.Range(0, 0, 0, 0)

  /**
   * Type guard to check if a result is a TextSearchMatch
   */
  private isTextSearchMatch(result: any): result is TextSearchMatchLike {
    return (
      result &&
      typeof result === 'object' &&
      'uri' in result &&
      result.uri instanceof vscode.Uri &&
      ('matches' in result || 'ranges' in result || 'range' in result) &&
      (
        (Array.isArray(result.matches) && result.matches.every((m: any) => 
          m && typeof m === 'object' && 'range' in m
        )) ||
        (Array.isArray(result.ranges) && result.ranges.every((r: any) => 
          r instanceof vscode.Range
        )) ||
        (result.range instanceof vscode.Range)
      )
    )
  }

  async searchWorkspace(
    options: SearchOptions
  ): Promise<Map<vscode.Uri, ExcerptInfo[]>> {
    const results = new Map<vscode.Uri, ExcerptInfo[]>()
    const workspaceAny = vscode.workspace as any

    if (typeof workspaceAny.findTextInFiles === 'function') {
      const searchPattern = this.createSearchPattern(options)
      const matches: TextSearchMatchLike[] = []

      try {
        await workspaceAny.findTextInFiles(
          searchPattern,
          {
            include: options.includePattern || '**/*',
            exclude: options.excludePattern,
            useIgnoreFiles: true,
            maxResults: options.maxResults
          },
          (result: any) => {
            if (this.isTextSearchMatch(result)) {
              matches.push(result)
            }
          }
        )
      } catch (err) {
        // Fall back if proposed API is not enabled or any error occurs
        return await this.searchWorkspaceFallback(options)
      }

      const matchesByFile = new Map<string, TextSearchMatchLike[]>()
      for (const match of matches) {
        const key = match.uri.toString()
        let fileMatches = matchesByFile.get(key)
        if (!fileMatches) {
          fileMatches = []
          matchesByFile.set(key, fileMatches)
        }
        fileMatches.push(match)
      }

      for (const [uriString, fileMatches] of matchesByFile) {
        const uri = vscode.Uri.parse(uriString)
        const { contextBefore, contextAfter } = getContextValues(options)
        const excerpts = await this.createExcerptsForFile(
          uri,
          fileMatches,
          contextBefore,
          contextAfter
        )
        if (excerpts.length > 0) {
          results.set(uri, excerpts)
        }
      }

      return results
    }

    // Fallback when findTextInFiles is not available (stable API)
    return await this.searchWorkspaceFallback(options)
  }

  private async searchWorkspaceFallback(
    options: SearchOptions
  ): Promise<Map<vscode.Uri, ExcerptInfo[]>> {
    const include = options.includePattern || '**/*'
    const exclude = options.excludePattern
    const uris = await vscode.workspace.findFiles(include, exclude)

    const results = new Map<vscode.Uri, ExcerptInfo[]>()
    const { contextBefore, contextAfter } = getContextValues(options)

    let globalCount = 0
    const maxResults = options.maxResults ?? Number.MAX_SAFE_INTEGER

    for (const uri of uris) {
      if (globalCount >= maxResults) break
      try {
        const document = await vscode.workspace.openTextDocument(uri)
        const ranges = this.findMatchesInDocument(document, options, maxResults - globalCount)
        globalCount += ranges.length
        if (ranges.length > 0) {
          const matches: TextSearchMatchLike[] = ranges.map(r => ({ uri, range: r }))
          const excerpts = await this.createExcerptsForFile(
            uri,
            matches,
            contextBefore,
            contextAfter
          )
          if (excerpts.length > 0) {
            results.set(uri, excerpts)
          }
        }
      } catch {
        // Ignore unreadable files
      }
    }

    return results
  }

  private findMatchesInDocument(
    document: vscode.TextDocument,
    options: SearchOptions,
    remaining: number
  ): vscode.Range[] {
    const ranges: vscode.Range[] = []
    const pattern = options.query
    const isRegex = !!options.isRegex
    const isCaseSensitive = !!options.isCaseSensitive
    const wholeWord = !!options.matchWholeWord

    const wordChar = (ch: string) => /[A-Za-z0-9_]/.test(ch)
    const isWordBoundary = (text: string, start: number, length: number) => {
      const b = start === 0 || !wordChar(text[start - 1])
      const a = start + length >= text.length || !wordChar(text[start + length])
      return b && a
    }

    const regex = isRegex
      ? new RegExp(pattern, isCaseSensitive ? 'g' : 'gi')
      : null

    for (let lineNum = 0; lineNum < document.lineCount && ranges.length < remaining; lineNum++) {
      const line = document.lineAt(lineNum)
      const text = line.text
      if (isRegex && regex) {
        let m: RegExpExecArray | null
        regex.lastIndex = 0
        while ((m = regex.exec(text)) && ranges.length < remaining) {
          if (!wholeWord || isWordBoundary(text, m.index, m[0].length)) {
            const start = new vscode.Position(lineNum, m.index)
            const end = new vscode.Position(lineNum, m.index + m[0].length)
            ranges.push(new vscode.Range(start, end))
          }
          if (m.index === regex.lastIndex) regex.lastIndex++ // avoid zero-length loops
        }
      } else {
        const haystack = isCaseSensitive ? text : text.toLowerCase()
        const needle = isCaseSensitive ? pattern : pattern.toLowerCase()
        let idx = 0
        while ((idx = haystack.indexOf(needle, idx)) !== -1 && ranges.length < remaining) {
          if (!wholeWord || isWordBoundary(text, idx, needle.length)) {
            const start = new vscode.Position(lineNum, idx)
            const end = new vscode.Position(lineNum, idx + needle.length)
            ranges.push(new vscode.Range(start, end))
          }
          idx += Math.max(1, needle.length)
        }
      }
    }
    return ranges
  }

  protected createSearchPattern(
    options: SearchOptions
  ): TextSearchQueryLike {
    if (options.isRegex) {
      return {
        pattern: options.query,
        isRegExp: true,
        isCaseSensitive: options.isCaseSensitive,
        isWordMatch: false
      }
    }
    return {
      pattern: options.query,
      isRegExp: false,
      isCaseSensitive: options.isCaseSensitive,
      isWordMatch: options.matchWholeWord
    }
  }

  /**
   * Extracts the primary range from a TextSearchMatch.
   * TextSearchMatch can have either:
   * - ranges: Array of Range objects (for matches with multiple selections)
   * - range: Single Range object (for simple matches)
   */
  private getPrimaryRange(match: TextSearchMatchLike): vscode.Range {
    // Prefer ranges array if it exists and has elements
    if (match.ranges && Array.isArray(match.ranges) && match.ranges.length > 0) {
      return match.ranges[0]
    }
    // Fall back to single range property
    if (match.range) {
      return match.range
    }
    // This should not happen with valid TextSearchMatch objects
    throw new Error('TextSearchMatch has neither ranges nor range property')
  }

  protected async createExcerptsForFile(
    uri: vscode.Uri,
    matches: TextSearchMatchLike[],
    contextBefore: number,
    contextAfter: number
  ): Promise<ExcerptInfo[]> {
    const document = await vscode.workspace.openTextDocument(uri)
    const excerpts: ExcerptInfo[] = []

    // Sort matches by line number for consistent output
    matches.sort((a, b) => {
      const aRange = this.getPrimaryRange(a)
      const bRange = this.getPrimaryRange(b)
      return aRange.start.line - bRange.start.line
    })

    // Extract primary ranges from all matches
    const primaryRanges = matches.map(match => this.getPrimaryRange(match))
    
    const mergedRanges = this.mergeOverlappingRanges(
      primaryRanges,
      contextBefore,
      contextAfter,
      document
    )

    for (const range of mergedRanges) {
      const excerpt = new Excerpt(
        Excerpt.generateId(),
        uri,
        document,
        range,
        SearchService.PLACEHOLDER_RANGE, // Temporary placeholder - will be updated by formatter
        contextBefore,
        contextAfter,
        true,
        document.getText(range)
      )
      excerpts.push(excerpt)
    }

    return excerpts
  }

  protected mergeOverlappingRanges(
    ranges: vscode.Range[],
    contextBefore: number,
    contextAfter: number,
    document: vscode.TextDocument
  ): vscode.Range[] {
    if (ranges.length === 0) return []

    const merged: vscode.Range[] = []
    let current = this.expandRange(ranges[0], contextBefore, contextAfter, document)

    for (let i = 1; i < ranges.length; i++) {
      const expanded = this.expandRange(ranges[i], contextBefore, contextAfter, document)
      if (current.end.line >= expanded.start.line - 1) {
        current = new vscode.Range(current.start, expanded.end)
      } else {
        merged.push(current)
        current = expanded
      }
    }

    merged.push(current)
    return merged
  }

  protected expandRange(
    range: vscode.Range,
    contextBefore: number,
    contextAfter: number,
    document: vscode.TextDocument
  ): vscode.Range {
    const startLine = Math.max(0, range.start.line - contextBefore)
    const endLine = Math.min(document.lineCount - 1, range.end.line + contextAfter)
    return new vscode.Range(
      new vscode.Position(startLine, 0),
      document.lineAt(endLine).range.end
    )
  }
}
