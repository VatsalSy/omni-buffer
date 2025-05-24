/**
 * # Excerpt Class
 *
 * Represents a snippet extracted from a file.
 *
 * Author: Unknown
 * Update: Initial version
 */

import * as vscode from 'vscode'
import { ExcerptInfo } from './types'

export class Excerpt implements ExcerptInfo {
  constructor(
    public id: string,
    public fileUri: vscode.Uri,
    public buffer: vscode.TextDocument,
    public sourceRange: vscode.Range,
    public multiBufferRange: vscode.Range,
    public contextBefore: number,
    public contextAfter: number,
    public isMatch: boolean,
    public originalText: string
  ) {}

  static generateId(): string {
    return `excerpt_${Date.now()}_${
      Math.random().toString(36).substr(2, 9)
    }`
  }

  getContextRange(): vscode.Range {
    const startLine = Math.max(0, this.sourceRange.start.line - this.contextBefore)
    const endLine = Math.min(
      this.buffer.lineCount - 1,
      this.sourceRange.end.line + this.contextAfter
    )
    return new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(endLine, this.buffer.lineAt(endLine).text.length)
    )
  }

  getFullText(): string {
    const contextRange = this.getContextRange()
    return this.buffer.getText(contextRange)
  }
}
