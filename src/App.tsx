import { useMemo, useState } from "react";
import "./styles.css";

const game = {
  "id": "hxywl-61901",
  "port": 61901,
  "title": "节奏点击",
  "tagline": "跟随节拍点击落下音符，追求连击与高判定",
  "prompt": "我想做一个H5节奏点击游戏，玩家跟着音乐节拍点击从屏幕上方落下的音符。游戏需要有开始页、歌曲选择页、游玩页和结算页，支持连击、Perfect/Good/Miss判定、分数计算和最高分本地保存。画面要适合手机竖屏，按钮和音符不能太小，节奏轨道要清楚。",
  "palette": [
    "#4f46e5",
    "#06b6d4",
    "#f97316"
  ],
  "stats": [
    "Perfect",
    "Good",
    "Miss",
    "Combo"
  ],
  "actions": [
    "开始演奏",
    "切换歌曲",
    "保存最高分"
  ],
  "mode": "rhythm"
};

const boards: Record<string, string[]> = {
  rhythm: ["♪", "◇", "♪", "◆", "♪", "◇", "◆", "♪", "◇"],
  merge: ["🍩", "🍩", "🧁", "🍪", "🧁", "🍰", "🍪", "🍩", "🍮"],
  dungeon: ["?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?"],
  slingshot: ["★", "·", "●", "·", "▣", "·", "★", "·", "◎"],
  escape: ["书架", "花瓶", "抽屉", "挂画", "地毯", "台灯", "门锁", "箱子", "窗帘"],
};

function App() {
  const [score, setScore] = useState(1280);
  const [combo, setCombo] = useState(7);
  const [selected, setSelected] = useState(0);
  const cells = useMemo(() => boards[game.mode], []);
  const best = Number(localStorage.getItem(game.id + "-best") || 0);

  function playCell(index: number) {
    setSelected(index);
    const gain = game.mode === "dungeon" && index % 5 === 0 ? -80 : 120 + index * 8;
    const nextScore = Math.max(0, score + gain);
    setScore(nextScore);
    setCombo((value) => (gain > 0 ? value + 1 : 0));
    if (nextScore > best) {
      localStorage.setItem(game.id + "-best", String(nextScore));
    }
  }

  return (
    <main className="game-shell">
      <section className="hero">
        <p>{game.id} · H5Game · Port {game.port}</p>
        <h1>{game.title}</h1>
        <span>{game.tagline}</span>
      </section>

      <section className="hud">
        {game.stats.map((stat, index) => (
          <article key={stat}>
            <small>{stat}</small>
            <strong>{index === 0 ? score : index === 1 ? best : index === 2 ? selected + 1 : combo}</strong>
          </article>
        ))}
      </section>

      <section className={"playground " + game.mode}>
        <div className="board">
          {cells.map((cell, index) => (
            <button
              className={selected === index ? "active" : ""}
              key={index}
              onClick={() => playCell(index)}
            >
              {cell}
            </button>
          ))}
        </div>
        <aside className="side-panel">
          <h2>核心玩法</h2>
          <p>{game.prompt}</p>
          <div className="actions">
            {game.actions.map((action) => (
              <button key={action}>{action}</button>
            ))}
          </div>
        </aside>
      </section>

      <section className="result-panel">
        <h2>结算预览</h2>
        <p>当前分数{score}，最高分{Math.max(best, score)}，连击{combo}。基础流程已包含开始、交互、反馈、记录和结算区域，后续可以继续扩展关卡、音效、动画与资源管理。</p>
      </section>
    </main>
  );
}

export default App;
