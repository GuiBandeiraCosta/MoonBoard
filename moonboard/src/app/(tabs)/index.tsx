import { useFocusEffect, useRouter } from 'expo-router';
import { Award, Download, Search, SlidersHorizontal, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ProblemRow } from '@/components/ProblemRow';
import { Button, Chip, EmptyState, IconButton, Screen, ScreenHeader, Segmented } from '@/components/ui';
import { placementIdAt } from '@/lib/catalog/decode';
import type { ProblemQuery } from '@/lib/catalog/db';
import { activeFilterCount, setFilters, useFilters } from '@/lib/catalog/filters';
import { hasCatalog } from '@/lib/catalog/snapshot';
import { useProblems } from '@/lib/catalog/useProblems';
import { getLayout } from '@/lib/constants/layouts';
import { projectSet, sentSet } from '@/lib/logbook/db';
import { updateSettings, useSettings } from '@/lib/settings/store';
import { radius, space, type, useTheme } from '@/lib/theme';

export default function ProblemsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const settings = useSettings();
  const filters = useFilters();
  const layout = getLayout(settings.layoutId);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [projects, setProjects] = useState<Set<string>>(new Set());
  const [catalogReady, setCatalogReady] = useState(() => (settings.layoutId ? hasCatalog(settings.layoutId) : false));

  useFocusEffect(
    useCallback(() => {
      if (!settings.layoutId) return;
      setCatalogReady(hasCatalog(settings.layoutId));
      sentSet(settings.layoutId)
        .then(setSent)
        .catch(() => undefined);
      projectSet(settings.layoutId)
        .then(setProjects)
        .catch(() => undefined);
    }, [settings.layoutId]),
  );

  const query: ProblemQuery | null = useMemo(() => {
    if (!layout || !catalogReady) return null;
    const placementIds = filters.holds.map((h) => placementIdAt(layout.id, h.col, h.row)).filter((x): x is string => x != null);
    return {
      layoutId: layout.id,
      angle: settings.angle,
      search: filters.search,
      minDifficulty: filters.minDifficulty ?? undefined,
      maxDifficulty: filters.maxDifficulty ?? undefined,
      benchmarksOnly: settings.benchmarksOnly,
      minAscents: filters.minAscents || undefined,
      placementIds,
      sort: filters.sort,
    };
  }, [layout, catalogReady, settings.angle, settings.benchmarksOnly, filters]);

  const { items, total, loading, error, hasMore, loadMore } = useProblems(query);

  if (!layout) return null;

  const filterCount = activeFilterCount(filters);

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg }}>
        <ScreenHeader
          title={layout.short}
          subtitle={catalogReady ? `${total.toLocaleString()} problems · ${settings.angle}°` : 'No catalog downloaded'}
          right={
            layout.angles.length > 1 ? (
              <View style={{ width: 120 }}>
                <Segmented
                  options={layout.angles.map((a) => ({ value: a, label: `${a}°` }))}
                  value={settings.angle}
                  onChange={(angle) => updateSettings({ angle })}
                />
              </View>
            ) : undefined
          }
        />

        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            value={filters.search}
            onChangeText={(search) => setFilters({ search })}
            placeholder="Search by name or setter"
            placeholderTextColor={colors.textFaint}
            style={[type.body, { flex: 1, color: colors.text, paddingVertical: 0 }]}
            autoCorrect={false}
            returnKeyType="search"
          />
          {filters.search ? (
            <Pressable hitSlop={8} onPress={() => setFilters({ search: '' })} accessibilityLabel="Clear search">
              <X size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.chips}>
          <Chip
            label="Benchmarks"
            icon={Award}
            active={settings.benchmarksOnly}
            color={colors.warning}
            onPress={() => updateSettings({ benchmarksOnly: !settings.benchmarksOnly })}
          />
          <Chip label="Popular" active={filters.sort === 'popular'} onPress={() => setFilters({ sort: 'popular' })} />
          <Chip label="Newest" active={filters.sort === 'newest'} onPress={() => setFilters({ sort: 'newest' })} />
          <Chip label="Hardest" active={filters.sort === 'hardest'} onPress={() => setFilters({ sort: 'hardest' })} />
          <View style={{ flex: 1 }} />
          <IconButton icon={SlidersHorizontal} label="Filters" active={filterCount > 0} onPress={() => router.push('/filter')} />
          {filterCount > 0 ? (
            <View style={[styles.count, { backgroundColor: colors.accent }]}>
              <Text style={styles.countText}>{filterCount}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {!catalogReady ? (
        <EmptyState
          icon={Download}
          title="Download the problem catalog"
          message={`Get every ${layout.name} problem on your phone so the list works offline.`}
          action={<Button title="Go to Settings" onPress={() => router.push('/settings')} />}
        />
      ) : error ? (
        <EmptyState icon={X} title="Could not read catalog" message={error} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.uuid}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
          renderItem={({ item }) => (
            <ProblemRow
              problem={item}
              sent={sent.has(item.uuid)}
              project={projects.has(item.uuid)}
              onPress={() => router.push({ pathname: '/problem/[uuid]', params: { uuid: item.uuid } })}
            />
          )}
          onEndReachedThreshold={0.6}
          onEndReached={loadMore}
          ListEmptyComponent={
            loading ? (
              <View style={{ paddingTop: space.xxl }}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : (
              <EmptyState icon={Search} title="No problems match" message="Try widening the grade range or clearing hold filters." />
            )
          }
          ListFooterComponent={hasMore && items.length > 0 ? <ActivityIndicator color={colors.accent} style={{ marginVertical: space.lg }} /> : null}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space.sm,
  },
  chips: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md, flexWrap: 'wrap' },
  count: { position: 'absolute', right: -4, top: -4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
