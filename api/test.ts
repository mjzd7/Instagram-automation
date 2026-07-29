import { spawn } from 'child_process';

export default async function handler(req: any, res: any) {
  const results = [];
  
  for (let slot = 1; slot <= 4; slot++) {
    const env = {
      ...process.env,
      SLOT_ID: String(slot),
      SKIP_POST: 'true',
    };

    const result = await new Promise((resolvePromise) => {
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
        resolvePromise({
          slot,
          success: code === 0,
          stdout,
          stderr,
          exitCode: code,
        });
      });
    });
    
    results.push(result);
  }

  const allSuccess = results.every((r: any) => r.success);
  
  return res.status(allSuccess ? 200 : 500).json({
    success: allSuccess,
    results,
    message: allSuccess 
      ? 'All 4 images generated successfully (test mode)' 
      : 'Some generations failed',
  });
}
