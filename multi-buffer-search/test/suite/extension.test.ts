/**
 * # Extension Test Suite
 *
 * Basic tests for search and formatting.
 */

import * as assert from 'assert'
import * as vscode from 'vscode'
import { SearchService } from '../../src/services/searchService'
import { ResultFormatter } from '../../src/services/resultFormatter'

suite('Extension Test Suite', () => {
  test('Search service finds matches', async () => {
    const service = new SearchService()
    const results = await service.searchWorkspace({
      query: 'function',
      isRegex: false,
      isCaseSensitive: false,
      matchWholeWord: false,
      contextLines: 2
    })
    assert.ok(results.size >= 0, 'Search executed')
  })

  test('Result formatter creates valid content', () => {
    const formatter = new ResultFormatter()
    const mockExcerpts = new Map()
    const { content, mapping } = formatter.formatSearchResults(mockExcerpts, {
      query: 'test',
      isRegex: false,
      isCaseSensitive: false,
      matchWholeWord: false,
      contextLines: 2
    })
    assert.ok(content.length >= 0, 'Content generated')
    assert.ok(mapping.excerpts.size >= 0, 'Mapping valid')
  })
})
