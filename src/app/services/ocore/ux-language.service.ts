import { Injectable } from '@angular/core';
import lodash from 'lodash';
import { LogService } from '../log.service';
import { OcoreConfigService } from './ocore-config.service';

@Injectable({
  providedIn: 'root'
})
export class UxLanguageService {
  root = {};

  availableLanguages = [{
    name: 'English',
    isoCode: 'en',
  }, {
    name: 'Français',
    isoCode: 'fr_FR',
  }, {
    name: 'Italiano',
    isoCode: 'it_IT',
  }, {
    name: 'Deutsch',
    isoCode: 'de_DE',
  }, {
    name: 'Español',
    isoCode: 'es_ES',
  }, {
    name: 'Português',
    isoCode: 'pt_PT',
  }, {
    name: 'Nederlands',
    isoCode: 'nl_NL',
  }, {
    name: 'Dansk',
    isoCode: 'da_DK',
  }, {
    name: 'Svenska',
    isoCode: 'sv_SE',
  }, {
    name: 'Polski',
    isoCode: 'pl_PL',
  }, {
    name: 'Eesti',
    isoCode: 'et_EE',
  }, {
    name: 'Bosanski',
    isoCode: 'bs_BA',
  }, {
    name: 'Hrvatski',
    isoCode: 'hr_HR',
  }, {
    name: 'Srpski',
    isoCode: 'sr_CS',
  }, {
    name: 'Magyar',
    isoCode: 'hu_HU',
  }, {
    name: 'Română',
    isoCode: 'ro_RO',
  }, {
    name: 'Shqip',
    isoCode: 'sq_AL',
  }, {
    name: 'Nigerian (Pidgin)',
    isoCode: 'pcm_NG',
  }, {
    name: 'Ελληνικά',
    isoCode: 'el_GR',
  }, {
    name: 'हिन्दी',
    isoCode: 'hi_IN',
  }, {
    name: '日本語',
    isoCode: 'ja_jp',
    useIdeograms: true,
  }, {
    name: '中文',
    isoCode: 'zh_CN',
    useIdeograms: true,
  }, {
    name: '한국어',
    isoCode: 'ko_KR',
  }, {
    name: 'Pусский',
    isoCode: 'ru_RU',
  }, {
    name: 'Bahasa Indonesia',
    isoCode: 'id_ID',
  }, {
    name: 'Filipino',
    isoCode: 'fil_PH',
  }, {
    name: 'Tiếng Việt',
    isoCode: 'vi_VN',
  }, {
    name: 'Èdè Yorùbá',
    isoCode: 'yo_NG',
  }, {
    name: 'Türk',
    isoCode: 'tr_TR',
  }];

  currentLanguage = null;

  constructor(
    public configService: OcoreConfigService,
    public log: LogService
  ) { }

  _detect() {
    // Auto-detect browser language
    let userLang, androidLang;
    const navigator = window.navigator as any;
    androidLang = navigator.userAgent.match(/android.*\W(\w\w)-(\w\w)\W/i);
    if (navigator && navigator.userAgent && (androidLang)) {
      userLang = androidLang[1];
    } else {
      // works for iOS and Android 4.x
      userLang = navigator.userLanguage || navigator.language;
    }
    userLang = userLang ? (userLang.split('-', 1)[0] || 'en') : 'en';

    for (const availableLanguage of this.availableLanguages) {
      const isoCode = availableLanguage.isoCode;
      if (userLang === isoCode.substr(0, 2)) {
        return isoCode;
      }
    }

    return 'en';
  }

  _set(lang) {
    this.log.debug('Setting default language: ' + lang);
    this.currentLanguage = lang;
  }

  getCurrentLanguage() {
    return this.currentLanguage;
  }

  getCurrentLanguageName() {
    return this.getName(this.currentLanguage);
  }

  getCurrentLanguageInfo() {
    return lodash.find(this.availableLanguages, {
      isoCode: this.currentLanguage
    });
  }

  getLanguages() {
    return this.availableLanguages;
  }

  init() {
    this._set(this._detect());
  }

  update() {
    let userLang = this.configService.getSync().wallet.settings.defaultLanguage;

    if (!userLang) {
      userLang = this._detect();
    }

    return userLang;
  }

  getName(lang) {
    return lodash.result(lodash.find(this.availableLanguages, {
      isoCode: lang
    }), 'name');
  }
}
