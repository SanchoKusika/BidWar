-- Russia-only pivot (09.10.2026): the only payment provider is Platega, which
-- charges in roubles, and the interface speaks Russian and English.
--
-- Points move from 1 point = 1 UZS to 1 point = 1 RUB. Everything multi-market
-- (Uzbek, UZS/USD display, fixed rates) is kept under the git tag
-- `archive/multi-market` and described in the Obsidian note
-- «13 Выход за пределы РФ».

-- 1. Languages: Russian and English only. Nobody had picked Uzbek by hand on
-- the dev board, but a leftover 'UZ' would break the new check, so it falls
-- back to "not chosen" — the bot then uses the Telegram shell language.
update users set language = null where language = 'UZ';
alter table users drop constraint users_language_check;
alter table users add constraint users_language_check
  check (language is null or language in ('RU', 'EN'));

-- 2. Display currency. The column is not read by the client (the display
-- choice lived in localStorage), but its default and check must not claim a
-- currency the product no longer has.
update users set display_currency = 'RUB' where display_currency <> 'RUB';
alter table users alter column display_currency set default 'RUB';
alter table users drop constraint users_display_currency_check;
alter table users add constraint users_display_currency_check
  check (display_currency = 'RUB');

-- 3. Existing points are redenominated at the rate the config held, 135 UZS
-- per rouble, so the board keeps its order. Rounded to the nearest rouble;
-- a ledger row never rounds to zero, because the sign check forbids it.
--
-- Receipts are not touched: original_amount and original_currency stay what
-- was charged (UZS), as 04 Платежи и валюты requires. fx_rate_used becomes
-- the UZS → point rate under the new anchor, so original × rate = points still
-- holds for those rows.
--
-- On a fresh database these tables are empty and the updates do nothing.
update projects
   set paid_amount   = round(paid_amount / 135.0),
       initial_stake = case
                         when initial_stake is null then null
                         else greatest(1, round(initial_stake / 135.0))
                       end
 where paid_amount > 0 or initial_stake is not null;

update stake_transactions
   set amount = sign(amount) * greatest(1, round(abs(amount) / 135.0));

update payment_transactions
   set points_granted = case
                          when points_granted > 0 then greatest(1, round(points_granted / 135.0))
                          else points_granted
                        end,
       fx_rate_used   = round(1 / 135.0, 10)
 where original_currency = 'UZS';

-- 4. Limits in roubles. The rest of paid_limits (attack counts, floor and
-- haircut percentages, reset window) is scale-free and stays.
update app_config
   set value = value || jsonb_build_object(
         'min_paid_amount',   300,
         'min_attack_amount',  50
       )
 where key = 'paid_limits';

-- 5. No rates are needed while points and charges are both in roubles. The
-- row is removed rather than left behind: a config nobody reads only invites
-- someone to edit it and expect a change.
delete from app_config where key = 'fx_rates';
