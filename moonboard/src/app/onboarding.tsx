import { useRouter } from 'expo-router';
import { ArrowRight, Moon } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CatalogCard } from '@/components/CatalogCard';
import { Button, Screen, Small } from '@/components/ui';
import { fetchMoonboardManifest, hasCatalog, type ManifestEntry } from '@/lib/catalog/snapshot';
import { LAYOUTS } from '@/lib/constants/layouts';
import { updateSettings } from '@/lib/settings/store';
import { space, type, useTheme } from '@/lib/theme';

export default function Onboarding() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [entries, setEntries] = useState<ManifestEntry[]>([]);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(LAYOUTS[0].id);
  const [, bump] = useState(0);

  useEffect(() => {
    fetchMoonboardManifest()
      .then(setEntries)
      .catch((e) => setManifestError(e instanceof Error ? e.message : String(e)));
  }, []);

  const ready = hasCatalog(selected);

  const finish = async () => {
    const layout = LAYOUTS.find((l) => l.id === selected)!;
    await updateSettings({ layoutId: selected, angle: layout.angles.includes(40) ? 40 : layout.angles[0] });
    router.replace('/');
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.xl, paddingHorizontal: space.lg, paddingBottom: insets.bottom + 110, gap: space.lg }}
      >
        <View style={{ alignItems: 'center', gap: space.md, marginBottom: space.md }}>
          <View style={[styles.logo, { backgroundColor: colors.accentSoft }]}>
            <Moon size={40} color={colors.accent} strokeWidth={1.8} />
          </View>
          <Text style={[type.title, { color: colors.text, textAlign: 'center' }]}>Which board do you climb on?</Text>
          <Small style={{ textAlign: 'center' }}>
            Pick your layout and download its problems once. Everything then works offline. You can add more boards later in Settings.
          </Small>
        </View>

        {manifestError ? (
          <Small style={{ color: colors.danger, textAlign: 'center' }}>Could not reach the catalog server: {manifestError}</Small>
        ) : null}

        {LAYOUTS.map((l) => (
          <CatalogCard
            key={l.id}
            layout={l}
            entry={entries.find((e) => e.layoutId === l.id)}
            selected={selected === l.id}
            onSelect={() => setSelected(l.id)}
            onChanged={() => bump((n) => n + 1)}
          />
        ))}

        <Small style={{ textAlign: 'center', marginTop: space.md }}>
          Unofficial app, not affiliated with Moon Climbing Ltd. Problem data comes from the Boardsesh community catalog.
        </Small>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md, backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        <Button title={ready ? 'Start climbing' : 'Download a catalog to continue'} icon={ArrowRight} disabled={!ready} onPress={finish} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, borderTopWidth: 1 },
});
