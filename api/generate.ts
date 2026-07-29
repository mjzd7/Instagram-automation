import { spawn } from 'child_process';

export default async function handler(req: any, res: any) {
  const { slot = '1' } = req.query || {};
  
  const env = {
    ...process.env,
    SLOT_ID: String(slot),
    SKIP_POST: 'true',
  };

  return new Promise((resolvePromise) => {
    const child = spawn('node', ['dist/daily-quote.js'], {
      cwd: process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolvePromise(
        res.status(code === 0 ? 200 : 500).json({
          success: code === 0,
          slot,
          stdout,
          stderr,
          exitCode: code,
        })
      );
    });
  });
}
