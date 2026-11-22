import { useEffect, useRef } from 'react';
import { BUILDINGS } from '../../game/data';
import type { BuildingId, GameState, Tile } from '../../game/types';
import { VillageScene, type SceneCallbacks } from './scene';

interface Props extends SceneCallbacks {
  state: GameState;
  selected: BuildingId | null;
  placing: BuildingId | null;
}

/** Hosts the PixiJS village scene and forwards state to it. */
export function VillageMap({ state, selected, placing, onSelect, onPlace, onCancelPlace }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<VillageScene | null>(null);
  const callbacks = useRef<SceneCallbacks>({ onSelect, onPlace, onCancelPlace });
  callbacks.current = { onSelect, onPlace, onCancelPlace };

  useEffect(() => {
    const s = new VillageScene({
      onSelect: (id) => callbacks.current.onSelect(id),
      onPlace: (at: Tile) => callbacks.current.onPlace(at),
      onCancelPlace: () => callbacks.current.onCancelPlace(),
    });
    scene.current = s;
    void s.init(host.current!);
    return () => {
      s.destroy();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    scene.current?.update({ state, selected, placing });
  }, [state, selected, placing]);

  useEffect(() => {
    if (!placing) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && callbacks.current.onCancelPlace();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placing]);

  return (
    <div className="map-wrap">
      <div ref={host} className="map-canvas" />
      {placing && (
        <div className="placing">
          📍 Choose a spot for the <b>{BUILDINGS[placing].name}</b>{placing === 'house' ? ' (new cottage)' : ''}
          <button className="ghost" onClick={onCancelPlace}>Cancel</button>
        </div>
      )}
      <div className="map-controls">
        <button className="ghost" onClick={() => scene.current?.zoomBy(1.25)} aria-label="Zoom in">＋</button>
        <button className="ghost" onClick={() => scene.current?.zoomBy(1 / 1.25)} aria-label="Zoom out">－</button>
        <button className="ghost" onClick={() => scene.current?.fit()} aria-label="Reset view">⟲</button>
      </div>
      <div className="map-hint">
        {placing ? 'Click a free spot to build · right-click or Esc to cancel' : 'Drag to pan · scroll to zoom · click a building'}
      </div>
    </div>
  );
}
