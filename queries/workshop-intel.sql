-- Workshop Intel Query Template
-- Parameters: @from_date (DATE), @to_date (DATE)

-- QUERY: weekly_workshop_metrics
-- Show rate trends by week from fact_workshop_sessions
SELECT
  DATE_TRUNC(session_date, WEEK(MONDAY))              AS week_start,
  SUM(all_tickets)                                    AS total_tickets,
  SUM(vip_tickets)                                    AS vip_tickets,
  SUM(free_tickets)                                   AS free_tickets,
  SUM(paid_tickets)                                   AS paid_tickets,
  SUM(attendees)                                      AS attendees,
  SUM(calls_booked_all_sources)                       AS calls_booked,
  SUM(calls_booked_workshop)                          AS calls_booked_workshop,
  AVG(show_rate)                                      AS avg_show_rate,
  AVG(vip_upgrade_pct)                                AS avg_vip_upgrade_pct,
  AVG(booking_pct)                                    AS avg_booking_pct
FROM `cod_warehouse.fact_workshop_sessions`
WHERE session_date BETWEEN @from_date AND @to_date
GROUP BY week_start
ORDER BY week_start;

-- QUERY: vip_vs_standard_performance
-- VIP vs standard ticket holder comparison: watch time, booking rate, enrollment rate
SELECT
  fa.attendee_type,
  COUNT(DISTINCT fa.email)                            AS attendee_count,
  AVG(fa.attendance_seconds)                          AS avg_watch_seconds,
  AVG(fa.attendance_seconds) / 60                     AS avg_watch_minutes,

  -- Booking conversion
  COUNT(DISTINCT fb.email)                            AS booked_calls,
  SAFE_DIVIDE(
    COUNT(DISTINCT fb.email),
    COUNT(DISTINCT fa.email)
  )                                                   AS booking_rate,

  -- Enrollment conversion
  COUNT(DISTINCT CASE WHEN cj.enrolled THEN cj.email END) AS enrolled,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN cj.enrolled THEN cj.email END),
    COUNT(DISTINCT fa.email)
  )                                                   AS enrollment_rate

FROM `cod_warehouse.fact_aevent_attendees` fa
LEFT JOIN `cod_warehouse.fact_bookings` fb
  ON fb.email = fa.email
  AND fb.call_date BETWEEN @from_date AND @to_date
LEFT JOIN `cod_warehouse.bridge_customer_journey` cj
  ON cj.email = fa.email
WHERE fa.event_date BETWEEN @from_date AND @to_date
GROUP BY fa.attendee_type;

-- QUERY: workshop_booking_funnel
-- Registration -> attendance -> booking funnel per event
SELECT
  fr.event_date,
  COUNT(DISTINCT fr.email)                            AS registrants,
  COUNT(DISTINCT fa.email)                            AS attendees,
  COUNT(DISTINCT fna.email)                           AS non_attendees,

  SAFE_DIVIDE(
    COUNT(DISTINCT fa.email),
    COUNT(DISTINCT fr.email)
  )                                                   AS show_rate,

  -- Booked calls from attendees
  COUNT(DISTINCT fb.email)                            AS calls_booked,
  SAFE_DIVIDE(
    COUNT(DISTINCT fb.email),
    COUNT(DISTINCT fa.email)
  )                                                   AS attendee_to_booked_rate

FROM `cod_warehouse.fact_aevent_registrants` fr
LEFT JOIN `cod_warehouse.fact_aevent_attendees` fa
  ON fa.email = fr.email AND fa.event_date = fr.event_date
LEFT JOIN `cod_warehouse.fact_aevent_non_attendees` fna
  ON fna.email = fr.email AND fna.event_date = fr.event_date
LEFT JOIN `cod_warehouse.fact_bookings` fb
  ON fb.email = fr.email
  AND fb.call_date BETWEEN fr.event_date AND DATE_ADD(fr.event_date, INTERVAL 14 DAY)
WHERE fr.event_date BETWEEN @from_date AND @to_date
GROUP BY fr.event_date
ORDER BY fr.event_date;
