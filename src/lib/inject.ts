import * as lang from '../lib/language';
import audioContext from './spoof/audioContext';
import clientRects from './spoof/clientRects';
import font from './spoof/font';
import history from './spoof/history';
import kbFingerprint from './spoof/kbFingerprint';
import language from './spoof/language';
import media from './spoof/media';
import navigator from './spoof/navigator';
import referer from './spoof/referer';
import screen from './spoof/screen';
import timezone from './spoof/timezone';
import winName from './spoof/name';
import util from './util';

const moment = require('moment-timezone');

class Injector {
  public enabled: boolean;
  public notifyId: string;
  private spoof = {
    custom: '',
    overwrite: [],
    metadata: {},
  };

  constructor(settings: any, tempStore: any, profileCache: any, seed: number) {
    if (!settings.config.enabled) {
      this.enabled = false;
      return;
    }

    this.enabled = true;
    this.notifyId = tempStore.notifyId;

    // profile to be used for injection
    let p: any = null;
    let wl = util.findWhitelistRule(settings.whitelist.rules, window.location.host, window.location.href);

    if (wl === null) {
      if (tempStore.profile && tempStore.profile != 'none') {
        p = profileCache[tempStore.profile];
      } else {
        if (settings.profile.selected != 'none') {
          p = profileCache[settings.profile.selected];
        }
      }

      if (settings.options.blockMediaDevices) this.updateInjectionData(media);

      if (settings.options.limitHistory) this.updateInjectionData(history);

      if (settings.options.protectKBFingerprint.enabled) {
        this.spoof.metadata['kbDelay'] = settings.options.protectKBFingerprint.delay;
        this.updateInjectionData(kbFingerprint);
      }

      if (settings.headers.spoofAcceptLang.enabled) {
        if (settings.headers.spoofAcceptLang.value != 'default') {
          let spoofedLang: string;

          if (settings.headers.spoofAcceptLang.value === 'ip') {
            spoofedLang = tempStore.ipInfo.lang;
          } else {
            spoofedLang = settings.headers.spoofAcceptLang.value;
          }

          let l = lang.getLanguage(spoofedLang);
          if (language.data[0].value === 'code') {
            language.data[0].value = spoofedLang;
            // @ts-ignore
            language.data[1].value = l.nav;
          } else {
            // @ts-ignore
            language.data[0].value = l.nav;
            language.data[1].value = spoofedLang;
          }
        }
      }

      if (settings.options.protectWinName) {
        // check if google domain
        if (!/\.google\.com$/.test(window.top.location.host)) {
          this.updateInjectionData(winName);
        }
      }

      if (settings.options.spoofAudioContext) {
        this.spoof.metadata['audioContextSeed'] = seed;
        this.updateInjectionData(audioContext);
      }

      if (settings.options.spoofClientRects) {
        this.spoof.metadata['clientRectsSeed'] = seed;
        this.updateInjectionData(clientRects);
      }

      if (settings.options.spoofFontFingerprint) {
        if (p) {
          this.spoof.metadata['fontFingerprintOS'] = p.osId;
          this.updateInjectionData(font);
        }
      }

      if (settings.options.screenSize != 'default') {
        if (settings.options.screenSize == 'profile' && p) {
          this.spoof.metadata['screen'] = {
            width: p.screen.width,
            height: p.screen.height,
            availHeight: p.screen.availHeight,
            deviceScaleFactor: p.screen.deviceScaleFactor,
            usingProfileRes: true,
          };
        } else {
          let scr: number[] = settings.options.screenSize.split('x').map(Number);

          this.spoof.metadata['screen'] = {
            width: scr[0],
            height: scr[1],
            usingProfileRes: false,
          };
        }

        this.updateInjectionData(screen);
      }

      if (settings.options.timeZone != 'default') {
        let tz: string = settings.options.timeZone;

        if (tz === 'ip') {
          tz = tempStore.ipInfo.tz;
        }

        this.spoof.metadata['timezone'] = {
          locale: 'en-US',
          zone: moment.tz.zone(tz),
        };

        this.updateInjectionData(timezone);
      }

      if (settings.headers.referer.disabled) {
        this.updateInjectionData(referer);
      }
    } else {
      if (wl.options.name) this.updateInjectionData(winName);

      let l = lang.getLanguage(wl.lang);
      if (language.data[0].value === 'code') {
        language.data[0].value = wl.lang;
        // @ts-ignore
        language.data[1].value = l.nav;
      } else {
        // @ts-ignore
        language.data[0].value = l.nav;
        language.data[1].value = wl.lang;
      }

      if (wl.profile != 'none') {
        if (wl.profile === 'default' && settings.whitelist.defaultProfile != 'none') {
          p = profileCache[settings.whitelist.defaultProfile];
        } else {
          p = profileCache[wl.profile];
        }
      }
    }

    if (language.data[0].value != 'code') {
      this.updateInjectionData(language);
    }

    if (p) {
      for (let i = 0; i < navigator.data.length; i++) {
        navigator.data[i].value = p.navigator[navigator.data[i].prop];
      }

      this.updateInjectionData(navigator);
    }
  }

  public injectIntoPage(): void {
    let code: string = this.finalOutput();
    let scriptEl = Object.assign(document.createElement('script'), {
      textContent: code,
      id: 'chameleon',
    });

    document.documentElement.appendChild(scriptEl);
    scriptEl.remove();

    // try injecting again to bypass cors
    scriptEl = document.createElement('script');
    scriptEl.src = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    (document.head || document.documentElement).appendChild(scriptEl);
    try {
      URL.revokeObjectURL(scriptEl.src);
    } catch (e) {}
    scriptEl.remove();
  }

  public finalOutput(): string {
    if (!this.enabled) return '';

    // generate unique variable name
    let chameleonObjName =
      String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
      Math.random()
        .toString(36)
        .substring(Math.floor(Math.random() * 5) + 5);

    return `
    (function(){
        if (
          window.location.href.startsWith("https://www.google.com/recaptcha/api2") || 
          window.location.href.startsWith("https://accounts.google.com/")          ||
          window.location.href.startsWith("https://accounts.youtube.com/")         ||
          window.location.href.startsWith("https://disqus.com/embed/comments/")    ||
          window.CHAMELEON_SPOOF
        ) { 
          return;
        }

        let CHAMELEON_SPOOF = new WeakMap();
        CHAMELEON_SPOOF.set(window, JSON.parse(\`${JSON.stringify(this.spoof.metadata)}\`));
        window.CHAMELEON_SPOOF = Symbol.for("CHAMELEON_SPOOF");

        let injectionProperties = JSON.parse(\`${JSON.stringify(this.spoof.overwrite)}\`);

        injectionProperties.forEach(injProp => {
          if (injProp.obj === 'window') {
            window[injProp.prop] = injProp.value;
          } else if (injProp.obj === 'window.navigator' && injProp.value === null) {
            delete navigator.__proto__[injProp.prop];
          } else if (injProp.obj === 'window.navigator' && injProp.prop == 'mimeTypes') {
            let mimes = (() => {
              const mimeArray = []
              injProp.value.forEach(p => {
                function FakeMimeType () { return p }
                const mime = new FakeMimeType()
                Object.setPrototypeOf(mime, MimeType.prototype);
                mimeArray.push(mime)
              })
              Object.setPrototypeOf(mimeArray, MimeTypeArray.prototype);
              return mimeArray
            })();

            Object.defineProperty(window.navigator, 'mimeTypes', {
              configurable: true,
              value: mimes
            });
          } else if (injProp.obj === 'window.navigator' && injProp.prop == 'plugins') {
            let plugins = (() => {
              const pluginArray = []
              injProp.value.forEach(p => {
                function FakePlugin () { return p }
                const plugin = new FakePlugin()
                Object.setPrototypeOf(plugin, Plugin.prototype);
                pluginArray.push(plugin)
              })
              Object.setPrototypeOf(pluginArray, PluginArray.prototype);
              return pluginArray
            })();

            Object.defineProperty(window.navigator, 'plugins', {
              configurable: true,
              value: plugins
            });
          } else {
            Object.defineProperty(injProp.obj.split('.').reduce((p,c)=>p&&p[c]||null, window), injProp.prop, {
              configurable: true,
              value: injProp.value
            });
          }
        });
        
        let iframeWindow = HTMLIFrameElement.prototype.__lookupGetter__('contentWindow');
        let iframeDocument = HTMLIFrameElement.prototype.__lookupGetter__('contentDocument');

        ${this.spoof.custom}

        Object.defineProperties(HTMLIFrameElement.prototype, {
          contentWindow: {
            get: function() {
              let f = iframeWindow.apply(this);
              if (f) {
                try {
                  Object.defineProperty(f, 'Date', {
                    value: window.Date
                  });
  
                  Object.defineProperty(f.Intl, 'DateTimeFormat', {
                    value: window.Intl.DateTimeFormat
                  });
  
                  Object.defineProperty(f, 'screen', {
                    value: window.screen
                  });
  
                  Object.defineProperty(f, 'navigator', {
                    value: window.navigator
                  });

                  Object.defineProperty(f.Element.prototype, 'getBoundingClientRect', {
                    value: window.Element.prototype.getBoundingClientRect
                  });

                  Object.defineProperty(f.Element.prototype, 'getClientRects', {
                    value: window.Element.prototype.getClientRects
                  });

                  Object.defineProperty(f.Range.prototype, 'getBoundingClientRect', {
                    value: window.Range.prototype.getClientRects
                  });

                  Object.defineProperty(f.Range.prototype, 'getClientRects', {
                    value: window.Range.prototype.getClientRects
                  });
                } catch (e) {}
              }
              return f;
            }
          },
          contentDocument: {
            get: function() {
              this.contentWindow;
              return iframeDocument.apply(this);
            }
          }
        });
    })()
    `.replace(/CHAMELEON_SPOOF/g, chameleonObjName);
  }

  private updateInjectionData(option: any) {
    if (option.type === 'overwrite') {
      this.spoof.overwrite = this.spoof.overwrite.concat(option.data);
    } else {
      this.spoof.custom += option.data;
    }
  }
}

// @ts-ignore
let chameleonInjector = new Injector(settings, tempStore, profileCache, seed);

if (chameleonInjector.enabled) {
  chameleonInjector.injectIntoPage();
}
