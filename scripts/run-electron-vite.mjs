import { spawn } from 'child_process'
import { join } from 'path'

const [command, ...args] = process.argv.slice(2)

if (!command) {
  console.error('Usage: node scripts/run-electron-vite.mjs <command> [...args]')
  process.exit(1)
}

const env = { ...process.env }
// 有些终端会残留 ELECTRON_RUN_AS_NODE=1，导致 Electron 以 Node 模式启动。
delete env.ELECTRON_RUN_AS_NODE

const binary = process.execPath
// 直接调用 electron-vite 的 JS 入口，避免 Windows .cmd shim 带来的 shell 参数警告。
const electronViteCli = join(
  process.cwd(),
  'node_modules',
  'electron-vite',
  'bin',
  'electron-vite.js'
)

const child = spawn(binary, [electronViteCli, command, ...args], {
  env,
  stdio: 'inherit'
})

child.on('error', (error) => {
  // 子进程启动失败时直接退出，让 pnpm 能拿到明确的失败状态。
  console.error(error)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
