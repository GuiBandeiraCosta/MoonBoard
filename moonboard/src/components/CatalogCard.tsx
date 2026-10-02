import { Check, Download, RefreshCw, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { closeCatalog } from '@/lib/catalog/db';
import { deleteCatalog, downloadCatalog, formatBytes, readCatalogMeta, type ManifestEntry } from '@/lib/catalog/snapshot';
import type { Layout } from '@/lib/constants/layouts';
import { radius, space, type, useTheme } from '@/lib/theme';
import { Body, Button, Row, Small } from './ui';

interface Props {
  layout: Layout;
  entry: ManifestEntry | undefined;
  selected: boolean;
  onSelect: () => void;
  onChanged?: () => void;
}

/** One row in the catalog list: select the board, download or refresh its problems. */
export function CatalogCard({ layout, entry, selected, onSelect, onChanged }: Props) {
  const { colors } = useTheme();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, bump] = useState(0);
  const meta = readCatalogMeta(layout.id);
  const outdated = meta && entry ? new Date(entry.builtAt) > new Date(meta.builtAt) : false;

  const download = async () => {
    if (!entry) return;
    setError(null);
    setProgress(0);
    try {
      closeCatalog(layout.id);
      await downloadCatalog(entry, setProgress);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
      bump((n) => n + 1);
    }
  };

  const remove = () =>
    Alert.alert('Remove catalog?', `${layout.name} problems will be deleted from this phone. Your logbook is kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          closeCatalog(layout.id);
          deleteCatalog(layout.id);
          bump((n) => n + 1);
          onChanged?.();
        },
      },
    ]);

  return (
    <Pressable
      onPress={onSelect}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: selected ? colors.accent : colors.border, borderWidth: selected ? 2 : 1 }]}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Body style={type.bodyStrong}>{layout.name}</Body>
          <Small>
            {layout.angles.map((a) => `${a}°`).join(' / ')}
            {entry ? ` · ${entry.tables.board_climbs?.rowCount.toLocaleString() ?? '?'} problems · ${formatBytes(entry.bytes)}` : ''}
          </Small>
        </View>
        {selected ? (
          <View style={[styles.check, { backgroundColor: colors.accent }]}>
            <Check size={14} color="#fff" strokeWidth={3} />
          </View>
        ) : null}
      </Row>

      {progress != null ? (
        <View style={{ gap: 6 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceRaised }}>
            <View style={{ width: `${Math.round(progress * 100)}%`, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
          </View>
          <Small>Downloading… {Math.round(progress * 100)}%</Small>
        </View>
      ) : meta ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={6}>
            <Check size={14} color={colors.success} />
            <Small style={{ color: colors.success }}>
              Downloaded {new Date(meta.downloadedAt).toLocaleDateString()}
              {outdated ? ' · update available' : ''}
            </Small>
          </Row>
          <Row gap={space.sm}>
            <Pressable hitSlop={8} onPress={download} accessibilityLabel="Refresh catalog" disabled={!entry}>
              <RefreshCw size={18} color={outdated ? colors.accent : colors.textMuted} />
            </Pressable>
            <Pressable hitSlop={8} onPress={remove} accessibilityLabel="Remove catalog">
              <Trash2 size={18} color={colors.textMuted} />
            </Pressable>
          </Row>
        </Row>
      ) : (
        <Button title="Download" icon={Download} variant="secondary" onPress={download} disabled={!entry} style={{ paddingVertical: 10 }} />
      )}
      {error ? <Small style={{ color: colors.danger }}>{error}</Small> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.lg, gap: space.md },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
