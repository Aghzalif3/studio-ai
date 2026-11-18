import fs from 'node:fs';
import { handler, json } from '@/lib/server/http';
import { getProject, saveProject } from '@/lib/server/store';
import { projectDir } from '@/lib/server/paths';
import { uid } from '@/lib/util';

export const runtime = 'nodejs';
export const POST = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const src = await getProject((await params).id);
  if (!src) return json({ error: 'Projet introuvable' }, 404);
  const copy = structuredClone(src);
  copy.id = uid('p_'); copy.name = `${src.name} (copie)`; copy.createdAt = copy.updatedAt = new Date().toISOString();
  await fs.promises.cp(projectDir(src.id), projectDir(copy.id), { recursive: true });
  await saveProject(copy);
  return json(copy, 201);
});
