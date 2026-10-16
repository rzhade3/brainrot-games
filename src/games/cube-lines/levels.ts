export interface LevelSpec {
  level: number;
  size: number;
  minLines: number;
  maxLength: number;
  minDensity: number;
  minBent: number;
  minBlockedRatio: number;
  minMultiTurn: number;
  minDepth: number;
  minLong: number;
  minWrapped: number;
  minCrossFace: number;
}

export const LEVELS: readonly LevelSpec[] = Array.from({ length: 30 }, (_, index) => {
  const tier = Math.floor(index / 6);
  const step = index % 6;
  return {
    level: index + 1,
    size: 8 + tier,
    minLines: 24 + tier * 3,
    maxLength: 18 + tier * 5,
    minDensity: 0.65 + step * 0.002,
    minBent: 0.75,
    minMultiTurn: 0.6,
    minBlockedRatio: 0.6 + tier * 0.01 + step * 0.003,
    minDepth: 5 + Math.floor(tier / 2),
    minLong: 0.35,
    minWrapped: 0.3 + tier * 0.025,
    minCrossFace: 0.2 + tier * 0.025,
  };
});
