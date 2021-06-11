import { Injectable } from '@angular/core';
import * as ClientOAuth from 'client-oauth2';
import { StorageService } from './ocore/storage.service';
import { SEED_DOMAIN_WITH_HTTPS } from 'src/app/library/Config';

const ClientOAuth2 = ClientOAuth as any;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  loginObj = null;
  loginCredential = null;

  constructor(
    private storageService: StorageService
  ) {
    this.loginObj = {
      userLoggedIn: false,
      client_id: '',
      client_secret: '',
      accessToken: '',
      refreshToken: '',
      tokenType: '',
      expires: '',
      userName: '',
      getIsLoggedIn: () => this.loginObj.userLoggedIn,
      getUserName: () => this.loginObj.userName,
      getHasClient: () => this.loginObj.client_id !== ''
    };
  }

  getIsLoggedIn() {
    return this.loginObj.userLoggedIn;
  }

  saveLoginCredential() {
    this.storageService.set('AUTH_CREDENTIAL', this.loginCredential);
  }

  async loadLoginStatus() {
    const value = await this.storageService.get('AUTH_CREDENTIAL', null);

    if (!value) { return false; }
    this.loginCredential = value;
    const {username, password} = this.loginCredential;

    return await this.do(username, password);
  }

  // First call! Get client_id and client_secret
  async getClient() {
    const oauthClient = new ClientOAuth2({
      authorizationUri: SEED_DOMAIN_WITH_HTTPS + '/api/v1/oauth-clients/local'
    });

    return new Promise((resolve, reject) => {
      oauthClient.jwt.getClientId()
        .then((data) => {
          this.loginObj.client_id = data.client_id;
          this.loginObj.client_secret = data.client_secret;
          resolve(true);
        }).catch((e) => {
          console.log(e);
          resolve(false);
        });
    });
  }

  // First call! Get client_id and client_secret ASYNC
  async getClientAsync() {
    const oauthClient = new ClientOAuth2({
      authorizationUri: SEED_DOMAIN_WITH_HTTPS + '/api/v1/oauth-clients/local'
    });

    await oauthClient.jwt.getClientId()
      .then((data) => {
        this.loginObj.client_id = data.client_id;
        this.loginObj.client_secret = data.client_secret;
      });
  }

  // Do login with user name and password
  async do(userName, userPwd) {
    this.loginCredential = null;
    this.loginObj.userLoggedIn = false;

    if (userName === '') { return false; }
    if (userPwd === '') { return false; }
    if (this.loginObj.client_id === '') { return false; }
    if (this.loginObj.client_secret === '') { return false; }

    const oauth = new ClientOAuth2({
      client_id: this.loginObj.client_id,
      client_secret: this.loginObj.client_secret,
      response_type: 'code',
      grant_type: 'password',
      scope: 'user',
      username: userName,
      password: userPwd,
      accessTokenUri: SEED_DOMAIN_WITH_HTTPS + '/api/v1/users/token'
    });
    // Get Auth Token
    const data = await oauth.jwt.getToken();

    if (data.accessToken === undefined) {
      return false;
    }
    this.loginObj.accessToken = data.accessToken;
    this.loginObj.refreshToken = data.refreshToken;
    this.loginObj.tokenType = this.ucFirst(data.tokenType);
    this.loginObj.expires = data.expires;
    this.loginObj.userLoggedIn = true;
    this.loginObj.userName = userName;

    this.loginCredential = {
      username: userName,
      password: userPwd
    };
    return true;
  }

  // Internal function to check if token is expired, call it in all functions, refresh token if necessary
  async checkToken() {
    const dateNow = new Date();
    if (dateNow > this.loginObj.expires) {
      await this.refreshToken();
    }
  }

  // Internal function to refresh token
  async refreshToken() {
    if (this.loginObj.client_id === '') { return false; }
    if (this.loginObj.client_secret === '') { return false; }
    if (this.loginObj.refreshToken === '') { return false; }

    const oauth = new ClientOAuth2({
      client_id: this.loginObj.client_id,
      client_secret: this.loginObj.client_secret,
      refresh_token: this.loginObj.refreshToken,
      response_type: 'code',
      grant_type: 'refresh_token',
      scope: 'user',
      accessTokenUri: SEED_DOMAIN_WITH_HTTPS + '/api/v1/users/token'
    });

    this.loginObj.userLoggedIn = false;
    // Get Auth Token
    return new Promise((resolve, reject) => {
      oauth.jwt.refreshToken()
        .then((data) => {
          if (data.accessToken === undefined) {
            this.loginObj.userLoggedIn = false;
            resolve(false);
            return;
          }
          this.loginObj.accessToken = data.accessToken;
          this.loginObj.refreshToken = data.refreshToken;
          this.loginObj.tokenType = this.ucFirst(data.tokenType);
          this.loginObj.expires = data.expires;
          this.loginObj.userLoggedIn = true;

          resolve(true);
        }).catch(e => {
          console.log('ERROR', e);
        });
    });
  }

  // Logout from server
  logout() {
    this.loginObj.accessToken = '';
    this.loginObj.refreshToken = '';
    this.loginObj.tokenType = '';
    this.loginObj.expires = '';
    this.loginObj.userLoggedIn = false;
    this.loginObj.userName = '';
    this.loginCredential = null;
    // sound.play('LOGOUT')
    return this.loginObj;
  }

  // Upload a storrent file and publish it on SeedWeb with necessary paramters
  async publishSeedWebTorrent(torrentStr, torrentConfig) {
    torrentConfig.URL = SEED_DOMAIN_WITH_HTTPS + '/api/v1/users/me/upload/seedmedia';

    return await this.publishSeedTorrent(torrentStr, torrentConfig);
  }


  // Upload a storrent file and publish it on SeedNet with necessary paramters
  async publishSeedNetTorrent(torrentStr, torrentConfig) {
    torrentConfig.URL = SEED_DOMAIN_WITH_HTTPS + '/api/v1/users/me/upload/seednet';
    // We don't need this param in SeedNet
    torrentConfig.privacy = '0';

    return await this.publishSeedTorrent(torrentStr, torrentConfig);
  }

  // Upload a storrent file and publish it on SeedWeb with necessary paramters
  // If publishing was successful it returns the LINK to the video
  async publishSeedTorrent(torrentStr, torrentConfig) {
    this.checkToken();
    if (this.loginObj.getIsLoggedIn() === false) { return; }
    if (torrentStr === undefined || torrentStr === null || torrentStr.length === 0) { return; }

    const oauth = new ClientOAuth2({
      sendSeedTorrentUri: torrentConfig.URL
    });

    const CHUNK_SIZE = 16300;
    let isFailed = false;
    let chunkNum = 0;
    let chunk, chunkStart, chunkEnd;
    let URL = '';

    while (torrentStr.length + CHUNK_SIZE > chunkNum * CHUNK_SIZE) {
      if (isFailed) {
        break;
      }
      chunkStart = chunkNum * CHUNK_SIZE;
      chunkEnd = chunkStart + CHUNK_SIZE;
      chunk = {
        num: chunkNum,
        data: torrentStr.slice(chunkStart, chunkEnd)
      };

      await oauth.jwt.sendSeedTorrentDataParts(this.loginObj.accessToken, this.loginObj.tokenType,
          chunk.data, chunk.num.toString(), torrentConfig)
        .then((res) => {
          if (Object.keys(res).length !== 0) {
            if (res.error !== undefined) {
              if (res.error !== null) {
                alert(res.error);
                isFailed = true;
              }
            } else {
              URL = res; // If publishing was successful it returns the LINK to the video
            }
          }
        });
      chunkNum++;
    }

    return URL;
  }

  // Load all video channels from the user
  async getVideoChannels() {
    this.checkToken();
    if (this.loginObj.getIsLoggedIn() === false) { return; }

    const oauth = new ClientOAuth2({
      videoChannelUri: SEED_DOMAIN_WITH_HTTPS + '/api/v1/accounts/' + this.loginObj.userName + '/video-channels'
    });

    let videoChannel;
    await oauth.jwt.getVideoChannels(this.loginObj.accessToken, this.loginObj.tokenType)
      .then((res) => {
        videoChannel = res.data;
      });

    return videoChannel;
  }

  // Load privacies setting form publishing ("Published" + "Unlisted")
  async getPrivacies() {
    this.checkToken();
    if (this.loginObj.getIsLoggedIn() === false) { return; }

    const oauth = new ClientOAuth2({
      privaciesUri: SEED_DOMAIN_WITH_HTTPS + '/api/v1/videos/privacies'
    });

    let privacies;

    await oauth.jwt.getPrivacies()
      .then((res) => {
        privacies = res;
      });

    return privacies;
  }

  // Check if infohash exists (small call to check if publishing is possible or allready done)
  async checkInfoHash(infoHash) {
    this.checkToken();
    if (this.loginObj.getIsLoggedIn() === false) { return; }
    if (infoHash === undefined || infoHash === null || infoHash.length === 0) { return; }

    const oauth = new ClientOAuth2({
      checkInfoHashUri: SEED_DOMAIN_WITH_HTTPS + '/api/v1/users/me/upload/checkInfoHash'
    });

    let infoHashExists = false;
    await oauth.jwt.doesInfoHashExist(this.loginObj.accessToken, this.loginObj.tokenType, infoHash)
      .then((res) => {
        if (Object.keys(res).length !== 0) {
          if (res.infoHashExists !== undefined) {
            if (res.infoHashExists === true) {
              infoHashExists = true;
            }
          }
        }
      });

    return infoHashExists;
  }

  // Check if infohash exists, returns video url
  async urlInfoHash(infoHash) {
    this.checkToken();
    if (this.loginObj.getIsLoggedIn() === false) { return; }
    if (infoHash === undefined || infoHash === null || infoHash.length === 0) { return; }

    const oauth = new ClientOAuth2({
      urlInfoHashUri: SEED_DOMAIN_WITH_HTTPS + '/api/v1/users/me/upload/urlInfoHash'
    });

    let url: any = false;
    await oauth.jwt.getVideoUrlByInfoHash(this.loginObj.accessToken, this.loginObj.tokenType, infoHash)
      .then((res) => {
        if (Object.keys(res).length !== 0) {
          if (res.url !== undefined) {
            url = res.url;
          }
        }
      });

    return url;
  }

  getVideoIdFromUrl(url) {
    return url.substr(url.lastIndexOf('/') + 1);
  }

  getVideoLinkSeedWeb(videoId) {
    return `${SEED_DOMAIN_WITH_HTTPS}/videos/watch/${videoId}`;
  }

  getThumbnail(thumbnailPath) {
    return `${SEED_DOMAIN_WITH_HTTPS}${thumbnailPath}`;
  }

  // Call this function after successful login to transfer deviceId and versionStr
  setDeviceIdAndVersion(deviceId, versionStr) {
    this.checkToken();
    if (this.loginObj.getIsLoggedIn() === false) { return false; }
    if (deviceId === undefined || deviceId === null || deviceId.length === 0) { return false; }
    if (versionStr === undefined || versionStr === null || versionStr.length === 0) { return false; }

    const oauth = new ClientOAuth2({
      setDeviceIdAndVersionUri: SEED_DOMAIN_WITH_HTTPS + '/api/v1/users/me/upload/setDeviceIdAndVersion'
    });

    oauth.jwt.setDeviceIdAndVersion(this.loginObj.accessToken, this.loginObj.tokenType, deviceId, versionStr);
    return true;
  }

  // Heart beat function, call it maybe in 30 secounds interval
  setDeviceIdAndPing(deviceId) {
    this.checkToken();
    if (this.loginObj.getIsLoggedIn() === false) { return; }
    if (deviceId === undefined || deviceId === null || deviceId.length === 0) { return; }

    const oauth = new ClientOAuth2({
      setDeviceIdAndPingUri: SEED_DOMAIN_WITH_HTTPS + '/api/v1/users/me/upload/setDeviceIdAndPing'
    });

    oauth.jwt.setDeviceIdAndPing(this.loginObj.accessToken, this.loginObj.tokenType, deviceId);
  }

  // Indicates whether a device was online within the time
  async checkOnlineStatusOfDevice(deviceId) {
    this.checkToken();
    if (this.loginObj.getIsLoggedIn() === false) { return; }
    if (deviceId === undefined || deviceId === null || deviceId.length === 0) { return; }

    const oauth = new ClientOAuth2({
      checkOnlineStatusOfDeviceUri: SEED_DOMAIN_WITH_HTTPS + '/api/v1/users/me/upload/checkOnlineStatusOfDevice'
    });

    let isOnline = false;
    await oauth.jwt.checkOnlineStatusOfDevice(this.loginObj.accessToken, this.loginObj.tokenType, deviceId)
      .then((res) => {
        if (Object.keys(res).length !== 0) {
          if (res.isOnline !== undefined) {
            if (res.isOnline === true) {
              isOnline = true;
            }
          }
        }
      });

    return isOnline;
  }

  async searchSeedNet(searchString) {
    this.checkToken();
    if (this.loginObj.getIsLoggedIn() === false) { return; }
    if (searchString === undefined || searchString === null || searchString.length === 0) { return; }
    const oauth = new ClientOAuth2({
      searchSeedNetUri: SEED_DOMAIN_WITH_HTTPS + '/api/v1/search/seednet'
    });
    await oauth.jwt.searchSeedNet(this.loginObj.accessToken, this.loginObj.tokenType, searchString)
      .then((res) => {
        if (Object.keys(res).length !== 0) {
          console.dir(res);
          return res;
        }
      });
  }

  // Load all video categories
  async getVideoCategories() {
    this.checkToken();
    if (this.loginObj.getIsLoggedIn() === false) { return; }

    const oauth = new ClientOAuth2({
      categoriesUri: SEED_DOMAIN_WITH_HTTPS + '/api/v1/videos/categories'
    });

    let categories = [];
    await oauth.jwt.getVideoCategories()
      .then((res) => {
        categories = res;
      });

    return categories;
  }

  // Delete a video from SeedWeb only if the user is the author
  async deleteVideoById(videoId) {
    this.checkToken();
    if (this.loginObj.getIsLoggedIn() === false) { return; }
    if (videoId === undefined || videoId === null || videoId.length === 0) { return; }

    const oauth = new ClientOAuth2({
      deleteVideoByIdUri: SEED_DOMAIN_WITH_HTTPS + '/api/v1/videos'
    });

    let error = '';
    await oauth.jwt.deleteVideoById(this.loginObj.accessToken, this.loginObj.tokenType, videoId)
      .then((res) => {
        if (Object.keys(res).length !== 0) {
          if (res.error !== undefined) {
            error = res.error;
          }
        }
      });

    return error;
  }

  // Get video info from SeedWeb
  async getVideoById(videoId) {
    this.checkToken();
    if (this.loginObj.getIsLoggedIn() === false) { return; }
    if (videoId === undefined || videoId === null || videoId.length === 0) { return; }

    const oauth = new ClientOAuth2({
      getVideoByIdUri: SEED_DOMAIN_WITH_HTTPS + '/api/v1/videos'
    });

    let video = null;
    await oauth.jwt.getVideoById(this.loginObj.accessToken, this.loginObj.tokenType, videoId)
      .then((res) => {
        video = res;
      });

    return video;
  }

  // Formatting tokenType
  ucFirst(string) {
    return string.substring(0, 1).toUpperCase() + string.substring(1).toLowerCase();
  }
}
