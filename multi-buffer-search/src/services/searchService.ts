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

export class SearchService {
  private static readonly DEFAULT_CONTEXT_LINES = 2
  
  /**
   * Placeholder range used temporarily when creating excerpts.
   * This will be replaced with actual multi-buffer coordinates by the formatter.
   */
  private static readonly PLACEHOLDER_RANGE = new vscode.Range(0, 0, 0, 0)

  /**
   * Type guard to check if a result is a TextSearchMatch
   */
  private isTextSearchMatch(result: any): result is vscode.TextSearchMatch {
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
    const searchPattern = this.createSearchPattern(options)
    const matches: vscode.TextSearchMatch[] = []

    await vscode.workspace.findTextInFiles(
      searchPattern,
      {
        include: options.includePattern || '**/*',
        exclude: options.excludePattern,
        useIgnoreFiles: true,
        maxResults: options.maxResults
      },
      (result: vscode.TextSearchResult) => {
        if (this.isTextSearchMatch(result)) {
          matches.push(result)
        }
      }
    )

    const matchesByFile = new Map<string, vscode.TextSearchMatch[]>()
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

  protected createSearchPattern(
    options: SearchOptions
  ): vscode.TextSearchQuery {
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
  private getPrimaryRange(match: vscode.TextSearchMatch): vscode.Range {
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
    matches: vscode.TextSearchMatch[],
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
      document.lineCount
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
    maxLine: number
  ): vscode.Range[] {
    if (ranges.length === 0) return []

    const merged: vscode.Range[] = []
    let current = this.expandRange(ranges[0], contextBefore, contextAfter, maxLine)

    for (let i = 1; i < ranges.length; i++) {
      const expanded = this.expandRange(ranges[i], contextBefore, contextAfter, maxLine)
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
    maxLine: number
  ): vscode.Range {
    const startLine = Math.max(0, range.start.line - contextBefore)
    const endLine = Math.min(maxLine - 1, range.end.line + contextAfter)
    return new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(endLine, Number.MAX_SAFE_INTEGER)
    )
  }
}
