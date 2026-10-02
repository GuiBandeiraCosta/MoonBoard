import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Check, Minus, Plus, Star, X, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradeBadge } from '@/components/GradeBadge';
import { Body, Button, Chip, IconButton, Loading, Row, Screen, Small, Title } from '@/components/ui';
import { getProblem, type Problem } from '@/lib/catalog/db';
import { FONT_GRADES } from '@/lib/catalog/decode';
import { getLayout } from '@/lib/constants/layouts';
import { addAscent } from '@/lib/logbook/db';
import { useSettings } from '@/lib/settings/store';
import { radius, space, type, useTheme } from '@/lib/theme';

export default function LogScreen() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const settings = useSettings();
  const layout = getLayout(settings.layoutId);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [attempts, setAttempts] = useState(1);
  const [userGrade, setUserGrade] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!layout || !uuid) return;
    getProblem(layout.id, uuid, settings.angle).then((p) => {
      setProblem(p);
      if (p) setUserGrade(p.grade);
    });
  }, [layout, uuid, settings.angle]);

  if (!layout) return null;
  if (!problem) return <Loading />;

  const nearby = (() => {
    const i = FONT_GRADES.findIndex((g) => g.font === problem.grade);
    const from = Math.max(0, i - 2);
    return FONT_GRADES.slice(from, from + 5);
  })();

  const save = async () => {
    setSaving(true);
    try {
      await addAscent({
        climbUuid: problem.uuid,
        layoutId: layout.id,
        angle: settings.angle,
        name: problem.name,
        grade: problem.grade,
        setter: problem.setter,
        isBenchmark: problem.isBenchmark,
        attempts,
        userGrade,
        rating,
        comment: comment.trim() || null,
        climbedAt: new Date().toISOString(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen padded={false}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Title>Log send</Title>
        <View style={{ flex: 1 }} />
        <IconButton icon={X} label="Close" onPress={() => router.back()} />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 100, gap: space.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <Row gap={space.md}>
          <GradeBadge grade={problem.grade} benchmark={problem.isBenchmark} />
          <View style={{ flex: 1 }}>
            <Body style={type.bodyStrong} numberOfLines={1}>
              {problem.name}
            </Body>
            <Small>
              {problem.setter ?? 'unknown'} · {settings.angle}°
            </Small>
          </View>
        </Row>

        <View style={{ gap: space.sm }}>
          <Body style={type.bodyStrong}>Attempts</Body>
          <Row gap={space.md}>
            <IconButton icon={Minus} label="Fewer attempts" onPress={() => setAttempts((a) => Math.max(1, a - 1))} />
            <View style={[styles.counter, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {attempts === 1 ? <Zap size={18} color={colors.warning} fill={colors.warning} /> : null}
              <Body style={type.bodyStrong}>{attempts === 1 ? 'Flash' : `${attempts} tries`}</Body>
            </View>
            <IconButton icon={Plus} label="More attempts" onPress={() => setAttempts((a) => a + 1)} />
          </Row>
        </View>

        <View style={{ gap: space.sm }}>
          <Body style={type.bodyStrong}>Felt like</Body>
          <Row gap={space.sm}>
            {nearby.map((g) => (
              <Chip key={g.font} label={g.font} active={userGrade === g.font} onPress={() => setUserGrade(g.font)} />
            ))}
          </Row>
        </View>

        <View style={{ gap: space.sm }}>
          <Body style={type.bodyStrong}>Quality</Body>
          <Row gap={space.xs}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} hitSlop={6} onPress={() => setRating(rating === n ? null : n)} accessibilityLabel={`${n} stars`}>
                <Star size={30} color={colors.warning} fill={rating != null && n <= rating ? colors.warning : 'transparent'} strokeWidth={1.8} />
              </Pressable>
            ))}
          </Row>
        </View>

        <View style={{ gap: space.sm }}>
          <Body style={type.bodyStrong}>Notes</Body>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Beta, conditions, how it felt..."
            placeholderTextColor={colors.textFaint}
            multiline
            style={[type.body, styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          />
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md, backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        <Button title="Save to logbook" icon={Check} loading={saving} onPress={save} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.md },
  counter: {
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  input: { minHeight: 90, borderRadius: radius.md, borderWidth: 1, padding: space.md, textAlignVertical: 'top' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, borderTopWidth: 1 },
});
