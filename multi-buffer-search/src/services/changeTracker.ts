/**
 * # Change Tracker
 *
 * Tracks edits made to multi-buffer documents.
 *
 * Author: Unknown
 * Update: Initial version
 */

import * as vscode from 'vscode'
import { MultiBufferMapping, ExcerptInfo } from '../models/types'

export interface FileChange {
  uri: vscode.Uri
  changes: TextChange[]
}

export interface TextChange {
  range: vscode.Range
  newText: string
  originalText: string
}

export class ChangeTracker {
  private originalContent: Map<number, string> = new Map()

  initialize(document: vscode.TextDocument, mapping: MultiBufferMapping): void {
    for (const [lineNum, excerpt] of mapping.lineToExcerpt) {
      if (excerpt.isMatch) {
        const line = document.lineAt(lineNum)
        this.originalContent.set(lineNum, this.extractContent(line.text))
      }
    }
  }

  computeChanges(
    document: vscode.TextDocument,
    mapping: MultiBufferMapping
  ): Map<string, FileChange> {
    const changesByFile = new Map<string, FileChange>()

    for (const [multiLine, excerpt] of mapping.lineToExcerpt) {
      if (!excerpt.isMatch) continue
      const currentLine = document.lineAt(multiLine)
      const currentContent = this.extractContent(currentLine.text)
      const originalContent = this.originalContent.get(multiLine)
      if (originalContent !== undefined && currentContent !== originalContent) {
        const fileKey = excerpt.fileUri.toString()
        let fileChange = changesByFile.get(fileKey)
        if (!fileChange) {
          fileChange = {
            uri: excerpt.fileUri,
            changes: []
          }
          changesByFile.set(fileKey, fileChange)
        }
        const sourceLineOffset = multiLine - excerpt.multiBufferRange.start.line
        const sourceLine = excerpt.sourceRange.start.line + sourceLineOffset
        
        // Calculate the actual line length from the source document
        const lineLength = excerpt.buffer.lineAt(sourceLine).text.length
        
        fileChange.changes.push({
          range: new vscode.Range(
            new vscode.Position(sourceLine, 0),
            new vscode.Position(sourceLine, lineLength)
          ),
          newText: currentContent,
          originalText: originalContent
        })
      }
    }

    return changesByFile
  }

  private extractContent(lineText: string): string {
    const contentStart = Math.min(8, lineText.length)
    return lineText.substring(contentStart).trim()
  }

  async applyChanges(changes: Map<string, FileChange>): Promise<void> {
    const edit = new vscode.WorkspaceEdit()
    for (const [, fileChange] of changes) {
      const document = await vscode.workspace.openTextDocument(fileChange.uri)
      for (const change of fileChange.changes) {
        const originalLine = document.lineAt(change.range.start.line)
        const leadingWhitespace = originalLine.text.match(/^\s*/)?.[0] || ''
        edit.replace(
          fileChange.uri,
          originalLine.range,
          leadingWhitespace + change.newText
        )
      }
    }
    const success = await vscode.workspace.applyEdit(edit)
    if (!success) {
      throw new Error('Failed to apply changes to workspace')
    }
    const savedFiles: vscode.Uri[] = []
    for (const [, fileChange] of changes) {
      if (!savedFiles.find(u => u.toString() === fileChange.uri.toString())) {
        const document = await vscode.workspace.openTextDocument(fileChange.uri)
        await document.save()
        savedFiles.push(fileChange.uri)
      }
    }
  }
}
