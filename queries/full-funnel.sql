-- Full Funnel Query Template
-- Parameters: @from_date (DATE), @to_date (DATE)

-- QUERY: funnel_stage_volumes
-- Counts at each funnel stage and stage-to-stage conversion rates
SELECT
  -- Stage volumes
  COUNT(DISTINCT CASE
    WHEN DATE(TIMESTAMP(cj.lead_created, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
    THEN cj.email END)                                              AS leads,

  COUNT(DISTINCT CASE
    WHEN DATE(TIMESTAMP(cj.application_submitted, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
    THEN cj.email END)                                              AS applications,

  COUNT(DISTINCT CASE
    WHEN DATE(TIMESTAMP(cj.ticket_purchased, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
    THEN cj.email END)                                              AS ticket_purchasers,

  COUNT(DISTINCT CASE
    WHEN DATE(TIMESTAMP(cj.call_booked, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
    THEN cj.email END)                                              AS calls_booked,

  COUNT(DISTINCT CASE
    WHEN DATE(TIMESTAMP(cj.call_booked, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
    AND cj.call_showed = TRUE
    THEN cj.email END)                                              AS calls_showed,

  COUNT(DISTINCT CASE
    WHEN DATE(TIMESTAMP(cj.enrollment_date, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
    AND cj.enrolled = TRUE
    THEN cj.email END)                                              AS enrolled,

  -- Conversion rates between stages
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE
      WHEN DATE(TIMESTAMP(cj.ticket_purchased, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
      THEN cj.email END),
    COUNT(DISTINCT CASE
      WHEN DATE(TIMESTAMP(cj.lead_created, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
      THEN cj.email END)
  )                                                                 AS lead_to_ticket_rate,

  SAFE_DIVIDE(
    COUNT(DISTINCT CASE
      WHEN DATE(TIMESTAMP(cj.call_booked, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
      THEN cj.email END),
    COUNT(DISTINCT CASE
      WHEN DATE(TIMESTAMP(cj.ticket_purchased, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
      THEN cj.email END)
  )                                                                 AS ticket_to_booked_rate,

  SAFE_DIVIDE(
    COUNT(DISTINCT CASE
      WHEN DATE(TIMESTAMP(cj.call_booked, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
      AND cj.call_showed = TRUE
      THEN cj.email END),
    COUNT(DISTINCT CASE
      WHEN DATE(TIMESTAMP(cj.call_booked, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
      THEN cj.email END)
  )                                                                 AS booked_to_showed_rate,

  SAFE_DIVIDE(
    COUNT(DISTINCT CASE
      WHEN DATE(TIMESTAMP(cj.enrollment_date, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
      AND cj.enrolled = TRUE
      THEN cj.email END),
    COUNT(DISTINCT CASE
      WHEN DATE(TIMESTAMP(cj.call_booked, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
      AND cj.call_showed = TRUE
      THEN cj.email END)
  )                                                                 AS showed_to_enrolled_rate,

  -- Full funnel conversion: lead to enrolled
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE
      WHEN DATE(TIMESTAMP(cj.enrollment_date, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
      AND cj.enrolled = TRUE
      THEN cj.email END),
    COUNT(DISTINCT CASE
      WHEN DATE(TIMESTAMP(cj.lead_created, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
      THEN cj.email END)
  )                                                                 AS lead_to_enrolled_rate,

  -- Velocity averages
  AVG(cj.days_lead_to_sale)                                         AS avg_days_lead_to_sale,
  AVG(cj.days_ticket_to_call)                                       AS avg_days_ticket_to_call

FROM `cod_warehouse.bridge_customer_journey` cj
WHERE (
  DATE(TIMESTAMP(cj.lead_created, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
  OR DATE(TIMESTAMP(cj.enrollment_date, 'America/Los_Angeles')) BETWEEN @from_date AND @to_date
);
