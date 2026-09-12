-- DEVELOPMENT TOOL. It rewrites the money ledger, resets attack limits and lets
-- tasks be completed again, so it must never be reachable in production: the
-- only caller, the remove-my-projects function, refuses unless
-- PAYMENT_PROVIDER=mock, and the button is shown only under
-- PREVIEW.mockPayments. The production equivalent belongs in the admin panel.
--
-- "Remove my projects" wipes the account back to zero: the user's projects,
-- every payment and stake the user made, votes, task completions, clicks and
-- queued notifications are deleted for real, and the vote balance is reset.
-- The account row itself (and its identities) stays.
--
-- Other users' payments that cannot exist without the removed projects go
-- with them: raises into those projects and attacks on them (an attack must
-- keep its target, see payment_transactions_target_matches_intent), together
-- with their stake legs. Votes, clicks, tasks and task completions of the
-- projects go too; only the moderation log is detached instead.
create or replace function public.reset_user_data(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_projects bigint[];
  v_payments uuid[];
  v_removed integer;
begin
  -- NO KEY UPDATE, not UPDATE: apply_payment inserts stake rows referencing
  -- this user, and their FK check takes KEY SHARE on the row. FOR UPDATE
  -- conflicts with it, and with apply_payment already holding the project
  -- lock that is a deadlock; NO KEY UPDATE does not conflict.
  perform 1 from users where id = p_user_id for no key update;
  if not found then
    raise exception 'user % not found', p_user_id;
  end if;

  -- Projects in ascending id, the order apply_payment locks them in.
  select coalesce(array_agg(id order by id), '{}')
    into v_projects
    from (select id from projects where user_id = p_user_id order by id for update) p;

  select coalesce(array_agg(id), '{}')
    into v_payments
    from payment_transactions
   where user_id = p_user_id
      or project_id = any(v_projects)
      or target_project_id = any(v_projects);

  delete from stake_transactions
   where actor_user_id = p_user_id
      or project_id = any(v_projects)
      or target_project_id = any(v_projects)
      or payment_id = any(v_payments);

  delete from payment_transactions where id = any(v_payments);

  delete from vote_transactions
   where user_id = p_user_id or project_id = any(v_projects);

  -- Deleted rather than detached: a null project_id would collide on
  -- task_completions_once_per_user_task_project.
  delete from task_completions
   where user_id = p_user_id
      or project_id = any(v_projects)
      or task_id in (select id from tasks where target_project_id = any(v_projects));
  delete from tasks where target_project_id = any(v_projects);

  delete from project_clicks
   where user_id = p_user_id or project_id = any(v_projects);
  update moderation_actions set project_id = null
   where project_id = any(v_projects);
  delete from notifications where user_id = p_user_id;

  delete from projects where id = any(v_projects);
  get diagnostics v_removed = row_count;

  update users set vote_balance = 0 where id = p_user_id;

  return v_removed;
end;
$$;

revoke all on function public.reset_user_data(uuid) from public, anon, authenticated;
grant execute on function public.reset_user_data(uuid) to service_role;
