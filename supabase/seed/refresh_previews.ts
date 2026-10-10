/**
 * Picks the picture of every active project again, with the rules
 * `_shared/og.ts` has today (pickAvatar), and writes it to `og_image_url`.
 * Names and descriptions stay as they are: those the owner has seen and may
 * have chosen by.
 *
 * The picture is chosen once, when the project is added, so a change of the
 * rule reaches old rows only through this. The first run (11.10.2026) moved
 * sites from their link-preview banners to their own icons, and Telegram
 * accounts from CDN files that had expired to their stable userpic address.
 *
 * A project whose page does not answer keeps its picture: no answer is not a
 * reason to take one away. A page that answers with nothing a browser would
 * show (click.uz keeps every image to its own site) loses it — the card then
 * shows the letter it was showing anyway, without a failed request.
 *
 *   npm run db:previews             — print what would change
 *   npm run db:previews -- --write  — and write it
 */
import postgres from 'npm:postgres@3';
import { fetchOg } from '../functions/_shared/og.ts';

const url = Deno.env.get('SUPABASE_DB_URL');
if (!url) throw new Error('SUPABASE_DB_URL не задан — см. README, раздел «База»');
const write = Deno.args.includes('--write');

/** Pages fetched at once: every one also probes a handful of images. */
const PARALLEL = 4;

interface Row {
  id: number;
  url: string;
  og_image_url: string | null;
}

const sql = postgres(url, { max: 4, prepare: false });

try {
  const rows = await sql<Row[]>`
    select id, url, og_image_url from projects where status = 'active' order by id
  `;

  const changes: Array<{ row: Row; next: string | null }> = [];
  let index = 0;
  const worker = async () => {
    while (index < rows.length) {
      const row = rows[index++]!;
      const og = await fetchOg(row.url);
      const next = og.status === 'ok' ? og.imageUrl : (og.imageUrl ?? row.og_image_url);
      const mark = next === row.og_image_url ? '=' : '→';
      // The old address is printed too: the log is the way back.
      console.log(
        `${mark} #${row.id} ${row.url}` +
          (mark === '→' ? `\n    was ${row.og_image_url}\n    now ${next}` : ''),
      );
      if (next !== row.og_image_url) changes.push({ row, next });
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  console.log(`\n${changes.length} of ${rows.length} pictures differ.`);
  if (!write) {
    console.log('Nothing written: run again with --write.');
  } else {
    for (const { row, next } of changes) {
      await sql`
        update projects set og_image_url = ${next}, og_fetched_at = now() where id = ${row.id}
      `;
    }
    console.log(`Written: ${changes.length}.`);
  }
} finally {
  await sql.end();
}
