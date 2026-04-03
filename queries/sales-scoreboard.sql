-- Sales Scoreboard Query Template
-- Parameters: @from_date (DATE), @to_date (DATE)

-- QUERY: closer_performance_summary
SELECT
  fc.closer,

  -- Call volume
  COUNT(*)                                                             AS total_calls,
  COUNTIF(fc.outcome != 'no show')                                     AS calls_showed,
  COUNTIF(fc.outcome = 'no show')                                      AS no_shows,

  -- Show rate
  SAFE_DIVIDE(
    COUNTIF(fc.outcome != 'no show'),
    COUNT(*)
  )                                                                    AS show_rate,

  -- Enrollments from bridge_sales_unified
  COUNT(DISTINCT su.email)                                             AS enrollments,

  -- Close rate: enrolled / showed
  SAFE_DIVIDE(
    COUNT(DISTINCT su.email),
    COUNTIF(fc.outcome != 'no show')
  )                                                                    AS close_rate,

  -- Revenue
  SUM(COALESCE(su.cash_amount, 0))                                     AS revenue_cash,
  SUM(COALESCE(su.contract_value, 0))                                  AS revenue_contract,

  -- DPL (dollars per lead shown)
  SAFE_DIVIDE(
    SUM(COALESCE(su.cash_amount, 0)),
    COUNTIF(fc.outcome != 'no show')
  )                                                                    AS dpl_cash,

  -- Average deal size (cash)
  SAFE_DIVIDE(
    SUM(COALESCE(su.cash_amount, 0)),
    COUNT(DISTINCT su.email)
  )                                                                    AS avg_deal_cash

FROM `cod_warehouse.fact_calls` fc
LEFT JOIN `cod_warehouse.bridge_sales_unified` su
  ON su.email = fc.email
  AND su.closer = fc.closer
  AND DATE(TIMESTAMP(su.sale_date, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
  AND su.is_duplicate = FALSE
WHERE fc.call_date BETWEEN @from_date AND @to_date
  AND fc.closer IS NOT NULL
GROUP BY fc.closer
ORDER BY revenue_cash DESC;

-- QUERY: call_disposition_breakdown
-- Per-closer outcome distribution
SELECT
  closer,
  outcome,
  COUNT(*)                                     AS count,
  SAFE_DIVIDE(COUNT(*), SUM(COUNT(*)) OVER (PARTITION BY closer)) AS pct_of_closer_calls
FROM `cod_warehouse.fact_calls`
WHERE call_date BETWEEN @from_date AND @to_date
  AND closer IS NOT NULL
GROUP BY closer, outcome
ORDER BY closer, count DESC;
