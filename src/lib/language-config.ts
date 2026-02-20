/**
 * Multi-language configuration for Pinterest scraping.
 * Maps language codes to Pinterest domains, DataForSEO settings, and HTTP headers.
 */

export type SupportedLanguage = 'de' | 'en' | 'fr' | 'es' | 'it' | 'pt' | 'nl';

export interface LanguageConfig {
  pinterestDomain: string;
  siteFilter: string;
  locationCode: number;
  languageCode: string;
  acceptLanguage: string;
  pinterestFallbackDomain: string;
}

const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  de: {
    pinterestDomain: 'de.pinterest.com',
    siteFilter: 'site:de.pinterest.com/ideas',
    locationCode: 2276,
    languageCode: 'de',
    acceptLanguage: 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    pinterestFallbackDomain: 'www.pinterest.de',
  },
  en: {
    pinterestDomain: 'www.pinterest.com',
    siteFilter: 'site:www.pinterest.com/ideas',
    locationCode: 2840,
    languageCode: 'en',
    acceptLanguage: 'en-US,en;q=0.9',
    pinterestFallbackDomain: 'www.pinterest.com',
  },
  fr: {
    pinterestDomain: 'fr.pinterest.com',
    siteFilter: 'site:fr.pinterest.com/ideas',
    locationCode: 2250,
    languageCode: 'fr',
    acceptLanguage: 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    pinterestFallbackDomain: 'www.pinterest.fr',
  },
  es: {
    pinterestDomain: 'es.pinterest.com',
    siteFilter: 'site:es.pinterest.com/ideas',
    locationCode: 2724,
    languageCode: 'es',
    acceptLanguage: 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
    pinterestFallbackDomain: 'www.pinterest.es',
  },
  it: {
    pinterestDomain: 'it.pinterest.com',
    siteFilter: 'site:it.pinterest.com/ideas',
    locationCode: 2380,
    languageCode: 'it',
    acceptLanguage: 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    pinterestFallbackDomain: 'www.pinterest.it',
  },
  pt: {
    pinterestDomain: 'br.pinterest.com',
    siteFilter: 'site:br.pinterest.com/ideas',
    locationCode: 2076,
    languageCode: 'pt',
    acceptLanguage: 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    pinterestFallbackDomain: 'www.pinterest.com.br',
  },
  nl: {
    pinterestDomain: 'nl.pinterest.com',
    siteFilter: 'site:nl.pinterest.com/ideas',
    locationCode: 2528,
    languageCode: 'nl',
    acceptLanguage: 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
    pinterestFallbackDomain: 'www.pinterest.nl',
  },
};

const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_CONFIGS) as SupportedLanguage[];

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

export function getLanguageConfig(lang?: string): LanguageConfig {
  if (lang && isSupportedLanguage(lang)) {
    return LANGUAGE_CONFIGS[lang];
  }
  return LANGUAGE_CONFIGS.de;
}

/**
 * Detect language from a Pinterest URL domain.
 * E.g. "fr.pinterest.com" → "fr", "br.pinterest.com" → "pt", "www.pinterest.com" → "en"
 */
export function detectLanguageFromUrl(url: string): SupportedLanguage | null {
  const subdomainMatch = url.match(/https?:\/\/([a-z]{2})\.pinterest\.com/);
  if (subdomainMatch) {
    const subdomain = subdomainMatch[1];
    if (subdomain === 'br') return 'pt';
    if (isSupportedLanguage(subdomain)) return subdomain;
  }
  if (/https?:\/\/www\.pinterest\.com/.test(url)) return 'en';
  return null;
}

export { SUPPORTED_LANGUAGES };
