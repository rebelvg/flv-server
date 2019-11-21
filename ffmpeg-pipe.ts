import { spawn } from 'child_process';
import { Readable } from 'stream';

import { config } from './config';

let lastError: string;

export function ffmpegPipe(): Readable {
  const ffmpegParams = [
    '-re',
    '-i',
    config.filePath,
    '-isync',
    '-c:v',
    'copy',
    '-acodec',
    'aac',
    '-ac',
    '2',
    '-ar',
    '48000',
    '-b:a',
    '256k',
    '-f',
    'flv',
    '-'
  ];

  const ffmpegProcess = spawn(config.ffmpegPath, ffmpegParams, {
    stdio: 'pipe'
  });

  ffmpegProcess.stderr.setEncoding('utf8');

  ffmpegProcess.stderr.on('data', (data: string) => {
    lastError = data;
  });

  ffmpegProcess.on('exit', () => {
    throw lastError;
  });

  return ffmpegProcess.stdout;
}
