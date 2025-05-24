/**
 * # Incremental Search Service
 *
 * Provides incremental search capabilities with caching and file watching
 * to improve performance by updating only changed files.
 *
 * Author: VatsalSy
 * Update: Full implementation with file-level incremental updates
 */

import * as vscode from 'vscode'
import * as crypto from 'crypto'
import { SearchService } from './searchService'
import { SearchOptions, ExcerptInfo, getContextValues } from '../models/types'

interface CachedExcerpts {
  excerpts: ExcerptInfo[]
  fileHash: string
  lastModified: number
}

interface SearchCache {
  lastSearchOptions: SearchOptions
  fileVersions: Map<string, number>
  excerptsByFile: Map<string, CachedExcerpts>
}

export interface IncrementalSearchResult {
  added: Map<vscode.Uri, ExcerptInfo[]>
  modified: Map<vscode.Uri, ExcerptInfo[]>
  removed: Set<vscode.Uri>
  unchanged: Map<vscode.Uri, ExcerptInfo[]>
  all: Map<vscode.Uri, ExcerptInfo[]>
}

export class IncrementalSearchService extends SearchService {
  private searchCache: SearchCache | null = null
  private fileWatcher: vscode.FileSystemWatcher | null = null
  private documentChangeListeners: vscode.Disposable[] = []
  private pendingUpdates: Set<string> = new Set()
  private updateTimer: ReturnType<typeof setTimeout> | null = null

  private static readonly DEBOUNCE_DELAY = 500
  private static readonly MAX_FILE_SIZE_FOR_INCREMENTAL = 1048576

  async searchWorkspaceIncremental(
    options: SearchOptions,
    previousResults?: Map<vscode.Uri, ExcerptInfo[]>
  ): Promise<IncrementalSearchResult> {
    const isNewSearch = !this.searchCache || 
      !this.isSameSearchOptions(options, this.searchCache.lastSearchOptions)

    if (isNewSearch) {
      this.clearCache()
      const fullResults = await this.searchWorkspace(options)
      this.initializeCache(options, fullResults)
      this.setupFileWatchers(options)
      
      return {
        added: fullResults,
        modified: new Map(),
        removed: new Set(),
        unchanged: new Map(),
        all: fullResults
      }
    }

    return await this.performIncrementalUpdate(options)
  }

  private async performIncrementalUpdate(
    options: SearchOptions
  ): Promise<IncrementalSearchResult> {
    if (!this.searchCache) {
      throw new Error('Search cache not initialized')
    }

    const result: IncrementalSearchResult = {
      added: new Map(),
      modified: new Map(),
      removed: new Set(),
      unchanged: new Map(),
      all: new Map()
    }

    const currentFiles = new Set<string>()
    const filesToUpdate = Array.from(this.pendingUpdates)
    this.pendingUpdates.clear()

    for (const fileUri of filesToUpdate) {
      const uri = vscode.Uri.parse(fileUri)
      try {
        const stat = await vscode.workspace.fs.stat(uri)
        if (stat.size > IncrementalSearchService.MAX_FILE_SIZE_FOR_INCREMENTAL) {
          continue
        }

        const newExcerpts = await this.searchSingleFile(uri, options)
        const cachedData = this.searchCache.excerptsByFile.get(fileUri)

        if (newExcerpts.length > 0) {
          if (cachedData) {
            result.modified.set(uri, newExcerpts)
          } else {
            result.added.set(uri, newExcerpts)
          }
          this.updateCacheForFile(uri, newExcerpts)
        } else if (cachedData) {
          result.removed.add(uri)
          this.searchCache.excerptsByFile.delete(fileUri)
        }

        currentFiles.add(fileUri)
      } catch (error) {
        const cachedData = this.searchCache.excerptsByFile.get(fileUri)
        if (cachedData) {
          result.removed.add(uri)
          this.searchCache.excerptsByFile.delete(fileUri)
        }
      }
    }

    for (const [fileUri, cachedData] of this.searchCache.excerptsByFile) {
      if (!filesToUpdate.includes(fileUri)) {
        const uri = vscode.Uri.parse(fileUri)
        result.unchanged.set(uri, cachedData.excerpts)
        result.all.set(uri, cachedData.excerpts)
      }
    }

    for (const [uri, excerpts] of [...result.added, ...result.modified]) {
      result.all.set(uri, excerpts)
    }

    return result
  }

  private async searchSingleFile(
    uri: vscode.Uri,
    options: SearchOptions
  ): Promise<ExcerptInfo[]> {
    const searchPattern = this.createSearchPattern(options)
    const matches: vscode.TextSearchMatch[] = []

    await vscode.workspace.findTextInFiles(
      searchPattern,
      {
        include: new vscode.RelativePattern(uri, '**'),
        maxResults: options.maxResults
      },
      result => {
        if ('matches' in result && result.matches) {
          matches.push(result as vscode.TextSearchMatch)
        }
      }
    )

    if (matches.length === 0) {
      return []
    }

    const { contextBefore, contextAfter } = getContextValues(options)
    return await this.createExcerptsForFile(
      uri,
      matches,
      contextBefore,
      contextAfter
    )
  }

  private initializeCache(
    options: SearchOptions,
    results: Map<vscode.Uri, ExcerptInfo[]>
  ): void {
    this.searchCache = {
      lastSearchOptions: { ...options },
      fileVersions: new Map(),
      excerptsByFile: new Map()
    }

    for (const [uri, excerpts] of results) {
      this.updateCacheForFile(uri, excerpts)
    }
  }

  private updateCacheForFile(uri: vscode.Uri, excerpts: ExcerptInfo[]): void {
    if (!this.searchCache) return

    const fileUri = uri.toString()
    this.searchCache.excerptsByFile.set(fileUri, {
      excerpts,
      fileHash: this.computeFileHash(excerpts),
      lastModified: Date.now()
    })
  }

  private computeFileHash(excerpts: ExcerptInfo[]): string {
    const hash = crypto.createHash('sha256')
    for (const excerpt of excerpts) {
      hash.update(excerpt.originalText)
    }
    return hash.digest('hex')
  }

  private setupFileWatchers(options: SearchOptions): void {
    this.clearFileWatchers()

    const pattern = options.includePattern || '**/*'
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern)

    this.fileWatcher.onDidChange(uri => this.handleFileChange(uri))
    this.fileWatcher.onDidCreate(uri => this.handleFileChange(uri))
    this.fileWatcher.onDidDelete(uri => this.handleFileDelete(uri))

    const listener = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.uri.scheme === 'file') {
        this.handleFileChange(event.document.uri)
      }
    })
    this.documentChangeListeners.push(listener)
  }

  private handleFileChange(uri: vscode.Uri): void {
    if (!this.searchCache) return

    const fileUri = uri.toString()
    this.pendingUpdates.add(fileUri)

    if (this.updateTimer) {
      clearTimeout(this.updateTimer)
    }

    this.updateTimer = setTimeout(() => {
      this.updateTimer = null
    }, IncrementalSearchService.DEBOUNCE_DELAY)
  }

  private handleFileDelete(uri: vscode.Uri): void {
    if (!this.searchCache) return

    const fileUri = uri.toString()
    this.searchCache.excerptsByFile.delete(fileUri)
    this.pendingUpdates.delete(fileUri)
  }

  private isSameSearchOptions(a: SearchOptions, b: SearchOptions): boolean {
    return (
      a.query === b.query &&
      a.isRegex === b.isRegex &&
      a.isCaseSensitive === b.isCaseSensitive &&
      a.matchWholeWord === b.matchWholeWord &&
      a.includePattern === b.includePattern &&
      a.excludePattern === b.excludePattern
    )
  }

  private clearFileWatchers(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose()
      this.fileWatcher = null
    }

    for (const listener of this.documentChangeListeners) {
      listener.dispose()
    }
    this.documentChangeListeners = []
  }

  private clearCache(): void {
    this.searchCache = null
    this.pendingUpdates.clear()
    if (this.updateTimer) {
      clearTimeout(this.updateTimer)
      this.updateTimer = null
    }
  }


  dispose(): void {
    this.clearFileWatchers()
    this.clearCache()
  }
}