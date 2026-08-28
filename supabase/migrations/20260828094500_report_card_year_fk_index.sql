-- Covers the (tenant_id, academic_year_id) foreign-key prefix used during
-- academic-year updates/deletes and year-scoped report-card queries.
create index if not exists idx_report_cards_tenant_year
  on public.report_card_versions (tenant_id, academic_year_id);
