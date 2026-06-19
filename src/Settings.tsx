import { useState } from "react";
import { getCalibrationOffset, resetTutorialStatus, isTutorialCompleted } from "./songs";

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
}

export default function Settings({
  onBack,
  onOpenCalibration,
  onStartTutorial,
}: SettingsProps) {
  const [, setTick] = useState(0);

  const calibrationOffset = getCalibrationOffset();
  const tutorialDone = isTutorialCompleted();

  const formatOffset = (ms: number): string => {
    if (ms === 0) return "0 ms";
    return ms > 0 ? `+${ms} ms` : `${ms} ms`;
  };

  const items: SettingItem[] = [
    {
      id: "calibration",
      icon: "🎯",
      title: "延迟校准",
      desc: "跟随节拍点击，自动计算推荐校准值，补偿输入延迟",
      value: formatOffset(calibrationOffset),
      actionLabel: "去校准",
      onClick: onOpenCalibration,
    },
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

      <div className="settings-list">
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
                className="settings-item-btn"
                onClick={item.onClick}
              >
                {item.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="settings-about">
        <small>节奏点击 v1.0 · 延迟校准模块</small>
      </div>
    </div>
  );
}
