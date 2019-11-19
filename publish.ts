import { FlvHeader, FlvPacketHeader, FlvPacket, FlvPacketType, FlvStreamParser } from 'node-flv';
import * as SocketClient from 'socket.io-client';
import { ffmpegPipe } from './ffmpeg-pipe';

const io = SocketClient('http://localhost:3000');

const flvStream = ffmpegPipe();

const flvStreamParser = new FlvStreamParser();

flvStreamParser.on('flv-header', (flvHeader: FlvHeader) => {
  io.emit('flv_header', {
    flvHeader
  });
});

flvStreamParser.on('flv-packet', (flvPacket: FlvPacket) => {
  io.emit('flv_packet', {
    flvPacket
  });
});

flvStream.pipe(flvStreamParser);
