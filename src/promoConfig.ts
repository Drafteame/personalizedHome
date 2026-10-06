import type { ActivePromo } from './types';

/** Quick Bet Figma: 2194:29841 / 2194:30544. Values are prototype offers. */
export const promoConfig = {
  freeBetStake: 25,
  boosterMultiplier: 1.2, // Figma explicitly boosts 120x to 144x.
  minimumSelections: 3,
  booster: {
    selectedBackground: 'linear-gradient(13.0927324629deg, rgba(255,166,91,0.16) 2.2306%, rgba(240,171,252,0.16) 102.71%)',
    badgeBackground: 'linear-gradient(12.1605676421deg, #ffa65b 2.2306%, #f0abfc 102.71%)',
    oddsBackground: 'linear-gradient(24.2035918548deg, #ffa65b 2.2306%, #f0abfc 102.71%)',
    winningsBackground: 'linear-gradient(41.0801059572deg, #ffa65b 2.2306%, #f0abfc 102.71%)',
    successBackground: 'linear-gradient(18.8547942787deg, #ffa65b 2.2306%, #f0abfc 102.71%)',
    successBadgeBackground: 'linear-gradient(26.2691557132deg, #ffa65b 2.2306%, #f0abfc 102.71%)',
    colors: ['#ffa65b', '#f0abfc'],
    ticketColors: ['#ffa65b', 'rgb(238.82411599,145.81279814,255)'],
    glowRgb: '231,165,242',
    // Inverse of the source Figma paint transform, object-bounding-box space.
    paintTransform: 'matrix(1.15501219476 -0.9228753056 1.41340188142 1.69417199143 -0.861713187165 0.0161513331284)',
    border: '#ffa65b',
  },
  freebet: {
    selectedBackground: 'linear-gradient(170.943711615deg, rgba(240,171,252,0.16) 0%, rgba(107,71,255,0.16) 100%)',
    badgeBackground: 'linear-gradient(169.6167432476deg, #f0abfc 0%, #6b47ff 100%)',
    oddsBackground: 'linear-gradient(169.6167432476deg, #f0abfc 0%, #6b47ff 100%)',
    successBackground: 'linear-gradient(166.7801621457deg, #f0abfc 0%, #6b47ff 100%)',
    successBadgeBackground: 'linear-gradient(169.6167432476deg, #f0abfc 0%, #6b47ff 100%)',
    colors: ['#f0abfc', '#6b47ff'],
    ticketColors: ['#f0abfc', '#6b47ff'],
    glowRgb: '107,71,255',
    paintTransform: 'matrix(1 1 -1 0.824545315937 0.5 -0.412272657968)',
    border: '#f0abfc',
  },
} as const;

/** Preserve the prototype's gross payout convention for every promo. */
export function promoValues(promo: ActivePromo, stake: number, baseOdds: number) {
  const amount = promo === 'freebet' ? promoConfig.freeBetStake : stake;
  const odds = promo === 'booster' ? baseOdds * promoConfig.boosterMultiplier : baseOdds;
  return { stake: amount, odds, winnings: Math.round(amount * odds) };
}

export const formatPromoAmount = (amount: number) =>
  amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
