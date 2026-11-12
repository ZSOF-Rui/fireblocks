import { useCallback, useEffect, useState } from 'react';
import BackgroundFX from './components/BackgroundFX';
import Nav from './components/Nav';
import Home from './components/Home';
import GameScreen from './components/GameScreen';
import type { GameConfig } from './components/GameScreen';
import Leaderboard from './components/Leaderboard';
import Matchmaking from './components/Matchmaking';
import RoomLobby from './components/RoomLobby';
import Toasts from './components/Toasts';
import { HelpModal, ProfileModal, SettingsModal, CloudDownModal } from './components/Modals';
import { audio } from './game/audio';
import { MODE_NAME, applyTheme } from './game/constants';
import type { Mode } from './game/constants';
import { cloud } from './services/cloud';
import type { RoomVia } from './net/room';
import { settingsStore, useSettings } from './store';

type Screen =
  | { name: 'home' }
  | { name: 'ranking' }
  | { name: 'match' }
  | { name: 'room'; initialCode?: string; autoJoin?: boolean; lan?: string; via?: RoomVia }
  | { name: 'game'; config: GameConfig; runId: number };

applyTheme(settingsStore.get().theme);
document.documentElement.dataset.theme = settingsStore.get().theme;

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const params = new URLSearchParams(location.search);
    const room = params.get('room');
    if (room && /^[A-Za-z0-9]{3,8}$/.test(room)) {
      const via = params.get('via');
      return {
        name: 'room',
        initialCode: room.toUpperCase(),
        autoJoin: true,
        lan: params.get('lan') ?? undefined,
        via: via === 'online' || via === 'lan' || via === 'window' ? via : undefined,
      };
    }
    return { name: 'home' };
  });
  const [modal, setModal] = useState<null | 'settings' | 'help' | 'profile' | 'cloud-down'>(null);
  const settings = useSettings();

  applyTheme(settings.theme);
  document.documentElement.dataset.theme = settings.theme;

  useEffect(() => {
    audio.applySettings(settings);
  }, [settings]);

  useEffect(() => {
    const init = () => {
      audio.init();
      audio.applySettings(settingsStore.get());
    };
    window.addEventListener('pointerdown', init, { once: true });
    window.addEventListener('keydown', init, { once: true });
    return () => {
      window.removeEventListener('pointerdown', init);
      window.removeEventListener('keydown', init);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void cloud.startupCheck().then((s) => {
      if (!alive) return;
      if (s === 'down') setModal('cloud-down');
      void cloud.trackVisit();
    });
    return () => { alive = false; };
  }, []);

  const startGame = useCallback((config: GameConfig) => {
    setScreen({ name: 'game', config, runId: Date.now() });
  }, []);

  const exitGame = useCallback(() => {
    setScreen((s) => {
      if (s.name === 'game' && s.config.room) s.config.room.client.close();
      return { name: 'home' };
    });
  }, []);

  const goHome = useCallback(() => {
    if (screen.name === 'game') {
      window.dispatchEvent(new CustomEvent('fb-exit-request'));
      return;
    }
    setScreen({ name: 'home' });
  }, [screen.name]);

  const inGame = screen.name === 'game';

  return (
    <div className="app">
      <BackgroundFX />
      <Nav
        inGame={inGame}
        gameTitle={inGame ? MODE_NAME[screen.config.mode] : undefined}
        onHome={goHome}
        onRanking={() => setScreen({ name: 'ranking' })}
        onHelp={() => setModal('help')}
        onProfile={() => setModal('profile')}
        onSettings={() => setModal('settings')}
        onExitGame={() => window.dispatchEvent(new CustomEvent('fb-exit-request'))}
      />
      <main className="main">
        {screen.name === 'home' && (
          <Home
            onPlay={(mode: Mode) => startGame({ mode })}
            onMatch={() => setScreen({ name: 'match' })}
            onRoom={() => setScreen({ name: 'room' })}
            onRanking={() => setScreen({ name: 'ranking' })}
            onHelp={() => setModal('help')}
          />
        )}
        {screen.name === 'ranking' && <Leaderboard />}
        {screen.name === 'match' && (
          <Matchmaking
            onCancel={() => setScreen({ name: 'home' })}
            onFound={(bot) => startGame({ mode: 'vs-ai', bot })}
          />
        )}
        {screen.name === 'room' && (
          <RoomLobby
            initialCode={screen.initialCode}
            autoJoin={screen.autoJoin}
            initialLan={screen.lan}
            initialVia={screen.via}
            onCancel={() => setScreen({ name: 'home' })}
            onStart={(client, isHost, via) => startGame({ mode: 'net', room: { client, isHost, via }, seed: client.seed ?? undefined })}
          />
        )}
        {screen.name === 'game' && (
          <GameScreen
            key={screen.runId}
            config={screen.config}
            onExit={exitGame}
            onRematch={() => setScreen({ name: 'match' })}
            onOpenSettings={() => setModal('settings')}
            onOpenHelp={() => setModal('help')}
          />
        )}
      </main>
      <Toasts />
      {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
      {modal === 'help' && <HelpModal onClose={() => setModal(null)} />}
      {modal === 'profile' && <ProfileModal onClose={() => setModal(null)} />}
      {modal === 'cloud-down' && (
        <CloudDownModal onClose={() => setModal(null)} onOpenSettings={() => setModal('settings')} />
      )}
    </div>
  );
}