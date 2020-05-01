import * as SocketServer from 'socket.io';
import { FlvHeader, FlvPacketHeader, FlvPacket, FlvPacketType, FlvPacketVideo } from 'node-flv';
import * as _ from 'lodash';
import { VideoFrameTypeEnum } from 'node-flv/dist/flv-data';

interface ISocketFlvHeader {
  flvHeader: any;
}

interface ISocketFlvPacker {
  flvPacket: any;
}

interface IStreamClient {
  socket: SocketServer.Socket;
  lastTimestamp: number;
}

let PUBLISHER: SocketServer.Socket = null;
const CLIENTS: IStreamClient[] = [];

const io = SocketServer(3000);

let FLV_HEADER: FlvHeader;
let FLV_FIRST_METADATA_PACKET: FlvPacket;
let FLV_FIRST_AUDIO_PACKET: FlvPacket;
let FLV_FIRST_VIDEO_PACKET: FlvPacket;

let GOP_CACHE: FlvPacket[] = [];

let FLV_LAST_TIMESTAMP = 0;

io.on('connection', (socket) => {
  console.log('connection');

  socket.on('publish', () => {
    console.log('publisher connected');

    if (!PUBLISHER) {
      PUBLISHER = socket;
    } else {
      console.log('already publishing...');

      socket.disconnect();
    }
  });

  socket.on('subscribe', async () => {
    console.log('subscriber connected');

    if (!PUBLISHER) {
      console.log('no publisher');

      socket.disconnect();

      return;
    }

    const client = { socket, lastTimestamp: FLV_LAST_TIMESTAMP };

    CLIENTS.push(client);

    client.socket.emit('stream', FLV_HEADER.build());
    client.socket.emit('stream', FLV_FIRST_METADATA_PACKET.build());
    client.socket.emit('stream', FLV_FIRST_AUDIO_PACKET.build());
    client.socket.emit('stream', FLV_FIRST_VIDEO_PACKET.build());

    for (const gopPacker of GOP_CACHE) {
      const clonedPacket = _.cloneDeep(gopPacker);

      clonedPacket.header.timestampLower = 0;

      client.socket.emit('stream', clonedPacket.build());
    }
  });

  socket.on('disconnect', () => {
    console.log('client disconnected');

    _.remove(CLIENTS, (client) => {
      return client.socket === socket;
    });

    if (PUBLISHER === socket) {
      for (const client of CLIENTS) {
        client.socket.disconnect();
      }

      PUBLISHER = null;

      FLV_HEADER = null;
      FLV_FIRST_AUDIO_PACKET = null;
      FLV_FIRST_VIDEO_PACKET = null;
      FLV_FIRST_METADATA_PACKET = null;

      GOP_CACHE = [];
    }
  });

  socket.on('subtitles', (data) => {
    if (PUBLISHER !== socket) {
      return;
    }

    io.emit('subtitles', data);
  });

  socket.on('flv_header', (data: ISocketFlvHeader) => {
    if (PUBLISHER !== socket) {
      return;
    }

    const flvHeader: FlvHeader = Object.setPrototypeOf(data.flvHeader, FlvHeader.prototype);

    if (!FLV_HEADER) {
      FLV_HEADER = flvHeader;

      return;
    }
  });

  socket.on('flv_packet', (data: ISocketFlvPacker) => {
    if (PUBLISHER !== socket) {
      return;
    }

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

    if (flvPacket.header.type === FlvPacketType.VIDEO) {
      const videoPacket: FlvPacketVideo = flvPacket.parsePayload();

      if (videoPacket.data.frameType === VideoFrameTypeEnum.KEYFRAME) {
        GOP_CACHE = [flvPacket];
      } else {
        GOP_CACHE.push(flvPacket);
      }
    }

    for (const client of CLIENTS) {
      const clonedPacket = _.cloneDeep(flvPacket);

      clonedPacket.header.timestampLower -= client.lastTimestamp;

      client.socket.emit('stream', clonedPacket.build());
    }
  });
});

console.log('server started...');
