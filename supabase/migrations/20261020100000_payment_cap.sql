-- Platega takes at most 10 000 RUB in a single transaction. The cap is a limit
-- on ONE payment, not on a stake: a project's bid can still grow past it by
-- several Raise payments. It lives next to the other limits so the client
-- reads it from the same row and never carries its own copy.
do $$
begin
  update app_config
     set value = value || jsonb_build_object('max_payment_amount', 10000)
   where key = 'paid_limits';
  -- An absent row would leave the cap unset and every payment failing later.
  if not found then
    raise exception 'app_config.paid_limits is missing';
  end if;
end $$;
