import type { AudioPlayer } from 'expo-audio';

import { restart, SoundPool } from './sound';

type FakePlayer = AudioPlayer & { source: string };

function fakePlayer(source: string): FakePlayer {
  const p = {
    source,
    playing: false,
    currentTime: 0,
    play: jest.fn(() => {
      p.playing = true;
    }),
    pause: jest.fn(() => {
      p.playing = false;
    }),
    seekTo: jest.fn(() => Promise.resolve()),
    remove: jest.fn(),
  };
  return p as unknown as FakePlayer;
}

describe('SoundPool (§4.2 overlapping bells, max 3 concurrent)', () => {
  function makePool() {
    const created: FakePlayer[] = [];
    const pool = new SoundPool({ left: 'L', right: 'R' } as never, 3, (src) => {
      const p = fakePlayer(src as unknown as string);
      created.push(p);
      return p;
    });
    return { pool, created };
  }

  it('preloads one player per sound per slot up front', () => {
    const { created } = makePool();
    expect(created.map((p) => p.source)).toEqual(['L', 'R', 'L', 'R', 'L', 'R']);
  });

  it('overlaps rapid taps on separate players, never more than 3 at once', () => {
    const { pool, created } = makePool();
    for (let i = 0; i < 7; i++) pool.play(i % 2 ? 'right' : 'left');
    expect(created.filter((p) => p.playing).length).toBeLessThanOrEqual(3);
    // the 4th tap reused slot 0: its right player (tap 4 = right) plays, the left one was stopped
    expect(created[0].pause).toHaveBeenCalled();
  });

  it('restarts a player that already played from the beginning', async () => {
    const p = fakePlayer('L');
    restart(p);
    expect(p.play).toHaveBeenCalledTimes(1);
    expect(p.seekTo).not.toHaveBeenCalled();

    (p as { currentTime: number }).currentTime = 0.8;
    restart(p);
    expect(p.pause).toHaveBeenCalled();
    expect(p.seekTo).toHaveBeenCalledWith(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(p.play).toHaveBeenCalledTimes(2);
  });

  it('releases every player', () => {
    const { pool, created } = makePool();
    pool.release();
    for (const p of created) expect(p.remove).toHaveBeenCalled();
  });
});
