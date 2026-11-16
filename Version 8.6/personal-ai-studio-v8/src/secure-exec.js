import { spawn } from 'node:child_process';
// Docker is the security boundary. Never fall back to executing code on the host.
export async function runSandboxedCode(code, language = 'javascript') {
  if (language !== 'javascript') throw new Error('Only JavaScript is supported in this starter sandbox.');
  if (typeof code !== 'string' || !code.trim() || code.length > 12000) throw new Error('Code must be 1–12,000 characters.');
  return new Promise((resolve, reject) => {
    const args = ['run','--rm','-i','--network=none','--read-only','--memory=128m','--cpus=0.5','--pids-limit=32','--user=65534:65534','--cap-drop=ALL','--security-opt=no-new-privileges','--tmpfs=/tmp:rw,noexec,nosuid,size=16m','--log-driver=none','node:22-alpine','node','-e',code];
    const child = spawn('docker', args, { stdio: ['ignore','pipe','pipe'], windowsHide: true }); let stdout='', stderr='', done=false;
    const timer = setTimeout(() => { child.kill('SIGKILL'); if (!done) { done=true; reject(new Error('Sandbox timed out after 5 seconds.')); } }, 5000);
    child.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > 12000) child.kill('SIGKILL'); });
    child.stderr.on('data', d => { stderr += d.toString(); if (stderr.length > 12000) child.kill('SIGKILL'); });
    child.on('error', e => { clearTimeout(timer); if (!done) { done=true; reject(new Error(`Docker sandbox is unavailable: ${e.message}`)); } });
    child.on('close', code => { clearTimeout(timer); if (done) return; done=true; resolve({ exitCode: code, stdout: stdout.slice(0,12000), stderr: stderr.slice(0,12000), sandbox: 'docker-isolated-no-network' }); });
  });
}
