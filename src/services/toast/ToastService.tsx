// ============================================================
// SERVICE: ToastService — Cola de notificaciones efímeras (CONSOLIDADO)
// Versión: 2.0.0 (Workday Tracking Platform)
// Fuente: Matriz de Resiliencia — Sección 6.1
// REGLA: Máximo 1 toast visible simultáneamente (cola FIFO)
//        Éxito/Info/Advertencia → Toast efímero 2500ms
//        Buffer en frío para disparos desde Background Task
// ============================================================

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  ReactNode,
} from 'react';
import { StyleSheet, Text, Animated, View } from 'react-native';
import { PALETTE, TEXT, RADIUS } from '../../theme';
import { ToastMessage, ToastType, IToastQueue } from '../../types/contracts';

// ── CONTEXT ───────────────────────────────────────────────────
interface ToastContextValue extends IToastQueue {}

const ToastContext = createContext<ToastContextValue | null>(null);

// ── SINGLETON REFERENCE & BUFFER EN FRÍO ─────────────────────
let _toastRef: ToastContextValue | null = null;
let _earlyBuffer: Omit<ToastMessage, 'id'>[] = [];

// ── COLOR MAP SEMÁNTICO V2 ─────────────────────────────────────
const TOAST_COLORS: Record<ToastType, { bg: string; border: string; text: string }> = {
  success: {
    bg: '#0F2A14',
    border: PALETTE.successGreen,
    text: PALETTE.successGreen,
  },
  info: {
    bg: '#0F1C2A',
    border: PALETTE.royalBlue || '#2563EB',
    text: PALETTE.royalBlue || '#2563EB',
  },
  warning: {
    bg: '#2A1A0F',
    border: PALETTE.amberWarning,
    text: PALETTE.amberWarning,
  },
  error: {
    bg: '#2A0F0F',
    border: PALETTE.deepRed,
    text: PALETTE.deepRed,
  },
};

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✓',
  info: 'ℹ',
  warning: '⚠',
  error: '✕',
};

// ── COMPONENTE TOAST ANIMADO ──────────────────────────────────
interface ToastProps {
  message: ToastMessage;
}

const Toast: React.FC<ToastProps> = ({ message }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  const colors = TOAST_COLORS[message.type] ?? TOAST_COLORS.info;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={[styles.toastIcon, { color: colors.text }]}>
        {TOAST_ICONS[message.type]}
      </Text>
      <Text style={[styles.toastText, { color: TEXT.primary }]} numberOfLines={2}>
        {message.text}
      </Text>
    </Animated.View>
  );
};

// ── PROVIDER COMPONENT ────────────────────────────────────────
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [current, setCurrent] = useState<ToastMessage | null>(null);
  const queueRef = useRef<ToastMessage[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      setCurrent(null);
      timerRef.current = null;
      return;
    }

    const next = queueRef.current.shift();
    if (!next) return;

    setCurrent(next);

    timerRef.current = setTimeout(() => {
      setCurrent(null);
      // Breve intervalo para suavizar la transición en UI entre toasts consecutivos
      timerRef.current = setTimeout(processNext, 150);
    }, next.durationMs ?? 2500);
  }, []);

  const push = useCallback(
    (msg: Omit<ToastMessage, 'id'>) => {
      const id = Math.random().toString(36).slice(2);
      const fullMsg: ToastMessage = { ...msg, id };

      // Prevenir encolamiento duplicado de mensajes idénticos
      if (queueRef.current.some((m) => m.text === msg.text) || current?.text === msg.text) {
        return;
      }

      queueRef.current.push(fullMsg);

      if (!current && !timerRef.current) {
        processNext();
      }
    },
    [current, processNext]
  );

  const clear = useCallback(() => {
    queueRef.current = [];
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = null;
    setCurrent(null);
  }, []);

  const value = useMemo(() => ({ push, clear }), [push, clear]);

  // Asignar singleton y vaciar buffer en frío almacenado previo al montaje
  useEffect(() => {
    _toastRef = value;
    if (_earlyBuffer.length > 0) {
      _earlyBuffer.forEach((msg) => value.push(msg));
      _earlyBuffer = [];
    }
  }, [value]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current && (
        <View style={styles.container} pointerEvents="none">
          <Toast message={current} />
        </View>
      )}
    </ToastContext.Provider>
  );
};

// ── HOOK REACT ────────────────────────────────────────────────
export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast debe ser utilizado dentro de un ToastProvider válido.');
  }
  return ctx;
};

// ── SINGLETON API (ACCESO FUERA DE COMPONENTES REACT) ─────────
export const ToastService = {
  push: (msg: Omit<ToastMessage, 'id'>) => {
    if (_toastRef) {
      _toastRef.push(msg);
    } else {
      console.log('[ToastService] Guardando en buffer temprano:', msg.text);
      _earlyBuffer.push(msg);
    }
  },
  clear: () => {
    if (_toastRef) {
      _toastRef.clear();
    }
  },
};

// ── ESTILOS ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 24,
    right: 24,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: RADIUS.pills,
    borderWidth: 1,
    gap: 10,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toastIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
});
