/**
 * # Search Command
 *
 * Executes workspace search and opens results.
 *
 * Author: Unknown
 * Update: Initial version
 */

import * as vscode from 'vscode'
import { SearchService } from '../services/searchService'
import { ResultFormatter } from '../services/resultFormatter'
import { DecorationService } from '../services/decorationService'
import { ChangeTracker } from '../services/changeTracker'
import { SearchOptions, MultiBufferDocument } from '../models/types'
import { MultiBufferProvider } from '../multiBufferProvider'

export class SearchCommand {
  constructor(
    private searchService: SearchService,
    private formatter: ResultFormatter,
    private decorationService: DecorationService,
    private multiBufferProvider: MultiBufferProvider
  ) {}

  async execute(): Promise<void> {
    try {
      const options = await this.getSearchOptions()
      if (!options) return
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Searching workspace...',
          cancellable: true
        },
        async (progress, token) => {
          const results = await this.searchService.searchWorkspace(options)
          if (token.isCancellationRequested) return
          if (results.size === 0) {
            vscode.window.showInformationMessage('No results found')
            return
          }
          const { content, mapping } =
            this.formatter.formatSearchResults(results, options)
          const multiBufferDoc: MultiBufferDocument = {
            content,
            mapping,
            searchOptions: options,
            uri: vscode.Uri.parse(
              `multibuffer:search-${Date.now()}.multibuffer`
            )
          }
          this.multiBufferProvider.addDocument(multiBufferDoc)
          const document = await vscode.workspace.openTextDocument(
            multiBufferDoc.uri
          )
          const editor = await vscode.window.showTextDocument(document, {
            preview: false,
            preserveFocus: false
          })
          const changeTracker = new ChangeTracker()
          changeTracker.initialize(document, mapping)
          this.multiBufferProvider.setChangeTracker(
            multiBufferDoc.uri,
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
            `Found ${matchCount} matches in ${fileCount} files`
          )
        }
      )
    } catch (error) {
      vscode.window.showErrorMessage(`Search failed: ${error}`)
    }
  }

  private async getSearchOptions(): Promise<SearchOptions | undefined> {
    const quickPickItems = [
      { label: 'Case Sensitive', picked: false, flag: 'caseSensitive' },
      { label: 'Regular Expression', picked: false, flag: 'regex' },
      { label: 'Whole Word', picked: false, flag: 'wholeWord' }
    ]
    const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
      canPickMany: true,
      placeHolder: 'Select search options'
    })
    const flags =
      selectedItems?.reduce((acc, item) => {
        acc[item.flag] = true
        return acc
      }, {} as any) || {}
    
    const query = await vscode.window.showInputBox({
      prompt: 'Search query',
      placeHolder: 'Enter search text or regex',
      validateInput: value => {
        if (!value.trim()) return 'Search query cannot be empty'
        
        // Validate regex syntax if regex option is selected
        if (flags.regex) {
          try {
            new RegExp(value)
          } catch (error) {
            return `Invalid regular expression: ${error.message}`
          }
        }
        
        return undefined
      }
    })
    if (!query) return undefined
    
    // Get context lines from configuration
    const config = vscode.workspace.getConfiguration('multiBufferSearch')
    const contextLines = config.get<number>('contextLines', 2)
    const contextBefore = config.get<number>('contextBefore')
    const contextAfter = config.get<number>('contextAfter')
    
    return {
      query,
      isRegex: flags.regex || false,
      isCaseSensitive: flags.caseSensitive || false,
      matchWholeWord: flags.wholeWord || false,
      contextBefore,
      contextAfter,
      contextLines  // Keep for backward compatibility
    }
  }
}
