import { spawn } from 'child_process';
import * as SocketClient from 'socket.io-client';

import { config } from './config';

const io = SocketClient('http://localhost:3000');

let lastError: string;

const clientProcess = spawn(config.clientPath, config.clientArgs, {
  stdio: 'pipe'
});

clientProcess.stderr.setEncoding('utf8');

clientProcess.stderr.on('data', (data: string) => {
  lastError = data;
});

clientProcess.on('exit', () => {
  throw lastError;
});

io.on('stream', (data: Buffer) => {
  clientProcess.stdin.write(data);
});

io.emit('client');

console.log('client started...');
