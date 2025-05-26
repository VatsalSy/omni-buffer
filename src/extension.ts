/**
 * # Extension Entry
 *
 * Registers commands and manages provider lifecycle.
 *
 * Author: Unknown
 * Update: Initial version
 */

import * as vscode from 'vscode'
import { SearchCommand } from './commands/searchCommand'
import { ReplaceCommand } from './commands/replaceCommand'
import { ApplyChangesCommand } from './commands/applyChangesCommand'
import { SearchService } from './services/searchService'
import { IncrementalSearchService } from './services/incrementalSearchService'
import { ResultFormatter } from './services/resultFormatter'
import { DecorationService } from './services/decorationService'
import { OmniBufferProvider } from './omniBufferProvider'

let decorationService: DecorationService | undefined
let omniBufferProvider: OmniBufferProvider | undefined
let searchService: SearchService | undefined

export function activate(context: vscode.ExtensionContext) {
  console.log('Omni-Buffer Search extension is now active')
  
  // Check if incremental updates are enabled
  const config = vscode.workspace.getConfiguration('omniBuffer')
  const useIncremental = config.get<boolean>('incrementalUpdates.enabled', false)
  
  searchService = useIncremental 
    ? new IncrementalSearchService() 
    : new SearchService()
  
  const formatter = new ResultFormatter()
  decorationService = new DecorationService()
  omniBufferProvider = new OmniBufferProvider()
  const providerRegistration = vscode.workspace.registerTextDocumentContentProvider(
    'omnibuffer',
    omniBufferProvider
  )
  context.subscriptions.push(providerRegistration)
  const searchCommand = new SearchCommand(
    searchService,
    formatter,
    decorationService,
    omniBufferProvider
  )
  const replaceCommand = new ReplaceCommand(
    searchService,
    formatter,
    decorationService,
    omniBufferProvider
  )
  const applyChangesCommand = new ApplyChangesCommand(omniBufferProvider)
  context.subscriptions.push(
    vscode.commands.registerCommand('omniBuffer.search', () =>
      searchCommand.execute()
    ),
    vscode.commands.registerCommand('omniBuffer.replace', () =>
      replaceCommand.execute()
    ),
    vscode.commands.registerCommand('omniBuffer.applyChanges', () =>
      applyChangesCommand.execute()
    ),
    vscode.commands.registerCommand('omniBuffer.openSourceFile', () =>
      openSourceFile()
    )
  )
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(doc => {
      if (doc.uri.scheme === 'omnibuffer') {
        omniBufferProvider?.removeDocument(doc.uri)
      }
    })
  )
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && editor.document.uri.scheme === 'omnibuffer') {
        const omniBufferDoc = omniBufferProvider?.getDocument(
          editor.document.uri
        )
        if (omniBufferDoc && decorationService) {
          decorationService.applyDecorations(
            editor,
            omniBufferDoc.mapping,
            omniBufferDoc.searchOptions
          )
        }
      }
    })
  )
}

async function openSourceFile(): Promise<void> {
  const editor = vscode.window.activeTextEditor
  if (!editor || !editor.document.uri.scheme.startsWith('omnibuffer')) {
    return
  }
  const position = editor.selection.active
  const omniBufferDoc = omniBufferProvider?.getDocument(editor.document.uri)
  if (!omniBufferDoc) return
  const excerpt = omniBufferDoc.mapping.lineToExcerpt.get(position.line)
  if (!excerpt) return
  const lineOffset = position.line - excerpt.omniBufferRange.start.line
  const sourceLine = excerpt.sourceRange.start.line + lineOffset
  
  try {
    const sourceDoc = await vscode.workspace.openTextDocument(excerpt.fileUri)
    
    // Validate that sourceLine is within bounds
    if (sourceLine < 0 || sourceLine >= sourceDoc.lineCount) {
      vscode.window.showErrorMessage(`Line ${sourceLine + 1} is out of bounds in source file`)
      return
    }
    
    const sourceEditor = await vscode.window.showTextDocument(sourceDoc, {
      preview: false,
      selection: new vscode.Range(
        new vscode.Position(sourceLine, 0),
        new vscode.Position(sourceLine, 0)
      )
    })
    sourceEditor.selection = new vscode.Selection(
      new vscode.Position(sourceLine, position.character),
      new vscode.Position(sourceLine, position.character)
    )
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open source file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export function deactivate() {
  decorationService?.dispose()
  omniBufferProvider?.dispose()
  
  // Dispose incremental search service if it exists
  if (searchService && 'dispose' in searchService) {
    (searchService as IncrementalSearchService).dispose()
  }
}
