type UnionKeys<T> = T extends unknown ? keyof T : never;
type InvalidKeys<K extends string | number | symbol> = { [P in K]?: never };
type StrictUnionHelper<T, TAll> = T extends unknown
  ? T & InvalidKeys<Exclude<UnionKeys<TAll>, keyof T>>
  : never;

/**
 * Overlapping union members skip excess-property checking, which would let a board declare
 * e.g. a port on a terrain hex. Forcing the check keeps the board data honest.
 *
 * From https://github.com/microsoft/TypeScript/issues/20863#issuecomment-520551758
 */
export type StrictUnion<T> = StrictUnionHelper<T, T>;

type Enumerate<N extends number, Acc extends number[] = []> = Acc["length"] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc["length"]]>;

/** A numeric range as a type; `F` inclusive, `T` exclusive. */
export type Range<F extends number, T extends number> = Exclude<Enumerate<T>, Enumerate<F>>;
