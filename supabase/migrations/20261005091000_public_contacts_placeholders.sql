-- Placeholder contact details for the landing page's Contact section, requested on 2026-10-04
-- because the station's real details are not available yet. HR replaces them from
-- /hr/public-site. Inserted only into an empty table, so HR's entries are never touched.
insert into public.public_contacts (label, kind, value, sort_order, is_visible)
select seed.label, seed.kind, seed.value, seed.sort_order, true
from (values
  ('Station hotline', 'phone', '(02) 0000-0000', 1),
  ('HR office email', 'email', 'hr-office@example.com', 2),
  ('Station address', 'address', 'Address to follow, San Juan City, Metro Manila', 3),
  ('Office hours', 'hours', 'Monday to Friday, 8:00 AM to 5:00 PM (to be confirmed)', 4)
) as seed(label, kind, value, sort_order)
where not exists (select 1 from public.public_contacts);
