import { useFocusEffect, useRouter } from 'expo-router';
import { Award, BookMarked, Trash2, Zap } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { GradeBadge, gradeColor } from '@/components/GradeBadge';
import { Card, EmptyState, Row, Screen, ScreenHeader, Small } from '@/components/ui';
import { getLayout } from '@/lib/constants/layouts';
import { deleteAscent, listAscents, type Ascent } from '@/lib/logbook/db';
import { useSettings } from '@/lib/settings/store';
import { radius, space, type, useTheme } from '@/lib/theme';

export default function LogbookScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const settings = useSettings();
  const layout = getLayout(settings.layoutId);
  const [ascents, setAscents] = useState<Ascent[]>([]);

  const refresh = useCallback(() => {
    if (!layout) return;
    listAscents(layout.id, settings.angle)
      .then(setAscents)
      .catch(() => undefined);
  }, [layout, settings.angle]);

  useFocusEffect(refresh);

  const pyramid = useMemo(() => {
    const byGrade = new Map<string, Set<string>>();
    for (const a of ascents) {
      if (!byGrade.has(a.grade)) byGrade.set(a.grade, new Set());
      byGrade.get(a.grade)!.add(a.climbUuid);
    }
    return [...byGrade.entries()]
      .map(([grade, set]) => ({ grade, count: set.size }))
      .sort((x, y) => x.grade.localeCompare(y.grade, undefined, { numeric: true }));
  }, [ascents]);

  const maxCount = Math.max(1, ...pyramid.map((p) => p.count));
  const unique = new Set(ascents.map((a) => a.climbUuid)).size;
  const benchmarks = new Set(ascents.filter((a) => a.isBenchmark).map((a) => a.climbUuid)).size;
  const flashes = ascents.filter((a) => a.attempts === 1).length;

  const confirmDelete = (a: Ascent) =>
    Alert.alert('Remove ascent?', `${a.name} (${a.grade})`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteAscent(a.id).then(refresh) },
    ]);

  if (!layout) return null;

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg }}>
        <ScreenHeader title="Logbook" subtitle={`${layout.short} · ${settings.angle}°`} />
      </View>
      <FlatList
        data={ascents}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
        ListHeaderComponent={
          ascents.length > 0 ? (
            <View style={{ gap: space.md, marginBottom: space.lg }}>
              <Row gap={space.sm}>
                <Stat label="Sends" value={unique} />
                <Stat label="Benchmarks" value={benchmarks} icon={<Award size={14} color={colors.warning} />} />
                <Stat label="Flashes" value={flashes} icon={<Zap size={14} color={colors.warning} fill={colors.warning} />} />
              </Row>
              <Card>
                <Small style={type.smallStrong}>Pyramid</Small>
                <View style={{ gap: 6 }}>
                  {pyramid.map((p) => (
                    <Row key={p.grade} gap={space.sm}>
                      <Text style={[type.smallStrong, { color: colors.text, width: 36 }]}>{p.grade}</Text>
                      <View style={{ flex: 1, height: 14, borderRadius: 7, backgroundColor: colors.surfaceRaised }}>
                        <View
                          style={{ width: `${(p.count / maxCount) * 100}%`, height: 14, borderRadius: 7, backgroundColor: gradeColor(p.grade) }}
                        />
                      </View>
                      <Text style={[type.small, { color: colors.textMuted, width: 24, textAlign: 'right' }]}>{p.count}</Text>
                    </Row>
                  ))}
                </View>
              </Card>
              <Small style={type.smallStrong}>History</Small>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/problem/[uuid]', params: { uuid: item.climbUuid } })}
            onLongPress={() => confirmDelete(item)}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceRaised : colors.surface, borderColor: colors.border }]}
          >
            <GradeBadge grade={item.grade} benchmark={item.isBenchmark} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text }]}>
                {item.name}
              </Text>
              <Small>
                {new Date(item.climbedAt).toLocaleDateString()} · {item.attempts === 1 ? 'Flash' : `${item.attempts} tries`}
                {item.userGrade && item.userGrade !== item.grade ? ` · felt ${item.userGrade}` : ''}
              </Small>
            </View>
            <Pressable hitSlop={8} onPress={() => confirmDelete(item)} accessibilityLabel="Remove ascent">
              <Trash2 size={18} color={colors.textFaint} />
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={BookMarked}
            title="No sends yet"
            message="Open a problem and tap “Log send” when you top it out. Your logbook stays on this phone."
          />
        }
      />
    </Screen>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[type.h2, { color: colors.text }]}>{value}</Text>
      <Row gap={4}>
        {icon}
        <Small>{label}</Small>
      </Row>
    </View>
  );
}

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
  stat: { flex: 1, padding: space.md, borderRadius: radius.md, borderWidth: 1, gap: 2 },
});
