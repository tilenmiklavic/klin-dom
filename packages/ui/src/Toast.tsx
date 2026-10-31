import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KText } from './Text';
import { tokens } from './tokens';

export interface ToastOptions {
  message: string;
  action?: { label: string; onPress: () => void };
  durationMs?: number;
}

interface ToastApi {
  show: (opts: ToastOptions) => void;
}

const DEFAULT_DURATION = 4000;
/** Clears the floating tab bar. */
const TAB_BAR_CLEARANCE = 110;

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const hide = useCallback(() => {
    clear();
    setToast(null);
  }, [clear]);

  const show = useCallback(
    (opts: ToastOptions) => {
      clear();
      setToast(opts);
      timer.current = setTimeout(() => {
        timer.current = null;
        setToast(null);
      }, opts.durationMs ?? DEFAULT_DURATION);
    },
    [clear],
  );

  useEffect(() => clear, [clear]);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: tokens.space[5],
            right: tokens.space[5],
            bottom: TAB_BAR_CLEARANCE + insets.bottom,
            alignItems: 'center',
          }}
        >
          <View
            testID="toast"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{
              width: '100%',
              maxWidth: 440,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: tokens.space[4],
              backgroundColor: tokens.color.night,
              borderRadius: tokens.radius.pill,
              paddingVertical: tokens.space[3],
              paddingHorizontal: tokens.space[5],
              boxShadow: tokens.shadow.float,
            }}
          >
            <KText variant="label" color="onNight" style={{ flexShrink: 1 }}>
              {toast.message}
            </KText>
            {toast.action ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={toast.action.label}
                hitSlop={8}
                onPress={() => {
                  const { onPress } = toast.action!;
                  hide();
                  onPress();
                }}
              >
                <KText variant="button" color="onNight" style={{ fontFamily: tokens.type.button.fontFamily, fontWeight: '600' }}>
                  {toast.action.label}
                </KText>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}
