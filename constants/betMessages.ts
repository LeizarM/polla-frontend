/**
 * Trash-talk bet messages — used to roast the user's pick whenever they tap
 * a match prediction. Each set is themed on which option they picked.
 *
 * Usage:
 *   getRandomBetMessage('L', 'Argentina', 'España')
 *     → "¿Estás seguro? Yo apostaría por España, están en modo destructor últimamente."
 */

// Local-win → user picks team A → we troll-suggest team B
const LOCAL_TROLL: ((a: string, b: string) => string)[] = [
  (a, b) => `¿Estás seguro? Yo apostaría por ${b}, están en modo destructor últimamente. 😏`,
  (a, b) => `Jajaja, ¿${a} gana? Hermano, eso es fe ciega… yo me voy con ${b}. 🙄`,
  (a, b) => `Tranquilo, pero… ¿no viste cómo juega ${b} de visitante? Yo cambiaría ya. 👀`,
  (a, b) => `Estás arriesgando mucho… yo apostaría a ${b}, tienen la racha. 🔥`,
  (a, b) => `¿Gana ${a}? Jajaja, buena broma. Piensa mejor, ${b} les clava dos. ⚽⚽`,
];

// Visitor-win → user picks team B → we troll-suggest team A
const VISITOR_TROLL: ((a: string, b: string) => string)[] = [
  (a, b) => `¿Estás seguro? Yo apostaría por ${a}, en casa son otra cosa. 🏠`,
  (a, b) => `Jajaja, ¿${b} gana? Nah, eso no pasa ni en los sueños. Yo me voy con ${a}. 😴`,
  (a, b) => `Hermano… ${a} en su estadio es imbatible. Yo cambiaría esa apuesta. 🛡️`,
  (a, b) => `Estás muy confiado, pero yo apostaría a ${a}, tienen el factor cancha. 🏟️`,
  (a, b) => `¿${b} gana? Jajaja, chiste del año. Piensa mejor, ${a} les revienta. 💥`,
];

// Empate → most trolled of all
const EMPATE_TROLL: ((a: string, b: string) => string)[] = [
  (a, b) => `¿Empate? Jajaja, ¿es un chiste? Piensa mejor, va a ganar ${a}. 🤡`,
  (a, b) => `Empate es de cobardes, elige un ganador de verdad. Yo apostaría a ${b}. 😤`,
  (a, b) => `¡¿Empate?! Hermano, eso es rendirse… yo me voy con ${a} full. 🚀`,
  (a, b) => `Estás jugando a lo seguro pero… ¿empate? Nah, yo apostaría a ${b}, va a haber goles. 🥅⚽`,
  (a, b) => `Empate es la opción de los que no se atreven. Piensa mejor, ${a} gana fácil. 😬`,
  (a, b) => `Jajaja, empate… clásico de perdedores. Yo apostaría a ${b} sin pensarlo. 🎯`,
];

// Universal trolls — fallback when team names aren't available
const UNIVERSAL_TROLL: string[] = [
  '¿Estás seguro de verdad? Porque yo apostaría por lo contrario y estoy muy confiado. 🤨',
  'Jajaja, ¿esa es tu apuesta? Yo cambiaría ya… pero tú decides, eh 😉',
  'Buena elección… dije sarcasmo. Yo me voy con la otra. 😂',
  'Estás a punto de arrepentirte… yo apostaría por el otro resultado. 🫣',
  'Confía en tu instinto… o mejor confía en el mío, yo apostaría por lo contrario. 🧠',
];

export type PickKind = 'L' | 'E' | 'V';

/**
 * Returns a random troll message tailored to the pick.
 *
 * @param pick   'L' = local wins, 'V' = visitor wins, 'E' = empate
 * @param teamA  local team name (optional — falls back to universal trolls if absent)
 * @param teamB  visitor team name (optional)
 */
export function getRandomBetMessage(
  pick?: PickKind,
  teamA?: string,
  teamB?: string,
): string {
  const a = (teamA ?? '').trim();
  const b = (teamB ?? '').trim();
  // If we don't have both team names, fall back to universal trolls
  if (!a || !b || !pick) {
    return UNIVERSAL_TROLL[Math.floor(Math.random() * UNIVERSAL_TROLL.length)];
  }
  const pool =
    pick === 'L' ? LOCAL_TROLL :
    pick === 'V' ? VISITOR_TROLL :
                   EMPATE_TROLL;
  const fn = pool[Math.floor(Math.random() * pool.length)];
  return fn ? fn(a, b) : UNIVERSAL_TROLL[0];
}
