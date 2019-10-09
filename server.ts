import * as SocketServer from 'socket.io';
import { FlvHeader, FlvPacketHeader, FlvPacket, FlvPacketType } from 'node-flv';

interface ISocketFlvHeader {
  flvHeader: any;
}

interface ISocketFlvPacker {
  flvPacket: any;
}

interface IStreamClient {
  socket: SocketServer.Socket;
  allFirstPacketsSent: boolean;
  lastTimestamp: number;
}

const CLIENTS: IStreamClient[] = [];

const io = SocketServer(3000);

let FLV_HEADER: FlvHeader;
let FLV_FIRST_METADATA_PACKET: FlvPacket;
let FLV_FIRST_AUDIO_PACKET: FlvPacket;
let FLV_FIRST_VIDEO_PACKET: FlvPacket;

let FLV_LAST_TIMESTAMP = 0;

io.on('connection', socket => {
  console.log('connection');

  socket.on('client', async () => {
    console.log('client connected');

    CLIENTS.push({
      socket,
      allFirstPacketsSent: false,
      lastTimestamp: FLV_LAST_TIMESTAMP
    });
  });

  socket.on('subtitles', data => {
    io.emit('subtitles', data);
  });

  socket.on('flv_header', (data: ISocketFlvHeader) => {
    const flvHeader: FlvHeader = Object.setPrototypeOf(data.flvHeader, FlvHeader.prototype);

    if (!FLV_HEADER) {
      FLV_HEADER = flvHeader;

      return;
    }
  });

  socket.on('flv_packet', (data: ISocketFlvPacker) => {
    data.flvPacket.header = Object.setPrototypeOf(data.flvPacket.header, FlvPacketHeader.prototype);
    const flvPacket: FlvPacket = Object.setPrototypeOf(data.flvPacket, FlvPacket.prototype);

    FLV_LAST_TIMESTAMP = flvPacket.header.timestampLower;

    if (!FLV_FIRST_METADATA_PACKET && flvPacket.header.type === FlvPacketType.METADATA) {
      console.log('got first metadata');

      FLV_FIRST_METADATA_PACKET = flvPacket;

      return;
    }

    if (!FLV_FIRST_AUDIO_PACKET && flvPacket.header.type === FlvPacketType.AUDIO) {
      console.log('got first audio');

      FLV_FIRST_AUDIO_PACKET = flvPacket;

      return;
    }

    if (!FLV_FIRST_VIDEO_PACKET && flvPacket.header.type === FlvPacketType.VIDEO) {
      console.log('got first video');

      FLV_FIRST_VIDEO_PACKET = flvPacket;

      return;
    }

    for (const client of CLIENTS) {
      if (!client.allFirstPacketsSent) {
        client.socket.emit('stream', FLV_HEADER.build());
        client.socket.emit('stream', FLV_FIRST_METADATA_PACKET.build());
        client.socket.emit('stream', FLV_FIRST_AUDIO_PACKET.build());
        client.socket.emit('stream', FLV_FIRST_VIDEO_PACKET.build());

        client.allFirstPacketsSent = true;
      }

      flvPacket.header.timestampLower -= client.lastTimestamp;

      client.socket.emit('stream', flvPacket.build());
    }
  });
});

console.log('server started...');
