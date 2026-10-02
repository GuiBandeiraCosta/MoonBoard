import { Award, Check, Flag, Users } from 'lucide-react-native';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProblemSummary } from '@/lib/catalog/db';
import { radius, space, type, useTheme } from '@/lib/theme';
import { GradeBadge } from './GradeBadge';

interface Props {
  problem: ProblemSummary;
  sent?: boolean;
  project?: boolean;
  onPress: () => void;
}

export const ProblemRow = memo(function ProblemRow({ problem, sent, project, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceRaised : colors.surface, borderColor: colors.border }]}
    >
      <GradeBadge grade={problem.grade} benchmark={problem.isBenchmark} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text, flexShrink: 1 }]}>
            {problem.name}
          </Text>
          {problem.isBenchmark ? <Award size={14} color={colors.warning} strokeWidth={2.4} /> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text numberOfLines={1} style={[type.small, { color: colors.textMuted, flexShrink: 1 }]}>
            {problem.setter ?? 'unknown setter'}
          </Text>
          <View style={styles.meta}>
            <Users size={12} color={colors.textFaint} />
            <Text style={[type.small, { color: colors.textFaint }]}>{problem.ascents}</Text>
          </View>
        </View>
      </View>
      {sent ? (
        <View style={[styles.badge, { backgroundColor: colors.success }]}>
          <Check size={14} color="#fff" strokeWidth={3} />
        </View>
      ) : project ? (
        <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
          <Flag size={14} color={colors.accent} strokeWidth={2.4} />
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space.sm,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  badge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
