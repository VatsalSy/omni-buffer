/**
 * # Result Formatter
 *
 * Converts excerpts to multi-buffer text.
 *
 * Author: Unknown
 * Update: Initial version
 */

import * as vscode from 'vscode'
import {
  ExcerptInfo,
  MultiBufferMapping,
  SearchOptions,
  ReplaceOptions
} from '../models/types'

export class ResultFormatter {
  private static readonly FILE_HEADER_PREFIX = '=== '
  private static readonly MATCH_LINE_PREFIX = '  '
  private static readonly CONTEXT_LINE_PREFIX = '  '
  private static readonly LINE_NUMBER_WIDTH = 6

  formatSearchResults(
    excerptsByFile: Map<vscode.Uri, ExcerptInfo[]>,
    options: SearchOptions,
    replaceOptions?: ReplaceOptions
  ): { content: string; mapping: MultiBufferMapping } {
    const lines: string[] = []
    const mapping: MultiBufferMapping = {
      lineToExcerpt: new Map(),
      excerpts: new Map(),
      excerptsByFile: new Map()
    }
    let currentLine = 0
    lines.push(this.formatHeader(options, replaceOptions))
    lines.push('')
    currentLine += 2

    for (const [uri, excerpts] of excerptsByFile) {
      const fileHeader = this.formatFileHeader(uri)
      lines.push(fileHeader)
      lines.push('')
      currentLine += 2

      for (const excerpt of excerpts) {
        const formattedExcerpt = this.formatExcerpt(
          excerpt,
          options,
          replaceOptions
        )
        const startLine = currentLine
        lines.push(...formattedExcerpt.lines)
        lines.push('')
        
        // Handle empty lines case
        if (formattedExcerpt.lines.length > 0) {
          const lastLineIndex = formattedExcerpt.lines.length - 1
          const lastLineLength = formattedExcerpt.lines[lastLineIndex].length
          excerpt.multiBufferRange = new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(startLine + lastLineIndex, lastLineLength)
          )
        } else {
          // Set a default range for empty content
          excerpt.multiBufferRange = new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(startLine, 0)
          )
        }
        for (let i = 0; i < formattedExcerpt.matchLineIndices.length; i++) {
          const multiLine = startLine + formattedExcerpt.matchLineIndices[i]
          mapping.lineToExcerpt.set(multiLine, excerpt)
        }
        mapping.excerpts.set(excerpt.id, excerpt)
        const fileKey = uri.toString()
        if (!mapping.excerptsByFile.has(fileKey)) {
          mapping.excerptsByFile.set(fileKey, [])
        }
        const excerpts = mapping.excerptsByFile.get(fileKey)
        if (excerpts) {
          excerpts.push(excerpt)
        }
        currentLine += formattedExcerpt.lines.length + 1
      }
    }

    return { content: lines.join('\n'), mapping }
  }

  private formatHeader(
    options: SearchOptions,
    replaceOptions?: ReplaceOptions
  ): string {
    if (replaceOptions) {
      return `Multi-Buffer Replace: "${options.query}" → "${
        replaceOptions.replacement
      }"`
    }
    return `Multi-Buffer Search: "${options.query}"`
  }

  private formatFileHeader(uri: vscode.Uri): string {
    const relativePath = vscode.workspace.asRelativePath(uri)
    return `${ResultFormatter.FILE_HEADER_PREFIX}${relativePath}`
  }

  private formatExcerpt(
    excerpt: ExcerptInfo,
    options: SearchOptions,
    replaceOptions?: ReplaceOptions
  ): { lines: string[]; matchLineIndices: number[] } {
    const lines: string[] = []
    const matchLineIndices: number[] = []
    
    // Calculate context range inline since ExcerptInfo doesn't have getContextRange method
    const startLine = Math.max(0, excerpt.sourceRange.start.line - excerpt.contextBefore)
    const endLine = Math.min(
      excerpt.buffer.lineCount - 1,
      excerpt.sourceRange.end.line + excerpt.contextAfter
    )
    const contextRange = new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(endLine, excerpt.buffer.lineAt(endLine).text.length)
    )
    const document = excerpt.buffer

    for (
      let lineNum = contextRange.start.line;
      lineNum <= contextRange.end.line;
      lineNum++
    ) {
      const line = document.lineAt(lineNum)
      const lineText = line.text
      const isMatchLine =
        lineNum >= excerpt.sourceRange.start.line &&
        lineNum <= excerpt.sourceRange.end.line
      if (isMatchLine) {
        matchLineIndices.push(lines.length)
      }
      const formattedLineNum = this.formatLineNumber(lineNum + 1)
      let formattedText = lineText
      if (replaceOptions && isMatchLine) {
        formattedText = this.applyReplacement(
          lineText,
          options,
          replaceOptions
        )
      }
      const prefix = isMatchLine
        ? ResultFormatter.MATCH_LINE_PREFIX
        : ResultFormatter.CONTEXT_LINE_PREFIX
      lines.push(`${formattedLineNum}${prefix}${formattedText}`)
    }

    return { lines, matchLineIndices }
  }

  private formatLineNumber(lineNum: number): string {
    return `${lineNum.toString().padStart(ResultFormatter.LINE_NUMBER_WIDTH, ' ')} `
  }

  private applyReplacement(
    text: string,
    searchOptions: SearchOptions,
    replaceOptions: ReplaceOptions
  ): string {
    if (searchOptions.isRegex) {
      const flags = searchOptions.isCaseSensitive ? 'g' : 'gi'
      const regex = new RegExp(searchOptions.query, flags)
      return text.replace(regex, replaceOptions.replacement)
    }
    const searchStr = searchOptions.query
    const replaceStr = replaceOptions.replacement
    if (searchOptions.isCaseSensitive) {
      return text.split(searchStr).join(replaceStr)
    }
    const regex = new RegExp(
      searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'gi'
    )
    return text.replace(regex, replaceStr)
  }
}
