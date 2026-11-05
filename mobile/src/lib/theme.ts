export const colors = {
  bg: '#F4F6F8',
  surface: '#FFFFFF',
  text: '#101828',
  textMuted: '#5B6472',
  textFaint: '#98A2B3',
  border: '#E3E7EC',
  primary: '#0F766E',
  primaryPressed: '#0B5E58',
  primarySoft: '#E3F3F1',
  success: '#157F3D',
  successSoft: '#E6F5EC',
  warning: '#B45309',
  warningSoft: '#FDF1E0',
  danger: '#B42318',
  dangerSoft: '#FDECEA',
  info: '#2052C9',
  infoSoft: '#E8EEFC',
  neutral: '#475467',
  neutralSoft: '#EEF0F3',
} as const;

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  primary: { fg: colors.primary, bg: colors.primarySoft },
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  neutral: { fg: colors.neutral, bg: colors.neutralSoft },
};

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const BRAND = {
  name: 'CareRound',
  tagline: 'Home care, verified.',
} as const;
