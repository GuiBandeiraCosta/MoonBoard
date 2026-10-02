import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, type, useTheme } from '@/lib/theme';

/* ---------- Layout ---------- */

export function Screen({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { colors } = useTheme();
  return <View style={[{ flex: 1, backgroundColor: colors.bg }, padded && { paddingHorizontal: space.lg }, style]}>{children}</View>;
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
      <View style={{ flex: 1 }}>
        <Text style={[type.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[type.small, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

export function Row({ children, style, gap = space.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

/* ---------- Text ---------- */

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[type.h2, { color: colors.text }, style]}>{children}</Text>;
}

export function Body({
  children,
  muted,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[type.body, { color: muted ? colors.textMuted : colors.text }, style]}>
      {children}
    </Text>
  );
}

export function Small({
  children,
  muted = true,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[type.small, { color: muted ? colors.textMuted : colors.text }, style]}>
      {children}
    </Text>
  );
}

/* ---------- Controls ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  icon: Icon,
  variant = 'primary',
  loading,
  disabled,
  style,
  ...rest
}: PressableProps & { title: string; icon?: LucideIcon; variant?: Variant; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const bg =
    variant === 'primary' ? colors.accent : variant === 'danger' ? colors.danger : variant === 'secondary' ? colors.surfaceRaised : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? '#fff' : variant === 'ghost' ? colors.accent : colors.text;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg} /> : Icon ? <Icon size={18} color={fg} strokeWidth={2.2} /> : null}
      <Text style={[type.bodyStrong, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  label,
  active,
  size = 22,
  style,
  ...rest
}: PressableProps & { icon: LucideIcon; label: string; active?: boolean; size?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: active ? colors.accentSoft : colors.surfaceRaised, opacity: pressed ? 0.7 : 1 },
        style,
      ]}
      {...rest}
    >
      <Icon size={size} color={active ? colors.accent : colors.text} strokeWidth={2} />
    </Pressable>
  );
}

export function Chip({
  label,
  icon: Icon,
  active,
  onPress,
  color,
}: {
  label: string;
  icon?: LucideIcon;
  active?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const { colors } = useTheme();
  const tint = color ?? colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? tint : colors.surfaceRaised,
          borderColor: active ? tint : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {Icon ? <Icon size={14} color={active ? '#fff' : colors.textMuted} strokeWidth={2.2} /> : null}
      <Text style={[type.smallStrong, { color: active ? '#fff' : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: colors.accent }]}
          >
            <Text style={[type.smallStrong, { color: active ? '#fff' : colors.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Feedback ---------- */

export function EmptyState({ icon: Icon, title, message, action }: { icon: LucideIcon; title: string; message?: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
        <Icon size={32} color={colors.accent} strokeWidth={1.8} />
      </View>
      <Text style={[type.h2, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      {message ? <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>{message}</Text> : null}
      {action ? <View style={{ marginTop: space.md }}>{action}</View> : null}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, { justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: space.md, gap: space.md },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: 14,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
  },
  iconButton: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  segmented: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md - 3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.xxl },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
});
