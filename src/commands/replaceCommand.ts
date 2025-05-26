/**
 * # Replace Command
 *
 * Performs search and prepare replacements.
 *
 * Author: Unknown
 * Update: Initial version
 */

import * as vscode from 'vscode'
import { SearchService } from '../services/searchService'
import { ResultFormatter } from '../services/resultFormatter'
import { DecorationService } from '../services/decorationService'
import { ChangeTracker } from '../services/changeTracker'
import { ReplaceOptions, OmniBufferDocument } from '../models/types'
import { OmniBufferProvider } from '../omniBufferProvider'

interface SearchFlags {
  caseSensitive?: boolean
  regex?: boolean
  wholeWord?: boolean
}

interface QuickPickFlag extends vscode.QuickPickItem {
  flag: keyof SearchFlags
}

export class ReplaceCommand {
  constructor(
    private readonly searchService: SearchService,
    private readonly formatter: ResultFormatter,
    private readonly decorationService: DecorationService,
    private readonly omniBufferProvider: OmniBufferProvider
  ) {}
  async execute(): Promise<void> {
    try {
      const options = await this.getReplaceOptions()
      if (!options) return
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Searching and preparing replacements...',
          cancellable: true
        },
        async (progress, token) => {
          const results = await this.searchService.searchWorkspace(options)
          if (token.isCancellationRequested) return
          if (results.size === 0) {
            vscode.window.showInformationMessage('No results found')
            return
          }
          const { content, mapping } = this.formatter.formatSearchResults(
            results,
            options,
            options as ReplaceOptions
          )
          const omniBufferDoc: OmniBufferDocument = {
            content,
            mapping,
            searchOptions: options,
            replaceOptions: options as ReplaceOptions,
            uri: vscode.Uri.parse(
              `omnibuffer:replace-${Date.now()}.omnibuffer`
            )
          }
          this.omniBufferProvider.addDocument(omniBufferDoc)
          const document = await vscode.workspace.openTextDocument(
            omniBufferDoc.uri
          )
          const editor = await vscode.window.showTextDocument(document, {
            preview: false,
            preserveFocus: false
          })
          const changeTracker = new ChangeTracker()
          changeTracker.initialize(document, mapping)
          this.omniBufferProvider.setChangeTracker(
            omniBufferDoc.uri,
            changeTracker
          )
          this.decorationService.applyDecorations(
            editor,
            mapping,
            options
          )
          const fileCount = results.size
          const matchCount = Array.from(results.values()).reduce(
            (sum, excerpts) => sum + excerpts.length,
            0
          )
          vscode.window.showInformationMessage(
            `Ready to replace ${matchCount} matches in ${fileCount} files. Review changes and press Ctrl+S to apply.`
          )
        }
      )
    } catch (error) {
      vscode.window.showErrorMessage(`Replace operation failed: ${error}`)
    }
  }

  private async getReplaceOptions(): Promise<ReplaceOptions | undefined> {
    const query = await vscode.window.showInputBox({
      prompt: 'Search query',
      placeHolder: 'Enter search text or regex'
    })
    if (!query) return undefined
    const replacement = await vscode.window.showInputBox({
      prompt: 'Replace with',
      placeHolder: 'Enter replacement text'
    })
    if (replacement === undefined) return undefined
    const quickPickItems: QuickPickFlag[] = [
      { label: 'Case Sensitive', picked: false, flag: 'caseSensitive' },
      { label: 'Regular Expression', picked: false, flag: 'regex' },
      { label: 'Whole Word', picked: false, flag: 'wholeWord' }
    ]
    const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
      canPickMany: true,
      placeHolder: 'Select search options'
    })
    const flags: SearchFlags = selectedItems?.reduce<SearchFlags>((acc, item) => {
      acc[item.flag] = true
      return acc
    }, {}) || {}
    // Get context configuration
    const config = vscode.workspace.getConfiguration('omniBuffer')
    const contextLines = config.get<number>('contextLines', 2)
    const contextBefore = config.get<number>('contextBefore')
    const contextAfter = config.get<number>('contextAfter')
    
    return {
      query,
      replacement,
      isRegex: flags.regex || false,
      isCaseSensitive: flags.caseSensitive || false,
      matchWholeWord: flags.wholeWord || false,
      contextBefore,
      contextAfter,
      contextLines  // Keep for backward compatibility
    }
  }
}

