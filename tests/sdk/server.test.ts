/**
 * Tests for Todori SDK Server Factory
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { createTodoriServer } from "../../src/sdk/server.js";

describe("Todori SDK Server Factory", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-sdk-server-test-"));
  });

  test("createTodoriServer returns valid server config", () => {
    const server = createTodoriServer({
      projectRoot: testDir,
    });

    expect(server).toBeDefined();
    expect(server.type).toBe("sdk");
    expect(server.name).toBe("todori");
    expect(server.instance).toBeDefined();
  });

  test("createTodoriServer accepts custom name", () => {
    const server = createTodoriServer({
      projectRoot: testDir,
      name: "custom-todori",
    });

    expect(server.name).toBe("custom-todori");
  });

  test("createTodoriServer accepts custom version", () => {
    const server = createTodoriServer({
      projectRoot: testDir,
      version: "2.0.0",
    });

    // Server config should be created successfully
    expect(server).toBeDefined();
  });
});
