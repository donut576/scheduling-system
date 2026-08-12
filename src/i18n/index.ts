/**
 * i18next 國際化（i18n）初始化設定檔。
 * 整合 zh-TW（繁體中文）與 en-US（英文）兩套翻譯資源，
 * 並設定預設語言與語言切換失敗時的備援語言（fallback）。
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from './zh-TW';
import enUS from './en-US';

// 初始化 i18next，並掛載 react-i18next 讓 React 元件可使用 useTranslation 等 hook
i18n.use(initReactI18next).init({
  resources: {
    // 各語系對應的翻譯字典，key 為語系代碼，value.translation 為翻譯字串物件
    'zh-TW': { translation: zhTW },
    'en-US': { translation: enUS },
  },
  // 預設語言：繁體中文
  lng: 'zh-TW',
  // 當找不到對應語言的翻譯時，退回使用的語言
  fallbackLng: 'zh-TW',
  // 關閉 i18next 內建的 HTML escape，因為 React 本身已會處理 XSS 逃逸
  interpolation: { escapeValue: false },
});

export default i18n;
