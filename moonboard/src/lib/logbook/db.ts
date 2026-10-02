import * as SQLite from 'expo-sqlite';

/**
 * Local logbook. Lives in the app's own database, separate from the
 * read-only catalog snapshots so a catalog refresh never touches it.
 */
export interface Ascent {
  id: number;
  climbUuid: string;
  layoutId: number;
  angle: number;
  /** Snapshot of the problem at log time so the logbook survives catalog changes. */
  name: string;
  grade: string;
  setter: string | null;
  isBenchmark: boolean;
  attempts: number;
  /** Climber's own grade opinion, Font scale, optional. */
  userGrade: string | null;
  rating: number | null;
  comment: string | null;
  climbedAt: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function logbookDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('logbook.db');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS ascents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        climb_uuid TEXT NOT NULL,
        layout_id INTEGER NOT NULL,
        angle INTEGER NOT NULL,
        name TEXT NOT NULL,
        grade TEXT NOT NULL,
        setter TEXT,
        is_benchmark INTEGER NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 1,
        user_grade TEXT,
        rating INTEGER,
        comment TEXT,
        climbed_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ascents_climb ON ascents(climb_uuid);
      CREATE INDEX IF NOT EXISTS idx_ascents_layout ON ascents(layout_id, angle, climbed_at);
      CREATE TABLE IF NOT EXISTS projects (
        climb_uuid TEXT PRIMARY KEY,
        layout_id INTEGER NOT NULL,
        added_at TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `);
  }
}

interface AscentRow {
  id: number;
  climb_uuid: string;
  layout_id: number;
  angle: number;
  name: string;
  grade: string;
  setter: string | null;
  is_benchmark: number;
  attempts: number;
  user_grade: string | null;
  rating: number | null;
  comment: string | null;
  climbed_at: string;
}

function fromRow(r: AscentRow): Ascent {
  return {
    id: r.id,
    climbUuid: r.climb_uuid,
    layoutId: r.layout_id,
    angle: r.angle,
    name: r.name,
    grade: r.grade,
    setter: r.setter,
    isBenchmark: r.is_benchmark === 1,
    attempts: r.attempts,
    userGrade: r.user_grade,
    rating: r.rating,
    comment: r.comment,
    climbedAt: r.climbed_at,
  };
}

export type NewAscent = Omit<Ascent, 'id'>;

export async function addAscent(a: NewAscent): Promise<number> {
  const db = await logbookDb();
  const res = await db.runAsync(
    `INSERT INTO ascents (climb_uuid, layout_id, angle, name, grade, setter, is_benchmark, attempts, user_grade, rating, comment, climbed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    a.climbUuid,
    a.layoutId,
    a.angle,
    a.name,
    a.grade,
    a.setter,
    a.isBenchmark ? 1 : 0,
    a.attempts,
    a.userGrade,
    a.rating,
    a.comment,
    a.climbedAt,
  );
  return res.lastInsertRowId;
}

export async function deleteAscent(id: number): Promise<void> {
  const db = await logbookDb();
  await db.runAsync('DELETE FROM ascents WHERE id = ?', id);
}

export async function listAscents(layoutId?: number, angle?: number): Promise<Ascent[]> {
  const db = await logbookDb();
  const rows =
    layoutId == null
      ? await db.getAllAsync<AscentRow>('SELECT * FROM ascents ORDER BY climbed_at DESC, id DESC')
      : angle == null
        ? await db.getAllAsync<AscentRow>('SELECT * FROM ascents WHERE layout_id = ? ORDER BY climbed_at DESC, id DESC', layoutId)
        : await db.getAllAsync<AscentRow>(
            'SELECT * FROM ascents WHERE layout_id = ? AND angle = ? ORDER BY climbed_at DESC, id DESC',
            layoutId,
            angle,
          );
  return rows.map(fromRow);
}

export async function ascentsFor(climbUuid: string): Promise<Ascent[]> {
  const db = await logbookDb();
  const rows = await db.getAllAsync<AscentRow>('SELECT * FROM ascents WHERE climb_uuid = ? ORDER BY climbed_at DESC', climbUuid);
  return rows.map(fromRow);
}

/** Set of climb uuids the user has sent, for list badges. */
export async function sentSet(layoutId: number): Promise<Set<string>> {
  const db = await logbookDb();
  const rows = await db.getAllAsync<{ climb_uuid: string }>('SELECT DISTINCT climb_uuid FROM ascents WHERE layout_id = ?', layoutId);
  return new Set(rows.map((r) => r.climb_uuid));
}

export async function isProject(climbUuid: string): Promise<boolean> {
  const db = await logbookDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM projects WHERE climb_uuid = ?', climbUuid);
  return (row?.c ?? 0) > 0;
}

export async function toggleProject(climbUuid: string, layoutId: number): Promise<boolean> {
  const db = await logbookDb();
  if (await isProject(climbUuid)) {
    await db.runAsync('DELETE FROM projects WHERE climb_uuid = ?', climbUuid);
    return false;
  }
  await db.runAsync('INSERT INTO projects (climb_uuid, layout_id, added_at) VALUES (?, ?, ?)', climbUuid, layoutId, new Date().toISOString());
  return true;
}

export async function projectSet(layoutId: number): Promise<Set<string>> {
  const db = await logbookDb();
  const rows = await db.getAllAsync<{ climb_uuid: string }>('SELECT climb_uuid FROM projects WHERE layout_id = ?', layoutId);
  return new Set(rows.map((r) => r.climb_uuid));
}

export interface GradeCount {
  grade: string;
  count: number;
}

export async function gradePyramid(layoutId: number, angle: number): Promise<GradeCount[]> {
  const db = await logbookDb();
  return db.getAllAsync<GradeCount>(
    'SELECT grade, COUNT(DISTINCT climb_uuid) as count FROM ascents WHERE layout_id = ? AND angle = ? GROUP BY grade',
    layoutId,
    angle,
  );
}
