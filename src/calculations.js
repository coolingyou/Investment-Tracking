/**
 * FIFO 损益计算引擎 —— 含交易税费
 *
 * 买入成本 = 股数 × 成交价 + 税费
 * 卖出收入 = 股数 × 成交价 - 税费
 */

/**
 * 对指定股票执行 FIFO 计算
 * @param {Array} txList - 该股票的全部交易记录（已按日期排序）
 * @returns {{ heldShares, avgCost, totalCost, realizedPnl, trades }}
 */
export function calcFifo(txList) {
  var lots = [];
  var realizedPnl = 0;
  var trades = [];

  for (var i = 0; i < txList.length; i++) {
    var t = txList[i];
    if (t.type === 'buy') {
      var effectivePrice = t.totalAmount / t.shares;
      lots.push({ shares: t.shares, price: effectivePrice });
    } else {
      var remaining = t.shares;
      while (remaining > 0 && lots.length > 0) {
        var lot = lots[0];
        var used = Math.min(lot.shares, remaining);
        var sellPortion = t.totalAmount * (used / t.shares);
        var buyPortion = lot.price * used;
        var pnl = sellPortion - buyPortion;
        realizedPnl += pnl;
        trades.push({
          buyDate: t.date, sellDate: t.date,
          shares: used, buyPrice: lot.price, sellPrice: t.price, pnl: pnl,
        });
        lot.shares -= used;
        remaining -= used;
        if (lot.shares <= 1e-10) lots.shift();
      }
    }
  }

  var heldShares = lots.reduce(function (s, l) { return s + l.shares; }, 0);
  var totalCost = lots.reduce(function (s, l) { return s + l.shares * l.price; }, 0);
  var avgCost = heldShares > 0 ? totalCost / heldShares : 0;

  return {
    heldShares: heldShares,
    avgCost: avgCost,
    totalCost: totalCost,
    realizedPnl: realizedPnl,
    trades: trades,
    lots: lots,
  };
}

/**
 * 获取当前持仓列表
 * @param {Array} allTransactions
 * @param {Object} priceCache { ticker: { price, ts } }
 * @returns {Array}
 */
export function getHoldings(allTransactions, priceCache) {
  var tickers = [];
  var seen = {};
  for (var i = 0; i < allTransactions.length; i++) {
    var ticker = allTransactions[i].ticker;
    if (!seen[ticker]) {
      seen[ticker] = true;
      tickers.push(ticker);
    }
  }

  var result = [];
  for (var j = 0; j < tickers.length; j++) {
    var tkr = tickers[j];
    var txForTicker = allTransactions
      .filter(function (t) { return t.ticker === tkr; })
      .sort(function (a, b) { return (a.date || '') < (b.date || '') ? -1 : 1; });

    var fifo = calcFifo(txForTicker);
    if (fifo.heldShares <= 0) continue;

    var meta = txForTicker[0];
    var cached = priceCache[tkr];
    var currentPrice = cached && cached.price ? cached.price : 0;
    var marketValue = fifo.heldShares * currentPrice;
    var unrealizedPnl = marketValue - fifo.totalCost;
    var unrealizedPct = fifo.totalCost > 0 ? (unrealizedPnl / fifo.totalCost) * 100 : 0;
    var priceAge = cached ? (Date.now() - (cached.ts || 0)) / 1000 : Infinity;

    result.push({
      ticker: tkr, name: meta ? meta.name : tkr,
      exchange: meta ? meta.exchange : 'NASDAQ',
      heldShares: fifo.heldShares, avgCost: fifo.avgCost, totalCost: fifo.totalCost,
      currentPrice: currentPrice, marketValue: marketValue,
      unrealizedPnl: unrealizedPnl, unrealizedPct: unrealizedPct, priceAge: priceAge,
    });
  }
  return result;
}

/**
 * 获取已实现盈亏汇总
 * @param {Array} allTransactions
 * @returns {Array}
 */
export function getRealizedPnL(allTransactions) {
  var sellTickers = [];
  var sellSeen = {};
  for (var i = 0; i < allTransactions.length; i++) {
    var t = allTransactions[i];
    if (t.type === 'sell' && !sellSeen[t.ticker]) {
      sellSeen[t.ticker] = true;
      sellTickers.push(t.ticker);
    }
  }

  var result = [];
  for (var j = 0; j < sellTickers.length; j++) {
    var tkr = sellTickers[j];
    var txForTicker = allTransactions
      .filter(function (t) { return t.ticker === tkr; })
      .sort(function (a, b) { return (a.date || '') < (b.date || '') ? -1 : 1; });

    var fifo = calcFifo(txForTicker);
    if (fifo.realizedPnl === 0 && fifo.trades.length === 0) continue;

    var totalBuy = 0;
    var totalSell = 0;
    var meta = null;
    for (var k = 0; k < txForTicker.length; k++) {
      var tx = txForTicker[k];
      if (!meta) meta = tx;
      if (tx.type === 'buy') totalBuy += tx.shares * tx.price;
      if (tx.type === 'sell') totalSell += tx.shares * tx.price;
    }

    var name = meta ? meta.name : tkr;
    var ret = totalBuy > 0 ? (fifo.realizedPnl / totalBuy) * 100 : 0;

    result.push({
      ticker: tkr, name: name,
      totalBuy: totalBuy, totalSell: totalSell,
      realizedPnl: fifo.realizedPnl, ret: ret, tradeCount: fifo.trades.length,
    });
  }
  return result;
}
