import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {findNodeHandle, Keyboard, ScrollView, TextInput, UIManager, View} from 'react-native';

interface RegisteredField {
  input: RefObject<TextInput | null>;
  wrapper: RefObject<View | null>;
}

interface FormKeyboardContextValue {
  fields: string[];
  activeField: string | null;
  scrollRef: RefObject<ScrollView | null>;
  registerField: (key: string, input: RefObject<TextInput | null>, wrapper: RefObject<View | null>) => void;
  unregisterField: (key: string) => void;
  onFieldFocus: (key: string) => void;
  focusNext: (key?: string) => void;
  dismissKeyboard: () => void;
}

const FormKeyboardContext = createContext<FormKeyboardContextValue | null>(null);

export function useFormKeyboard(): FormKeyboardContextValue | null {
  return useContext(FormKeyboardContext);
}

interface ProviderProps {
  fields: string[];
  children: React.ReactNode;
}

export const FormKeyboardProvider: React.FC<ProviderProps> = ({fields, children}) => {
  const scrollRef = useRef<ScrollView>(null);
  const registry = useRef<Map<string, RegisteredField>>(new Map());
  const [activeField, setActiveField] = useState<string | null>(null);

  const scrollToField = useCallback((key: string) => {
    const entry = registry.current.get(key);
    const scrollView = scrollRef.current;
    if (!entry?.wrapper.current || !scrollView) {
      return;
    }

    const scrollNode = findNodeHandle(scrollView);
    const wrapperNode = findNodeHandle(entry.wrapper.current);
    if (!scrollNode || !wrapperNode) {
      return;
    }

    UIManager.measureLayout(
      wrapperNode,
      scrollNode,
      () => undefined,
      (_x, y) => {
        scrollRef.current?.scrollTo({y: Math.max(0, y - 24), animated: true});
      },
    );
  }, []);

  const registerField = useCallback(
    (key: string, input: RefObject<TextInput | null>, wrapper: RefObject<View | null>) => {
      registry.current.set(key, {input, wrapper});
    },
    [],
  );

  const unregisterField = useCallback((key: string) => {
    registry.current.delete(key);
  }, []);

  const focusField = useCallback(
    (key: string) => {
      const entry = registry.current.get(key);
      entry?.input.current?.focus();
      setActiveField(key);
      requestAnimationFrame(() => scrollToField(key));
    },
    [scrollToField],
  );

  const onFieldFocus = useCallback(
    (key: string) => {
      setActiveField(key);
      requestAnimationFrame(() => scrollToField(key));
    },
    [scrollToField],
  );

  const focusNext = useCallback(
    (key?: string) => {
      const current = key ?? activeField;
      if (!current) {
        return;
      }
      const index = fields.indexOf(current);
      const nextKey = fields[index + 1];
      if (nextKey) {
        focusField(nextKey);
        return;
      }
      Keyboard.dismiss();
    },
    [activeField, fields, focusField],
  );

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const value = useMemo(
    () => ({
      fields,
      activeField,
      scrollRef,
      registerField,
      unregisterField,
      onFieldFocus,
      focusNext,
      dismissKeyboard,
    }),
    [fields, activeField, registerField, unregisterField, onFieldFocus, focusNext, dismissKeyboard],
  );

  return <FormKeyboardContext.Provider value={value}>{children}</FormKeyboardContext.Provider>;
};

export function useFormKeyboardRequired(): FormKeyboardContextValue {
  const context = useFormKeyboard();
  if (!context) {
    throw new Error('useFormKeyboardRequired must be used within FormKeyboardProvider');
  }
  return context;
}
