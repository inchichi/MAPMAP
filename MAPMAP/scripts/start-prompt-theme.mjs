import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const child = spawn(process.env.PYTHON ?? 'python', [
  '-m', 'uvicorn', 'theme_pipeline:app', '--app-dir', 'experiments/prompt-theme-server',
  '--host', '127.0.0.1', '--port', process.env.THEME_PORT ?? '8773'
], { cwd: root, stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1', THEME_PROJECT: root } })
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
