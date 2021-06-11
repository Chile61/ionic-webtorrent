import { version } from '../../../package.json';

export const VERSION = version;
export const VERSION_STR = version
  .replace(/\d*./g, (v: string) => `0${parseInt(v) % 100}`.slice(-2))
  .slice(0, 4);
export const VERSION_PREFIX = `SA${VERSION_STR}-`;

export const BACKUP_DIR = 'Backup';
export const SEEDCHAT_DIR = 'SeedChat';
export const SEEDWEB_DIR = 'Web';
export const SEEDNET_DIR = 'Net';
export const IMP_VIDEO_DIR = 'URL-Download';

export const APP_NAME = 'SeedWallet';
export const APP_DIR = APP_NAME;
export const APP_BACKUP_DIR = APP_DIR + '/' + BACKUP_DIR;

export const SEED_DOMAIN = 'xubay.com';
export const HUB_DOMAIN = 'seedmedia.tv';
export const SEED_DOMAIN_WITH_HTTPS = 'https://' + SEED_DOMAIN;
export const HUB_DOMAIN_FULL = HUB_DOMAIN + '/bb';

export const WATCH_URL = '/videos/watch/';

export const ANNOUNCE_LIST = [
  [SEED_DOMAIN_WITH_HTTPS + '/tracker/announce'],
  ['wss://' + SEED_DOMAIN + ':443/tracker/socket']
];

export const ANNOUNCE_LIST_SEEDNET = [
  [SEED_DOMAIN_WITH_HTTPS + '/seedtracker/announce'],
  ['wss://' + SEED_DOMAIN + ':443/seedtracker/socket']
];

export const ANNOUNCE_LIST_ORIGINAL = [
  ['udp://tracker.leechers-paradise.org:6969'],
  ['udp://tracker.coppersurfer.tk:6969'],
  ['udp://tracker.opentrackr.org:1337'],
  ['udp://explodie.org:6969'],
  ['udp://tracker.empire-js.us:1337'],
  ['wss://tracker.btorrent.xyz'],
  ['wss://tracker.openwebtorrent.com']
];

export const SEED_KEY = 'OGPXA5TGCAUZGJQZXJFJI8YQDDWDC6KM';

export const SEED_SECRET = 'ZTU5FBHTVQXHN8';

export const IMPORT_TYPES = { SEEDWEB: 1, SEEDNET: 2, POSTER: 3 };
export const IMPORT_SEEDWEB_FILETYPES = 'video/webm|video/mp4|application/x-bittorrent|application/octet-stream';
export const IMPORT_SEEDNET_FILETYPES = '';
export const IMPORT_POSTER_FILETYPES = 'image/jpg|image/jpeg|image/pjpeg';

export const VIDEO_CATEGORIES = {
  1: 'Music',
  2: 'Films',
  3: 'Vehicles',
  4: 'Art',
  5: 'Sports',
  6: 'Travels',
  7: 'Gaming',
  8: 'People',
  9: 'Comedy',
  10: 'Entertainment',
  11: 'News & Politics',
  12: 'How To',
  13: 'Education',
  14: 'Activism',
  15: 'Science & Technology',
  16: 'Animals',
  17: 'Kids',
  18: 'Food'
};

export const SeedNetCategories = [
  {
    icon: 'film-outline',
    title: 'Movies',
    exts: ['asf', 'avi', 'flac', 'flv', 'mkv', 'mov', 'mp4', 'webm'],
    isReady: true
  },
  {
    icon: 'headset-outline',
    title: 'Audio',
    exts: ['aac', 'mp3', 'ogg', 'wav', 'm4a']
  },
  {
    icon: 'image-outline',
    title: 'Images',
    exts: ['gif', 'jpeg', 'jpg', 'png', 'tif']
  },
  {
    icon: 'reader-outline',
    title: 'Texts',
    exts: ['doc', 'docx', 'epub', 'pdf', 'mobi', 'txt', 'xls', 'xlsx']
  },
  {
    icon: 'settings-outline',
    title: 'Software',
    exts: ['zip']
  }
];

export const SeedFilters = [
  {
    icon: 'globe-outline',
    title: SEEDWEB_DIR,
  },
  {
    icon: 'planet-outline',
    title: SEEDNET_DIR,
  },
  ...SeedNetCategories
];

export const SeedMainDirectory = [
  {
    title: BACKUP_DIR,
  },
  {
    title: SEEDCHAT_DIR,
  },
  {
    title: SEEDNET_DIR,
  },
  {
    title: SEEDWEB_DIR,
  },
];

export const SeedWebCategories = [
  {
    title: 'Video',
    exts: ['mp4', 'webm']
  },
];

export const SignalServerConfig = {
  iceServers: [
    {
      urls: 'stun:xubay.com:5349'
    },
    {
      urls: 'turn:xubay.com:5349',
      username: 'SeedTurner',
      credential: 'QSX7HLSL5OBXOP8EFWBT5PAIPQ3ZYO2K'
    }
  ],
  sdpSemantics: 'unified-plan'
};

export const SignalServerConfigFallback = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302'
    },
    {
      urls: 'stun:global.stun.twilio.com:3478'
    },
    {
      urls: 'turn:0.peerjs.com:3478',
      username: 'peerjs',
      credential: 'peerjs'
    }
  ],
  sdpSemantics: 'unified-plan'
};

export const PeerServerConfig = {
  // debug: 1, // 1: Errors, 2: Warnings, 3: All logs
  host: 'xubay.com',
  port: 9090,
  path: '/SeedPeer',
  key: 'M8X5CWHSEQZNQIVYZWXSDUGCUWCFPEDT',
  config: SignalServerConfig,
//  secure: true,
};

export const PeerServerConfigFallback = {
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  key: 'peerjs',
  config: SignalServerConfigFallback,
};

export const DATA_URL_REPLACE = 'data:image/jpeg;base64,';

export const PEER_ID_TYPE = {
  PEER_ID_20: 20,
  PEER_ID_40: 40
};
