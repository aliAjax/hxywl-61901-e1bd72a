import { useState } from "react";
import { getCalibrationOffset, saveCalibrationOffset, resetCalibrationOffset, resetTutorialStatus, isTutorialCompleted } from "./songs";
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

export default function Settings({
  onBack,
  onOpenCalibration,
  onStartTutorial,
}: SettingsProps) {
  const [, setTick] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const calibrationOffset = getCalibrationOffset();
  const tutorialDone = isTutorialCompleted();
  const version = resourceManager.getVersion();

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
      desc: "重新生成所有歌曲的谱面数据（不会影响分数和记录）",
      actionLabel: "重建",
      onClick: () => {
        if (window.confirm("确定要重建所有谱面吗？")) {
          const songs = resourceManager.getSongs();
          for (const s of songs) {
            resourceManager.rebuildChart(s.id);
          }
          showMessage("谱面已全部重建");
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
      id: "reset-settings",
      icon: "⚙️",
      title: "重置游戏设置",
      desc: "重置校准值和教学状态，保留歌曲和分数",
      actionLabel: "重置设置",
      danger: true,
      onClick: () => {
        if (window.confirm("确定要重置游戏设置吗？")) {
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
        <div className="settings-item calibration-item">
          <div className="settings-item-icon">🎯</div>
          <div className="settings-item-body">
            <div className="settings-item-title">延迟校准</div>
            <div className="settings-item-desc">手动微调校准值，以5ms为步长。正值表示系统判定提前，负值表示判定延后。自动校准仍然可以覆盖此值。</div>
            <div className="calibration-controls">
              <div className="calibration-value-display">
                <span className="calibration-value-label">当前值</span>
                <strong className="calibration-value">{formatOffset(calibrationOffset)}</strong>
              </div>
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
