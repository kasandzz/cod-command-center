-- Revenue & Payments Query Template
-- Parameters: @from_date (DATE), @to_date (DATE)

-- QUERY: monthly_cash_vs_contract
-- Monthly cash collected vs contract value from bridge_sales_unified
SELECT
  DATE_TRUNC(DATE(TIMESTAMP(sale_date, 'America/Los_Angeles')), MONTH) AS month,
  SUM(cash_amount)                                                       AS cash_collected,
  SUM(contract_value)                                                    AS contract_value,
  SUM(contract_value) - SUM(cash_amount)                                AS contract_balance,
  COUNT(DISTINCT email)                                                  AS enrollments,
  SAFE_DIVIDE(SUM(cash_amount), COUNT(DISTINCT email))                  AS avg_cash_per_enrollment
FROM `cod_warehouse.bridge_sales_unified`
WHERE DATE(TIMESTAMP(sale_date, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
  AND is_duplicate = FALSE
GROUP BY month
ORDER BY month;

-- QUERY: product_mix
-- Revenue breakdown by product from fact_sales_ghl
SELECT
  product,
  COUNT(*)                                                AS transaction_count,
  COUNT(DISTINCT email)                                   AS unique_buyers,
  SUM(cash_collected)                                     AS cash_collected,
  SUM(sale_price)                                         AS contract_value,
  AVG(cash_collected)                                     AS avg_cash,
  SAFE_DIVIDE(SUM(cash_collected), SUM(SUM(cash_collected)) OVER ()) AS pct_of_total_cash
FROM `cod_warehouse.fact_sales_ghl`
WHERE order_date BETWEEN @from_date AND @to_date
GROUP BY product
ORDER BY cash_collected DESC;

-- QUERY: pif_vs_split
-- PIF vs payment plan breakdown from bridge_sales_unified
SELECT
  CASE
    WHEN LOWER(payment_method) IN ('pif', 'pay in full') THEN 'PIF'
    WHEN payment_method IS NULL THEN 'Unknown'
    ELSE 'Split / Financed'
  END                                                     AS payment_type,
  payment_method,
  payment_processor,
  COUNT(*)                                                AS count,
  COUNT(DISTINCT email)                                   AS unique_customers,
  SUM(cash_amount)                                        AS cash_collected,
  SUM(contract_value)                                     AS contract_value,
  SAFE_DIVIDE(COUNT(*), SUM(COUNT(*)) OVER ())            AS pct_of_enrollments
FROM `cod_warehouse.bridge_sales_unified`
WHERE DATE(TIMESTAMP(sale_date, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
  AND is_duplicate = FALSE
  AND is_high_ticket = TRUE
GROUP BY payment_type, payment_method, payment_processor
ORDER BY cash_collected DESC;
