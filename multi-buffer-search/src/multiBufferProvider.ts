/**
 * # Multi-Buffer Provider
 *
 * Provides in-memory documents for the multi-buffer scheme.
 *
 * Author: Unknown
 * Update: Initial version
 */

import * as vscode from 'vscode'
import { MultiBufferDocument } from './models/types'
import { ChangeTracker } from './services/changeTracker'

export class MultiBufferProvider implements vscode.TextDocumentContentProvider {
  private documents = new Map<string, MultiBufferDocument>()
  private changeTrackers = new Map<string, ChangeTracker>()
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>()
  readonly onDidChange = this._onDidChange.event

  provideTextDocumentContent(uri: vscode.Uri): string {
    const doc = this.documents.get(uri.toString())
    return doc?.content || ''
  }

  addDocument(doc: MultiBufferDocument): void {
    this.documents.set(doc.uri.toString(), doc)
  }

  getDocument(uri: vscode.Uri): MultiBufferDocument | undefined {
    return this.documents.get(uri.toString())
  }

  removeDocument(uri: vscode.Uri): void {
    const key = uri.toString()
    this.documents.delete(key)
    this.changeTrackers.delete(key)
  }

  setChangeTracker(uri: vscode.Uri, tracker: ChangeTracker): void {
    this.changeTrackers.set(uri.toString(), tracker)
  }

  getChangeTracker(uri: vscode.Uri): ChangeTracker | undefined {
    return this.changeTrackers.get(uri.toString())
  }

  dispose(): void {
    this.documents.clear()
    this.changeTrackers.clear()
    this._onDidChange.dispose()
  }
}
