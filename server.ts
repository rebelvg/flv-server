import * as SocketServer from 'socket.io';
import {
  FlvHeader,
  FlvPacketHeader,
  FlvPacket,
  FlvPacketType,
  FlvPacketVideo,
} from 'node-flv';
import * as _ from 'lodash';
import { VideoFrameTypeEnum } from 'node-flv/dist/flv-data';
import * as http from 'http';

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

interface IHttpStreamClient {
  res: http.ServerResponse;
  lastTimestamp: number;
}

let PUBLISHER: SocketServer.Socket = null;
const CLIENTS: IStreamClient[] = [];
const HTTP_CLIENTS: IHttpStreamClient[] = [];

const httpServer = http.createServer((req, res) => {
  console.log('http_subscriber connected');

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!PUBLISHER) {
    console.log('no publisher');

    res.end();

    return;
  }

  res.write(FLV_HEADER.build());
  res.write(FLV_FIRST_METADATA_PACKET.build());
  res.write(FLV_FIRST_AUDIO_PACKET.build());
  res.write(FLV_FIRST_VIDEO_PACKET.build());

  for (const gopPacker of GOP_CACHE) {
    const clonedPacket = _.cloneDeep(gopPacker);

    clonedPacket.header.timestampLower = 0;

    res.write(clonedPacket.build());
  }

  HTTP_CLIENTS.push({
    res,
    lastTimestamp: FLV_LAST_TIMESTAMP,
  });

  res.socket.on('close', () => {
    _.remove(HTTP_CLIENTS, (client) => {
      return client.res === res;
    });
  });
});

const io = SocketServer(httpServer);

httpServer.listen(3000);

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

    socket.emit('stream', FLV_HEADER.build());
    socket.emit('stream', FLV_FIRST_METADATA_PACKET.build());
    socket.emit('stream', FLV_FIRST_AUDIO_PACKET.build());
    socket.emit('stream', FLV_FIRST_VIDEO_PACKET.build());

    for (const gopPacker of GOP_CACHE) {
      const clonedPacket = _.cloneDeep(gopPacker);

      clonedPacket.header.timestampLower = 0;

      socket.emit('stream', clonedPacket.build());
    }

    CLIENTS.push({
      socket,
      lastTimestamp: FLV_LAST_TIMESTAMP,
    });
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

    const flvHeader: FlvHeader = Object.setPrototypeOf(
      data.flvHeader,
      FlvHeader.prototype,
    );

    if (!FLV_HEADER) {
      FLV_HEADER = flvHeader;

      return;
    }
  });

  socket.on('flv_packet', (data: ISocketFlvPacker) => {
    if (PUBLISHER !== socket) {
      return;
    }

    data.flvPacket.header = Object.setPrototypeOf(
      data.flvPacket.header,
      FlvPacketHeader.prototype,
    );
    const flvPacket: FlvPacket = Object.setPrototypeOf(
      data.flvPacket,
      FlvPacket.prototype,
    );

    FLV_LAST_TIMESTAMP = flvPacket.header.timestampLower;

    if (
      !FLV_FIRST_METADATA_PACKET &&
      flvPacket.type === FlvPacketType.METADATA
    ) {
      console.log('got first metadata');

      FLV_FIRST_METADATA_PACKET = flvPacket;

      return;
    }

    if (!FLV_FIRST_AUDIO_PACKET && flvPacket.type === FlvPacketType.AUDIO) {
      console.log('got first audio');

      FLV_FIRST_AUDIO_PACKET = flvPacket;

      return;
    }

    if (!FLV_FIRST_VIDEO_PACKET && flvPacket.type === FlvPacketType.VIDEO) {
      console.log('got first video');

      FLV_FIRST_VIDEO_PACKET = flvPacket;

      return;
    }

    if (flvPacket.type === FlvPacketType.VIDEO) {
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

    for (const client of HTTP_CLIENTS) {
      const clonedPacket = _.cloneDeep(flvPacket);

      clonedPacket.header.timestampLower -= client.lastTimestamp;

      client.res.write(clonedPacket.build());
    }
  });
});

console.log('server started...');
