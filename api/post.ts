import { spawn } from 'child_process';

export default async function handler(req: any, res: any) {
  const { slots = '1,2,3,4' } = req.query || {};
  const slotArray = String(slots).split(',').map(s => s.trim());
  
  const results = [];
  
  for (const slot of slotArray) {
    const env = {
      ...process.env,
      SLOT_ID: slot,
      SKIP_POST: 'false',
    };

    const result = await new Promise((resolvePromise) => {
      const child = spawn('npx', ['tsx', 'src/daily-quote.ts'], {
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
      ? 'All 4 images posted successfully' 
      : 'Some posts failed',
  });
}
