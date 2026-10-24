import { badRequest } from '../_shared/http.ts';
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from '../_shared/og.ts';

export interface EditProjectBody {
  initData?: string;
  projectId?: number;
  name?: string;
  description?: string | null;
}

export interface ParsedEdit {
  initData: string;
  projectId: number;
  name: string;
  /** null — the card shows no description line. */
  description: string | null;
}

/** One line, as the card shows it: the same folding the link preview does. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * The owner's own name and description replace what the link preview found —
 * or failed to find: Instagram and LinkedIn answer the cloud with a login wall
 * or a refusal, and the card was left saying "Instagram" or "www.linkedin.com".
 * The limits are the preview's own, so an edited card fits where a fetched
 * one does.
 */
export function parseEditRequest(body: EditProjectBody): ParsedEdit {
  if (!body.initData) throw badRequest('initData обязателен');
  if (!Number.isInteger(body.projectId)) throw badRequest('projectId обязателен');
  if (typeof body.name !== 'string') throw badRequest('Название обязательно');
  if (body.description != null && typeof body.description !== 'string') {
    throw badRequest('Описание должно быть строкой');
  }

  const name = oneLine(body.name);
  if (name.length === 0) throw badRequest('Название не может быть пустым');
  if (name.length > MAX_NAME_LENGTH) {
    throw badRequest(`Название длиннее ${MAX_NAME_LENGTH} символов`);
  }

  const description = body.description ? oneLine(body.description) : '';
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw badRequest(`Описание длиннее ${MAX_DESCRIPTION_LENGTH} символов`);
  }

  return {
    initData: body.initData,
    projectId: body.projectId as number,
    name,
    description: description.length > 0 ? description : null,
  };
}
