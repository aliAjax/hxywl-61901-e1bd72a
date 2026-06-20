import type { Chart, ChartDifficulty } from "./types";
import { resourceManager, CHART_DIFFICULTIES, CHART_DIFFICULTY_INFO } from "./resourceManager";

export { CHART_DIFFICULTIES, CHART_DIFFICULTY_INFO };

export function getChartForSong(songId: string, difficulty: ChartDifficulty = "standard"): Chart {
  return resourceManager.getChart(songId, difficulty);
}

export function rebuildChartForSong(songId: string, difficulty: ChartDifficulty = "standard"): Chart {
  return resourceManager.rebuildChart(songId, difficulty);
}

export function rebuildAllChartsForSong(songId: string): void {
  resourceManager.rebuildAllChartsForSong(songId);
}
