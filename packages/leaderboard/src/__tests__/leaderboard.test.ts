/**
 * Unit tests for LeaderboardService
 *
 * Tests cover:
 * - Construction and file I/O (load / save)
 * - Accessors (getAll, getScore, getRankings, contributorCount, totalScore)
 * - Mutators (incrementScore, setScore, removeUser, reset)
 * - Edge cases (missing file, malformed JSON, negative scores, ties, empty data)
 * - Bulk operations (importData)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { LeaderboardService } from "../index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "leaderboard-test-"));
}

function tempFilePath(dir: string): string {
  return join(dir, "leaderboard.json");
}

function writeTempLeaderboard(dir: string, data: Record<string, number>): string {
  const fp = tempFilePath(dir);
  writeFileSync(fp, JSON.stringify(data, null, 2) + "\n", "utf-8");
  return fp;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("LeaderboardService", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    // Clean up temp dir
    try {
      const fp = tempFilePath(tmpDir);
      if (existsSync(fp)) unlinkSync(fp);
      // rmdirSync(tmpDir); // leave for debugging if needed
    } catch {
      // ignore
    }
  });

  // ── Construction & I/O ──────────────────────────────────────────

  describe("construction and file I/O", () => {
    it("starts with an empty data set when the file does not exist", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      expect(svc.getAll()).toEqual({});
      expect(svc.contributorCount).toBe(0);
      expect(svc.totalScore).toBe(0);
    });

    it("loads existing data from disk on construction", () => {
      writeTempLeaderboard(tmpDir, { alice: 5, bob: 3 });
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      expect(svc.getAll()).toEqual({ alice: 5, bob: 3 });
      expect(svc.contributorCount).toBe(2);
    });

    it("gracefully handles malformed JSON and starts empty", () => {
      const fp = tempFilePath(tmpDir);
      writeFileSync(fp, "this is not json", "utf-8");
      const svc = new LeaderboardService(fp);
      expect(svc.getAll()).toEqual({});
    });

    it("persists data to disk via save()", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      svc.incrementScore("charlie");
      svc.save();

      // Read the file back directly
      const raw = readFileSync(tempFilePath(tmpDir), "utf-8");
      expect(JSON.parse(raw)).toEqual({ charlie: 1 });
    });

    it("is re-loadable from disk after save()", () => {
      const fp = tempFilePath(tmpDir);
      const svc1 = new LeaderboardService(fp);
      svc1.incrementScore("alice");
      svc1.incrementScore("bob");
      svc1.save();

      const svc2 = new LeaderboardService(fp);
      expect(svc2.getScore("alice")).toBe(1);
      expect(svc2.getScore("bob")).toBe(1);
    });

    it("load() re-reads data from disk, discarding in-memory changes", () => {
      const fp = writeTempLeaderboard(tmpDir, { dave: 99 });
      const svc = new LeaderboardService(fp);
      expect(svc.getScore("dave")).toBe(99);

      // Mutate in-memory then overwrite on disk externally
      svc.incrementScore("dave");
      expect(svc.getScore("dave")).toBe(100);
      writeFileSync(fp, JSON.stringify({ dave: 42 }), "utf-8");

      svc.load();
      expect(svc.getScore("dave")).toBe(42);
    });
  });

  // ── Accessors ───────────────────────────────────────────────────

  describe("getAll / getScore", () => {
    it("getAll returns a shallow copy, not the internal reference", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      svc.incrementScore("eve");
      const copy = svc.getAll();
      copy.eve = 999;
      expect(svc.getScore("eve")).toBe(1);
    });

    it("getScore returns 0 for unknown users", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      expect(svc.getScore("nonexistent")).toBe(0);
    });

    it("getScore returns the correct value for existing users", () => {
      writeTempLeaderboard(tmpDir, { frank: 7 });
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      expect(svc.getScore("frank")).toBe(7);
    });
  });

  describe("getRankings", () => {
    it("returns an empty array for an empty leaderboard", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      expect(svc.getRankings()).toEqual([]);
    });

    it("returns entries sorted descending by score", () => {
      writeTempLeaderboard(tmpDir, { a: 1, b: 3, c: 2 });
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      const rankings = svc.getRankings();
      expect(rankings).toHaveLength(3);
      expect(rankings[0]).toEqual({ username: "b", score: 3 });
      expect(rankings[1]).toEqual({ username: "c", score: 2 });
      expect(rankings[2]).toEqual({ username: "a", score: 1 });
    });

    it("breaks ties alphabetically by username", () => {
      writeTempLeaderboard(tmpDir, { beta: 5, alpha: 5, gamma: 5 });
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      const rankings = svc.getRankings();
      expect(rankings[0].username).toBe("alpha");
      expect(rankings[1].username).toBe("beta");
      expect(rankings[2].username).toBe("gamma");
    });
  });

  describe("contributorCount / totalScore", () => {
    it("contributorCount is 0 when empty", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      expect(svc.contributorCount).toBe(0);
    });

    it("contributorCount reflects unique users", () => {
      writeTempLeaderboard(tmpDir, { a: 10, b: 20, c: 30 });
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      expect(svc.contributorCount).toBe(3);
    });

    it("totalScore sums all scores", () => {
      writeTempLeaderboard(tmpDir, { x: 5, y: 15, z: 25 });
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      expect(svc.totalScore).toBe(45);
    });

    it("totalScore is 0 when empty", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      expect(svc.totalScore).toBe(0);
    });
  });

  // ── Mutators ───────────────────────────────────────────────────

  describe("incrementScore", () => {
    it("sets score to 1 for a new user", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      const newScore = svc.incrementScore("newuser");
      expect(newScore).toBe(1);
      expect(svc.getScore("newuser")).toBe(1);
    });

    it("increments an existing user by 1", () => {
      writeTempLeaderboard(tmpDir, { existing: 10 });
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      const newScore = svc.incrementScore("existing");
      expect(newScore).toBe(11);
    });

    it("can be called multiple times", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      svc.incrementScore("multi");
      svc.incrementScore("multi");
      svc.incrementScore("multi");
      expect(svc.getScore("multi")).toBe(3);
    });

    it("updates contributorCount correctly", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      svc.incrementScore("a");
      svc.incrementScore("b");
      expect(svc.contributorCount).toBe(2);
      svc.incrementScore("a");
      expect(svc.contributorCount).toBe(2); // no new user
    });

    it("updates totalScore correctly", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      svc.incrementScore("a");
      svc.incrementScore("b");
      svc.incrementScore("a");
      expect(svc.totalScore).toBe(3);
    });
  });

  describe("setScore", () => {
    it("sets a score for a new user", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      const result = svc.setScore("newbie", 42);
      expect(result).toBe(42);
      expect(svc.getScore("newbie")).toBe(42);
    });

    it("overwrites an existing user's score", () => {
      writeTempLeaderboard(tmpDir, { user: 5 });
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      svc.setScore("user", 100);
      expect(svc.getScore("user")).toBe(100);
    });

    it("supports setting score to 0", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      svc.setScore("zero", 0);
      expect(svc.getScore("zero")).toBe(0);
    });

    it("throws for negative scores", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      expect(() => svc.setScore("neg", -1)).toThrow("non-negative integer");
    });
  });

  describe("removeUser", () => {
    it("removes an existing user and returns true", () => {
      writeTempLeaderboard(tmpDir, { alice: 5 });
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      const removed = svc.removeUser("alice");
      expect(removed).toBe(true);
      expect(svc.getScore("alice")).toBe(0);
      expect(svc.contributorCount).toBe(0);
    });

    it("returns false for a non-existent user", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      expect(svc.removeUser("ghost")).toBe(false);
    });

    it("updates totalScore after removal", () => {
      writeTempLeaderboard(tmpDir, { a: 10, b: 20 });
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      svc.removeUser("a");
      expect(svc.totalScore).toBe(20);
    });
  });

  describe("reset", () => {
    it("clears all data", () => {
      writeTempLeaderboard(tmpDir, { a: 1, b: 2, c: 3 });
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      svc.reset();
      expect(svc.getAll()).toEqual({});
      expect(svc.contributorCount).toBe(0);
      expect(svc.totalScore).toBe(0);
    });

    it("does not affect the file on disk until save() is called", () => {
      const fp = writeTempLeaderboard(tmpDir, { persist: 99 });
      const svc = new LeaderboardService(fp);
      svc.reset();
      // File should still have old data
      const raw = JSON.parse(readFileSync(fp, "utf-8"));
      expect(raw).toEqual({ persist: 99 });
    });
  });

  // ── Bulk ──────────────────────────────────────────────────────

  describe("importData", () => {
    it("replaces current data with the provided data set", () => {
      writeTempLeaderboard(tmpDir, { old: 1 });
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      svc.importData({ new1: 10, new2: 20 });
      expect(svc.getAll()).toEqual({ new1: 10, new2: 20 });
    });

    it("does not share references with the caller", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      const external = { user: 5 };
      svc.importData(external);
      external.user = 999;
      expect(svc.getScore("user")).toBe(5);
    });
  });

  // ── Integration: matches auto-process.yml workflow ───────────────

  describe("workflow parity (auto-process.yml)", () => {
    it("mirrors the auto-process.yml increment logic", () => {
      // The workflow runs:  .[$user] = ((.[$user] // 0) + 1)
      // which is exactly LeaderboardService.incrementScore
      const fp = writeTempLeaderboard(tmpDir, { existing: 3 });
      const svc = new LeaderboardService(fp);

      // Simulate two PRs by different users
      svc.incrementScore("existing"); // existing goes 3 → 4
      svc.incrementScore("newguy");   // newguy goes 0 → 1

      expect(svc.getScore("existing")).toBe(4);
      expect(svc.getScore("newguy")).toBe(1);
    });

    it("supports many concurrent-like increments", () => {
      const svc = new LeaderboardService(tempFilePath(tmpDir));
      const users = ["alice", "bob", "charlie", "alice", "bob", "alice"];
      for (const u of users) svc.incrementScore(u);

      expect(svc.getScore("alice")).toBe(3);
      expect(svc.getScore("bob")).toBe(2);
      expect(svc.getScore("charlie")).toBe(1);
    });

    it("save then reload produces the same data", () => {
      const fp = tempFilePath(tmpDir);
      const svc1 = new LeaderboardService(fp);
      svc1.incrementScore("alice");
      svc1.incrementScore("bob");
      svc1.save();

      const svc2 = new LeaderboardService(fp);
      expect(svc2.getScore("alice")).toBe(1);
      expect(svc2.getScore("bob")).toBe(1);
    });
  });
});
