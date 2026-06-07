/**
 * LeaderboardService — read and update the contributor leaderboard.
 *
 * Mirrors the logic used by the GitHub Actions workflow in
 * `.github/workflows/auto-process.yml` that increments a user's PR count
 * in `leaderboard.json` on every opened pull request.
 *
 * The leaderboard is a flat JSON map: `{ "github_user": <PR count> }`.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface LeaderboardEntry {
  username: string;
  score: number;
}

export interface LeaderboardData {
  [username: string]: number;
}

export class LeaderboardService {
  private readonly filePath: string;
  private data: LeaderboardData = {};

  /**
   * @param filePath  Absolute or relative path to the leaderboard JSON file.
   *                  Defaults to `leaderboard.json` in the project root.
   */
  constructor(filePath?: string) {
    this.filePath = filePath ?? resolve(process.cwd(), "leaderboard.json");
    this.load();
  }

  // ── Low-level I/O ──────────────────────────────────────────────

  /** Load leaderboard data from disk (or start with an empty map). */
  load(): void {
    if (existsSync(this.filePath)) {
      const raw = readFileSync(this.filePath, "utf-8");
      try {
        this.data = JSON.parse(raw) as LeaderboardData;
      } catch {
        this.data = {};
      }
    } else {
      this.data = {};
    }
  }

  /** Persist the current in-memory data to disk. */
  save(): void {
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2) + "\n", "utf-8");
  }

  // ── Accessors ──────────────────────────────────────────────────

  /** Return the raw data map `{ user → count }`. */
  getAll(): LeaderboardData {
    return { ...this.data };
  }

  /** Get the score for a single user (0 if not present). */
  getScore(username: string): number {
    return this.data[username] ?? 0;
  }

  /**
   * Return entries sorted descending by score.
   * Ties are broken alphabetically by username.
   */
  getRankings(): LeaderboardEntry[] {
    return Object.entries(this.data)
      .map(([username, score]) => ({ username, score }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.username.localeCompare(b.username);
      });
  }

  /** Number of unique contributors tracked. */
  get contributorCount(): number {
    return Object.keys(this.data).length;
  }

  /** Total PR count across all contributors. */
  get totalScore(): number {
    return Object.values(this.data).reduce((sum, v) => sum + v, 0);
  }

  // ── Mutators ───────────────────────────────────────────────────

  /**
   * Increment the PR count for `username` by 1.
   * This mirrors the logic in the auto-process.yml workflow:
   *   `.[$user] = ((.[$user] // 0) + 1)`
   */
  incrementScore(username: string): number {
    const current = this.data[username] ?? 0;
    const next = current + 1;
    this.data[username] = next;
    return next;
  }

  /**
   * Set an exact score for a user (overwrite).
   * Returns the new score.
   */
  setScore(username: string, score: number): number {
    if (score < 0) {
      throw new Error("Score must be a non-negative integer");
    }
    this.data[username] = score;
    return score;
  }

  /**
   * Remove a user from the leaderboard entirely.
   * Returns `true` if the user existed, `false` otherwise.
   */
  removeUser(username: string): boolean {
    if (!(username in this.data)) return false;
    delete this.data[username];
    return true;
  }

  /** Reset the leaderboard — clear all entries. */
  reset(): void {
    this.data = {};
  }

  // ── Bulk helpers ───────────────────────────────────────────────

  /** Import an external data set, replacing the current data. */
  importData(data: LeaderboardData): void {
    this.data = { ...data };
  }
}
