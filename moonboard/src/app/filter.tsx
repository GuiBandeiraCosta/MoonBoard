import { useRouter } from 'expo-router';
import { Check, RotateCcw, X } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BoardView } from '@/components/BoardView';
import { Body, Button, Chip, IconButton, Screen, Small, Title } from '@/components/ui';
import { FONT_GRADES } from '@/lib/catalog/decode';
import { resetFilters, setFilters, useFilters } from '@/lib/catalog/filters';
import { getLayout, holdName } from '@/lib/constants/layouts';
import { useSettings } from '@/lib/settings/store';
import { space, type, useTheme } from '@/lib/theme';

const ASCENT_STEPS = [0, 5, 20, 100];

export default function FilterScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const filters = useFilters();
  const settings = useSettings();
  const layout = getLayout(settings.layoutId);
  if (!layout) return null;

  const grades = FONT_GRADES;

  const toggleHold = (col: number, row: number) => {
    const exists = filters.holds.some((h) => h.col === col && h.row === row);
    setFilters({ holds: exists ? filters.holds.filter((h) => !(h.col === col && h.row === row)) : [...filters.holds, { col, row }] });
  };

  const pickGrade = (d: number) => {
    const { minDifficulty: min, maxDifficulty: max } = filters;
    if (min == null && max == null) return setFilters({ minDifficulty: d, maxDifficulty: d });
    if (min != null && max != null && min === max && d !== min) {
      return setFilters({ minDifficulty: Math.min(min, d), maxDifficulty: Math.max(max, d) });
    }
    setFilters({ minDifficulty: d, maxDifficulty: d });
  };

  return (
    <Screen padded={false}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Title>Filters</Title>
        <View style={{ flex: 1 }} />
        <IconButton icon={RotateCcw} label="Reset filters" onPress={resetFilters} />
        <IconButton icon={X} label="Close" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 96, gap: space.xl }}>
        <View style={{ gap: space.sm }}>
          <Body style={type.bodyStrong}>Grade</Body>
          <Small>Tap one grade, then another to set a range.</Small>
          <View style={styles.wrap}>
            {grades.map((g) => {
              const inRange =
                filters.minDifficulty != null &&
                filters.maxDifficulty != null &&
                g.difficulty >= filters.minDifficulty &&
                g.difficulty <= filters.maxDifficulty;
              return <Chip key={g.font} label={g.font} active={inRange} onPress={() => pickGrade(g.difficulty)} />;
            })}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Body style={type.bodyStrong}>Minimum ascents</Body>
          <View style={styles.wrap}>
            {ASCENT_STEPS.map((n) => (
              <Chip key={n} label={n === 0 ? 'Any' : `${n}+`} active={filters.minAscents === n} onPress={() => setFilters({ minAscents: n })} />
            ))}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Body style={type.bodyStrong}>Must use these holds</Body>
          <Small>
            {filters.holds.length === 0
              ? 'Tap holds on the board. Only problems using all of them are shown.'
              : filters.holds.map((h) => holdName(h.col, h.row)).join(', ')}
          </Small>
          <BoardView layout={layout} holds={[]} selected={filters.holds} onPressHold={toggleHold} />
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md, backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        <Button title="Show problems" icon={Check} onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, borderTopWidth: 1 },
});

void Text;
