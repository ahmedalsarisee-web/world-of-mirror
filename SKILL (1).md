---
name: rn-conventions
description: React Native project conventions for the user's apps — folder layout, screen/component patterns, StyleSheet-factory styling, theme tokens, i18next localization (en/ar), and full RTL directional helpers. Use when editing or creating files in any React Native project that follows these conventions (look for `shared/theme/theme.ts`, `@app` / `@shared` path aliases, or `*.styles.ts(x)` files). Apply automatically — do not announce.
---

# React Native conventions

These are the conventions used in InspectionMobileApp, UAE-PLATES, SmartWatchApp, RNLatestApp. When working in any of these, follow them by default.

## Detecting that these conventions apply

Look for ANY of these signals:
- `shared/theme/theme.ts` exists
- `tsconfig.json` has `@app/*` or `@shared/*` paths
- Files named `*.styles.ts` or `*.styles.tsx` co-located with components
- `src/I18n/{en,ar}/translation.json` present
- `shared/utils/directionalStyles.ts` exists

If none are present, ask before applying — the project may use different conventions.

## Folder layout

```
<root>/
├── App.tsx                  # main app shell (providers + navigation)
├── AppEntry.tsx             # optional: router between app modes
├── bootstrap.ts             # optional: env detection + i18n init
├── RootNavigation.ts        # navigation ref + imperative nav helpers
├── index.js                 # registers root component
├── src/
│   ├── I18n/{en,ar}/translation.json
│   ├── I18n/index.ts        # i18next init
│   ├── assets/
│   ├── components/
│   │   ├── general/         # reusable atomic (button, row, column, typography)
│   │   └── private/         # domain-specific (fine-card, plate-tag, header)
│   ├── config/
│   ├── constants/
│   ├── context/             # React contexts (ThemeContext, LangContext, ...)
│   ├── enums/
│   ├── hooks/
│   ├── navigation/          # AppNavigator + StackNavigators/
│   ├── redux/               # *.reducers.ts + selectors/
│   ├── screens/             # PascalCase folders per screen
│   ├── services/            # API + business logic
│   ├── store/               # store.ts (redux-toolkit + redux-persist)
│   ├── svg/                 # SVG-as-component
│   ├── types/
│   └── utils/
└── shared/                  # cross-app (when multiple app modes exist)
    ├── theme/theme.ts
    ├── components/general/
    ├── enums/LangDirection.ts
    ├── utils/directionalStyles.ts
    ├── utils/responsive-design.ts
    ├── hooks/
    └── types/
```

- Folder names: kebab-case for component folders (`fine-card/`), PascalCase for screen folders (`Login/`).
- Component files: `index.tsx` inside the folder, with co-located `styles.tsx`.
- Screen files: `LoginScreen.tsx` + `Login.styles.ts` (no index file).
- No barrel `index.ts` re-exports — import directly.

## Path aliases

`tsconfig.json` and `babel.config.js` define:
- `@app/*` → `src/*` (or `srcAutoMode/*` when dual-mode)
- `@shared/*` → `shared/*`

Always import via aliases, never via `../../../`.

## Screens

One folder per screen under `src/screens/<Name>/`:
```
src/screens/Login/
├── LoginScreen.tsx
├── Login.styles.ts
└── components/                # screen-private components (kebab-case)
    └── login-form/
        └── index.tsx
```

**Required structure of a screen file:**

```tsx
import React from 'react';
import {View} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@app/context/ThemeContext';
import {useLanguage} from '@app/context/LangContext';
import {RootStackParamList} from '@app/types/navigation';
import {loginStyles} from './Login.styles';

type NavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {theme} = useTheme();
  const {direction} = useLanguage();
  const {t} = useTranslation();
  const styles = React.useMemo(
    () => loginStyles(theme, direction),
    [theme, direction],
  );

  return <View style={styles.container}>{/* ... */}</View>;
};

export default LoginScreen;
```

Always destructure `theme`, `direction`, `t` at the top. Always memoize styles.

## Components

Component folder pattern (kebab-case):

```
src/components/private/fine-card/
├── index.tsx
└── styles.tsx
```

```tsx
// index.tsx
import React, {useMemo} from 'react';
import {View} from 'react-native';
import {useTheme} from '@app/context/ThemeContext';
import {useLanguage} from '@app/context/LangContext';
import {FineCardProps} from '@app/types/fineCard.props';
import {fineStyles} from './styles';

const FineCard: React.FC<FineCardProps> = ({item, onPress}) => {
  const {theme} = useTheme();
  const {direction} = useLanguage();
  const styles = useMemo(
    () => fineStyles(direction, theme),
    [direction, theme],
  );
  return <View style={styles.card}>{/* ... */}</View>;
};

export default FineCard;
```

- Reusable atomic components go in `components/general/` (button, row, column, typography).
- Domain-specific go in `components/private/`.
- Truly cross-app: `shared/components/general/`.

## Styling

**Pattern:** `StyleSheet.create()` wrapped in a factory that takes `(theme, direction)` or `(direction, theme)`. Always memoize the result in the consumer.

```ts
// Login.styles.ts
import {StyleSheet} from 'react-native';
import {ThemeType} from '@shared/theme/theme';
import {LangDirection} from '@shared/enums/LangDirection';
import {getHeight, getWidth, moderateScale} from '@shared/utils/responsive-design';
import {
  getAlignSelf,
  getMarginRight,
  getTextAlign,
} from '@shared/utils/directionalStyles';

export const loginStyles = (theme: ThemeType, direction: LangDirection) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgrounds.background,
      paddingHorizontal: getWidth(16),
    },
    header: {
      alignSelf: getAlignSelf(direction),
      ...getMarginRight(direction, getWidth(8)),
    },
    title: {
      color: theme.typography.primary,
      textAlign: getTextAlign(direction),
      fontSize: moderateScale(20),
    },
  });
```

**Rules:**
- No inline styles, no `styled-components`, no NativeWind/Tailwind.
- All sizes via `getWidth/getHeight/moderateScale` (react-native-size-matters wrappers).
- All horizontal margins/paddings via directional helpers — never raw `marginLeft`/`marginRight`.
- All colors via `theme.*` — never hex literals in components.
- Style file extension: `.styles.ts` for screens, `.styles.tsx` for components (matching the component file's extension).

## Theme

`shared/theme/theme.ts` exports `lightTheme`, `darkTheme`, and `ThemeType`:

```ts
export const lightTheme = {
  status: {success: '#1FA971', error: '#E5484D', warning: '#F5A623', info: '#3E9CFF'},
  navigation: {activeTint: '#000', inactiveTint: '#999', background: '#FFF'},
  gradient: {header: ['#...', '#...'], skeleton: [...], profile: [...]},
  typography: {primary: '#111', secondary: '#666', error: '#E5484D'},
  ui: {border: '#E5E5E5', borderLight: '#F1F1F1', shadow: '#000', lightGray: '#EEE'},
  backgrounds: {background: '#FAFAFA'},
  base: {black: '#000', white: '#FFF'},
};

export const darkTheme: typeof lightTheme = { /* parallel keys */ };

export type ThemeType = typeof lightTheme;
```

Consumed via `useTheme()` from `@app/context/ThemeContext`.

The user-facing preference is `'light' | 'dark' | 'system'`. **`'system'` is the default for first launch** — it follows the device color scheme via RN's `useColorScheme()` (which already updates on system changes through `Appearance`).

`ThemeContext` stores the *preference* in MMKV under `StorageKeys.THEME_MODE` and exposes both the preference and the resolved mode:

```ts
type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

interface ThemeContextValue {
  theme: ThemeType;                 // resolved theme object
  themeType: ThemeMode;             // resolved mode (what's actually applied)
  themePreference: ThemePreference; // what the user picked
  toggleTheme: () => void;          // flips light <-> dark (writes a concrete pref)
  setTheme: (pref: ThemePreference) => void;
}
```

Resolution rule: `themeType = preference === 'system' ? (useColorScheme() === 'dark' ? 'dark' : 'light') : preference`.

In settings UIs, show the preference and disambiguate `'system'` as e.g. `"System · Dark"`.

When adding a new color, ALWAYS add it to both `lightTheme` and `darkTheme` with matching keys.

## Localization (i18next)

- Library: `i18next` + `react-i18next`.
- Translation files: flat JSON at `src/I18n/{en,ar}/translation.json`.
- `keySeparator: false` — keys are flat strings, no dot-nesting.
- Language *preference* stored in MMKV under `StorageKeys.LANGUAGE` as `'en' | 'ar' | 'system'`. **`'system'` is the default for first launch** and resolves to the device locale.
- Device-locale helper lives at `shared/utils/deviceLocale.ts` and uses `react-native-localize`'s **`getLocales()`** — NOT `findBestLanguageTag` or `useLocalize`. Critical detail: in `react-native-localize@3.x`, `findBestLanguageTag` is precomputed at module load against a cached `getLocales()` snapshot and never re-queries native; `useLocalize` returns a static API object with no subscription and no change events. Only `getLocales()` calls native fresh on each invocation, so it is the only API that reflects an OS locale change made after app launch. Stock RN's `NativeModules.I18nManager.localeIdentifier` is similarly bridge-cached and cannot be used.
- `LangContext` mirrors `ThemeContext`: stores preference + effective language. Shape:

  ```ts
  type LangCode = 'en' | 'ar';
  export type LangPreference = LangCode | 'system';
  interface LangContextValue {
    language: LangCode;               // resolved (used by i18next + direction)
    languagePreference: LangPreference;
    direction: LangDirection;
    changeLanguage: (pref?: LangPreference) => Promise<void>;
  }
  ```

- `I18n/index.ts` reads the stored preference at boot; if `'system'` (or missing/invalid), resolves via `getDeviceLanguage()` before initializing i18next.
- **i18next init MUST set `react: {useSuspense: false}`** — without it, language changes can trigger a Suspense fallback and a visible loader flash. Resources are bundled inline so suspense provides no benefit.
- **`LangContext` MUST react to OS locale changes when preference is `'system'`** via an `AppState.addEventListener('change', ...)` subscription. On `'active'`, call `getDeviceLanguage()` (which goes through `getLocales()`) and only `applyLanguage()` when the resolved code differs from current state — use refs for the current preference and language so the effect subscribes once and never re-attaches. Do NOT rely on `useLocalize()` from `react-native-localize@3.x` — it does not subscribe to changes (see Localization bullet above). Wrap the `i18next.changeLanguage()` call in try/catch — a rejection during the refresh must not crash the app.
- **Android manifest MUST declare `locale|layoutDirection` in `android:configChanges`** on `MainActivity` — without these, Android destroys and recreates the activity when the user changes the device language, which makes the app appear to close on return. The full recommended value is:

  ```xml
  android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode|locale|layoutDirection"
  ```

- **iOS terminates apps when the system language is changed in Settings.** This is OS behavior, not a bug — the app cold-starts on next launch and our boot-time resolution via `getDeviceLanguage()` picks up the new locale. Do not try to work around this on iOS.
- The App.tsx shell loader (the `ActivityIndicator` shown while `!i18nReady`) MUST only run on first init — never reset `i18nReady` on language changes, and never call `initializeI18n()` again after mount.

In components:
```tsx
const {t} = useTranslation();
return <Text>{t('biometrics')}</Text>;
```

With interpolation: `t('issuedOn', {date})` against `"issuedOn": "Issued on {{date}}"`.

When adding a string:
1. Add the key to BOTH `en/translation.json` and `ar/translation.json`.
2. Reference it via `t('key')`.
3. Never hardcode user-visible strings.

## RTL / directional styles

The app supports Arabic (RTL). All horizontal layout decisions go through helpers in `shared/utils/directionalStyles.ts`:

```ts
import {LangDirection} from '@shared/enums/LangDirection';

export const getFlexDirection = (d: LangDirection) =>
  d === LangDirection.RTL ? 'row-reverse' : 'row';

export const getTextAlign = (d: LangDirection) =>
  d === LangDirection.RTL ? 'right' : 'left';

export const getAlignSelf = (d: LangDirection) =>
  d === LangDirection.RTL ? 'flex-end' : 'flex-start';

export const getMarginLeft = (d: LangDirection, v: number) => ({
  [d === LangDirection.LTR ? 'marginLeft' : 'marginRight']: v,
});
export const getMarginRight = (d: LangDirection, v: number) => ({
  [d === LangDirection.LTR ? 'marginRight' : 'marginLeft']: v,
});
export const getPaddingLeft = (d: LangDirection, v: number) => ({
  [d === LangDirection.LTR ? 'paddingLeft' : 'paddingRight']: v,
});
export const getPaddingRight = (d: LangDirection, v: number) => ({
  [d === LangDirection.LTR ? 'paddingRight' : 'paddingLeft']: v,
});
```

**Rules:**
- NEVER call `I18nManager.forceRTL()` in app code.
- NEVER write raw `marginLeft`, `marginRight`, `paddingLeft`, `paddingRight`, `left:`, `right:` in style files — use a helper.
- NEVER write `textAlign: 'left'` / `'right'` — use `getTextAlign(direction)`.
- Direction comes from `useLanguage()` (`LangContext`), which is the single source of truth.
- Icons that imply direction (chevron, arrow) should flip based on direction — either swap component or apply `transform: [{scaleX: direction === RTL ? -1 : 1}]`.

## Modals & bottom sheets

- Reusable sheets live in `src/components/general/bottom-sheet-modal/` (custom, built on RN `Modal` + `Animated` + `react-native-safe-area-context` — no `@gorhom/bottom-sheet` dep unless asked).
- Any sheet, drawer, or floating bar anchored to the bottom MUST respect the safe-area inset. Pattern:

  ```tsx
  import {useSafeAreaInsets} from 'react-native-safe-area-context';
  // ...
  const insets = useSafeAreaInsets();
  // in the sheet view:
  style={[styles.sheet, {paddingBottom: Math.max(insets.bottom, getHeight(16))}]}
  ```

  The `Math.max(insets.bottom, minPad)` keeps a comfortable padding on devices with no home indicator (where `insets.bottom === 0`).

- Modal props: pass `statusBarTranslucent`, `transparent`, and use `animationType="none"` when you're animating the sheet manually so RN doesn't double-animate.
- Tap-outside-to-dismiss: wrap a `<Pressable onPress={onClose} />` behind the sheet (use `StyleSheet.absoluteFill` for the backdrop — `absoluteFillObject` doesn't exist in current RN typings).
- Header rows inside the sheet must use `getFlexDirection(direction)` like any other row.

## Navigation

- Library: `@react-navigation/native` v7 + `native-stack` + `bottom-tabs` (+ `drawer` when needed).
- `src/navigation/AppNavigator.tsx` wraps `NavigationContainer` and passes `ref={navigationRef}` exported from `RootNavigation.ts`.
- `RootNavigation.ts` exposes `navigate(name, params)`, `reset(...)`, `getCurrentRoute()` for use outside components (services, redux thunks).
- Route param types live in `src/types/navigation.ts` as `RootStackParamList`.

## State management

- Redux Toolkit. Slice files: `src/redux/<Domain>.reducers.ts`.
- Selectors: `src/redux/selectors/<domain>.selectors.ts`.
- Store: `src/store/store.ts`, persisted via `redux-persist` with MMKV storage adapter.

## When in doubt

Mirror what an existing screen/component in the repo already does. Consistency with the codebase outweighs personal preference. If a pattern in this skill conflicts with what's actually in the repo, the repo wins — and tell the user so the skill can be updated.
