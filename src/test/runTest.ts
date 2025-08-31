import * as path from 'path'
import * as fs from 'fs'
import { runTests } from '@vscode/test-electron'

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../')
    const extensionTestsPath = path.resolve(__dirname, './suite/index')

    // Open a minimal workspace with fixture files for search
    const workspaceFolder = path.resolve(__dirname, '../../test-fixtures/basic')
    const userDataDir = path.resolve(__dirname, '../../.vscode-test-user')
    try { fs.mkdirSync(userDataDir, { recursive: true }) } catch {}

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        workspaceFolder,
        '--disable-extensions',
        '--disable-gpu',
        '--no-sandbox',
        '--skip-getting-started',
        '--skip-welcome',
        '--skip-release-notes',
        '--disable-workspace-trust',
        '--user-data-dir', userDataDir
      ],
      extensionTestsEnv: { VSCODE_TEST_WORKSPACE: workspaceFolder }
    })
  } catch (err) {
    console.error('Failed to run tests')
    if (err instanceof Error) {
      console.error(err.message)
      console.error(err.stack)
    }
    process.exit(1)
  }
}

main()
