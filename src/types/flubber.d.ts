declare module 'flubber' {
  export function interpolate(
    fromShape: string,
    toShape: string,
    options?: { maxSegmentLength?: number; string?: boolean },
  ): (t: number) => string;

  export function toCircle(
    fromShape: string,
    x: number,
    y: number,
    r: number,
    options?: { maxSegmentLength?: number },
  ): (t: number) => string;

  export function fromCircle(
    x: number,
    y: number,
    r: number,
    toShape: string,
    options?: { maxSegmentLength?: number },
  ): (t: number) => string;

  export function toRect(
    fromShape: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options?: { maxSegmentLength?: number },
  ): (t: number) => string;

  export function fromRect(
    x: number,
    y: number,
    width: number,
    height: number,
    toShape: string,
    options?: { maxSegmentLength?: number },
  ): (t: number) => string;

  export function separate(
    fromShape: string,
    toShapes: string[],
    options?: { maxSegmentLength?: number; single?: boolean },
  ): ((t: number) => string)[];

  export function combine(
    fromShapes: string[],
    toShape: string,
    options?: { maxSegmentLength?: number; single?: boolean },
  ): ((t: number) => string)[];
}
