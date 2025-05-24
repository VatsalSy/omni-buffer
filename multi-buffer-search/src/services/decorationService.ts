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
    const contentStart = lineText.search(/\S/) + 8
    const content = lineText.substring(contentStart)

    if (isRegex) {
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
    } else {
      const searchStr = isCaseSensitive ? query : query.toLowerCase()
      const searchContent = isCaseSensitive ? content : content.toLowerCase()
      let index = 0
      while ((index = searchContent.indexOf(searchStr, index)) !== -1) {
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
