import type { IndexNode } from "@/data/types";
import { versionHistoryOf, type AeVersionPoint } from "@/data/aeVersionHistory";
import { abbreviateAccValue, accMetadataRaw, inferAccTaxonomy } from "@/metadata/accTaxonomy";

export interface GrowingPoint {
  date: number;
  version: number;
  sizeMb: number;
}

export interface GrowingSeries {
  id: string;
  discipline: string;
  label: string;
  points: GrowingPoint[];
}

export interface GrowingModel {
  series: GrowingSeries[];
  minDate: number;
  maxDate: number;
  maxVersion: number;
  maxSizeMb: number;
}

function disciplineOf(file: IndexNode): string | null {
  const raw = accMetadataRaw(file.metadata, "ACC-Discipline");
  const inferred = raw ?? inferAccTaxonomy(file.name, file.relativePath, file.metadata)["ACC-Discipline"];
  if (!inferred) {
    return null;
  }
  const code = abbreviateAccValue("ACC-Discipline", inferred);
  return code && code !== "(none)" ? code : null;
}

function timeOf(modifiedAt: string): number {
  const parsed = Date.parse(modifiedAt.replace(" ", "T"));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function dayKey(date: number): string {
  const value = new Date(date);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function activeAt(history: readonly AeVersionPoint[], date: number): AeVersionPoint | null {
  let active: AeVersionPoint | null = null;
  for (const point of history) {
    if (timeOf(point.modifiedAt) <= date) {
      active = point;
    }
  }
  return active;
}

/** One circle track per discipline. Size is the sum of that discipline's file sizes on that day. */
export function growingModel(files: readonly IndexNode[]): GrowingModel {
  const grouped = new Map<string, Array<{ history: AeVersionPoint[] }>>();
  for (const file of files) {
    const history = versionHistoryOf(file);
    const discipline = disciplineOf(file);
    if (!discipline || history.length === 0) {
      continue;
    }
    const list = grouped.get(discipline) ?? [];
    list.push({ history: [...history].sort((left, right) => left.version - right.version) });
    grouped.set(discipline, list);
  }

  const series: GrowingSeries[] = [];
  let minDate = Infinity;
  let maxDate = 0;
  let maxVersion = 1;
  let maxSizeMb = 1;

  for (const [discipline, members] of [...grouped.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    const lastStampByDay = new Map<string, number>();
    for (const stamp of members.flatMap((member) => member.history.map((point) => timeOf(point.modifiedAt)))) {
      if (stamp <= 0) {
        continue;
      }
      const day = dayKey(stamp);
      lastStampByDay.set(day, Math.max(lastStampByDay.get(day) ?? 0, stamp));
    }
    const dates = [...lastStampByDay.values()].sort((left, right) => left - right);
    const points: GrowingPoint[] = [];
    for (const date of dates) {
      let sizeMb = 0;
      let version = 0;
      for (const member of members) {
        const active = activeAt(member.history, date);
        if (!active) {
          continue;
        }
        sizeMb += active.sizeMb;
        version = Math.max(version, active.version);
      }
      if (version === 0) {
        continue;
      }
      points.push({ date, version, sizeMb });
      minDate = Math.min(minDate, date);
      maxDate = Math.max(maxDate, date);
      maxVersion = Math.max(maxVersion, version);
      maxSizeMb = Math.max(maxSizeMb, sizeMb);
    }
    if (points.length > 0) {
      series.push({ id: discipline, discipline, label: discipline, points });
    }
  }

  if (!Number.isFinite(minDate) || maxDate === 0) {
    return { series: [], minDate: 0, maxDate: 0, maxVersion: 1, maxSizeMb: 1 };
  }
  return { series, minDate, maxDate, maxVersion, maxSizeMb };
}

export interface GrowingSnapshot {
  id: string;
  discipline: string;
  label: string;
  date: number;
  version: number;
  sizeMb: number;
}

export interface GrowingTrail {
  id: string;
  discipline: string;
  points: Array<{ date: number; version: number; sizeMb: number }>;
}

/** One circle track per file. Color stays with the file's discipline. */
export function growingFileModel(files: readonly IndexNode[]): GrowingModel {
  const series: GrowingSeries[] = [];
  let minDate = Infinity;
  let maxDate = 0;
  let maxVersion = 1;
  let maxSizeMb = 1;

  for (const file of files) {
    const history = [...versionHistoryOf(file)].sort((left, right) => left.version - right.version);
    const discipline = disciplineOf(file);
    if (!discipline || history.length === 0) {
      continue;
    }
    const lastStampByDay = new Map<string, number>();
    for (const stamp of history.map((point) => timeOf(point.modifiedAt))) {
      if (stamp <= 0) {
        continue;
      }
      const day = dayKey(stamp);
      lastStampByDay.set(day, Math.max(lastStampByDay.get(day) ?? 0, stamp));
    }
    const points: GrowingPoint[] = [];
    for (const date of [...lastStampByDay.values()].sort((left, right) => left - right)) {
      const active = activeAt(history, date);
      if (!active) {
        continue;
      }
      points.push({ date, version: active.version, sizeMb: active.sizeMb });
      minDate = Math.min(minDate, date);
      maxDate = Math.max(maxDate, date);
      maxVersion = Math.max(maxVersion, active.version);
      maxSizeMb = Math.max(maxSizeMb, active.sizeMb);
    }
    if (points.length > 0) {
      series.push({ id: file.id, discipline, label: file.name, points });
    }
  }

  series.sort((left, right) => left.discipline.localeCompare(right.discipline) || left.label.localeCompare(right.label));
  if (!Number.isFinite(minDate) || maxDate === 0) {
    return { series: [], minDate: 0, maxDate: 0, maxVersion: 1, maxSizeMb: 1 };
  }
  return { series, minDate, maxDate, maxVersion, maxSizeMb };
}

/** Earlier positions of a circle, left behind the one drawn at `time`. */
export function growingTrail(track: GrowingSeries, time: number): GrowingTrail | null {
  const nextIndex = track.points.findIndex((point) => point.date > time);
  if (nextIndex === 0) {
    return null;
  }
  const headIndex = nextIndex === -1 ? track.points.length - 1 : nextIndex - 1;
  const head = track.points[headIndex];
  const next = nextIndex === -1 ? null : track.points[nextIndex];
  const sittingOnHead = !head || !next || time <= head.date;
  const lastFootprint = sittingOnHead ? headIndex - 1 : headIndex;
  if (!head || lastFootprint < 0) {
    return null;
  }
  return {
    id: track.id,
    discipline: track.discipline,
    points: track.points.slice(0, lastFootprint + 1).map((point) => ({
      date: point.date,
      version: point.version,
      sizeMb: point.sizeMb,
    })),
  };
}

/** Where each discipline circle sits when the playhead is at `time`. */
export function growingSnapshot(model: GrowingModel, time: number): GrowingSnapshot[] {
  const snapshots: GrowingSnapshot[] = [];
  for (const track of model.series) {
    const nextIndex = track.points.findIndex((point) => point.date > time);
    if (nextIndex === 0) {
      continue;
    }
    const previous = track.points[nextIndex === -1 ? track.points.length - 1 : nextIndex - 1];
    if (!previous) {
      continue;
    }
    const next = nextIndex === -1 ? null : track.points[nextIndex];
    if (!next) {
      snapshots.push({
        id: track.id,
        discipline: track.discipline,
        label: track.label,
        date: previous.date,
        version: previous.version,
        sizeMb: previous.sizeMb,
      });
      continue;
    }
    const span = next.date - previous.date;
    const t = span <= 0 ? 1 : (time - previous.date) / span;
    snapshots.push({
      id: track.id,
      discipline: track.discipline,
      label: track.label,
      date: time,
      version: previous.version + (next.version - previous.version) * t,
      sizeMb: previous.sizeMb + (next.sizeMb - previous.sizeMb) * t,
    });
  }
  return snapshots;
}
