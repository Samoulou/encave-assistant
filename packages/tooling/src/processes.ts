import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

export type ManagedProcess = {
  child: ChildProcess;
  output: () => string;
  exited: () => boolean;
  completion: Promise<number>;
};

export function launch(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; discardOutput?: boolean } = {}): ManagedProcess {
  let output = '';
  let ended = false;
  const child = spawn(command, args, {
    ...options, env: options.env ?? process.env, windowsHide: true,
    detached: process.platform !== 'win32', stdio: options.discardOutput ? 'ignore' : ['ignore', 'pipe', 'pipe'],
  });
  const collect = (data: Buffer) => { output = (output + data.toString()).slice(-64_000); };
  child.stdout?.on('data', collect);
  child.stderr?.on('data', collect);
  const completion = new Promise<number>((resolve) => {
    child.once('error', () => { ended = true; resolve(1); });
    child.once('close', code => { ended = true; resolve(code ?? 1); });
  });
  return { child, output: () => output, exited: () => ended, completion };
}

export async function stopProcess(p: ManagedProcess): Promise<void> {
  const pid = p.child.pid;
  if (!pid || p.exited()) return;
  if (process.platform === 'win32') {
    const killer = launch('taskkill.exe', ['/PID', String(pid), '/T', '/F']);
    await Promise.race([killer.completion, delay(5_000)]);
  } else {
    try { process.kill(-pid, 'SIGTERM'); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
    await Promise.race([p.completion, delay(1_000)]);
    if (!p.exited()) {
      try { process.kill(-pid, 'SIGKILL'); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
    }
  }
  await Promise.race([p.completion, delay(5_000)]);
  if (!p.exited()) throw new Error('Process cleanup timed out');
}

export async function command(commandPath: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; quiet?: boolean; discardOutput?: boolean } = {}): Promise<string> {
  const p = launch(commandPath, args, options);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const code = await Promise.race([
      p.completion,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Command timed out')), options.timeoutMs ?? 120_000); }),
    ]);
    if (!options.quiet) process.stdout.write(p.output());
    if (code !== 0) throw new Error(`Command failed with exit code ${code}`);
    return p.output();
  } finally {
    clearTimeout(timer);
    await stopProcess(p);
  }
}

export async function until(check: () => Promise<boolean>, p: ManagedProcess, timeoutMs: number): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (p.exited()) throw new Error('Service exited before readiness');
    if (await check()) return;
    await delay(100);
  }
  throw new Error('Readiness timed out');
}
