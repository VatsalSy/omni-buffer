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
import * as nodeCrypto from 'crypto'

export class Excerpt implements ExcerptInfo {
  private static idCounter = 0;
  
  constructor(
    public id: string,
    public fileUri: vscode.Uri,
    public buffer: vscode.TextDocument,
    public sourceRange: vscode.Range,
    public omniBufferRange: vscode.Range,
    public contextBefore: number,
    public contextAfter: number,
    public isMatch: boolean,
    public originalText: string
  ) {
    // Validate required string fields
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Excerpt id must be a non-empty string')
    }
    if (!originalText || typeof originalText !== 'string') {
      throw new Error('Excerpt originalText must be a string')
    }
    
    // Validate URI and document
    if (!fileUri || !(fileUri instanceof vscode.Uri)) {
      throw new Error('Excerpt fileUri must be a valid vscode.Uri')
    }
    if (!buffer || !buffer.uri) {
      throw new Error('Excerpt buffer must be a valid vscode.TextDocument')
    }
    
    // Validate ranges
    if (!sourceRange || !(sourceRange instanceof vscode.Range)) {
      throw new Error('Excerpt sourceRange must be a valid vscode.Range')
    }
    if (!omniBufferRange || !(omniBufferRange instanceof vscode.Range)) {
      throw new Error('Excerpt omniBufferRange must be a valid vscode.Range')
    }
    
    // Validate that sourceRange is within document bounds
    if (sourceRange.start.line < 0 || sourceRange.end.line >= buffer.lineCount) {
      throw new Error(`Excerpt sourceRange (${sourceRange.start.line}-${sourceRange.end.line}) is out of document bounds (0-${buffer.lineCount - 1})`)
    }
    
    // Validate context values
    if (typeof contextBefore !== 'number' || contextBefore < 0 || !Number.isInteger(contextBefore)) {
      throw new Error('Excerpt contextBefore must be a non-negative integer')
    }
    if (typeof contextAfter !== 'number' || contextAfter < 0 || !Number.isInteger(contextAfter)) {
      throw new Error('Excerpt contextAfter must be a non-negative integer')
    }
    
    // Validate boolean
    if (typeof isMatch !== 'boolean') {
      throw new Error('Excerpt isMatch must be a boolean')
    }
  }

  static generateId(): string {
    // Increment counter for uniqueness in rapid calls
    this.idCounter = (this.idCounter + 1) % 1000000

    // High-resolution timestamp component
    const hrTime = typeof process !== 'undefined' && (process as any).hrtime && (process as any).hrtime.bigint
      ? (process as any).hrtime.bigint().toString()
      : Date.now().toString()

    // Cryptographically secure random bytes via Node's crypto
    let randomStr: string
    try {
      randomStr = nodeCrypto.randomBytes(12).toString('hex')
    } catch {
      // Fallback if crypto fails
      randomStr = Math.random().toString(36).slice(2, 11)
    }

    return `excerpt_${hrTime}_${this.idCounter}_${randomStr}`
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
