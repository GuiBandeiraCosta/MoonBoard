import React, { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import type { Hold } from '@/lib/catalog/decode';
import { layoutHolds } from '@/lib/catalog/decode';
import { COLS, type Layout } from '@/lib/constants/layouts';
import { role as roleColors, useTheme } from '@/lib/theme';

interface Props {
  layout: Layout;
  holds: Hold[];
  /** Grid positions highlighted as selectable (hold filter mode). */
  selected?: { col: number; row: number }[];
  onPressHold?: (col: number, row: number) => void;
  /** Fit to this width; defaults to the screen width minus gutters. */
  width?: number;
  compact?: boolean;
}

/**
 * Schematic board. We deliberately draw our own grid instead of Moon's board
 * artwork: the geometry is all a climber needs to read a problem, and the
 * images are Moon Climbing's copyright.
 */
export function BoardView({ layout, holds, selected, onPressHold, width, compact }: Props) {
  const { colors, isDark } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const w = width ?? screenW - 32;

  const labelGutter = compact ? 0 : 18;
  const cell = (w - labelGutter) / layout.cols;
  const h = cell * layout.rows + labelGutter;
  const r = cell * 0.36;

  const present = useMemo(() => {
    const set = new Set<string>();
    for (const p of layoutHolds(layout.id)) set.add(`${p.col}-${p.row}`);
    return set;
  }, [layout.id]);

  const selectedSet = useMemo(() => new Set((selected ?? []).map((s) => `${s.col}-${s.row}`)), [selected]);

  const cx = (col: number) => labelGutter + col * cell + cell / 2;
  const cy = (row: number) => (layout.rows - row) * cell + cell / 2;

  const idleFill = isDark ? colors.holdIdle : colors.holdIdle;

  return (
    <View style={[styles.wrap, { width: w, height: h, backgroundColor: colors.boardBg, borderColor: colors.border }]}>
      <Svg width={w} height={h}>
        <Rect x={0} y={0} width={w} height={h} rx={12} fill={colors.boardBg} />
        {/* grid */}
        <G stroke={colors.boardGrid} strokeWidth={1}>
          {Array.from({ length: layout.cols + 1 }, (_, i) => (
            <Line key={`v${i}`} x1={labelGutter + i * cell} y1={0} x2={labelGutter + i * cell} y2={cell * layout.rows} />
          ))}
          {Array.from({ length: layout.rows + 1 }, (_, i) => (
            <Line key={`h${i}`} x1={labelGutter} y1={i * cell} x2={w} y2={i * cell} />
          ))}
        </G>
        {/* labels */}
        {!compact &&
          Array.from({ length: layout.cols }, (_, c) => (
            <SvgText key={`cl${c}`} x={cx(c)} y={h - 4} fontSize={10} fill={colors.textFaint} textAnchor="middle">
              {COLS[c]}
            </SvgText>
          ))}
        {!compact &&
          Array.from({ length: layout.rows }, (_, i) => {
            const row = i + 1;
            return (
              <SvgText key={`rl${row}`} x={labelGutter - 5} y={cy(row) + 3.5} fontSize={10} fill={colors.textFaint} textAnchor="end">
                {row}
              </SvgText>
            );
          })}
        {/* idle holds */}
        {Array.from({ length: layout.cols }, (_, c) =>
          Array.from({ length: layout.rows }, (_, i) => {
            const row = i + 1;
            if (present.size > 0 && !present.has(`${c}-${row}`)) return null;
            const sel = selectedSet.has(`${c}-${row}`);
            return (
              <Circle
                key={`i${c}-${row}`}
                cx={cx(c)}
                cy={cy(row)}
                r={sel ? r : r * 0.45}
                fill={sel ? colors.accent : idleFill}
                opacity={sel ? 1 : 0.9}
              />
            );
          }),
        )}
        {/* problem holds */}
        {holds.map((hd) => (
          <G key={`${hd.col}-${hd.row}-${hd.role}`}>
            <Circle cx={cx(hd.col)} cy={cy(hd.row)} r={r} fill={roleColors[hd.role]} opacity={0.22} />
            <Circle cx={cx(hd.col)} cy={cy(hd.row)} r={r} stroke={roleColors[hd.role]} strokeWidth={Math.max(2, cell * 0.11)} fill="none" />
          </G>
        ))}
        {/* touch targets */}
        {onPressHold &&
          Array.from({ length: layout.cols }, (_, c) =>
            Array.from({ length: layout.rows }, (_, i) => {
              const row = i + 1;
              if (present.size > 0 && !present.has(`${c}-${row}`)) return null;
              return (
                <Rect
                  key={`t${c}-${row}`}
                  x={labelGutter + c * cell}
                  y={(layout.rows - row) * cell}
                  width={cell}
                  height={cell}
                  fill="transparent"
                  onPress={() => onPressHold(c, row)}
                />
              );
            }),
          )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', alignSelf: 'center' },
});
