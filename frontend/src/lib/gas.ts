import type { GasType } from './domain'

// Shoulder colours from ISO 32 (medical/industrial gas cylinder identification),
// so the swatch matches what operators see on the physical cylinder.
export const GAS_META: Record<GasType, { color: string; formula: string }> = {
  Oxygen: { color: '#ffffff', formula: 'O₂' },
  Nitrogen: { color: '#1b1b1b', formula: 'N₂' },
  Argon: { color: '#2f6b3a', formula: 'Ar' },
  'Carbon Dioxide': { color: '#8a8d91', formula: 'CO₂' },
  Acetylene: { color: '#7a1f2b', formula: 'C₂H₂' },
  Hydrogen: { color: '#d3302f', formula: 'H₂' },
}
