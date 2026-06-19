import { useEffect, useState } from "react";
import "./styles.css";
import SongSelect from "./SongSelect";
import GamePlay from "./GamePlay";
import Tutorial from "./Tutorial";
import ScoreBook from "./ScoreBook";
import type { Song, PageType } from "./types";
import { songs, isTutorialCompleted } from "./songs";

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
  const [initChecked, setInitChecked] = useState(false);
  const [scorebookSongId, setScorebookSongId] = useState<string | null>(null);

  const selectedSong = songs.find((s) => s.id === selectedSongId) || songs[0];

  useEffect(() => {
    const completed = isTutorialCompleted();
    if (!completed) {
      setPage("tutorial");
    }
    setInitChecked(true);
  }, []);

  function handleSelectSong(song: Song) {
    setSelectedSongId(song.id);
  }

  function handleStartPlay(song: Song) {
    setSelectedSongId(song.id);
    setPage("play");
  }

  function handleBackToSelect() {
    setPage("select");
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

  function handleOpenScorebook(songId?: string | null) {
    setScorebookSongId(songId || selectedSongId);
    setPage("scorebook");
  }

  function handleBackFromScorebook() {
    setPage("select");
  }

  if (!initChecked) {
    return (
      <main className="game-shell">
        <section className="hero">
          <p>{game.id} · H5Game · Port {game.port}</p>
          <h1>{game.title}</h1>
          <span>{game.tagline}</span>
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

      {page === "tutorial" && (
        <Tutorial
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialSkip}
        />
      )}

      {page === "select" && (
        <SongSelect
          selectedSongId={selectedSongId}
          onSelectSong={handleSelectSong}
          onStartPlay={handleStartPlay}
          onStartTutorial={handleStartTutorial}
          onOpenScorebook={handleOpenScorebook}
        />
      )}

      {page === "play" && (
        <GamePlay
          song={selectedSong}
          onBack={handleBackToSelect}
          onOpenScorebook={handleOpenScorebook}
        />
      )}

      {page === "scorebook" && (
        <ScoreBook
          initialSongId={scorebookSongId}
          onBack={handleBackFromScorebook}
        />
      )}
    </main>
  );
}

export default App;
