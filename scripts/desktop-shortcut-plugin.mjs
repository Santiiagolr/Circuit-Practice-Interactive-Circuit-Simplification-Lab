import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('./ensure-desktop-shortcut.ps1', import.meta.url));
const enabled = name => ['1', 'true'].includes(process.env[name]?.toLowerCase());

// Runs in Vite's Node process, including when CircuitPractice.exe starts Vite directly.
export default function desktopShortcut() {
  function installWhenListening(server) {
    server.httpServer?.once('listening', () => {
      const child = spawn('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath, '-ProjectDirectory', server.config.root,
      ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      let errorText = '';
      child.stderr.on('data', chunk => { errorText = (errorText + chunk).slice(-4096); });
      child.once('error', error => server.config.logger.warn(`Acceso directo: ${error.message}`));
      child.once('exit', code => {
        if (code) server.config.logger.warn(`No se pudo preparar el acceso directo: ${errorText.trim() || `codigo ${code}`}`);
      });
    });
  }
  return {
    name: 'circuit-practice-desktop-shortcut',
    apply: (_config, { command, mode }) => command === 'serve' && mode !== 'qa'
      && process.platform === 'win32' && !process.env.CI && !process.env.VITEST
      && !enabled('CIRCUIT_PRACTICE_NO_SHORTCUT') && !enabled('CIRCUIT_PRACTICE_NONINTERACTIVE'),
    configureServer: installWhenListening,
    configurePreviewServer: installWhenListening,
  };
}
