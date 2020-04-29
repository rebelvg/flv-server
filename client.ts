import { spawn } from 'child_process';
import * as SocketClient from 'socket.io-client';

import { config } from './config';

const io = SocketClient('http://localhost:3000');

const clientProcess = spawn(config.clientPath, config.clientArgs, {
  stdio: 'pipe',
});

clientProcess.on('close', () => {
  throw new Error('player was closed...');
});

clientProcess.stdin.on('error', (error) => {
  console.error('error', error);
});

io.on('stream', (data: Buffer) => {
  clientProcess.stdin.write(data);
});

io.on('disconnect', () => {
  throw new Error('lost connection...');
});

io.emit('subscribe');

console.log('client started...');
