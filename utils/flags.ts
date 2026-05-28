/**
 * Country flag emoji map and ISO country code map.
 * Maps country names (in Spanish) to flag emojis and ISO codes for flag CDN.
 */

const COUNTRY_ISO: Record<string, string> = {
  'Argentina': 'ar', 'Brasil': 'br', 'Mexico': 'mx', 'México': 'mx',
  'España': 'es', 'Alemania': 'de', 'Francia': 'fr', 'Inglaterra': 'gb-eng',
  'Portugal': 'pt', 'Italia': 'it', 'Holanda': 'nl', 'Países Bajos': 'nl',
  'Colombia': 'co', 'Uruguay': 'uy', 'Chile': 'cl', 'Peru': 'pe', 'Perú': 'pe',
  'Ecuador': 'ec', 'Bolivia': 'bo', 'Paraguay': 'py', 'Venezuela': 've',
  'Estados Unidos': 'us', 'USA': 'us', 'Canadá': 'ca', 'Canada': 'ca',
  'Japón': 'jp', 'Corea del Sur': 'kr', 'Australia': 'au', 'Marruecos': 'ma',
  'Senegal': 'sn', 'Ghana': 'gh', 'Camerún': 'cm', 'Nigeria': 'ng', 'Túnez': 'tn',
  'Costa Rica': 'cr', 'Panamá': 'pa', 'Honduras': 'hn', 'Jamaica': 'jm',
  'Arabia Saudita': 'sa', 'Qatar': 'qa', 'Irán': 'ir', 'Croacia': 'hr',
  'Suiza': 'ch', 'Dinamarca': 'dk', 'Polonia': 'pl', 'Bélgica': 'be', 'Serbia': 'rs',
  'Gales': 'gb-wls', 'Escocia': 'gb-sct', 'Sudáfrica': 'za', 'Egipto': 'eg',
  'Argelia': 'dz', 'China': 'cn', 'India': 'in', 'Rusia': 'ru', 'Turquía': 'tr',
  'Suecia': 'se', 'Noruega': 'no', 'Austria': 'at', 'República Checa': 'cz',
  'Ucrania': 'ua', 'Rumania': 'ro', 'Grecia': 'gr', 'Hungría': 'hu',
  'Eslovenia': 'si', 'Eslovaquia': 'sk', 'Finlandia': 'fi', 'Islandia': 'is',
  'Albania': 'al', 'Montenegro': 'me', 'Macedonia del Norte': 'mk',
  'Trinidad y Tobago': 'tt', 'El Salvador': 'sv', 'Guatemala': 'gt',
  'Cuba': 'cu', 'República Dominicana': 'do', 'Haití': 'ht', 'Uzbekistán': 'uz',
  'Irak': 'iq', 'Siria': 'sy', 'Jordania': 'jo', 'Palestina': 'ps',
  'Líbano': 'lb', 'Omán': 'om', 'Bahréin': 'bh', 'Kuwait': 'kw',
  'Emiratos Árabes Unidos': 'ae',
};

const FLAGS: Record<string, string> = {
  'Argentina': '🇦🇷', 'Brasil': '🇧🇷', 'Mexico': '🇲🇽', 'México': '🇲🇽',
  'España': '🇪🇸', 'Alemania': '🇩🇪', 'Francia': '🇫🇷', 'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Portugal': '🇵🇹', 'Italia': '🇮🇹', 'Holanda': '🇳🇱', 'Países Bajos': '🇳🇱',
  'Colombia': '🇨🇴', 'Uruguay': '🇺🇾', 'Chile': '🇨🇱', 'Peru': '🇵🇪', 'Perú': '🇵🇪',
  'Ecuador': '🇪🇨', 'Bolivia': '🇧🇴', 'Paraguay': '🇵🇾', 'Venezuela': '🇻🇪',
  'Estados Unidos': '🇺🇸', 'USA': '🇺🇸', 'Canadá': '🇨🇦', 'Canada': '🇨🇦',
  'Japón': '🇯🇵', 'Corea del Sur': '🇰🇷', 'Australia': '🇦🇺', 'Marruecos': '🇲🇦',
  'Senegal': '🇸🇳', 'Ghana': '🇬🇭', 'Camerún': '🇨🇲', 'Nigeria': '🇳🇬', 'Túnez': '🇹🇳',
  'Costa Rica': '🇨🇷', 'Panamá': '🇵🇦', 'Honduras': '🇭🇳', 'Jamaica': '🇯🇲',
  'Arabia Saudita': '🇸🇦', 'Qatar': '🇶🇦', 'Irán': '🇮🇷', 'Croacia': '🇭🇷',
  'Suiza': '🇨🇭', 'Dinamarca': '🇩🇰', 'Polonia': '🇵🇱', 'Bélgica': '🇧🇪', 'Serbia': '🇷🇸',
  'Gales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Escocia': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
};

/**
 * Returns a flag image URL from flagcdn.com for a country.
 */
export function getFlagImageUrl(country?: string | null, size: number = 64): string | null {
  if (!country) return null;
  const iso = COUNTRY_ISO[country];
  if (!iso) return null;
  // flagcdn.com supports svg and png
  return `https://upload.wikimedia.org/wikipedia/commons/e/e3/Flag_of_Papua_New_Guinea.svg`;
}

/**
 * Returns the flag emoji for a country.
 */
export function getFlag(country?: string | null): string {
  if (!country) return '🏳️';
  return FLAGS[country] ?? '🏳️';
}

/**
 * Returns the ISO code for a country.
 */
export function getCountryIso(country?: string | null): string | null {
  if (!country) return null;
  return COUNTRY_ISO[country] ?? null;
}

/**
 * Returns true if the team has a shield_url.
 */
export function hasShield(team?: any): boolean {
  return !!team?.shield_url;
}