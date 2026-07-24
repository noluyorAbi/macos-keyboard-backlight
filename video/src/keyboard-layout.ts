/**
 * A MacBook keyboard, as data.
 *
 * Widths are in key units: 1 unit is one letter key. The numbers are the real
 * proportions of an Apple keyboard (a 1.5u tab, a 1.75u caps, a 5u space bar),
 * because a keyboard with all-equal keys reads instantly as a placeholder and
 * the whole point of the shot is that you recognise the object.
 *
 * The arrow cluster is the one deliberate simplification: on a real MacBook the
 * up and down arrows are half height stacked in one unit. Splitting a row into
 * half-height cells costs a second layout pass and buys nothing at this size,
 * so the cluster is four keys of equal height sharing the same 3 units.
 *
 * The row-width assertion at the bottom of this file is not ceremony. It caught
 * this row at 16 units the first time it ran.
 */

export type Key = {
  /** width in key units */
  w: number;
  /** printed legend, only where it survives at this size */
  label?: string;
  /** function row and modifiers get a smaller legend */
  small?: boolean;
};

export type Row = Key[];

const k = (w: number, label?: string, small?: boolean): Key => ({
  w,
  label,
  small,
});

/**
 * Six rows, top to bottom. Every row sums to 15 units, which is what keeps the
 * block rectangular without any per-row fudging.
 */
export const ROWS: Row[] = [
  // function row: shorter keys, 15 of them
  [
    k(1, "esc", true),
    k(1, "F1", true),
    k(1, "F2", true),
    k(1, "F3", true),
    k(1, "F4", true),
    k(1, "F5", true),
    k(1, "F6", true),
    k(1, "F7", true),
    k(1, "F8", true),
    k(1, "F9", true),
    k(1, "F10", true),
    k(1, "F11", true),
    k(1, "F12", true),
    k(1, undefined, true),
    k(1, undefined, true),
  ],
  [
    k(1, "~"),
    k(1, "1"),
    k(1, "2"),
    k(1, "3"),
    k(1, "4"),
    k(1, "5"),
    k(1, "6"),
    k(1, "7"),
    k(1, "8"),
    k(1, "9"),
    k(1, "0"),
    k(1, "-"),
    k(1, "="),
    k(2, "delete", true),
  ],
  [
    k(1.5, "tab", true),
    k(1, "Q"),
    k(1, "W"),
    k(1, "E"),
    k(1, "R"),
    k(1, "T"),
    k(1, "Y"),
    k(1, "U"),
    k(1, "I"),
    k(1, "O"),
    k(1, "P"),
    k(1, "["),
    k(1, "]"),
    k(1.5, "\\"),
  ],
  [
    k(1.75, "caps", true),
    k(1, "A"),
    k(1, "S"),
    k(1, "D"),
    k(1, "F"),
    k(1, "G"),
    k(1, "H"),
    k(1, "J"),
    k(1, "K"),
    k(1, "L"),
    k(1, ";"),
    k(1, "'"),
    k(2.25, "return", true),
  ],
  [
    k(2.25, "shift", true),
    k(1, "Z"),
    k(1, "X"),
    k(1, "C"),
    k(1, "V"),
    k(1, "B"),
    k(1, "N"),
    k(1, "M"),
    k(1, ","),
    k(1, "."),
    k(1, "/"),
    k(2.75, "shift", true),
  ],
  [
    k(1, "fn", true),
    k(1, "ctrl", true),
    k(1.25, "opt", true),
    k(1.25, "cmd", true),
    k(5, undefined), // space
    k(1.25, "cmd", true),
    k(1.25, "opt", true),
    // The arrow cluster is 3 units total on a real board, so four keys at 0.75.
    k(0.75, "◀", true),
    k(0.75, "▲", true),
    k(0.75, "▼", true),
    k(0.75, "▶", true),
  ],
];

/** Every row is this many units wide. Asserted at module load, not assumed. */
export const ROW_UNITS = 15;

for (const [i, row] of ROWS.entries()) {
  const sum = row.reduce((n, key) => n + key.w, 0);
  if (Math.abs(sum - ROW_UNITS) > 0.001) {
    throw new Error(
      `keyboard row ${i} is ${sum} units wide, expected ${ROW_UNITS}`,
    );
  }
}

/** A key placed in the grid, with the geometry the scene actually draws. */
export type PlacedKey = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  small?: boolean;
  /**
   * 0 at the top left corner, 1 at the bottom right. This is the only thing
   * the sweep needs: it turns a 2D keyboard into one ordered line of keys.
   */
  t: number;
};

/**
 * Lay the rows out in pixels.
 *
 * `t` is a diagonal gradient rather than a plain left-to-right one, so the light
 * leaves the board as a wave travelling across it instead of a curtain closing.
 * The diagonal is weighted 0.72 / 0.28 toward the horizontal: a true 45 degree
 * sweep on a keyboard this wide takes too long to cross, and a purely
 * horizontal one looks mechanical.
 */
export const placeKeys = (
  unit: number,
  gap: number,
  rowH: number,
): { keys: PlacedKey[]; width: number; height: number } => {
  const keys: PlacedKey[] = [];
  const width = ROW_UNITS * unit + (ROW_UNITS - 1) * gap;
  const height = ROWS.length * rowH + (ROWS.length - 1) * gap;

  ROWS.forEach((row, r) => {
    let cursor = 0;
    row.forEach((key, c) => {
      const w = key.w * unit + (key.w - 1) * gap;
      const x = cursor;
      const y = r * (rowH + gap);
      const cx = (x + w / 2) / width;
      const cy = (y + rowH / 2) / height;
      keys.push({
        id: `${r}-${c}`,
        x,
        y,
        w,
        h: rowH,
        label: key.label,
        small: key.small,
        t: cx * 0.72 + cy * 0.28,
      });
      cursor += w + gap;
    });
  });

  return { keys, width, height };
};
