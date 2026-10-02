import { Bluetooth, BluetoothOff, BluetoothSearching, Lightbulb, LightbulbOff, Link2Off, RadioTower, Wifi } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Body, Button, Card, EmptyState, Row, Screen, ScreenHeader, Small } from '@/components/ui';
import { useBoard } from '@/lib/ble/useBoard';
import { getLayout } from '@/lib/constants/layouts';
import { updateSettings, useSettings } from '@/lib/settings/store';
import { radius, space, type, useTheme } from '@/lib/theme';

export default function BoardScreen() {
  const { colors } = useTheme();
  const board = useBoard();
  const settings = useSettings();
  const layout = getLayout(settings.layoutId);
  const [testLit, setTestLit] = useState(false);

  // Auto-reconnect to the last board once when the screen mounts.
  useEffect(() => {
    if (settings.deviceId && board.status === 'idle' && !board.isConnected) {
      board.connect(settings.deviceId).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async (id: string) => {
    await board.connect(id);
    if (board.isConnected) updateSettings({ deviceId: id });
  };

  const testPattern = async () => {
    if (!layout) return;
    if (testLit) {
      await board.clear();
      setTestLit(false);
      return;
    }
    // Light the four corners plus the centre so wiring direction is obvious.
    const top = layout.rows;
    await board.lightHolds(
      [
        { col: 0, row: 1, role: 'start' },
        { col: layout.cols - 1, row: 1, role: 'start' },
        { col: Math.floor(layout.cols / 2), row: Math.ceil(top / 2), role: 'middle' },
        { col: 0, row: top, role: 'finish' },
        { col: layout.cols - 1, row: top, role: 'finish' },
      ],
      { rows: layout.rows, bothLights: settings.bothLights, flipped: settings.flippedStrip },
    );
    setTestLit(true);
  };

  const statusLabel =
    board.status === 'off'
      ? 'Bluetooth is off'
      : board.status === 'connected'
        ? `Connected to ${board.deviceName}`
        : board.status === 'connecting'
          ? 'Connecting...'
          : board.status === 'scanning'
            ? 'Looking for boards...'
            : 'Not connected';

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg }}>
        <ScreenHeader title="Board" subtitle={statusLabel} />
      </View>

      <FlatList
        data={board.status === 'connected' ? [] : board.found}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.md }}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
              <View
                style={[
                  styles.orb,
                  { backgroundColor: board.isConnected ? colors.success : board.status === 'off' ? colors.danger : colors.accentSoft },
                ]}
              >
                {board.status === 'off' ? (
                  <BluetoothOff size={36} color="#fff" />
                ) : board.isConnected ? (
                  <Bluetooth size={36} color="#fff" />
                ) : board.status === 'scanning' || board.status === 'connecting' ? (
                  <BluetoothSearching size={36} color={colors.accent} />
                ) : (
                  <RadioTower size={36} color={colors.accent} />
                )}
              </View>
              <Body style={[type.bodyStrong, { marginTop: space.md }]}>{statusLabel}</Body>
              {board.lastError ? <Small style={{ color: colors.danger, textAlign: 'center' }}>{board.lastError}</Small> : null}
              <View style={{ marginTop: space.lg, width: '100%', gap: space.sm }}>
                {board.isConnected ? (
                  <>
                    <Button title={testLit ? 'Turn off test' : 'Test lights'} icon={testLit ? LightbulbOff : Lightbulb} onPress={testPattern} />
                    <Button title="Disconnect" icon={Link2Off} variant="secondary" onPress={() => board.disconnect()} />
                  </>
                ) : (
                  <Button
                    title={board.status === 'scanning' ? 'Stop scanning' : 'Scan for boards'}
                    icon={board.status === 'scanning' ? BluetoothOff : BluetoothSearching}
                    loading={board.status === 'connecting'}
                    onPress={() => (board.status === 'scanning' ? board.stopScan() : board.startScan())}
                    disabled={board.status === 'off'}
                  />
                )}
              </View>
            </Card>

            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Body style={type.bodyStrong}>Light both LEDs</Body>
                  <Small>Also light the LED above each hold, like the official app&apos;s “both lights”.</Small>
                </View>
                <Switch
                  value={settings.bothLights}
                  onValueChange={(bothLights) => updateSettings({ bothLights })}
                  trackColor={{ true: colors.accent }}
                />
              </Row>
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.sm }} />
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Body style={type.bodyStrong}>Strip starts at the top</Body>
                  <Small>DIY boards only. Flip this if the test pattern lights the wrong corners.</Small>
                </View>
                <Switch
                  value={settings.flippedStrip}
                  onValueChange={(flippedStrip) => updateSettings({ flippedStrip })}
                  trackColor={{ true: colors.accent }}
                />
              </Row>
            </Card>

            {!board.isConnected && board.found.length > 0 ? <Small style={type.smallStrong}>Nearby boards</Small> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => connect(item.id)}
            style={({ pressed }) => [styles.device, { backgroundColor: pressed ? colors.surfaceRaised : colors.surface, borderColor: colors.border }]}
          >
            <Bluetooth size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>{item.name}</Text>
              <Small>{item.id === settings.deviceId ? 'Last used' : item.id}</Small>
            </View>
            <Row gap={4}>
              <Wifi size={14} color={colors.textFaint} />
              <Small>{item.rssi ?? '–'} dBm</Small>
            </Row>
          </Pressable>
        )}
        ListEmptyComponent={
          board.isConnected || board.status === 'scanning' || board.status === 'connecting' ? null : (
            <EmptyState
              icon={RadioTower}
              title="No boards yet"
              message="Turn on the LED box, stand near it, then scan. Boards show up as “MoonBoard”."
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  orb: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  device: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
});
