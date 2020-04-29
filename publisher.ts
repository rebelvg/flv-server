import { FlvHeader, FlvPacketHeader, FlvPacket, FlvPacketType, FlvStreamParser } from 'node-flv';
import * as SocketClient from 'socket.io-client';
import { ffmpegPipe } from './ffmpeg-pipe';
import { Socket } from 'socket.io';

const io = SocketClient('http://localhost:3000');

const ffmpegStream = ffmpegPipe();

const flvStreamParser = new FlvStreamParser();

io.emit('publish');

flvStreamParser.on('flv-header', (flvHeader: FlvHeader) => {
  io.emit('flv_header', {
    flvHeader,
  });
});

flvStreamParser.on('flv-packet', (flvPacket: FlvPacket) => {
  io.emit('flv_packet', {
    flvPacket,
  });
});

ffmpegStream.pipe(flvStreamParser);

io.on('disconnect', (socket: Socket) => {
  throw new Error('lost connection...');
});

console.log('publisher started...');
