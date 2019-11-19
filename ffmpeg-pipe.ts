import * as childProcess from 'child_process';
import { Readable } from 'stream';

import { config } from './config';

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

  const ffmpegProcess = childProcess.spawn(config.ffmpegPath, ffmpegParams, {
    stdio: 'pipe'
  });

  return ffmpegProcess.stdout;
}
