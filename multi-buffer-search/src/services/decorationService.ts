/**
 * # Decoration Service
 *
 * Handles editor decorations for multi-buffer documents.
 *
 * Author: Unknown
 * Update: Initial version
 */

import * as vscode from 'vscode'
import { MultiBufferMapping, SearchOptions } from '../models/types'

export class DecorationService {
  private fileHeaderDecoration: vscode.TextEditorDecorationType
  private matchLineDecoration: vscode.TextEditorDecorationType
  private matchTextDecoration: vscode.TextEditorDecorationType
  private contextLineDecoration: vscode.TextEditorDecorationType
  private lineNumberDecoration: vscode.TextEditorDecorationType
  // Line format: 6 chars for line number + 1 space + 2 chars for prefix = 9 total
  private static readonly CONTENT_START_INDEX = 9

  constructor() {
    this.fileHeaderDecoration = vscode.window.createTextEditorDecorationType({
      fontWeight: 'bold',
      overviewRulerColor: new vscode.ThemeColor(
        'editorOverviewRuler.findMatchForeground'
      ),
      overviewRulerLane: vscode.OverviewRulerLane.Full,
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor(
        'editor.findMatchHighlightBackground'
      ),
      opacity: '0.3'
    })
    this.matchLineDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
      isWholeLine: true,
      overviewRulerColor: new vscode.ThemeColor(
        'editorOverviewRuler.addedForeground'
      ),
      overviewRulerLane: vscode.OverviewRulerLane.Left
    })
    this.matchTextDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
      border: '1px solid',
      borderColor: new vscode.ThemeColor('editor.findMatchHighlightBorder')
    })
    this.contextLineDecoration = vscode.window.createTextEditorDecorationType({
      opacity: '0.7',
      isWholeLine: true
    })
    this.lineNumberDecoration = vscode.window.createTextEditorDecorationType({
      before: {
        color: new vscode.ThemeColor('editorLineNumber.foreground'),
        fontStyle: 'normal',
        fontWeight: 'normal'
      }
    })
  }

  applyDecorations(
    editor: vscode.TextEditor,
    mapping: MultiBufferMapping,
    searchOptions: SearchOptions
  ): void {
    const fileHeaderRanges: vscode.Range[] = []
    const matchLineRanges: vscode.Range[] = []
    const matchTextRanges: vscode.DecorationOptions[] = []
    const contextLineRanges: vscode.Range[] = []
    const document = editor.document

    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const line = document.lineAt(lineNum)
      const lineText = line.text
      if (lineText.startsWith('=== ')) {
        fileHeaderRanges.push(line.range)
        continue
      }
      const excerpt = mapping.lineToExcerpt.get(lineNum)
      if (excerpt) {
        if (excerpt.isMatch) {
          matchLineRanges.push(line.range)
          const matchRanges = this.findMatchesInLine(
            line,
            searchOptions.query,
            searchOptions.isRegex,
            searchOptions.isCaseSensitive
          )
          matchTextRanges.push(...matchRanges)
        } else {
          contextLineRanges.push(line.range)
        }
      }
    }

    editor.setDecorations(this.fileHeaderDecoration, fileHeaderRanges)
    editor.setDecorations(this.matchLineDecoration, matchLineRanges)
    editor.setDecorations(this.matchTextDecoration, matchTextRanges)
    editor.setDecorations(this.contextLineDecoration, contextLineRanges)
  }

  private findMatchesInLine(
    line: vscode.TextLine,
    query: string,
    isRegex: boolean,
    isCaseSensitive: boolean
  ): vscode.DecorationOptions[] {
    const decorations: vscode.DecorationOptions[] = []
    const lineText = line.text
    
    // Dynamically calculate content start based on actual format
    // First, skip the line number and space (7 chars), then find where content begins after prefix
    let contentStart = DecorationService.CONTENT_START_INDEX
    if (lineText.length >= 7) {
      // Look for content after the line number and prefix pattern
      const afterLineNum = lineText.substring(7)
      const prefixMatch = afterLineNum.match(/^(\s{2}|\s\s)/)
      if (prefixMatch) {
        contentStart = 7 + prefixMatch[0].length
      }
    }
    contentStart = Math.min(contentStart, lineText.length)
    const content = lineText.substring(contentStart)

    if (isRegex) {
      try {
        const flags = isCaseSensitive ? 'g' : 'gi'
        const regex = new RegExp(query, flags)
        let match
        while ((match = regex.exec(content)) !== null) {
          const startPos = new vscode.Position(
            line.lineNumber,
            contentStart + match.index
          )
          const endPos = new vscode.Position(
            line.lineNumber,
            contentStart + match.index + match[0].length
          )
          decorations.push({ range: new vscode.Range(startPos, endPos) })
        }
      } catch (error) {
        // Invalid regex pattern - return empty decorations
        console.warn(`Invalid regex pattern: ${query}`, error)
        return decorations
      }
    } else {
      // Use locale-aware comparison for case-insensitive matching
      if (isCaseSensitive) {
        let index = 0
        while ((index = content.indexOf(query, index)) !== -1) {
          const startPos = new vscode.Position(
            line.lineNumber,
            contentStart + index
          )
          const endPos = new vscode.Position(
            line.lineNumber,
            contentStart + index + query.length
          )
          decorations.push({ range: new vscode.Range(startPos, endPos) })
          index += query.length
        }
      } else {
        // Use locale-aware case-insensitive search
        const collator = new Intl.Collator(undefined, { sensitivity: 'base' })
        const queryLen = query.length
        
        for (let i = 0; i <= content.length - queryLen; i++) {
          const substring = content.substring(i, i + queryLen)
          if (collator.compare(substring, query) === 0) {
            const startPos = new vscode.Position(
              line.lineNumber,
              contentStart + i
            )
            const endPos = new vscode.Position(
              line.lineNumber,
              contentStart + i + queryLen
            )
            decorations.push({ range: new vscode.Range(startPos, endPos) })
            // Skip past this match
            i += queryLen - 1
          }
        }
      }
    }

    return decorations
  }

  dispose(): void {
    this.fileHeaderDecoration.dispose()
    this.matchLineDecoration.dispose()
    this.matchTextDecoration.dispose()
    this.contextLineDecoration.dispose()
    this.lineNumberDecoration.dispose()
  }
}
