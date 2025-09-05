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
import { IncrementalSearchService } from '../services/incrementalSearchService'
import { ResultFormatter } from '../services/resultFormatter'
import { DecorationService } from '../services/decorationService'
import { ChangeTracker } from '../services/changeTracker'
import { SearchOptions, OmniBufferDocument } from '../models/types'
import { OmniBufferProvider } from '../omniBufferProvider'

export class SearchCommand {
  constructor(
    private searchService: SearchService,
    private formatter: ResultFormatter,
    private decorationService: DecorationService,
    private omniBufferProvider: OmniBufferProvider
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
          // Use incremental search if the service supports it
          const results = this.searchService instanceof IncrementalSearchService
            ? (await this.searchService.searchWorkspaceIncremental(options)).all
            : await this.searchService.searchWorkspace(options)
          
          if (token.isCancellationRequested) return
          if (results.size === 0) {
            vscode.window.showInformationMessage('No results found')
            return
          }
          const { content, mapping } =
            this.formatter.formatSearchResults(results, options)
          const omniBufferDoc: OmniBufferDocument = {
            content,
            mapping,
            searchOptions: options,
            uri: vscode.Uri.parse(
              `omnibuffer:search-${Date.now()}.omnibuffer`
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
            `Found ${matchCount} matches in ${fileCount} files`
          )
        }
      )
    } catch (error) {
      vscode.window.showErrorMessage(`Search failed: ${error}`)
    }
  }

  private async getSearchOptions(): Promise<SearchOptions | undefined> {
    const quickPickItems: Array<{ label: string; picked: boolean; flag: string }> = [
      { label: 'Case Sensitive', picked: false, flag: 'caseSensitive' },
      { label: 'Regular Expression', picked: false, flag: 'regex' },
      { label: 'Whole Word', picked: false, flag: 'wholeWord' }
    ]
    const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
      canPickMany: true,
      placeHolder: 'Select search options'
    })
    const flags: Record<string, boolean> =
      selectedItems?.reduce((acc, item) => {
        acc[item.flag] = true
        return acc
      }, {} as Record<string, boolean>) || {}
    
    const query = await vscode.window.showInputBox({
      prompt: 'Search query',
      placeHolder: 'Enter search text or regex',
      validateInput: (value: string) => {
        if (!value.trim()) return 'Search query cannot be empty'
        
        // Validate regex syntax if regex option is selected
        if (flags.regex) {
          try {
            new RegExp(value)
          } catch (error) {
            return `Invalid regular expression: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
        
        return undefined
      }
    })
    if (!query) return undefined
    
    // Get context lines from configuration
    const config = vscode.workspace.getConfiguration('omniBuffer')
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
