import type { Chart } from "./types";
import { resourceManager } from "./resourceManager";

export function getChartForSong(songId: string): Chart {
  return resourceManager.getChart(songId);
}

export function rebuildChartForSong(songId: string): Chart {
  return resourceManager.rebuildChart(songId);
}
