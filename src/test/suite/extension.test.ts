/**
 * Extension Test Suite (integration)
 */

import * as assert from 'node:assert'
import * as vscode from 'vscode'
import { SearchService } from '../../services/searchService'
import { ResultFormatter } from '../../services/resultFormatter'
import { ExcerptInfo } from '../../models/types'

suite('Extension Test Suite', () => {
  suiteSetup(async () => {
    // Ensure a workspace is open (fall back to env-provided fixture)
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      const wsPath = process.env.VSCODE_TEST_WORKSPACE
      if (wsPath) {
        const uri = vscode.Uri.file(wsPath)
        vscode.workspace.updateWorkspaceFolders(0, 0, { uri })
        // Give VS Code a moment to register the folder
        await new Promise(res => setTimeout(res, 500))
      }
    }
  })
  test('Search service finds matches', async () => {
    const wsFolders = vscode.workspace.workspaceFolders
    assert.ok(wsFolders && wsFolders.length > 0, 'Workspace folder should be open for tests')

    const service = new SearchService()
    const results = await service.searchWorkspace({
      query: 'function',
      isRegex: false,
      isCaseSensitive: false,
      matchWholeWord: false,
      contextBefore: 2,
      contextAfter: 2
    })
    assert.ok(results.size > 0, 'Search should find at least one match for "function"')

    let foundMatch = false
    for (const [, excerpts] of results) {
      for (const excerpt of excerpts) {
        if (excerpt.originalText.toLowerCase().includes('function')) {
          foundMatch = true
          break
        }
      }
      if (foundMatch) break
    }
    assert.ok(foundMatch, 'Search results should contain the query term "function"')
  })

  test('Result formatter creates valid content', () => {
    const formatter = new ResultFormatter()

    const mockExcerpts = new Map<string, ExcerptInfo[]>()
    const mockUri = vscode.Uri.file('/test/file.ts')
    const mockDocument = {
      uri: mockUri,
      lineCount: 10,
      lineAt: (line: number) => ({ text: `Line ${line} contains test code`, range: { end: { character: 25 } } }),
      getText: (_?: vscode.Range) => 'function test() { return true; }'
    } as any

    const mockExcerpt: ExcerptInfo = {
      id: 'test-excerpt-1',
      fileUri: mockUri,
      buffer: mockDocument,
      sourceRange: new vscode.Range(2, 0, 2, 20),
      omniBufferRange: new vscode.Range(0, 0, 5, 0),
      contextBefore: 2,
      contextAfter: 2,
      isMatch: true,
      originalText: 'function test() { return true; }'
    }

    mockExcerpts.set(mockUri.fsPath, [mockExcerpt])

    const { content, mapping } = formatter.formatSearchResults(mockExcerpts as any, {
      query: 'test',
      isRegex: false,
      isCaseSensitive: false,
      matchWholeWord: false,
      contextBefore: 2,
      contextAfter: 2
    })

    assert.ok(content.length > 0, 'Content should not be empty')
    assert.ok(content.includes('test'), 'Content should include the search query')
    assert.ok(mapping.excerpts.size === 1, 'Mapping should contain exactly one excerpt')
  })
})
