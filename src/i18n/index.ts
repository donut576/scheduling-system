import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from './zh-TW';
import enUS from './en-US';

i18n.use(initReactI18next).init({
  resources: {
    'zh-TW': { translation: zhTW },
    'en-US': { translation: enUS },
  },
  lng: 'zh-TW',
  fallbackLng: 'zh-TW',
  interpolation: { escapeValue: false },
});

export default i18n;
