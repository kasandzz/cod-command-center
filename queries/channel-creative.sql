-- Channel & Creative Query Template
-- Parameters: @from_date (DATE), @to_date (DATE)

-- QUERY: campaign_performance_by_source
-- Source/platform-level spend, revenue, and lead volume
SELECT
  hs.traffic_platform                                     AS platform,
  hs.category_name                                        AS campaign_name,
  hs.source_tag,

  -- Lead volume from Hyros
  COUNT(DISTINCT hl.email)                                AS leads,

  -- Revenue from Hyros sales
  SUM(hsa.net_price)                                      AS revenue_attributed,
  COUNT(DISTINCT hsa.sale_id)                             AS sales_count,

  -- Spend from fact_ad_spend (aggregated, not per-campaign until Meta API connected)
  -- NOTE: campaign-level spend requires meta_ad_performance (blocked on BM access)
  NULL                                                    AS spend,
  NULL                                                    AS roas,
  NULL                                                    AS cpl

FROM `cod_warehouse.hyros_sources` hs
LEFT JOIN `cod_warehouse.hyros_leads` hl
  ON hl.first_source_id = hs.source_id
  AND DATE(TIMESTAMP(hl.lead_timestamp, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
LEFT JOIN `cod_warehouse.hyros_sales` hsa
  ON hsa.first_source_id = hs.source_id
  AND DATE(TIMESTAMP(hsa.sale_timestamp, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
WHERE hs.is_disregarded = FALSE
GROUP BY platform, campaign_name, source_tag
ORDER BY leads DESC;

-- QUERY: campaign_performance_with_spend
-- Cross-joins ad spend to attributed revenue for ROAS estimation
-- Uses daily aggregate spend until Meta API is connected
SELECT
  DATE_TRUNC(spend_date, WEEK(MONDAY))                    AS week_start,
  fa.workshop_paid                                        AS spend_workshop_paid,
  fa.workshop_free                                        AS spend_workshop_free,
  fa.vsl                                                  AS spend_vsl,
  fa.five_shifts_masterclass                              AS spend_5shifts,
  fa.total_spend,

  -- Revenue for same week from bridge_sales_unified
  SUM(COALESCE(su.cash_amount, 0))                        AS cash_collected,
  SUM(COALESCE(su.contract_value, 0))                     AS contract_value,

  -- ROAS (cash basis)
  SAFE_DIVIDE(
    SUM(COALESCE(su.cash_amount, 0)),
    fa.total_spend
  )                                                       AS roas_cash,

  -- Lead count
  COUNT(DISTINCT fl.email)                                AS leads,

  -- CPL
  SAFE_DIVIDE(
    fa.total_spend,
    COUNT(DISTINCT fl.email)
  )                                                       AS cpl

FROM `cod_warehouse.fact_ad_spend` fa
LEFT JOIN `cod_warehouse.bridge_sales_unified` su
  ON DATE(TIMESTAMP(su.sale_date, 'America/Los_Angeles')) = fa.spend_date
  AND su.is_duplicate = FALSE
LEFT JOIN `cod_warehouse.fact_leads` fl
  ON DATE(TIMESTAMP(fl.date_registered, 'America/Los_Angeles')) = fa.spend_date
WHERE fa.spend_date BETWEEN @from_date AND @to_date
GROUP BY week_start, spend_workshop_paid, spend_workshop_free, spend_vsl, spend_5shifts, fa.total_spend
ORDER BY week_start;
