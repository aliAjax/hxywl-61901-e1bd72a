import { useState } from "react";
import "./styles.css";
import SongSelect from "./SongSelect";
import GamePlay from "./GamePlay";
import type { Song, PageType } from "./types";
import { songs } from "./songs";

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

  const selectedSong = songs.find((s) => s.id === selectedSongId) || songs[0];

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

  return (
    <main className="game-shell">
      <section className="hero">
        <p>{game.id} · H5Game · Port {game.port}</p>
        <h1>{game.title}</h1>
        <span>{game.tagline}</span>
      </section>

      {page === "select" ? (
        <SongSelect
          selectedSongId={selectedSongId}
          onSelectSong={handleSelectSong}
          onStartPlay={handleStartPlay}
        />
      ) : (
        <GamePlay song={selectedSong} onBack={handleBackToSelect} />
      )}
    </main>
  );
}

export default App;
