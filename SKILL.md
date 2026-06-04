---
name: rn-bootstrap
description: Scaffold a fresh React Native project with the user's standard conventions — folder skeleton, theme tokens (light/dark), i18next localization (en/ar) with full RTL support, directional style helpers, responsive scale helpers, Redux Toolkit + MMKV persisted store, React Navigation v7 setup, and @app/@shared path aliases. Use when starting a new RN project, or when applying these conventions to a bare project just created with `npx @react-native-community/cli init`. Pairs with the `rn-conventions` skill (which documents the patterns this skill installs).
---

# RN bootstrap

Apply the standard project structure to a fresh bare React Native project.

## When to use

- Right after `npx @react-native-community/cli init` on a new project.
- When asked to "set up the structure", "apply our conventions", "bootstrap this RN project".
- NOT for Expo projects without first confirming with the user — Expo Router changes navigation setup.

## Before starting

1. Confirm the working directory is the project root (has `package.json`, `App.tsx`, `android/`, `ios/`).
2. Confirm with the user before installing dependencies (they may already have versions pinned).
3. Confirm path-alias choice — default is `@app` → `src` and `@shared` → `shared`.
4. Decide single-app vs dual-app mode upfront. Default: single-app (no `srcAutoMode/`, no `bootstrap.ts`, no `resolve.config.js`).

## Steps

### 1. Install dependencies

Group install — confirm the list with the user first.

```bash
# Navigation
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context react-native-gesture-handler

# State
npm install @reduxjs/toolkit react-redux redux-persist react-native-mmkv

# i18n
npm install i18next react-i18next react-native-localize

# Styling helpers
npm install react-native-size-matters

# SVG (commonly needed)
npm install react-native-svg

# Dev: path aliases via babel
npm install --save-dev babel-plugin-module-resolver
```

After install, follow each library's iOS pod / Android linking notes (most are autolinked in modern RN).

### 2. Create the folder skeleton

```
src/
├── I18n/
│   ├── en/translation.json
│   ├── ar/translation.json
│   └── index.ts
├── assets/
├── components/
│   ├── general/
│   └── private/
├── config/
├── constants/
├── context/
├── enums/
├── hooks/
├── navigation/
├── redux/
│   └── selectors/
├── screens/
├── services/
├── store/
├── svg/
├── types/
└── utils/
shared/
├── theme/
├── components/general/
├── enums/
├── hooks/
├── types/
└── utils/
```

Use `.gitkeep` in empty folders so they survive git.

### 3. Path aliases

**tsconfig.json** — add:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@app/*": ["src/*"],
      "@shared/*": ["shared/*"]
    }
  }
}
```

**babel.config.js** — add `module-resolver`:
```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['module-resolver', {
      root: ['./'],
      alias: {
        '@app': './src',
        '@shared': './shared',
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    }],
  ],
};
```

Restart Metro with `--reset-cache` after this.

### 4. Theme system

**`shared/theme/theme.ts`** — light/dark theme objects with parallel keys and exported `ThemeType`. Use the structure from the `rn-conventions` skill.

**`src/context/ThemeContext.tsx`** — provider exposing `{theme, themeType, themePreference, toggleTheme, setTheme}`. Preference is `'light' | 'dark' | 'system'`; default for first launch is `'system'`. When preference is `'system'`, derive `themeType` from `useColorScheme()` (which already re-renders on system changes via `Appearance`). Persist the *preference* (not the resolved mode) to MMKV under `StorageKeys.THEME_MODE`. See the `rn-conventions` skill's Theme section for the exact context shape.

### 5. Localization + RTL

**`shared/enums/LangDirection.ts`**:
```ts
export enum LangDirection {
  LTR = 'ltr',
  RTL = 'rtl',
}
```

**`shared/utils/directionalStyles.ts`** — `getFlexDirection`, `getTextAlign`, `getAlignSelf`, `getMarginLeft/Right`, `getPaddingLeft/Right` (copy from `rn-conventions` skill).

**`shared/utils/responsive-design.ts`** — wrap `react-native-size-matters`:
```ts
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
export const getWidth = (n: number) => scale(n);
export const getHeight = (n: number) => verticalScale(n);
export {moderateScale};
```

**`src/I18n/en/translation.json`** and **`src/I18n/ar/translation.json`** — flat JSON, start with a few sample keys (include `"system"` for the system-preference label).

**`shared/utils/deviceLocale.ts`** — `getDeviceLanguage(fallback)` that calls `getLocales()` from `react-native-localize` and picks the first supported `languageCode`. **Do NOT use `findBestLanguageTag` or `useLocalize`** — in v3 both are static snapshots taken at module load and do not re-query native, so they cannot detect OS locale changes made after launch. `getLocales()` is the only API that calls native fresh on every invocation. `react-native-localize` is required; stock RN's `NativeModules.I18nManager.localeIdentifier` has the same staleness problem and cannot be used either.

**`src/I18n/index.ts`** — i18next init with `keySeparator: false` AND `react: {useSuspense: false}` (the latter avoids a Suspense fallback flash on language change). Read the stored *preference* from MMKV; if missing/`'system'`/invalid, resolve via `getDeviceLanguage('en')` before passing to `i18next.init({lng})`.

**`src/context/LangContext.tsx`** — provider exposing `{language, languagePreference, direction, changeLanguage}`. Preference is `'en' | 'ar' | 'system'`; default first-launch is `'system'`. `changeLanguage(pref?)` accepts any preference (including `'system'`, which re-resolves via `getDeviceLanguage()`), writes the preference to MMKV, calls `i18next.changeLanguage(resolved)`, and updates direction. **Must include an `AppState.addEventListener('change', ...)` subscription** that, on `'active'` and when preference is `'system'`, re-calls `getDeviceLanguage()` and applies the result only if the resolved code changed. Use refs for the current preference and language so the effect subscribes once. Do NOT rely on `useLocalize()` from `react-native-localize@3.x` — it has no change-event API. Wrap the `i18next.changeLanguage()` call in try/catch so a rejection cannot crash the app. See the `rn-conventions` skill's Localization section for the exact context shape and listener pattern.

**`android/app/src/main/AndroidManifest.xml`** — add `locale|layoutDirection` to `MainActivity`'s `android:configChanges`. The default RN manifest omits these, so Android destroys the activity when the device language changes and the app appears to close on return. Required final value:

```xml
android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode|locale|layoutDirection"
```

iOS terminates apps when the system language is changed in Settings — this is OS-level and cannot be worked around. The next cold start picks up the new locale via `getDeviceLanguage()` during i18n init.

### 6. State management

**`src/store/store.ts`** — `configureStore` with `redux-persist` using a MMKV storage adapter. Combine reducers from `src/redux/*.reducers.ts`.

**Sample slice** `src/redux/User.reducers.ts`:
```ts
import {createSlice, PayloadAction} from '@reduxjs/toolkit';

interface UserState { id: string | null; name: string | null; }
const initialState: UserState = {id: null, name: null};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<UserState>) {
      Object.assign(state, action.payload);
    },
    clearUser(state) { state.id = null; state.name = null; },
  },
});

export const {setUser, clearUser} = userSlice.actions;
export default userSlice.reducer;
```

### 7. Navigation

**`RootNavigation.ts`** (project root):
```ts
import {createNavigationContainerRef} from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef();
export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) navigationRef.navigate(name as never, params as never);
}
```

**`src/navigation/AppNavigator.tsx`** — `NavigationContainer` with `ref={navigationRef}`; inside, a root stack with placeholder Auth + Main screens.

**`src/types/navigation.ts`** — `RootStackParamList` type.

### 8. Wire App.tsx

Replace the default `App.tsx` with a shell that mounts (outer → inner):
1. `<Provider store={store}>` (redux)
2. `<PersistGate persistor={persistor}>`
3. `<SafeAreaProvider>`
4. `<ThemeProvider>` (custom)
5. `<LangProvider>` (custom)
6. `<AppNavigator />`

### 9. Sample screen to verify

Create `src/screens/Home/HomeScreen.tsx` + `Home.styles.ts` following the screen pattern from `rn-conventions`. Register it in `AppNavigator`. Run on Android emulator to confirm everything wires up.

### 10. Verification checklist

- [ ] `npm start` runs Metro without errors
- [ ] `npm run android` builds and shows the sample screen
- [ ] Switching language via `LangContext.changeLanguage()` flips text and direction
- [ ] `changeLanguage('system')` picks up the device locale on next call
- [ ] With preference `'system'`, backgrounding the app, changing device language, and returning updates the UI without a loader flash
- [ ] Theme toggle swaps colors
- [ ] `setTheme('system')` follows the OS dark/light setting (verify by toggling OS theme)
- [ ] `@app/...` and `@shared/...` imports resolve in both TS and runtime

## Notes

- Do NOT install `react-native-vector-icons` or `react-native-reanimated` proactively — wait until a screen needs them.
- Do NOT install `@gorhom/bottom-sheet` proactively — the conventions cover bottom sheets without it. Add only when the user asks for snap points / scroll-in-sheet.
- `react-native-localize` IS required (used by `getDeviceLanguage` + `LangContext`'s `useLocalize` hook). Install it during the i18n step, not as an afterthought.
- Do NOT create `srcAutoMode/`, `bootstrap.ts`, or `resolve.config.js` unless the user explicitly asks for dual-app mode.
- After scaffolding, suggest the user commit a "scaffold conventions" commit so future diffs are clean.
