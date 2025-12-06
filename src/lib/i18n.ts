
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';
import { UI_LANGUAGES } from './constants';

i18n
  .use(HttpApi)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    react: {
      useSuspense: true,
    },
    lng: 'en', // Set a default language
    fallbackLng: 'en',
    supportedLngs: UI_LANGUAGES.map(lang => lang.value),
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    ns: ['common', 'userMenu', 'libraryPage', 'createPage', 'bookCard', 'achievements', 'presets', 'learningPage', 'playlist', 'readerPage', 'settingsPage', 'vocabularyPage', 'vocabularyItemCard', 'miniAudioPlayer', 'toast'], // Define all namespaces
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
