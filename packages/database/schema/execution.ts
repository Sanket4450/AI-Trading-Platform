/**
 * R1 schema: execution
 *
 * Generated from context/r1-implementation-plan.html and then reviewed by hand.
 * Cross-table foreign keys, partial unique indexes, partitions and the
 * materialized view live in packages/database/migrations/*.sql because they
 * are easier to express and audit as explicit SQL.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
export const signals = pgTable(
  'signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    strategyVersionId: uuid('strategy_version_id').notNull(),
    tradingSessionId: uuid('trading_session_id').notNull(),
    accountId: uuid('account_id').notNull(),
    instrumentId: uuid('instrument_id').notNull(),
    configurationVersionId: uuid('configuration_version_id').notNull(),
    signalAt: timestamp('signal_at', { withTimezone: true }).notNull(),
    candleStart: timestamp('candle_start', { withTimezone: true }).notNull(),
    direction: varchar('direction', { length: 10 }).notNull(),
    signalType: varchar('signal_type', { length: 30 }).notNull(),
    referencePrice: numeric('reference_price', { precision: 20, scale: 4 }).notNull(),
    entryPrice: numeric('entry_price', { precision: 20, scale: 4 }),
    stopPrice: numeric('stop_price', { precision: 20, scale: 4 }),
    targetPrice: numeric('target_price', { precision: 20, scale: 4 }),
    quantity: numeric('quantity', { precision: 20, scale: 4 }),
    evidence: jsonb('evidence')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_signals_strategy_version_id').on(table.strategyVersionId),
    index('idx_signals_trading_session_id').on(table.tradingSessionId),
    index('idx_signals_instrument_id').on(table.instrumentId),
    index('idx_signals_signal_at').on(table.signalAt),
    check('chk_signals_direction_1', sql`${table.direction} in ('long', 'short')`),
    check(
      'chk_signals_signal_type_2',
      sql`${table.signalType} in ('entry', 'exit', 'stop', 'target', 'eod')`,
    ),
    check('chk_signals_reference_price_3', sql`${table.referencePrice} > 0`),
    check('chk_signals_entry_price_4', sql`${table.entryPrice} > 0`),
    check('chk_signals_stop_price_5', sql`${table.stopPrice} > 0`),
    check('chk_signals_target_price_6', sql`${table.targetPrice} > 0`),
    check('chk_signals_quantity_7', sql`${table.quantity} > 0`),
    check(
      'chk_signals_status_8',
      sql`${table.status} in ('created', 'risk_pending', 'approved', 'rejected', 'executed', 'expired', 'cancelled')`,
    ),
  ],
);

export const riskDecisions = pgTable(
  'risk_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    signalId: uuid('signal_id').notNull(),
    tradingSessionId: uuid('trading_session_id').notNull(),
    configurationVersionId: uuid('configuration_version_id').notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }).defaultNow().notNull(),
    outcome: varchar('outcome', { length: 20 }).notNull(),
    approvedQuantity: numeric('approved_quantity', { precision: 20, scale: 4 }),
    riskPercent: numeric('risk_percent', { precision: 10, scale: 6 }).notNull(),
    riskAmount: numeric('risk_amount', { precision: 20, scale: 2 }),
    accountEquity: numeric('account_equity', { precision: 20, scale: 2 }),
    availableCash: numeric('available_cash', { precision: 20, scale: 2 }),
    stopDistance: numeric('stop_distance', { precision: 20, scale: 4 }),
    reasons: jsonb('reasons')
      .default(sql`'[]'::jsonb`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_risk_decisions_signal').on(table.signalId),
    index('idx_risk_decisions_trading_session_id').on(table.tradingSessionId),
    check(
      'chk_risk_decisions_outcome_1',
      sql`${table.outcome} in ('approved', 'rejected', 'reduced')`,
    ),
    check('chk_risk_decisions_approved_quantity_2', sql`${table.approvedQuantity} >= 0`),
    check('chk_risk_decisions_risk_percent_3', sql`${table.riskPercent} > 0`),
    check('chk_risk_decisions_risk_amount_4', sql`${table.riskAmount} >= 0`),
    check('chk_risk_decisions_stop_distance_5', sql`${table.stopDistance} > 0`),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').notNull(),
    tradingSessionId: uuid('trading_session_id').notNull(),
    signalId: uuid('signal_id'),
    strategyVersionId: uuid('strategy_version_id'),
    instrumentId: uuid('instrument_id').notNull(),
    parentOrderId: uuid('parent_order_id'),
    brokerOrderId: varchar('broker_order_id', { length: 80 }),
    exchangeOrderId: varchar('exchange_order_id', { length: 80 }),
    clientOrderRef: varchar('client_order_ref', { length: 80 }).notNull(),
    orderRefId: varchar('order_ref_id', { length: 80 }),
    side: varchar('side', { length: 10 }).notNull(),
    orderType: varchar('order_type', { length: 20 }).notNull(),
    product: varchar('product', { length: 10 }).notNull(),
    validity: varchar('validity', { length: 10 }).notNull(),
    variety: varchar('variety', { length: 20 }).notNull(),
    status: varchar('status', { length: 30 }).notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
    filledQuantity: numeric('filled_quantity', { precision: 20, scale: 4 }).default('0').notNull(),
    pendingQuantity: numeric('pending_quantity', { precision: 20, scale: 4 })
      .default('0')
      .notNull(),
    cancelledQuantity: numeric('cancelled_quantity', { precision: 20, scale: 4 })
      .default('0')
      .notNull(),
    price: numeric('price', { precision: 20, scale: 4 }),
    triggerPrice: numeric('trigger_price', { precision: 20, scale: 4 }),
    averageFillPrice: numeric('average_fill_price', { precision: 20, scale: 4 }),
    disclosedQuantity: numeric('disclosed_quantity', { precision: 20, scale: 4 }),
    isAmo: boolean('is_amo').notNull(),
    tag: varchar('tag', { length: 40 }).notNull(),
    placedAt: timestamp('placed_at', { withTimezone: true }).notNull(),
    brokerUpdatedAt: timestamp('broker_updated_at', { withTimezone: true }).notNull(),
    statusMessage: text('status_message'),
    statusMessageRaw: text('status_message_raw'),
    rawPayloadId: uuid('raw_payload_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_orders_client_ref').on(table.clientOrderRef),
    index('idx_orders_account_id').on(table.accountId),
    index('idx_orders_trading_session_id').on(table.tradingSessionId),
    index('idx_orders_signal_id').on(table.signalId),
    index('idx_orders_instrument_id').on(table.instrumentId),
    index('idx_orders_parent_order_id').on(table.parentOrderId),
    index('idx_orders_broker_order_id').on(table.brokerOrderId),
    check('chk_orders_side_1', sql`${table.side} in ('buy', 'sell')`),
    check('chk_orders_order_type_2', sql`${table.orderType} in ('market', 'limit', 'sl', 'sl_m')`),
    check('chk_orders_product_3', sql`${table.product} in ('intraday', 'delivery', 'co', 'mtf')`),
    check('chk_orders_validity_4', sql`${table.validity} in ('day', 'ioc')`),
    check('chk_orders_variety_5', sql`${table.variety} in ('simple', 'amo', 'co')`),
    check(
      'chk_orders_status_6',
      sql`${table.status} in ('pending_new', 'submitted', 'open', 'partially_filled', 'filled', 'cancelled', 'rejected', 'expired', 'unknown')`,
    ),
    check('chk_orders_quantity_7', sql`${table.quantity} > 0`),
    check(
      'chk_orders_filled_quantity_8',
      sql`${table.filledQuantity} + ${table.pendingQuantity} + ${table.cancelledQuantity} <= ${table.quantity}`,
    ),
    check('chk_orders_price_9', sql`${table.price} >= 0`),
    check('chk_orders_trigger_price_10', sql`${table.triggerPrice} >= 0`),
    check('chk_orders_average_fill_price_11', sql`${table.averageFillPrice} >= 0`),
    check('chk_orders_disclosed_quantity_12', sql`${table.disclosedQuantity} >= 0`),
  ],
);

export const orderEvents = pgTable(
  'order_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull(),
    sequence: integer('sequence').notNull(),
    eventType: varchar('event_type', { length: 40 }).notNull(),
    fromStatus: varchar('from_status', { length: 30 }),
    toStatus: varchar('to_status', { length: 30 }),
    payload: jsonb('payload')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    rawPayloadId: uuid('raw_payload_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_order_events_sequence').on(table.orderId, table.sequence),
    index('idx_order_events_occurred_at').on(table.occurredAt),
    check('chk_order_events_sequence_1', sql`${table.sequence} > 0`),
    check(
      'chk_order_events_event_type_2',
      sql`${table.eventType} in ('created', 'submitted', 'acknowledged', 'partially_filled', 'filled', 'modified', 'cancelled', 'rejected', 'expired', 'reconciled', 'unknown')`,
    ),
  ],
);

export const fills = pgTable(
  'fills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull(),
    accountId: uuid('account_id').notNull(),
    instrumentId: uuid('instrument_id').notNull(),
    brokerTradeId: varchar('broker_trade_id', { length: 80 }).notNull(),
    exchangeTradeId: varchar('exchange_trade_id', { length: 80 }),
    side: varchar('side', { length: 10 }).notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
    price: numeric('price', { precision: 20, scale: 4 }).notNull(),
    grossAmount: numeric('gross_amount', { precision: 20, scale: 2 }).notNull(),
    executedAt: timestamp('executed_at', { withTimezone: true }).notNull(),
    exchangeTimestamp: timestamp('exchange_timestamp', { withTimezone: true }).notNull(),
    rawPayloadId: uuid('raw_payload_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_fills_account_trade').on(table.accountId, table.brokerTradeId),
    index('idx_fills_order_id').on(table.orderId),
    index('idx_fills_instrument_id').on(table.instrumentId),
    check('chk_fills_side_1', sql`${table.side} in ('buy', 'sell')`),
    check('chk_fills_quantity_2', sql`${table.quantity} > 0`),
    check('chk_fills_price_3', sql`${table.price} > 0`),
    check('chk_fills_gross_amount_4', sql`${table.grossAmount} >= 0`),
  ],
);

export const tradeCosts = pgTable(
  'trade_costs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fillId: uuid('fill_id').notNull(),
    brokerage: numeric('brokerage', { precision: 20, scale: 4 }).notNull(),
    stt: numeric('stt', { precision: 20, scale: 4 }).notNull(),
    exchangeCharge: numeric('exchange_charge', { precision: 20, scale: 4 }).notNull(),
    sebiCharge: numeric('sebi_charge', { precision: 20, scale: 4 }).notNull(),
    stampDuty: numeric('stamp_duty', { precision: 20, scale: 4 }).notNull(),
    gst: numeric('gst', { precision: 20, scale: 4 }).notNull(),
    otherCharges: numeric('other_charges', { precision: 20, scale: 4 }).notNull(),
    total: numeric('total', { precision: 20, scale: 4 }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    costModelVersion: varchar('cost_model_version', { length: 30 }).notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_trade_costs_fill').on(table.fillId),
    check('chk_trade_costs_brokerage_1', sql`${table.brokerage} >= 0`),
    check('chk_trade_costs_stt_2', sql`${table.stt} >= 0`),
    check('chk_trade_costs_exchange_charge_3', sql`${table.exchangeCharge} >= 0`),
    check('chk_trade_costs_sebi_charge_4', sql`${table.sebiCharge} >= 0`),
    check('chk_trade_costs_stamp_duty_5', sql`${table.stampDuty} >= 0`),
    check('chk_trade_costs_gst_6', sql`${table.gst} >= 0`),
    check('chk_trade_costs_other_charges_7', sql`${table.otherCharges} >= 0`),
    check('chk_trade_costs_total_8', sql`${table.total} >= 0`),
  ],
);

export const positions = pgTable(
  'positions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').notNull(),
    instrumentId: uuid('instrument_id').notNull(),
    product: varchar('product', { length: 10 }).notNull(),
    tradingSessionId: uuid('trading_session_id'),
    strategyVersionId: uuid('strategy_version_id'),
    quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
    overnightQuantity: numeric('overnight_quantity', { precision: 20, scale: 4 })
      .default('0')
      .notNull(),
    averagePrice: numeric('average_price', { precision: 20, scale: 4 }),
    lastPrice: numeric('last_price', { precision: 20, scale: 4 }),
    marketValue: numeric('market_value', { precision: 20, scale: 2 }),
    realizedPnl: numeric('realized_pnl', { precision: 20, scale: 2 }).default('0').notNull(),
    unrealizedPnl: numeric('unrealized_pnl', { precision: 20, scale: 2 }).default('0').notNull(),
    stopPrice: numeric('stop_price', { precision: 20, scale: 4 }),
    targetPrice: numeric('target_price', { precision: 20, scale: 4 }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    status: varchar('status', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_positions_account_id').on(table.accountId),
    index('idx_positions_instrument_id').on(table.instrumentId),
    index('idx_positions_trading_session_id').on(table.tradingSessionId),
    check(
      'chk_positions_product_1',
      sql`${table.product} in ('intraday', 'delivery', 'co', 'mtf')`,
    ),
    check('chk_positions_quantity_2', sql`${table.status} <> 'open' or ${table.quantity} <> 0`),
    check('chk_positions_average_price_3', sql`${table.averagePrice} > 0`),
    check('chk_positions_last_price_4', sql`${table.lastPrice} > 0`),
    check('chk_positions_stop_price_5', sql`${table.stopPrice} > 0`),
    check('chk_positions_target_price_6', sql`${table.targetPrice} > 0`),
    check(
      'chk_positions_opened_at_7',
      sql`${table.closedAt} is null or ${table.closedAt} > ${table.openedAt}`,
    ),
    check('chk_positions_status_8', sql`${table.status} in ('open', 'closed')`),
  ],
);

export const positionEvents = pgTable(
  'position_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    positionId: uuid('position_id').notNull(),
    eventType: varchar('event_type', { length: 30 }).notNull(),
    quantityDelta: numeric('quantity_delta', { precision: 20, scale: 4 }).notNull(),
    price: numeric('price', { precision: 20, scale: 4 }),
    realizedPnlDelta: numeric('realized_pnl_delta', { precision: 20, scale: 2 })
      .default('0')
      .notNull(),
    fillId: uuid('fill_id'),
    payload: jsonb('payload')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_position_events_position_id').on(table.positionId),
    check(
      'chk_position_events_event_type_1',
      sql`${table.eventType} in ('opened', 'increased', 'reduced', 'closed', 'stop_moved', 'target_moved', 'reconciled')`,
    ),
    check('chk_position_events_price_2', sql`${table.price} > 0`),
  ],
);

export const brokerPositionSnapshots = pgTable(
  'broker_position_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    tradingDate: date('trading_date').notNull(),
    instrumentId: uuid('instrument_id').notNull(),
    product: varchar('product', { length: 10 }).notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
    overnightQuantity: numeric('overnight_quantity', { precision: 20, scale: 4 }).notNull(),
    averagePrice: numeric('average_price', { precision: 20, scale: 4 }),
    lastPrice: numeric('last_price', { precision: 20, scale: 4 }),
    closePrice: numeric('close_price', { precision: 20, scale: 4 }),
    unrealizedPnl: numeric('unrealized_pnl', { precision: 20, scale: 2 }).notNull(),
    realizedPnl: numeric('realized_pnl', { precision: 20, scale: 2 }).notNull(),
    brokerPnl: numeric('broker_pnl', { precision: 20, scale: 2 }).notNull(),
    dayBuyQuantity: numeric('day_buy_quantity', { precision: 20, scale: 4 }).default('0').notNull(),
    daySellQuantity: numeric('day_sell_quantity', { precision: 20, scale: 4 })
      .default('0')
      .notNull(),
    multiplier: numeric('multiplier', { precision: 20, scale: 4 }).default('1').notNull(),
    rawPayloadId: uuid('raw_payload_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_broker_position_snapshots_account_id').on(table.accountId),
    index('idx_broker_position_snapshots_captured_at').on(table.capturedAt),
    check(
      'chk_broker_position_snapshots_product_1',
      sql`${table.product} in ('intraday', 'delivery', 'co', 'mtf')`,
    ),
    check('chk_broker_position_snapshots_average_price_2', sql`${table.averagePrice} >= 0`),
    check('chk_broker_position_snapshots_last_price_3', sql`${table.lastPrice} >= 0`),
    check('chk_broker_position_snapshots_close_price_4', sql`${table.closePrice} >= 0`),
  ],
);

export const holdingsSnapshots = pgTable(
  'holdings_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    tradingDate: date('trading_date').notNull(),
    instrumentId: uuid('instrument_id').notNull(),
    isin: char('isin', { length: 12 }).notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
    t1Quantity: numeric('t1_quantity', { precision: 20, scale: 4 }).default('0').notNull(),
    collateralQuantity: numeric('collateral_quantity', { precision: 20, scale: 4 })
      .default('0')
      .notNull(),
    averagePrice: numeric('average_price', { precision: 20, scale: 4 }),
    lastPrice: numeric('last_price', { precision: 20, scale: 4 }),
    closePrice: numeric('close_price', { precision: 20, scale: 4 }),
    pnl: numeric('pnl', { precision: 20, scale: 2 }).notNull(),
    dayChange: numeric('day_change', { precision: 20, scale: 4 }),
    dayChangePct: numeric('day_change_pct', { precision: 20, scale: 4 }),
    haircut: numeric('haircut', { precision: 10, scale: 6 }),
    rawPayloadId: uuid('raw_payload_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_holdings_snapshots_account_id').on(table.accountId),
    check('chk_holdings_snapshots_quantity_1', sql`${table.quantity} >= 0`),
    check('chk_holdings_snapshots_average_price_2', sql`${table.averagePrice} >= 0`),
    check('chk_holdings_snapshots_last_price_3', sql`${table.lastPrice} >= 0`),
    check('chk_holdings_snapshots_close_price_4', sql`${table.closePrice} >= 0`),
    check('chk_holdings_snapshots_haircut_5', sql`${table.haircut} >= 0`),
  ],
);

export const accountEquitySnapshots = pgTable(
  'account_equity_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    tradingDate: date('trading_date').notNull(),
    snapshotType: varchar('snapshot_type', { length: 20 }).notNull(),
    availableCash: numeric('available_cash', { precision: 20, scale: 2 }),
    cashOpeningBalance: numeric('cash_opening_balance', { precision: 20, scale: 2 }),
    cashAddedToday: numeric('cash_added_today', { precision: 20, scale: 2 }),
    cashWithdrawnToday: numeric('cash_withdrawn_today', { precision: 20, scale: 2 }),
    amountFromStockSale: numeric('amount_from_stock_sale', { precision: 20, scale: 2 }),
    collateralValue: numeric('collateral_value', { precision: 20, scale: 2 }),
    utilizedMargin: numeric('utilized_margin', { precision: 20, scale: 2 }),
    realizedPnl: numeric('realized_pnl', { precision: 20, scale: 2 }).notNull(),
    unrealizedPnl: numeric('unrealized_pnl', { precision: 20, scale: 2 }).notNull(),
    netEquity: numeric('net_equity', { precision: 20, scale: 2 }),
    drawdownPct: numeric('drawdown_pct', { precision: 10, scale: 6 }),
    source: varchar('source', { length: 20 }).notNull(),
    rawPayloadId: uuid('raw_payload_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_account_equity_snapshots_account_id').on(table.accountId),
    index('idx_account_equity_snapshots_trading_date').on(table.tradingDate),
    check(
      'chk_account_equity_snapshots_snapshot_type_1',
      sql`${table.snapshotType} in ('session_open', 'intraday', 'session_close', 'broker_sync')`,
    ),
    check(
      'chk_account_equity_snapshots_amount_from_stock_sale_2',
      sql`${table.amountFromStockSale} >= 0`,
    ),
    check('chk_account_equity_snapshots_collateral_value_3', sql`${table.collateralValue} >= 0`),
    check('chk_account_equity_snapshots_utilized_margin_4', sql`${table.utilizedMargin} >= 0`),
    check('chk_account_equity_snapshots_drawdown_pct_5', sql`${table.drawdownPct} >= 0`),
    check('chk_account_equity_snapshots_source_6', sql`${table.source} in ('broker', 'computed')`),
  ],
);

export const roundTripTrades = pgTable(
  'round_trip_trades',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').notNull(),
    strategyVersionId: uuid('strategy_version_id').notNull(),
    instrumentId: uuid('instrument_id').notNull(),
    tradingSessionId: uuid('trading_session_id').notNull(),
    configurationVersionId: uuid('configuration_version_id').notNull(),
    direction: varchar('direction', { length: 10 }).notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
    entryOrderId: uuid('entry_order_id'),
    exitOrderId: uuid('exit_order_id'),
    entryAt: timestamp('entry_at', { withTimezone: true }).notNull(),
    exitAt: timestamp('exit_at', { withTimezone: true }),
    entryPrice: numeric('entry_price', { precision: 20, scale: 4 }).notNull(),
    exitPrice: numeric('exit_price', { precision: 20, scale: 4 }).notNull(),
    grossPnl: numeric('gross_pnl', { precision: 20, scale: 2 }).notNull(),
    costsTotal: numeric('costs_total', { precision: 20, scale: 2 }).default('0').notNull(),
    netPnl: numeric('net_pnl', { precision: 20, scale: 2 }).notNull(),
    initialStop: numeric('initial_stop', { precision: 20, scale: 4 }),
    target: numeric('target', { precision: 20, scale: 4 }),
    rMultiple: numeric('r_multiple', { precision: 20, scale: 6 }),
    exitReason: varchar('exit_reason', { length: 30 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_round_trip_trades_account_id').on(table.accountId),
    index('idx_round_trip_trades_strategy_version_id').on(table.strategyVersionId),
    index('idx_round_trip_trades_trading_session_id').on(table.tradingSessionId),
    check('chk_round_trip_trades_direction_1', sql`${table.direction} in ('long', 'short')`),
    check('chk_round_trip_trades_quantity_2', sql`${table.quantity} > 0`),
    check(
      'chk_round_trip_trades_entry_at_3',
      sql`${table.exitAt} is null or ${table.exitAt} > ${table.entryAt}`,
    ),
    check('chk_round_trip_trades_entry_price_4', sql`${table.entryPrice} > 0`),
    check('chk_round_trip_trades_exit_price_5', sql`${table.exitPrice} > 0`),
    check('chk_round_trip_trades_initial_stop_6', sql`${table.initialStop} > 0`),
    check('chk_round_trip_trades_target_7', sql`${table.target} > 0`),
    check(
      'chk_round_trip_trades_exit_reason_8',
      sql`${table.exitReason} in ('target', 'stop', 'eod', 'manual', 'risk', 'reconciliation', 'strategy_exit')`,
    ),
    check('chk_round_trip_trades_status_9', sql`${table.status} in ('open', 'closed')`),
  ],
);

export const reconciliations = pgTable(
  'reconciliations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').notNull(),
    tradingDate: date('trading_date').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    status: varchar('status', { length: 20 }).notNull(),
    ordersChecked: integer('orders_checked').default(0).notNull(),
    positionsChecked: integer('positions_checked').default(0).notNull(),
    mismatchesCount: integer('mismatches_count').default(0).notNull(),
    rawPayloadId: uuid('raw_payload_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_reconciliations_account_date').on(table.accountId, table.tradingDate),
    index('idx_reconciliations_trading_date').on(table.tradingDate),
    check(
      'chk_reconciliations_started_at_1',
      sql`${table.finishedAt} is null or ${table.startedAt} is null or ${table.finishedAt} >= ${table.startedAt}`,
    ),
    check(
      'chk_reconciliations_status_2',
      sql`${table.status} in ('running', 'matched', 'mismatched', 'failed')`,
    ),
    check('chk_reconciliations_orders_checked_3', sql`${table.ordersChecked} >= 0`),
    check('chk_reconciliations_positions_checked_4', sql`${table.positionsChecked} >= 0`),
    check('chk_reconciliations_mismatches_count_5', sql`${table.mismatchesCount} >= 0`),
  ],
);

export const reconciliationIssues = pgTable(
  'reconciliation_issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reconciliationId: uuid('reconciliation_id').notNull(),
    entityType: varchar('entity_type', { length: 20 }).notNull(),
    entityId: uuid('entity_id'),
    fieldName: varchar('field_name', { length: 60 }).notNull(),
    internalValue: text('internal_value'),
    brokerValue: text('broker_value'),
    severity: varchar('severity', { length: 20 }).notNull(),
    resolutionStatus: varchar('resolution_status', { length: 20 }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_reconciliation_issues_reconciliation_id').on(table.reconciliationId),
    check(
      'chk_reconciliation_issues_entity_type_1',
      sql`${table.entityType} in ('order', 'position', 'holding', 'funds')`,
    ),
    check(
      'chk_reconciliation_issues_severity_2',
      sql`${table.severity} in ('info', 'warning', 'critical')`,
    ),
    check(
      'chk_reconciliation_issues_resolution_status_3',
      sql`${table.resolutionStatus} in ('open', 'resolved', 'ignored')`,
    ),
  ],
);
