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
  // Line format: 6 chars for line number + 1 space + 2 chars for prefix = 9 total
  private static readonly CONTENT_START_INDEX = 9

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
    const contentStart = Math.min(ChangeTracker.CONTENT_START_INDEX, lineText.length)
    return lineText.substring(contentStart).trim()
  }

  async applyChanges(changes: Map<string, FileChange>): Promise<void> {
    const edit = new vscode.WorkspaceEdit()
    const documentCache = new Map<string, vscode.TextDocument>()
    
    // First pass: build edits and cache documents
    for (const [, fileChange] of changes) {
      let document: vscode.TextDocument
      try {
        document = await vscode.workspace.openTextDocument(fileChange.uri)
        documentCache.set(fileChange.uri.toString(), document)
      } catch (error) {
        throw new Error(`Failed to open document ${fileChange.uri.fsPath}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      
      for (const change of fileChange.changes) {
        try {
          const originalLine = document.lineAt(change.range.start.line)
          const leadingWhitespace = originalLine.text.match(/^\s*/)?.[0] || ''
          edit.replace(
            fileChange.uri,
            originalLine.range,
            leadingWhitespace + change.newText
          )
        } catch (error) {
          throw new Error(`Failed to prepare edit for ${fileChange.uri.fsPath} at line ${change.range.start.line + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }
    
    // Apply all edits
    const success = await vscode.workspace.applyEdit(edit)
    if (!success) {
      const fileList = Array.from(changes.values()).map(fc => fc.uri.fsPath).join(', ')
      throw new Error(`Failed to apply changes to workspace. Affected files: ${fileList}`)
    }
    
    // Save all modified documents using cached references
    const savedFiles = new Set<string>()
    for (const [, fileChange] of changes) {
      const fileKey = fileChange.uri.toString()
      if (!savedFiles.has(fileKey)) {
        const document = documentCache.get(fileKey)
        if (document) {
          try {
            await document.save()
            savedFiles.add(fileKey)
          } catch (error) {
            throw new Error(`Failed to save document ${fileChange.uri.fsPath}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }
      }
    }
  }
}
