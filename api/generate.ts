import { spawn } from 'child_process';

export default async function handler(req: any, res: any) {
  const { slot = '1' } = req.query || {};
  
  const env = {
    ...process.env,
    SLOT_ID: String(slot),
    SKIP_POST: 'true',
  };

  return new Promise((resolve, reject) => {
    // Use node directly to run the compiled JS
    const child = spawn('node', ['dist/daily-quote.js'], {
      cwd: process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => stdout += data.toString());
    child.stderr.on('data', (data) => stderr += data.toString());

    child.on('close', (code) => {
      if (code === 0) {
        try {
          // Try to parse JSON response if one exists
          const result = stdout.trim() ? JSON.parse(stdout.trim()) : {};
          res.status(200).json({
            success: true,
            slot,
            message: 'Quote generation completed',
            ...result,
          });
        } catch (e) {
          res.status(200).json({
            success: true,
            slot,
            stdout,
            stderr,
            exitCode: code,
          });
        }
      } else {
        res.status(500).json({
          success: false,
          slot,
          stderr,
          exitCode: code,
        });
      }
    });
  });
}