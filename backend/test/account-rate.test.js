import assert from "node:assert/strict";
import { test } from "node:test";
import { rateAccount } from "../src/live/accountRate.js";

test("limits joining across different socket connections by authenticated account", () => {
  const user = `test-${process.pid}-${Date.now()}`;
  rateAccount(user, "joinRoom", 2, 60_000);
  rateAccount(user, "joinRoom", 2, 60_000);
  assert.throws(() => rateAccount(user, "joinRoom", 2, 60_000), /Too many meeting joins/);
  assert.doesNotThrow(() => rateAccount(`${user}-other`, "joinRoom", 2, 60_000));
});
