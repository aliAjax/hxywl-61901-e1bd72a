import { useState, useRef, useEffect } from "react";
import type { KeyBindings, ButtonLayout } from "./types";
import {
  getCalibrationOffset,
  saveCalibrationOffset,
  resetCalibrationOffset,
  resetTutorialStatus,
  isTutorialCompleted,
  getAllSongCalibrations,
  resetAllSongCalibrations,
  getEffectiveCalibration,
  getKeyBindings,
  saveKeyBindings,
  getButtonLayout,
  saveButtonLayout,
  validateKeyBinding,
  DEFAULT_KEY_BINDINGS,
  resetControlSettings,
} from "./songs";
import { resourceManager } from "./resourceManager";

interface SettingsProps {
  onBack: () => void;
  onOpenCalibration: () => void;
  onStartTutorial: () => void;
}

interface SettingItem {
  id: string;
  icon: string;
  title: string;
  desc: string;
  value?: string;
  actionLabel?: string;
  onClick?: () => void;
  danger?: boolean;
}

const TRACK_COLORS = ["#4f46e5", "#06b6d4", "#f97316", "#ec4899"];

export default function Settings({
  onBack,
  onOpenCalibration,
  onStartTutorial,
}: SettingsProps) {
  const [, setTick] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const calibrationOffset = getCalibrationOffset();
  const effectiveCalibration = getEffectiveCalibration();
  const songCalibrationCount = Object.keys(getAllSongCalibrations()).length;
  const tutorialDone = isTutorialCompleted();
  const version = resourceManager.getVersion();

  const [keyBindings, setKeyBindings] = useState<KeyBindings>(getKeyBindings());
  const [buttonLayout, setButtonLayout] = useState<ButtonLayout>(getButtonLayout());
  const [editingTrack, setEditingTrack] = useState<number | null>(null);
  const [bindingError, setBindingError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (editingTrack !== null && inputRefs.current[editingTrack]) {
      inputRefs.current[editingTrack]?.focus();
    }
  }, [editingTrack]);

  const handleKeyBindingChange = (trackIndex: number, key: string) => {
    const newBindings = { ...keyBindings };
    const trackKey = `track${trackIndex}` as keyof KeyBindings;
    newBindings[trackKey] = key;
    setKeyBindings(newBindings);
    setBindingError(null);
  };

  const handleKeyBindingKeyDown = (e: React.KeyboardEvent, trackIndex: number) => {
    if (editingTrack !== trackIndex) return;

    e.preventDefault();
    e.stopPropagation();

    let key = e.key;

    if (key === "Escape") {
      setEditingTrack(null);
      setBindingError(null);
      setKeyBindings(getKeyBindings());
      return;
    }

    if (key === "Enter" || key === "Tab") {
      const trackKey = `track${trackIndex}` as keyof KeyBindings;
      const currentKey = keyBindings[trackKey];
      const validation = validateKeyBinding(currentKey, keyBindings, trackIndex);

      if (!validation.valid) {
        setBindingError(validation.error || "无效按键");
        return;
      }

      saveKeyBindings(keyBindings);
      setEditingTrack(null);
      setBindingError(null);
      showMessage("按键绑定已保存");
      setTick((t) => t + 1);
      return;
    }

    let displayKey = key;
    if (key === " ") {
      displayKey = "space";
    } else if (key.length === 1) {
      displayKey = key.toLowerCase();
    } else {
      displayKey = key.toLowerCase();
    }

    const validation = validateKeyBinding(displayKey, keyBindings, trackIndex);
    if (!validation.valid) {
      setBindingError(validation.error || "无效按键");
      return;
    }

    setBindingError(null);
    handleKeyBindingChange(trackIndex, displayKey);
  };

  const handleKeyBindingBlur = (trackIndex: number) => {
    if (editingTrack !== trackIndex) return;

    const trackKey = `track${trackIndex}` as keyof KeyBindings;
    const currentKey = keyBindings[trackKey];
    const validation = validateKeyBinding(currentKey, keyBindings, trackIndex);

    if (!validation.valid) {
      setBindingError(validation.error || "无效按键");
      return;
    }

    saveKeyBindings(keyBindings);
    setEditingTrack(null);
    setBindingError(null);
    showMessage("按键绑定已保存");
    setTick((t) => t + 1);
  };

  const handleResetKeyBindings = () => {
    if (window.confirm("确定要重置为默认按键 D/F/J/K 吗？")) {
      setKeyBindings({ ...DEFAULT_KEY_BINDINGS });
      saveKeyBindings({ ...DEFAULT_KEY_BINDINGS });
      setEditingTrack(null);
      setBindingError(null);
      showMessage("已重置为默认按键 D/F/J/K");
      setTick((t) => t + 1);
    }
  };

  const handleLayoutChange = (layout: ButtonLayout) => {
    setButtonLayout(layout);
    saveButtonLayout(layout);
    showMessage(layout === "compact" ? "已切换为紧凑布局" : "已切换为宽松布局");
    setTick((t) => t + 1);
  };

  const formatOffset = (ms: number): string => {
    if (ms === 0) return "0 ms";
    return ms > 0 ? `+${ms} ms` : `${ms} ms`;
  };

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 3000);
  };

  const handleCalibrationIncrease = () => {
    const current = getCalibrationOffset();
    const newValue = current + 5;
    saveCalibrationOffset(newValue);
    setTick((t) => t + 1);
    showMessage(`校准值已调整为 ${formatOffset(newValue)}`);
  };

  const handleCalibrationDecrease = () => {
    const current = getCalibrationOffset();
    const newValue = current - 5;
    saveCalibrationOffset(newValue);
    setTick((t) => t + 1);
    showMessage(`校准值已调整为 ${formatOffset(newValue)}`);
  };

  const handleCalibrationReset = () => {
    resetCalibrationOffset();
    setTick((t) => t + 1);
    showMessage("校准值已重置为 0 ms");
  };

  const items: SettingItem[] = [
    {
      id: "tutorial",
      icon: "📘",
      title: "新手教学",
      desc: tutorialDone ? "已完成，可重新观看熟悉操作" : "未完成，建议先完成教学",
      actionLabel: tutorialDone ? "重新观看" : "开始教学",
      onClick: onStartTutorial,
    },
    {
      id: "reset-tutorial",
      icon: "🔄",
      title: "重置教学进度",
      desc: "清除教学完成记录，下次进入会重新显示教学",
      actionLabel: "重置",
      onClick: () => {
        if (window.confirm("确定要重置教学进度吗？")) {
          resetTutorialStatus();
          setTick((t) => t + 1);
          showMessage("教学进度已重置");
        }
      },
    },
    {
      id: "rebuild-charts",
      icon: "🎼",
      title: "重建所有谱面",
      desc: "重新生成所有歌曲的所有难度谱面（轻松/标准/挑战），不会影响分数和记录",
      actionLabel: "重建",
      onClick: () => {
        if (window.confirm("确定要重建所有难度的谱面吗？")) {
          resourceManager.rebuildAllCharts();
          showMessage("所有难度的谱面已重建");
        }
      },
    },
    {
      id: "reset-scores",
      icon: "📊",
      title: "清除所有分数",
      desc: "重置所有歌曲的最高分和游玩记录，歌曲和谱面保留",
      actionLabel: "清除分数",
      danger: true,
      onClick: () => {
        if (window.confirm("确定要清除所有分数和游玩记录吗？此操作不可撤销！")) {
          resourceManager.resetScores();
          setTick((t) => t + 1);
          showMessage("所有分数已清除");
        }
      },
    },
    {
      id: "reset-song-calibrations",
      icon: "🎵",
      title: "清除所有单曲校准",
      desc: (() => {
        const count = Object.keys(getAllSongCalibrations()).length;
        return count > 0
          ? `当前有 ${count} 首歌曲设置了独立校准值，清除后将全部使用全局校准`
          : "当前没有歌曲设置独立校准值";
      })(),
      actionLabel: "清除单曲校准",
      danger: Object.keys(getAllSongCalibrations()).length > 0,
      onClick: () => {
        const count = Object.keys(getAllSongCalibrations()).length;
        if (count === 0) {
          showMessage("没有需要清除的单曲校准");
          return;
        }
        if (window.confirm(`确定要清除 ${count} 首歌曲的独立校准值吗？`)) {
          resetAllSongCalibrations();
          setTick((t) => t + 1);
          showMessage("已清除所有单曲校准");
        }
      },
    },
    {
      id: "reset-settings",
      icon: "⚙️",
      title: "重置游戏设置",
      desc: "重置全局校准、所有单曲校准和教学状态，保留歌曲和分数",
      actionLabel: "重置设置",
      danger: true,
      onClick: () => {
        if (window.confirm("确定要重置游戏设置吗？这将清除所有校准和教学进度。")) {
          resourceManager.resetSettings();
          setTick((t) => t + 1);
          showMessage("设置已重置");
        }
      },
    },
    {
      id: "reset-all",
      icon: "⚠️",
      title: "清除所有本地数据",
      desc: "完全重置，包括歌曲、谱面、分数和所有设置，游戏将恢复到首次打开状态",
      actionLabel: "全部清除",
      danger: true,
      onClick: () => {
        if (
          window.confirm(
            "确定要清除所有本地数据吗？此操作不可撤销！\n所有歌曲、分数和设置都会被删除。"
          )
        ) {
          resourceManager.clearAllCache();
          resourceManager.initialize();
          setTick((t) => t + 1);
          showMessage("已重置为初始状态，页面将刷新...");
          window.setTimeout(() => window.location.reload(), 1200);
        }
      },
    },
  ];

  return (
    <div className="settings">
      <header className="settings-header">
        <button className="back-btn" onClick={onBack}>
          ← 返回
        </button>
        <div>
          <h1 className="select-title">设置</h1>
          <p className="select-subtitle">调整游戏参数与个性化选项</p>
        </div>
      </header>

      {message && (
        <div className="settings-message">
          <span>{message}</span>
        </div>
      )}

      <div className="settings-list">
        <div className="settings-item keybindings-item">
          <div className="settings-item-icon">⌨️</div>
          <div className="settings-item-body">
            <div className="settings-item-title">按键绑定</div>
            <div className="settings-item-desc">自定义四条轨道的键盘按键，点击按键后输入新的按键。</div>
            <div className="keybindings-grid">
              {[0, 1, 2, 3].map((trackIdx) => {
                const trackKey = `track${trackIdx}` as keyof KeyBindings;
                const isEditing = editingTrack === trackIdx;
                return (
                  <div key={trackIdx} className="keybinding-item">
                    <div
                      className="keybinding-track-label"
                      style={{ color: TRACK_COLORS[trackIdx] }}
                    >
                      轨道 {trackIdx + 1}
                    </div>
                    <button
                      className={
                        "keybinding-btn " +
                        (isEditing ? "editing " : "") +
                        (bindingError && isEditing ? "error " : "")
                      }
                      style={{
                        borderColor: TRACK_COLORS[trackIdx],
                        boxShadow: isEditing ? `0 0 16px ${TRACK_COLORS[trackIdx]}80` : "none",
                      }}
                      onClick={() => setEditingTrack(trackIdx)}
                      onKeyDown={(e) => handleKeyBindingKeyDown(e, trackIdx)}
                      onBlur={() => handleKeyBindingBlur(trackIdx)}
                      tabIndex={0}
                      ref={(el) => {
                        inputRefs.current[trackIdx] = el;
                      }}
                    >
                      {keyBindings[trackKey].toUpperCase()}
                    </button>
                  </div>
                );
              })}
            </div>
            {bindingError && (
              <div className="keybinding-error">
                ⚠️ {bindingError}
              </div>
            )}
            <div className="keybinding-hint">
              提示：点击按键后输入新按键，按 Enter 确认，按 Esc 取消
            </div>
            <button className="ghost-btn small-btn" onClick={handleResetKeyBindings}>
              🔄 重置为默认 D/F/J/K
            </button>
          </div>
        </div>

        <div className="settings-item layout-item">
          <div className="settings-item-icon">📱</div>
          <div className="settings-item-body">
            <div className="settings-item-title">移动端按钮布局</div>
            <div className="settings-item-desc">选择触屏按钮的排列方式，紧凑模式适合小手或大屏设备。</div>
            <div className="layout-selector">
              <button
                className={
                  "layout-option " +
                  (buttonLayout === "compact" ? "active " : "")
                }
                onClick={() => handleLayoutChange("compact")}
              >
                <div className="layout-preview compact-preview">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="layout-preview-btn"
                      style={{ backgroundColor: TRACK_COLORS[i] + "80" }}
                    />
                  ))}
                </div>
                <span>紧凑</span>
              </button>
              <button
                className={
                  "layout-option " +
                  (buttonLayout === "spacious" ? "active " : "")
                }
                onClick={() => handleLayoutChange("spacious")}
              >
                <div className="layout-preview spacious-preview">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="layout-preview-btn"
                      style={{ backgroundColor: TRACK_COLORS[i] + "80" }}
                    />
                  ))}
                </div>
                <span>宽松</span>
              </button>
            </div>
          </div>
        </div>

        <div className="settings-item calibration-item">
          <div className="settings-item-icon">🎯</div>
          <div className="settings-item-body">
            <div className="settings-item-title">延迟校准</div>
            <div className="settings-item-desc">手动微调校准值，以5ms为步长。正值表示系统判定提前，负值表示判定延后。自动校准仍然可以覆盖此值。</div>
            <div className="calibration-controls">
              <div className="calibration-value-display">
                <span className="calibration-value-label">全局校准</span>
                <strong className="calibration-value">{formatOffset(calibrationOffset)}</strong>
              </div>
              {songCalibrationCount > 0 && (
                <div className="calibration-song-count">
                  <span className="calibration-value-label">单曲校准</span>
                  <strong className="calibration-value small">
                    {songCalibrationCount} 首歌已设置
                  </strong>
                </div>
              )}
              <div className="calibration-buttons">
                <button
                  className="calibration-adjust-btn"
                  onClick={handleCalibrationDecrease}
                  title="减少5ms"
                >
                  −
                </button>
                <button
                  className="calibration-adjust-btn"
                  onClick={handleCalibrationReset}
                  title="重置为0"
                >
                  0
                </button>
                <button
                  className="calibration-adjust-btn"
                  onClick={handleCalibrationIncrease}
                  title="增加5ms"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <button className="settings-item-btn" onClick={onOpenCalibration}>
            去校准
          </button>
        </div>

        {items.map((item) => (
          <div key={item.id} className="settings-item">
            <div className="settings-item-icon">{item.icon}</div>
            <div className="settings-item-body">
              <div className="settings-item-title">{item.title}</div>
              <div className="settings-item-desc">{item.desc}</div>
              {item.value !== undefined && (
                <div className="settings-item-value">{item.value}</div>
              )}
            </div>
            {item.actionLabel && item.onClick && (
              <button
                className={
                  "settings-item-btn " + (item.danger ? "danger-btn" : "")
                }
                onClick={item.onClick}
              >
                {item.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="settings-about">
        <small>
          节奏点击 v1.0 · 延迟校准模块 · 资源版本 v{version.schemaVersion}
          (s{version.songsVersion}/c{version.chartsVersion}/sc{version.scoresVersion})
        </small>
      </div>
    </div>
  );
}
