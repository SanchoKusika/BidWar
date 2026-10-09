-- The referral task becomes a ladder: invite one friend, then three, five,
-- ten, and from there every ten more. A friend counts once they finish their
-- first task, the same moment the reward is paid, so the reward per friend
-- does not change — only the goal the task shows.
--
-- The numbers live next to the visit limit so the ladder can be retuned
-- without a deploy.
update app_config
   set value = value || jsonb_build_object(
         'referral_milestones',     jsonb_build_array(1, 3, 5, 10),
         'referral_milestone_step', 10
       )
 where key = 'task_limits';
