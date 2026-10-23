-- Local and test seed. TEST ONLY methodology: not a real methodology and never a compliance check.
insert into public.methodologies (code, name, version, status)
values ('TEST-ONLY', 'Test methodology (synthetic, not a real methodology)', '0.1', 'draft')
on conflict (code, version) do nothing;

insert into public.parameter_defs (methodology_id, parameter_code, name, data_type, canonical_unit, description)
select m.id, p.code, p.name, p.data_type, p.unit, p.descr
from public.methodologies m
cross join (values
  ('net_export_mwh', 'Net electricity exported', 'number', 'MWh', 'Total net electricity exported to the grid in the period'),
  ('period_start', 'Monitoring period start', 'date', null, 'First day of the monitoring period'),
  ('period_end', 'Monitoring period end', 'date', null, 'Last day of the monitoring period'),
  ('installed_capacity_mw', 'Installed capacity', 'number', 'MW', 'Installed capacity of the facility'),
  ('grid_emission_factor', 'Grid emission factor', 'number', 'tCO2/MWh', 'Emission factor applied to exported electricity')
) as p(code, name, data_type, unit, descr)
where m.code = 'TEST-ONLY' and m.version = '0.1'
on conflict (methodology_id, parameter_code) do nothing;
