import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import { Cause, Exit, Runtime } from "effect";
import { runServer } from "./server.ts";

const port = Number(process.env["PORT"] ?? 4318);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("PORT must be an integer between 0 and 65535.");
}
const sidecar = process.argv.includes("--sidecar");

BunRuntime.runMain(runServer({ port, sidecar }), {
  teardown: (exit, onExit) => {
    if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) process.exit(0);
    Runtime.defaultTeardown(exit, onExit);
  },
});
