import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, useTheme } from '@/lib/theme';

/** Grade colour bands, loosely following common gym tape conventions. */
export function gradeColor(grade: string): string {
  const m = /^(\d)([abc])?(\+)?/i.exec(grade);
  if (!m) return '#64748B';
  const n = Number(m[1]);
  const letter = (m[2] ?? 'a').toLowerCase();
  if (n <= 5) return '#22C55E';
  if (n === 6) return letter === 'c' ? '#0EA5E9' : '#3B82F6';
  if (n === 7) return letter === 'a' ? '#8B5CF6' : letter === 'b' ? '#EC4899' : '#F43F5E';
  return '#F59E0B';
}

export function GradeBadge({ grade, benchmark, size = 'md' }: { grade: string; benchmark?: boolean; size?: 'md' | 'lg' }) {
  const { colors } = useTheme();
  const bg = gradeColor(grade);
  const big = size === 'lg';
  return (
    <View style={[styles.badge, big && styles.badgeLg, { backgroundColor: bg }, benchmark && { borderWidth: 2, borderColor: colors.warning }]}>
      <Text style={[styles.text, big && styles.textLg]}>{grade}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { minWidth: 48, height: 40, paddingHorizontal: 8, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  badgeLg: { minWidth: 64, height: 52, borderRadius: radius.md },
  text: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },
  textLg: { fontSize: 20 },
});
