-- War Room Query Template
-- Parameters: @from_date (DATE), @to_date (DATE)

-- QUERY: daily_revenue_trend
SELECT
  order_date,
  SUM(cash_collected)    AS revenue_cash,
  SUM(sale_price)        AS revenue_contract,
  COUNT(*)               AS transaction_count
FROM `cod_warehouse.fact_sales_ghl`
WHERE order_date BETWEEN @from_date AND @to_date
GROUP BY order_date
ORDER BY order_date;

-- QUERY: weekly_summary
SELECT
  DATE_TRUNC(DATE(sale_date), WEEK(MONDAY))              AS week_start,
  SUM(cash_amount)                                        AS cash_collected,
  SUM(contract_value)                                     AS contract_value,
  COUNT(*)                                                AS enrollments,
  COUNT(DISTINCT email)                                   AS unique_customers,
  SUM(CASE WHEN is_high_ticket THEN cash_amount ELSE 0 END) AS ht_cash
FROM `cod_warehouse.bridge_sales_unified`
WHERE DATE(TIMESTAMP(sale_date, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
  AND is_duplicate = FALSE
GROUP BY week_start
ORDER BY week_start;

-- QUERY: kpi_aggregation
SELECT
  -- Revenue
  SUM(cash_amount)                                                       AS revenue_cash,
  SUM(contract_value)                                                    AS revenue_contract,

  -- Enrollment counts
  COUNT(DISTINCT CASE WHEN is_high_ticket THEN email END)                AS ht_enrollments,
  COUNT(DISTINCT email)                                                  AS total_enrollments,

  -- Show rate: showed / booked (using bridge_customer_journey)
  SAFE_DIVIDE(
    COUNTIF(cj.call_showed),
    COUNT(cj.email)
  )                                                                      AS show_rate,

  -- Close rate: enrolled / showed
  SAFE_DIVIDE(
    COUNTIF(cj.enrolled AND cj.call_showed),
    COUNTIF(cj.call_showed)
  )                                                                      AS close_rate,

  -- DPL (dollars per lead): cash / total leads
  SAFE_DIVIDE(
    SUM(su.cash_amount),
    COUNT(DISTINCT fl.email)
  )                                                                      AS dpl_cash

FROM `cod_warehouse.bridge_sales_unified` su
LEFT JOIN `cod_warehouse.bridge_customer_journey` cj USING (email)
LEFT JOIN `cod_warehouse.fact_leads` fl
  ON fl.email = su.email
  AND DATE(TIMESTAMP(fl.date_registered, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
WHERE DATE(TIMESTAMP(su.sale_date, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
  AND su.is_duplicate = FALSE;
