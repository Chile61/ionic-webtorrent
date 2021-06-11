export class Profile {
  version = '1.0.0';
  createdOn;
  credentials;
  xPrivKey;
  mnemonic;
  xPrivKeyEncrypted;
  mnemonicEncrypted;
  tempDeviceKey;
  prevTempDeviceKey;
  my_device_address;

  constructor(opts: any = {}) {
    opts = opts || {};

    this.createdOn = Date.now();
    this.credentials = opts.credentials || [];
    if (!opts.xPrivKey && !opts.xPrivKeyEncrypted) {
      throw Error('no xPrivKey, even encrypted');
    }
    // if (!opts.mnemonic && !opts.mnemonicEncrypted) {
    //   throw Error('no mnemonic, even encrypted');
    // }
    if (!opts.tempDeviceKey) {
      throw Error('no tempDeviceKey');
    }
    this.xPrivKey = opts.xPrivKey;
    this.mnemonic = opts.mnemonic;
    this.xPrivKeyEncrypted = opts.xPrivKeyEncrypted;
    this.mnemonicEncrypted = opts.mnemonicEncrypted;
    this.tempDeviceKey = opts.tempDeviceKey;
    this.prevTempDeviceKey = opts.prevTempDeviceKey; // optional
    this.my_device_address = opts.my_device_address;
  }


  static fromObj(obj) {
    const x = new Profile(obj);

    x.createdOn = obj.createdOn;
    x.credentials = obj.credentials;

    if (x.credentials[0] && typeof x.credentials[0] !== 'object') {
      throw new Error(('credentials should be an object'));
    }

    if (!obj.xPrivKey && !obj.xPrivKeyEncrypted) {
      throw Error('no xPrivKey, even encrypted');
    }
    // 	if (!obj.mnemonic && !obj.mnemonicEncrypted)
    // 		throw Error("no mnemonic, even encrypted");
    if (!obj.tempDeviceKey) {
      throw Error('no tempDeviceKey');
    }
    x.xPrivKey = obj.xPrivKey;
    x.mnemonic = obj.mnemonic;
    x.xPrivKeyEncrypted = obj.xPrivKeyEncrypted;
    x.mnemonicEncrypted = obj.mnemonicEncrypted;
    x.tempDeviceKey = obj.tempDeviceKey;
    x.prevTempDeviceKey = obj.prevTempDeviceKey; // optional
    x.my_device_address = obj.my_device_address;

    return x;
  }

  static fromString(str) {
    if (typeof str === 'string') {
      return Profile.fromObj(JSON.parse(str));
    }
    return Profile.fromObj(str);
  }

  toObj() {
    return JSON.stringify(this);
  }
}
