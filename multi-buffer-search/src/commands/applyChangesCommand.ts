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
          cancellable: true
        },
        async (progress, token) => {
          let appliedSuccessfully = false
          
          try {
            // Check for cancellation before starting
            if (token.isCancellationRequested) {
              vscode.window.showWarningMessage('Operation cancelled')
              return
            }
            
            // Monitor cancellation during the operation
            const cancellationPromise = new Promise<void>((_, reject) => {
              token.onCancellationRequested(() => {
                reject(new Error('Operation cancelled by user'))
              })
            })
            
            // Apply changes with cancellation support
            await Promise.race([
              changeTracker.applyChanges(changes),
              cancellationPromise
            ])
            
            appliedSuccessfully = true
            
            // Try to close the editor after successful application
            try {
              await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
            } catch (closeError) {
              // Log error but don't fail the operation since changes were applied
              console.warn('Failed to close editor:', closeError)
            }
            
            vscode.window.showInformationMessage(
              `Successfully applied ${changeCount} changes to ${fileCount} files`
            )
          } catch (error) {
            // Handle errors during change application
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            
            if (errorMessage === 'Operation cancelled by user') {
              vscode.window.showWarningMessage('Changes cancelled. No files were modified.')
            } else {
              // Show detailed error message
              vscode.window.showErrorMessage(
                `Failed to apply changes: ${errorMessage}. Some files may have been partially modified.`
              )
              
              // Try to refresh the editor to show current state
              try {
                await vscode.commands.executeCommand('workbench.action.files.revert')
              } catch (revertError) {
                console.error('Failed to refresh editor:', revertError)
              }
            }
            
            // Re-throw to be caught by outer try-catch
            throw error
          }
        }
      )
    } catch (error) {
      // Error already handled and displayed in the progress callback
      // Just log it for debugging
      console.error('Apply changes operation failed:', error)
    }
  }
}
