import * as path from 'path'
import Mocha from 'mocha'
import { glob } from 'glob'

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 20000 })
  const testsRoot = path.resolve(__dirname)

  const files = await glob('**/*.test.js', { cwd: testsRoot })
  for (const f of files) {
    mocha.addFile(path.resolve(testsRoot, f))
  }

  return new Promise((resolve, reject) => {
    try {
      mocha.run(failures => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`))
        } else {
          resolve()
        }
      })
    } catch (e) {
      reject(e)
    }
  })
}
