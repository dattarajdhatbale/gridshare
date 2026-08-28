import { Activity, ChevronRight, Zap } from 'lucide-react';
import { Order, Trade } from '../simulation/model';

interface OrderBookProps {
  orders: Order[];
  trades: Trade[];
}

export function OrderBook({ orders, trades }: OrderBookProps) {
  const asks = orders.filter((o) => o.side === 'ask');
  const bids = orders.filter((o) => o.side === 'bid');

  return (
    <section className="card trades">
      <div className="card-head">
        <div>
          <label>ORDER BOOK / MARKET ACTIVITY</label>
          <h2>Matching in real time</h2>
        </div>
        <Activity size={22} className="lime" />
      </div>

      <div className="book">
        <div>
          <small>ASKS · SELLERS</small>
          {asks.map((o) => (
            <div className="order ask" key={o.id}>
              <span>{o.owner}</span>
              <b>{o.kwh.toFixed(1)} kWh</b>
              <strong>₹{o.price.toFixed(2)}</strong>
            </div>
          ))}
        </div>
        <div>
          <small>BIDS · BUYERS</small>
          {bids.map((o) => (
            <div className="order bid" key={o.id}>
              <span>{o.owner}</span>
              <b>{o.kwh.toFixed(1)} kWh</b>
              <strong>₹{o.price.toFixed(2)}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="clear-note">
        <Zap size={13} /> Compatible bids clear at the live LMP
      </div>

      <div className="trade-list">
        {trades.slice(0, 3).map((t) => (
          <div className="trade" key={t.id}>
            <div className="trade-icon">
              <Zap size={15} />
            </div>
            <div className="trade-main">
              <b>
                {t.seller} <ChevronRight size={13} /> {t.buyer}
              </b>
              <span>
                {t.kwh.toFixed(1)} kWh · {t.distance}m away · {t.lossPct.toFixed(2)}% loss
              </span>
            </div>
            <div className="trade-price">
              <b>₹{t.price.toFixed(2)}</b>
              <span>{t.time}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
