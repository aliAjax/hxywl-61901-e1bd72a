import { useEffect, useState } from "react";
import "./styles.css";
import SongSelect from "./SongSelect";
import GamePlay from "./GamePlay";
import Tutorial from "./Tutorial";
import ScoreBook from "./ScoreBook";
import Calibration from "./Calibration";
import Settings from "./Settings";
import type { Song, PageType, ResourceInitResult, PracticeSegment, ChartDifficulty } from "./types";
import { songs, isTutorialCompleted } from "./songs";
import { resourceManager, CHART_DIFFICULTIES } from "./resourceManager";

const game = {
  id: "hxywl-61901",
  port: 61901,
  title: "节奏点击",
  tagline: "跟随节拍点击落下音符，追求连击与高判定",
};

function App() {
  const [page, setPage] = useState<PageType>("select");
  const [selectedSongId, setSelectedSongId] = useState<string | null>(
    songs[0].id
  );
  const [selectedDifficulty, setSelectedDifficulty] = useState<ChartDifficulty>("standard");
  const [scorebookDifficulty, setScorebookDifficulty] = useState<ChartDifficulty | null>(null);
  const [initChecked, setInitChecked] = useState(false);
  const [initResult, setInitResult] = useState<ResourceInitResult | null>(null);
  const [resourceWarning, setResourceWarning] = useState<string | null>(null);
  const [scorebookSongId, setScorebookSongId] = useState<string | null>(null);
  const [calibrationReturnPage, setCalibrationReturnPage] = useState<PageType>("select");
  const [practiceSegment, setPracticeSegment] = useState<PracticeSegment | null>(null);

  const selectedSong = songs.find((s) => s.id === selectedSongId) || songs[0];

  useEffect(() => {
    try {
      const result = resourceManager.initialize();
      setInitResult(result);

      if (result.warnings.length > 0) {
        setResourceWarning(result.warnings.join("；"));
        const timer = window.setTimeout(() => {
          setResourceWarning(null);
        }, 5000);
        return () => window.clearTimeout(timer);
      }
    } catch (e) {
      console.error("资源初始化失败，执行紧急恢复:", e);
      try {
        resourceManager.clearAllCache();
        const fallback = resourceManager.initialize();
        setInitResult(fallback);
        setResourceWarning("资源严重损坏，已重置为默认状态");
        const timer = window.setTimeout(() => {
          setResourceWarning(null);
        }, 5000);
        return () => window.clearTimeout(timer);
      } catch (fatal) {
        console.error("紧急恢复也失败:", fatal);
      }
    } finally {
      const completed = isTutorialCompleted();
      if (!completed) {
        setPage("tutorial");
      }
      setInitChecked(true);
    }
  }, []);

  function handleSelectSong(song: Song) {
    setSelectedSongId(song.id);
  }

  function handleSelectDifficulty(difficulty: ChartDifficulty) {
    setSelectedDifficulty(difficulty);
  }

  function handleStartPlay(song: Song, difficulty: ChartDifficulty) {
    setSelectedSongId(song.id);
    setSelectedDifficulty(difficulty);
    setPracticeSegment(null);
    setPage("play");
  }

  function handleStartPractice(songId: string, difficulty: ChartDifficulty, startMs: number, endMs: number) {
    setSelectedSongId(songId);
    setSelectedDifficulty(difficulty);
    setPracticeSegment({ startMs, endMs });
    setPage("play");
  }

  function handleBackToSelect() {
    setPage("select");
    setPracticeSegment(null);
  }

  function handleStartTutorial() {
    setPage("tutorial");
  }

  function handleTutorialComplete() {
    setPage("select");
  }

  function handleTutorialSkip() {
    setPage("select");
  }

  function handleOpenScorebook(songId?: string | null, difficulty?: ChartDifficulty | null) {
    setScorebookSongId(songId || selectedSongId);
    setScorebookDifficulty(difficulty ?? selectedDifficulty);
    setPage("scorebook");
  }

  function handleBackFromScorebook() {
    setPage("select");
  }

  function handleOpenCalibration() {
    setCalibrationReturnPage("select");
    setPage("calibration");
  }

  function handleBackFromCalibration() {
    setPage(calibrationReturnPage);
  }

  function handleOpenSettings() {
    setPage("settings");
  }

  function handleBackFromSettings() {
    setPage("select");
  }

  function handleCalibrationFromSettings() {
    setCalibrationReturnPage("settings");
    setPage("calibration");
  }

  function handleTutorialFromSettings() {
    setPage("tutorial");
  }

  if (!initChecked) {
    return (
      <main className="game-shell">
        <section className="hero">
          <p>{game.id} · H5Game · Port {game.port}</p>
          <h1>{game.title}</h1>
          <span>{game.tagline}</span>
          <p className="loading-hint">正在加载资源...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="game-shell">
      <section className="hero">
        <p>{game.id} · H5Game · Port {game.port}</p>
        <h1>{game.title}</h1>
        <span>{game.tagline}</span>
      </section>

      {resourceWarning && (
        <div className="resource-warning" onClick={() => setResourceWarning(null)}>
          <span className="resource-warning-icon">⚠️</span>
          <span className="resource-warning-text">{resourceWarning}</span>
          <button className="resource-warning-close" onClick={() => setResourceWarning(null)}>
            ✕
          </button>
        </div>
      )}

      {page === "tutorial" && (
        <Tutorial
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialSkip}
        />
      )}

      {page === "select" && (
        <SongSelect
          selectedSongId={selectedSongId}
          selectedDifficulty={selectedDifficulty}
          onSelectSong={handleSelectSong}
          onSelectDifficulty={handleSelectDifficulty}
          onStartPlay={handleStartPlay}
          onStartTutorial={handleStartTutorial}
          onOpenScorebook={handleOpenScorebook}
          onOpenSettings={handleOpenSettings}
          onStartPractice={handleStartPractice}
        />
      )}

      {page === "play" && (
        <GamePlay
          song={selectedSong}
          difficulty={selectedDifficulty}
          onBack={handleBackToSelect}
          onOpenScorebook={handleOpenScorebook}
          practiceSegment={practiceSegment}
        />
      )}

      {page === "scorebook" && (
        <ScoreBook
          initialSongId={scorebookSongId}
          initialDifficulty={scorebookDifficulty}
          onBack={handleBackFromScorebook}
        />
      )}

      {page === "settings" && (
        <Settings
          onBack={handleBackFromSettings}
          onOpenCalibration={handleCalibrationFromSettings}
          onStartTutorial={handleTutorialFromSettings}
        />
      )}

      {page === "calibration" && (
        <Calibration
          onBack={handleBackFromCalibration}
        />
      )}
    </main>
  );
}

export default App;
