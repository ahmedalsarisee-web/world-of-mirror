import tokens from './design-tokens.json';

type ModeTokens = (typeof tokens)['light'];

export interface ThemeType {
  colors: ModeTokens['colors'] & {onPrimary: string};
  gradients: ModeTokens['gradients'];
  spacing: typeof tokens.spacing;
  radius: typeof tokens.radius;
  typographyScale: typeof tokens.typography;
  shadow: ModeTokens['shadow'];
  components: typeof tokens.components;
  status: {
    success: string;
    error: string;
    warning: string;
    info: string;
  };
  navigation: {
    activeTint: string;
    inactiveTint: string;
    background: string;
  };
  gradient: {
    header: string[];
    skeleton: string[];
    profile: string[];
  };
  typography: {
    primary: string;
    secondary: string;
    error: string;
    muted: string;
  };
  ui: {
    border: string;
    borderLight: string;
    shadow: string;
    lightGray: string;
  };
  backgrounds: {
    background: string;
  };
  base: {
    black: string;
    white: string;
  };
}

function build(mode: ModeTokens): ThemeType {
  const {colors, gradients, shadow} = mode;

  return {
    colors: {...colors, onPrimary: '#FFFFFF'},
    gradients,
    spacing: tokens.spacing,
    radius: tokens.radius,
    typographyScale: tokens.typography,
    shadow,
    components: tokens.components,
    status: {
      success: colors.success,
      error: colors.danger,
      warning: colors.warning,
      info: colors.primary,
    },
    navigation: {
      activeTint: colors.primary,
      inactiveTint: colors.icon,
      background: colors.surface,
    },
    gradient: {
      header: gradients.dashboard,
      skeleton: [colors.surfaceSecondary, colors.surfaceSecondary],
      profile: gradients.primary,
    },
    typography: {
      primary: colors.text,
      secondary: colors.textSecondary,
      error: colors.danger,
      muted: colors.textMuted,
    },
    ui: {
      border: colors.cardBorder,
      borderLight: colors.divider,
      shadow: '#000000',
      lightGray: colors.surfaceSecondary,
    },
    backgrounds: {
      background: colors.background,
    },
    base: {
      black: '#000000',
      white: '#FFFFFF',
    },
  };
}

export const lightTheme = build(tokens.light);
export const darkTheme = build(tokens.dark);
