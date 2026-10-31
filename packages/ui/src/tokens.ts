const font = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
} as const;

type FontWeight = '400' | '500' | '600';

interface TypeStyle {
  fontFamily: (typeof font)[keyof typeof font];
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
  letterSpacing?: number;
}

// Static Geist has no 450 weight, so 450 maps to Geist_400Regular.
const regular = { fontFamily: font.regular, fontWeight: '400' } as const;
const medium = { fontFamily: font.medium, fontWeight: '500' } as const;
const semibold = { fontFamily: font.semibold, fontWeight: '600' } as const;

export const tokens = {
  color: {
    canvas: '#e4e4e4',
    surface: '#f2f2f2',
    surfaceRaised: '#ffffff',
    surfaceSunken: '#e6e6e6',
    track: '#d9d9d9',
    ink: '#141414',
    inkMuted: '#5c5c5c',
    inkSubtle: '#737373',
    brand: '#e2643f',
    brandStrong: '#b84424',
    brandSoft: '#ef8a6c',
    brandHalo: '#f6c9b9',
    onBrand: '#2a0e06',
    night: '#3d3d3d',
    nightRaised: '#575757',
    onNight: '#ffffff',
    onNightMuted: '#d0d0d0',
    // Proposed design-system addition: third ring colour.
    ringFresh: '#8a8a8a',
  },
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 12: 48 },
  radius: { sm: 14, md: 22, lg: 28, xl: 40, pill: 999 },
  shadow: {
    card: '0 10px 30px rgba(0, 0, 0, 0.06)',
    float: '0 6px 16px rgba(0, 0, 0, 0.10)',
    glow: '0 8px 22px rgba(226, 100, 63, 0.40)',
    inset: 'inset 0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  type: {
    // letterSpacing is em x fontSize, in px.
    displayXl: { ...regular, fontSize: 64, lineHeight: 64, letterSpacing: -1.92 },
    display: { ...regular, fontSize: 40, lineHeight: 40, letterSpacing: -1 },
    statLg: { ...medium, fontSize: 32, lineHeight: 36, letterSpacing: -0.64 },
    stat: { ...medium, fontSize: 24, lineHeight: 28, letterSpacing: -0.24 },
    title: { ...medium, fontSize: 24, lineHeight: 30 },
    heading: { ...medium, fontSize: 18, lineHeight: 24 },
    body: { ...regular, fontSize: 15, lineHeight: 22 },
    button: { ...semibold, fontSize: 14, lineHeight: 20 },
    label: { ...regular, fontSize: 13, lineHeight: 18 },
    caption: { ...regular, fontSize: 12, lineHeight: 16 },
  },
} satisfies {
  color: Record<string, string>;
  space: Record<number, number>;
  radius: Record<string, number>;
  shadow: Record<string, string>;
  type: Record<string, TypeStyle>;
};

export type ColorToken = keyof typeof tokens.color;
export type TypeVariant = keyof typeof tokens.type;
