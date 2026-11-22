WITH input AS (
  SELECT $1::uuid AS instrument_id
  -- Optional range filter: add to `sessions` below
  -- AND tc.trading_date BETWEEN $2::date AND $3::date
),
instrument AS (
  SELECT i.id, i.exchange_id, i.listed_on, i.delisted_on
  FROM instruments i
  JOIN input p ON p.instrument_id = i.id
),
sessions AS (
  SELECT tc.trading_date, tc.session_open, tc.session_close
  FROM trading_calendar tc
  JOIN instrument i ON i.exchange_id = tc.exchange_id
  WHERE tc.is_trading_day
    AND tc.session_open IS NOT NULL
    AND tc.session_close IS NOT NULL
    AND tc.session_close > tc.session_open
    AND (i.listed_on  IS NULL OR tc.trading_date >= i.listed_on)
    AND (i.delisted_on IS NULL OR tc.trading_date <= i.delisted_on)
),
expected AS (
  SELECT s.trading_date,
         s.session_open,
         s.session_close,
         (EXTRACT(EPOCH FROM (s.session_close - s.session_open)) / 60)::int AS expected_bars,
         minute AS candle_start
  FROM sessions s
  CROSS JOIN LATERAL generate_series(
    s.session_open,
    s.session_close - interval '1 minute',
    interval '1 minute'
  ) AS minute
),
observed AS (
  SELECT DISTINCT c.trading_date, c.candle_start
  FROM market_candles_1m c
  WHERE c.instrument_id = (SELECT instrument_id FROM input)
    AND c.trading_date BETWEEN (SELECT min(trading_date) FROM sessions)
                           AND (SELECT max(trading_date) FROM sessions)
),
marked AS (
  SELECT e.trading_date, e.session_open, e.session_close, e.expected_bars,
         e.candle_start,
         (o.candle_start IS NOT NULL) AS present
  FROM expected e
  LEFT JOIN observed o
    ON o.trading_date = e.trading_date
   AND o.candle_start = e.candle_start
),
missing AS (
  SELECT trading_date, candle_start
  FROM marked
  WHERE NOT present
),
missing_runs AS (
  SELECT trading_date,
         min(candle_start) AS run_start,
         max(candle_start) AS run_end,
         count(*)         AS minutes
  FROM (
    SELECT trading_date, candle_start,
           candle_start
             - row_number() OVER (PARTITION BY trading_date ORDER BY candle_start)
               * interval '1 minute' AS island
    FROM missing
  ) grouped
  GROUP BY trading_date, island
)
SELECT m.trading_date,
       m.session_open,
       m.session_close,
       m.expected_bars,
       count(*) FILTER (WHERE m.present)     AS stored_bars,
       count(*) FILTER (WHERE NOT m.present) AS missing_bars,
       array_agg(m.candle_start ORDER BY m.candle_start)
         FILTER (WHERE NOT m.present)        AS missing_candle_starts,
       array_agg(to_char(m.candle_start AT TIME ZONE 'Asia/Kolkata', 'HH24:MI')
                 ORDER BY m.candle_start)
         FILTER (WHERE NOT m.present)        AS missing_minutes_ist,
       (SELECT jsonb_agg(jsonb_build_object(
                 'start',   r.run_start,
                 'end',     r.run_end,
                 'minutes', r.minutes) ORDER BY r.run_start)
          FROM missing_runs r
         WHERE r.trading_date = m.trading_date) AS missing_runs
FROM marked m
GROUP BY m.trading_date, m.session_open, m.session_close, m.expected_bars
HAVING count(*) FILTER (WHERE NOT m.present) > 0
ORDER BY m.trading_date;