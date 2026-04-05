// src/lib/i18n/index.ts
import { derived } from 'svelte/store';
import { get } from 'svelte/store';
import { settingsStore } from '../stores/settingsStore';
import { en } from './en';
import { pl } from './pl';
import type { Translations } from './types';
import type { AppLanguage } from '../types';

function resolve(lang: AppLanguage): Translations {
  const effective =
    lang === 'auto'
      ? (typeof navigator !== 'undefined' && navigator.language.startsWith('pl') ? 'pl' : 'en')
      : lang;
  return effective === 'pl' ? pl : en;
}

export const t = derived(settingsStore, s => resolve(s.language));

export function currentTranslations(): Translations {
  return resolve(get(settingsStore).language);
}
