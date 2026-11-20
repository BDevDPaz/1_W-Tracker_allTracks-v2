import type { ReactNode } from "react";
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { StyleSheet, Text, Animated, View } from "react-native";
import { PALETTE, TEXT, RADIUS } from "@/theme";
import type { ToastMessage, ToastType, IToastQueue } from "@/types/contracts";

// CORRECCIÓN: Sustituido 'interface extends' por un 'type' directo para evitar el error de interfaz vacía
type ToastContextValue = IToastQueue;
const ToastContext = createContext<ToastContextValue | null>(null);

let _toastRef: ToastContextValue | null = null;
let _earlyBuffer: Omit<ToastMessage, "id">[] = [];

const TOAST_COLORS: Record<
  ToastType,
  { bg: string; border: string; text: string }
> = {
  success: {
    bg: "#0F2A14",
    border: PALETTE.successGreen,
    text: PALETTE.successGreen,
  },
  info: { bg: "#0F1C2A", border: PALETTE.royalBlue, text: PALETTE.royalBlue },
  warning: {
    bg: "#2A1A0F",
    border: PALETTE.amberWarning,
    text: PALETTE.amberWarning,
  },
  error: { bg: "#2A0F0F", border: PALETTE.deepRed, text: PALETTE.deepRed },
};

const TOAST_ICONS: Record<ToastType, string> = {
  success: "✓",
  info: "ℹ",
  warning: "⚠",
  error: "✕",
};

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
      <Text
        style={[styles.toastText, { color: TEXT.primary }]}
        numberOfLines={2}
      >
        {message.text}
      </Text>
    </Animated.View>
  );
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
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
      timerRef.current = setTimeout(processNext, 150);
    }, next.durationMs ?? 2500);
  }, []);

  const push = useCallback(
    (msg: Omit<ToastMessage, "id">) => {
      const id = Math.random().toString(36).slice(2);
      const fullMsg: ToastMessage = { ...msg, id };
      if (
        queueRef.current.some((m) => m.text === msg.text) ||
        current?.text === msg.text
      )
        return;
      queueRef.current.push(fullMsg);
      if (!current && !timerRef.current) processNext();
    },
    [current, processNext],
  );

  const clear = useCallback(() => {
    queueRef.current = [];
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setCurrent(null);
  }, []);

  const value = useMemo(() => ({ push, clear }), [push, clear]);

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

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de un ToastProvider.");
  return ctx;
};

export const ToastService = {
  push: (msg: Omit<ToastMessage, "id">) => {
    if (_toastRef) _toastRef.push(msg);
    else _earlyBuffer.push(msg);
  },
  clear: () => {
    if (_toastRef) _toastRef.clear();
  },
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 24,
    right: 24,
    zIndex: 9999,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: RADIUS.pills,
    borderWidth: 1,
    gap: 10,
    maxWidth: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toastIcon: { fontSize: 14, fontWeight: "700" },
  toastText: { fontSize: 13, fontWeight: "600", flex: 1, lineHeight: 18 },
});
