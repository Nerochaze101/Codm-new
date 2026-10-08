// Centralized authentic CODM images with local asset imports and reliable CDN fallbacks
// Ensures images display properly in development, production, and cloud hosting (Render, Vercel, etc.)

import heroActionLocal from './images/codm_hero_action_1791303425231.jpg';
import sniperShipmentLocal from './images/codm_sniper_shipment_1791303451126.jpg';
import teamTacticalLocal from './images/codm_team_tactical_1791306219906.jpg';
import trophyPotLocal from './images/codm_trophy_pot_1791303439079.jpg';
import scoreVictoryLocal from './images/codm_score_victory_1791303464940.jpg';
import matchRoomBgLocal from './images/match_room_bg_1791331746985.jpg';
import appLogoLocal from './images/18012397-6DAC-458A-9230-E51DC47747A9.png';

export const CODM_IMAGES = {
  // App Official Professional Logo Icon Emblem
  appLogo: '/public/18012397-6DAC-458A-9230-E51DC47747A9.png',
  appLogoFallback: '/18012397-6DAC-458A-9230-E51DC47747A9.png',

  // Active Match Room Card Background
  matchRoomBg: matchRoomBgLocal || '/src/assets/images/match_room_bg_1791331746985.jpg',
  matchRoomBgFallback: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',

  // 1v1 Shipment Card Background
  shipment1v1: sniperShipmentLocal || '/images/codm_sniper_shipment_1791303451126.jpg',
  shipment1v1Fallback: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',

  // Squad / Team Tactical Card Background
  squadTactical: teamTacticalLocal || '/images/codm_team_tactical_1791306219906.jpg',
  squadTacticalFallback: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',

  // Hero Banner Action
  heroAction: heroActionLocal || '/images/codm_hero_action_1791303425231.jpg',
  heroActionFallback: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1600&q=80',

  // Trophy & Pot
  trophyPot: trophyPotLocal || '/images/codm_trophy_pot_1791303439079.jpg',
  trophyPotFallback: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80',

  // Score Victory
  scoreVictory: scoreVictoryLocal || '/images/codm_score_victory_1791303464940.jpg',
  scoreVictoryFallback: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80',

  // Maps gallery
  maps: {
    Shipment: sniperShipmentLocal || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80',
    Killhouse: 'https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?auto=format&fit=crop&w=800&q=80',
    Standoff: teamTacticalLocal || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80',
    Summit: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    Rust: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    'Firing Range': 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80',
    Nuketown: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80',
    Isolated: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
  } as Record<string, string>,
};
