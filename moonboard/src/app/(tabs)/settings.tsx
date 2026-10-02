import { Info } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { CatalogCard } from '@/components/CatalogCard';
import { Body, Card, Row, Screen, ScreenHeader, Small } from '@/components/ui';
import { fetchMoonboardManifest, hasCatalog, type ManifestEntry } from '@/lib/catalog/snapshot';
import { LAYOUTS } from '@/lib/constants/layouts';
import { updateSettings, useSettings } from '@/lib/settings/store';
import { space, type, useTheme } from '@/lib/theme';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const settings = useSettings();
  const [entries, setEntries] = useState<ManifestEntry[]>([]);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [, bump] = useState(0);

  useEffect(() => {
    fetchMoonboardManifest()
      .then(setEntries)
      .catch((e) => setManifestError(e instanceof Error ? e.message : String(e)));
  }, []);

  const select = (id: number) => {
    const layout = LAYOUTS.find((l) => l.id === id)!;
    const angle = layout.angles.includes(settings.angle) ? settings.angle : layout.angles[0];
    updateSettings({ layoutId: id, angle });
  };

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg }}>
        <ScreenHeader title="Settings" subtitle="Boards and catalogs" />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.md }}>
        <Small style={type.smallStrong}>Your board</Small>
        <Small>Tap a board to switch to it. Download its catalog to browse problems offline.</Small>
        {manifestError ? <Small style={{ color: colors.danger }}>Catalog server unreachable: {manifestError}</Small> : null}
        {LAYOUTS.map((l) => (
          <CatalogCard
            key={l.id}
            layout={l}
            entry={entries.find((e) => e.layoutId === l.id)}
            selected={settings.layoutId === l.id}
            onSelect={() => select(l.id)}
            onChanged={() => bump((n) => n + 1)}
          />
        ))}

        <Card style={{ marginTop: space.md }}>
          <Row gap={space.sm}>
            <Info size={18} color={colors.accent} />
            <Body style={type.bodyStrong}>About</Body>
          </Row>
          <Small>
            Moonlight is an unofficial, open MoonBoard companion. It is not affiliated with Moon Climbing Ltd. Problems and grades come from the
            Boardsesh community catalog and may differ from the official app. Your logbook never leaves this phone.
          </Small>
          <Small>{hasCatalog(settings.layoutId ?? -1) ? 'Catalog ready.' : 'No catalog for the selected board yet.'}</Small>
        </Card>
      </ScrollView>
    </Screen>
  );
}
