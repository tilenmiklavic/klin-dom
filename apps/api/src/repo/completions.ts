import { localDate, type CompletionDto } from '@klindom/shared';
import type { Db } from '../db.js';

interface CompletionRow {
  id: string;
  task_id: string;
  kind: 'done' | 'skip';
  user_id: string;
  user_name: string;
  completed_at: Date;
  due_date: string;
}

/** People who left the home or deleted their account show as "Former member". */
export const SELECT_COMPLETIONS = `
  select c.id, c.task_id, c.kind, c.user_id, c.completed_at, c.due_date,
         case when m.user_id is null or u.deleted_at is not null then 'Former member'
              else coalesce(u.display_name, 'Someone') end as user_name
  from completions c
  join users u on u.id = c.user_id
  left join home_members m on m.home_id = c.home_id and m.user_id = c.user_id`;

export function toCompletionDto(row: CompletionRow, tz: string): CompletionDto {
  return {
    id: row.id,
    taskId: row.task_id,
    kind: row.kind,
    userId: row.user_id,
    userName: row.user_name,
    completedAt: row.completed_at.toISOString(),
    dueDate: row.due_date,
    onTime: localDate(row.completed_at, tz) <= row.due_date,
  };
}

export async function getCompletion(db: Db, id: string, tz: string): Promise<CompletionDto> {
  const [row] = await db.query<CompletionRow>(`${SELECT_COMPLETIONS} where c.id = $1`, [id]);
  return toCompletionDto(row!, tz);
}

export async function taskHistory(db: Db, taskId: string, tz: string, limit: number): Promise<CompletionDto[]> {
  const rows = await db.query<CompletionRow>(
    `${SELECT_COMPLETIONS} where c.task_id = $1 order by c.completed_at desc limit $2`,
    [taskId, limit],
  );
  return rows.map((row) => toCompletionDto(row, tz));
}
