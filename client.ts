import { spawn } from 'child_process';
import * as SocketClient from 'socket.io-client';

import { config } from './config';

const io = SocketClient('http://localhost:3000');

const mpcProcess = spawn(config.mpcPath, ['playpath', '-'], {
  stdio: 'pipe'
});

io.on('stream', (data: Buffer) => {
  mpcProcess.stdin.write(data);
});

io.emit('client');
