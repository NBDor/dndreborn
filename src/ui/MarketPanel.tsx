import { ITEMS, ITEM_ORDER } from '../game/data';
import { buyPrice, qty, sellPrice, storageCap } from '../game/rules';
import type { Action, GameState } from '../game/types';
import { fmt } from './format';

export function MarketPanel({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  if (state.buildings.market < 1) {
    return (
      <div className="panel">
        <div className="card empty">⚖️ Build a <b>Market</b> to trade goods with passing merchants.</div>
      </div>
    );
  }
  const cap = storageCap(state);

  return (
    <div className="panel">
      <p className="muted">Merchants buy and sell at prices set by your market's level. Treasures sell well.</p>
      <div className="card">
        <table className="market">
          <thead>
            <tr><th>Item</th><th>Stock</th><th>Buy</th><th></th><th>Sell</th><th></th></tr>
          </thead>
          <tbody>
            {ITEM_ORDER.map((id) => {
              const have = qty(state, id);
              const bp = buyPrice(state, id);
              const sp = sellPrice(state, id);
              const canBuy = (n: number) => state.gold >= bp * n && have + n <= cap;
              return (
                <tr key={id}>
                  <td title={ITEMS[id].description}>{ITEMS[id].icon} {ITEMS[id].name}</td>
                  <td>{fmt(have)}</td>
                  <td>🪙 {bp}</td>
                  <td className="btns">
                    <button disabled={!canBuy(1)} onClick={() => dispatch({ type: 'buy', item: id, qty: 1 })}>+1</button>
                    <button disabled={!canBuy(10)} onClick={() => dispatch({ type: 'buy', item: id, qty: 10 })}>+10</button>
                  </td>
                  <td>🪙 {sp}</td>
                  <td className="btns">
                    <button disabled={have < 1} onClick={() => dispatch({ type: 'sell', item: id, qty: 1 })}>-1</button>
                    <button disabled={have < 10} onClick={() => dispatch({ type: 'sell', item: id, qty: 10 })}>-10</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
