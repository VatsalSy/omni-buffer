/**
 * # Extension Test Suite
 *
 * Basic tests for search and formatting.
 */

import * as assert from 'node:assert'
import * as vscode from 'vscode'
import { SearchService } from '../../src/services/searchService'
import { ResultFormatter } from '../../src/services/resultFormatter'
import { ExcerptInfo } from '../../src/models/types'

suite('Extension Test Suite', () => {
  test('Search service finds matches', async () => {
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
    
    // Verify that results contain excerpts with the search term
    let foundMatch = false
    for (const [_, excerpts] of results) {
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
    
    // Create mock excerpts with meaningful data
    const mockExcerpts = new Map<string, ExcerptInfo[]>()
    const mockUri = vscode.Uri.file('/test/file.ts')
    const mockDocument = {
      uri: mockUri,
      lineCount: 10,
      lineAt: (line: number) => ({ text: `Line ${line} contains test code`, range: { end: { character: 25 } } }),
      getText: (range?: vscode.Range) => 'function test() { return true; }'
    } as any
    
    const mockExcerpt: ExcerptInfo = {
      id: 'test-excerpt-1',
      fileUri: mockUri,
      buffer: mockDocument,
      sourceRange: new vscode.Range(2, 0, 2, 20),
      multiBufferRange: new vscode.Range(0, 0, 5, 0),
      contextBefore: 2,
      contextAfter: 2,
      isMatch: true,
      originalText: 'function test() { return true; }'
    }
    
    mockExcerpts.set(mockUri.fsPath, [mockExcerpt])
    
    const { content, mapping } = formatter.formatSearchResults(mockExcerpts, {
      query: 'test',
      isRegex: false,
      isCaseSensitive: false,
      matchWholeWord: false,
      contextBefore: 2,
      contextAfter: 2
    })
    
    // Assert meaningful conditions
    assert.ok(content.length > 0, 'Content should not be empty')
    assert.ok(content.includes('test'), 'Content should include the search query')
    assert.ok(content.includes('/test/file.ts'), 'Content should include file path')
    assert.strictEqual(mapping.excerpts.size, 1, 'Mapping should contain exactly one excerpt')
    assert.ok(mapping.excerpts.has('test-excerpt-1'), 'Mapping should contain our mock excerpt')
    assert.ok(mapping.excerptsByFile.has(mockUri.fsPath), 'Mapping should group excerpts by file')
  })
})
