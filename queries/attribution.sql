-- Attribution Query Template
-- Parameters: @from_date (DATE), @to_date (DATE)

-- QUERY: source_breakdown
-- Hyros attribution: revenue and lead volume by source/platform
SELECT
  hs.traffic_platform                                     AS platform,
  hs.source_tag,
  hs.source_name,
  hs.category_name                                        AS campaign,
  hs.is_organic,

  -- Lead counts
  COUNT(DISTINCT hl.email)                                AS leads,

  -- Sale counts + revenue
  COUNT(DISTINCT hsa.sale_id)                             AS sales,
  SUM(COALESCE(hsa.net_price, 0))                        AS revenue_attributed,

  -- Conversion rate: leads to sales
  SAFE_DIVIDE(
    COUNT(DISTINCT hsa.sale_id),
    COUNT(DISTINCT hl.email)
  )                                                       AS lead_to_sale_rate,

  -- Average sale value
  SAFE_DIVIDE(
    SUM(COALESCE(hsa.net_price, 0)),
    COUNT(DISTINCT hsa.sale_id)
  )                                                       AS avg_sale_value

FROM `cod_warehouse.hyros_sources` hs
LEFT JOIN `cod_warehouse.hyros_leads` hl
  ON hl.first_source_id = hs.source_id
  AND DATE(TIMESTAMP(hl.lead_timestamp, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
LEFT JOIN `cod_warehouse.hyros_sales` hsa
  ON hsa.first_source_id = hs.source_id
  AND DATE(TIMESTAMP(hsa.sale_timestamp, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
WHERE hs.is_disregarded = FALSE
GROUP BY platform, source_tag, source_name, campaign, is_organic
ORDER BY revenue_attributed DESC;

-- QUERY: segment_profitability
-- Segment-level revenue from Hyros leads joined with GHL contacts for segment inference
SELECT
  COALESCE(gc.profession_dropdown, bcs.resolved_segment, 'Unknown')    AS segment,
  bcs.resolved_confidence                                               AS segment_confidence,

  COUNT(DISTINCT hl.email)                                              AS leads,

  -- Sales and revenue
  COUNT(DISTINCT hsa.sale_id)                                          AS attributed_sales,
  SUM(COALESCE(hsa.net_price, 0))                                      AS attributed_revenue,

  -- Non-Hyros revenue via bridge_sales_unified (email match)
  SUM(COALESCE(su.cash_amount, 0))                                     AS total_cash_collected,

  -- Conversion
  SAFE_DIVIDE(
    COUNT(DISTINCT hsa.sale_id),
    COUNT(DISTINCT hl.email)
  )                                                                     AS lead_to_sale_rate,

  -- Revenue per lead
  SAFE_DIVIDE(
    SUM(COALESCE(su.cash_amount, 0)),
    COUNT(DISTINCT hl.email)
  )                                                                     AS revenue_per_lead

FROM `cod_warehouse.hyros_leads` hl
LEFT JOIN `cod_warehouse.ghl_contacts` gc
  ON gc.email = hl.email
LEFT JOIN `cod_warehouse.bridge_customer_segments` bcs
  ON bcs.email = hl.email
LEFT JOIN `cod_warehouse.hyros_sales` hsa
  ON hsa.email = hl.email
  AND DATE(TIMESTAMP(hsa.sale_timestamp, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
LEFT JOIN `cod_warehouse.bridge_sales_unified` su
  ON su.email = hl.email
  AND DATE(TIMESTAMP(su.sale_date, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
  AND su.is_duplicate = FALSE
WHERE DATE(TIMESTAMP(hl.lead_timestamp, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
GROUP BY segment, segment_confidence
ORDER BY total_cash_collected DESC;
