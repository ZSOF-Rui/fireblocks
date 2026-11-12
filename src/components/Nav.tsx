import { audio } from '../game/audio';
import { settingsStore, useProfile, useSettings } from '../store';

export function FlameLogo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="flame-g" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff3b1f" />
          <stop offset=".55" stopColor="#ff6a00" />
          <stop offset="1" stopColor="#ffc93c" />
        </linearGradient>
      </defs>
      <path fill="url(#flame-g)" d="M32 4c3 12-9 16-9 27 0 5 2 8 5 10-1-7 3-10 6-15 7 7 10 12 10 18 0 9-7 15-12 17 16-2 25-13 25-27C57 18 41 15 32 4z" />
    </svg>
  );
}

export function SoundIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

interface Props {
  inGame: boolean;
  gameTitle?: string;
  onHome: () => void;
  onRanking: () => void;
  onHelp: () => void;
  onProfile: () => void;
  onExitGame: () => void;
}

export default function Nav({ inGame, gameTitle, onHome, onRanking, onHelp, onProfile, onExitGame }: Props) {
  const s = useSettings();
  const p = useProfile();
  return (
    <header className="nav">
      <button className="nav-logo" onClick={inGame ? onExitGame : onHome} title={inGame ? '退出对局' : '返回主页'}>
        <FlameLogo />
        <span className="nav-logo-text">
          <b>炎块</b>
          <i>FIREBLOCKS</i>
        </span>
      </button>

      {inGame ? (
        <div className="nav-game-title">{gameTitle}</div>
      ) : (
        <nav className="nav-links">
          <button onClick={onHome}>主页</button>
          <button onClick={onRanking}>排行榜</button>
          <button onClick={onHelp}>玩法说明</button>
        </nav>
      )}

      <div className="nav-right">
        {inGame && (
          <button className="btn btn-ghost btn-sm nav-exit" onClick={onExitGame}>退出对局</button>
        )}
        <button
          className={`icon-btn sound-btn ${s.muted ? 'is-muted' : ''}`}
          title={s.muted ? '取消静音' : '静音全部声音'}
          aria-label={s.muted ? '取消静音' : '静音全部声音'}
          onClick={() => {
            audio.init();
            settingsStore.set({ muted: !s.muted });
            if (s.muted) audio.click();
          }}
        >
          <SoundIcon muted={s.muted} />
        </button>
        <button className="profile-chip" onClick={onProfile} title="编辑玩家资料">
          <span className="profile-avatar">{p.avatar}</span>
          <span className="profile-meta">
            <b>{p.name}</b>
            <i>积分 {p.rating}</i>
          </span>
        </button>
      </div>
    </header>
  );
}