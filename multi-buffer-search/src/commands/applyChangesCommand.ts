/**
 * # Apply Changes Command
 *
 * Applies tracked changes back to source files.
 *
 * Author: Unknown
 * Update: Initial version
 */

import * as vscode from 'vscode'
import { MultiBufferProvider } from '../multiBufferProvider'

export class ApplyChangesCommand {
  constructor(private multiBufferProvider: MultiBufferProvider) {}

  async execute(): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor) return
    const document = editor.document
    if (document.uri.scheme !== 'multibuffer') return
    try {
      const multiBufferDoc = this.multiBufferProvider.getDocument(document.uri)
      if (!multiBufferDoc) {
        vscode.window.showErrorMessage('Multi-buffer document not found')
        return
      }
      const changeTracker = this.multiBufferProvider.getChangeTracker(
        document.uri
      )
      if (!changeTracker) {
        vscode.window.showErrorMessage('Change tracker not initialized')
        return
      }
      const changes = changeTracker.computeChanges(document, multiBufferDoc.mapping)
      if (changes.size === 0) {
        vscode.window.showInformationMessage('No changes to apply')
        return
      }
      const fileCount = changes.size
      const changeCount = Array.from(changes.values()).reduce(
        (sum, fc) => sum + fc.changes.length,
        0
      )
      const result = await vscode.window.showInformationMessage(
        `Apply ${changeCount} changes to ${fileCount} files?`,
        'Yes',
        'No'
      )
      if (result !== 'Yes') return
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Applying changes...',
          cancellable: false
        },
        async () => {
          await changeTracker.applyChanges(changes)
          try {
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
          } catch (error) {
            // Log error but don't fail the operation
            console.warn('Failed to close editor:', error)
          }
          vscode.window.showInformationMessage(
            `Successfully applied ${changeCount} changes to ${fileCount} files`
          )
        }
      )
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to apply changes: ${error}`)
    }
  }
}
