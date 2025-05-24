/**
 * # Search Service
 *
 * Provides workspace search capabilities.
 *
 * Author: Unknown
 * Update: Initial version
 *
 * TODO: Add support for incremental updates.
 */

import * as vscode from 'vscode'
import { SearchOptions, ExcerptInfo, getContextValues } from '../models/types'
import { Excerpt } from '../models/excerpt'

export class SearchService {
  private static readonly DEFAULT_CONTEXT_LINES = 2

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
      result => {
        if ('matches' in result && result.matches) {
          matches.push(result as vscode.TextSearchMatch)
        }
      }
    )

    const matchesByFile = new Map<string, vscode.TextSearchMatch[]>()
    for (const match of matches) {
      const key = match.uri.toString()
      if (!matchesByFile.has(key)) {
        matchesByFile.set(key, [])
      }
      matchesByFile.get(key)!.push(match)
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

  private createSearchPattern(
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

  private async createExcerptsForFile(
    uri: vscode.Uri,
    matches: vscode.TextSearchMatch[],
    contextBefore: number,
    contextAfter: number
  ): Promise<ExcerptInfo[]> {
    const document = await vscode.workspace.openTextDocument(uri)
    const excerpts: ExcerptInfo[] = []

    matches.sort((a, b) => {
      const aLine = a.ranges[0]?.start.line || a.range.start.line
      const bLine = b.ranges[0]?.start.line || b.range.start.line
      return aLine - bLine
    })

    const mergedRanges = this.mergeOverlappingRanges(
      matches.map(m => m.ranges[0] || m.range),
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
        new vscode.Range(0, 0, 0, 0),
        contextBefore,
        contextAfter,
        true,
        document.getText(range)
      )
      excerpts.push(excerpt)
    }

    return excerpts
  }

  private mergeOverlappingRanges(
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

  private expandRange(
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
