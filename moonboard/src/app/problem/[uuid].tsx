import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Award, Bluetooth, BluetoothOff, Check, ChevronLeft, Flag, Lightbulb, LightbulbOff, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BoardView } from '@/components/BoardView';
import { GradeBadge } from '@/components/GradeBadge';
import { Body, Button, Card, EmptyState, IconButton, Loading, Row, Screen, Small } from '@/components/ui';
import { useBoard } from '@/lib/ble/useBoard';
import { getProblem, type Problem } from '@/lib/catalog/db';
import { vGrade } from '@/lib/catalog/decode';
import { getLayout } from '@/lib/constants/layouts';
import { ascentsFor, isProject, toggleProject, type Ascent } from '@/lib/logbook/db';
import { useSettings } from '@/lib/settings/store';
import { role as roleColors, space, type, useTheme } from '@/lib/theme';

export default function ProblemScreen() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const settings = useSettings();
  const board = useBoard();
  const layout = getLayout(settings.layoutId);
  const [problem, setProblem] = useState<Problem | null | undefined>(undefined);
  const [ascents, setAscents] = useState<Ascent[]>([]);
  const [project, setProject] = useState(false);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    if (!layout || !uuid) return;
    getProblem(layout.id, uuid, settings.angle)
      .then(setProblem)
      .catch(() => setProblem(null));
  }, [layout, uuid, settings.angle]);

  useFocusEffect(
    useCallback(() => {
      if (!uuid) return;
      ascentsFor(uuid)
        .then(setAscents)
        .catch(() => undefined);
      isProject(uuid)
        .then(setProject)
        .catch(() => undefined);
    }, [uuid]),
  );

  const light = async () => {
    if (!problem || !layout) return;
    if (!board.isConnected) {
      router.push('/board');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    if (lit) {
      await board.clear();
      setLit(false);
    } else {
      await board.lightHolds(problem.holds, {
        rows: layout.rows,
        bothLights: settings.bothLights,
        flipped: settings.flippedStrip,
      });
      setLit(true);
    }
  };

  if (!layout) return null;
  if (problem === undefined) return <Loading />;
  if (problem === null) {
    return (
      <Screen>
        <EmptyState
          icon={Check}
          title="Problem not found"
          message="It may not exist at this angle."
          action={<Button title="Back" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const starts = problem.holds.filter((h) => h.role === 'start').length;
  const finishes = problem.holds.filter((h) => h.role === 'finish').length;
  const sent = ascents.length > 0;

  return (
    <Screen padded={false}>
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <IconButton icon={ChevronLeft} label="Back" onPress={() => router.back()} />
        <View style={{ flex: 1 }} />
        <IconButton
          icon={Flag}
          label={project ? 'Remove from projects' : 'Add to projects'}
          active={project}
          onPress={async () => setProject(await toggleProject(problem.uuid, layout.id))}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 110, gap: space.lg }}>
        <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
          <GradeBadge grade={problem.grade} benchmark={problem.isBenchmark} size="lg" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.title, { color: colors.text, fontSize: 24 }]}>{problem.name}</Text>
            <Small>
              by {problem.setter ?? 'unknown'} · {vGrade(problem.difficulty)} · {settings.angle}°
            </Small>
            <Row gap={space.md} style={{ marginTop: 4 }}>
              <Row gap={4}>
                <Users size={14} color={colors.textMuted} />
                <Small>{problem.ascents} ascents</Small>
              </Row>
              {problem.isBenchmark ? (
                <Row gap={4}>
                  <Award size={14} color={colors.warning} />
                  <Small style={{ color: colors.warning }}>Benchmark</Small>
                </Row>
              ) : null}
              {sent ? (
                <Row gap={4}>
                  <Check size={14} color={colors.success} />
                  <Small style={{ color: colors.success }}>Sent</Small>
                </Row>
              ) : null}
            </Row>
          </View>
        </Row>

        <BoardView layout={layout} holds={problem.holds} />

        <Row gap={space.lg} style={{ justifyContent: 'center' }}>
          <Legend color={roleColors.start} label={`${starts} start`} />
          <Legend color={roleColors.middle} label={`${problem.holds.length - starts - finishes} hand`} />
          <Legend color={roleColors.finish} label={`${finishes} finish`} />
        </Row>

        {problem.description ? (
          <Card>
            <Body muted>{problem.description}</Body>
          </Card>
        ) : null}

        {ascents.length > 0 ? (
          <Card>
            <Body style={type.bodyStrong}>Your ascents</Body>
            {ascents.map((a) => (
              <Row key={a.id} style={{ justifyContent: 'space-between' }}>
                <Small>{new Date(a.climbedAt).toLocaleDateString()}</Small>
                <Small>
                  {a.attempts === 1 ? 'Flash' : `${a.attempts} tries`}
                  {a.userGrade ? ` · felt ${a.userGrade}` : ''}
                </Small>
              </Row>
            ))}
          </Card>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md, backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        <Button
          title={!board.isConnected ? 'Connect board' : lit ? 'Turn off' : 'Light it up'}
          icon={!board.isConnected ? BluetoothOff : lit ? LightbulbOff : Lightbulb}
          variant={!board.isConnected ? 'secondary' : lit ? 'secondary' : 'primary'}
          onPress={light}
          style={{ flex: 1 }}
        />
        <Button
          title={sent ? 'Log again' : 'Log send'}
          icon={Check}
          variant={board.isConnected ? 'secondary' : 'primary'}
          onPress={() => router.push({ pathname: '/log/[uuid]', params: { uuid: problem.uuid } })}
          style={{ flex: 1 }}
        />
      </View>
      {board.isConnected ? null : (
        <View pointerEvents="none" style={[styles.hint, { bottom: insets.bottom + 84 }]}>
          <Bluetooth size={12} color={colors.textFaint} />
          <Small style={{ color: colors.textFaint }}>Not connected to a board</Small>
        </View>
      )}
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={6}>
      <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: color }} />
      <Small>{label}</Small>
    </Row>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.sm },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: space.sm,
    padding: space.lg,
    borderTopWidth: 1,
  },
  hint: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4 },
});
