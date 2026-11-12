import type { Action } from '../game/input';

interface Props {
  onPress: (a: Action) => void;
  onRelease: (a: Action) => void;
  onPause: () => void;
  canPause: boolean;
}

function TouchBtn({ label, cls, act, onPress, onRelease }: {
  label: string; cls: string; act: Action;
  onPress: (a: Action) => void; onRelease: (a: Action) => void;
}) {
  return (
    <button
      className={`touch-btn ${cls}`}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        onPress(act);
      }}
      onPointerUp={() => onRelease(act)}
      onPointerCancel={() => onRelease(act)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

export default function TouchControls({ onPress, onRelease, onPause, canPause }: Props) {
  return (
    <div className="touch-controls">
      <div className="touch-cluster">
        <TouchBtn label="◀" cls="t-left" act="left" onPress={onPress} onRelease={onRelease} />
        <TouchBtn label="▼" cls="t-soft" act="soft" onPress={onPress} onRelease={onRelease} />
        <TouchBtn label="▶" cls="t-right" act="right" onPress={onPress} onRelease={onRelease} />
      </div>
      <div className="touch-cluster">
        <TouchBtn label="暂存" cls="t-hold" act="hold" onPress={onPress} onRelease={onRelease} />
        <TouchBtn label="⟲" cls="t-ccw" act="ccw" onPress={onPress} onRelease={onRelease} />
        <TouchBtn label="⟳" cls="t-cw" act="cw" onPress={onPress} onRelease={onRelease} />
        <TouchBtn label="⤓" cls="t-hard" act="hard" onPress={onPress} onRelease={onRelease} />
        {canPause && <button className="touch-btn t-pause" onClick={onPause}>❚❚</button>}
      </div>
    </div>
  );
}