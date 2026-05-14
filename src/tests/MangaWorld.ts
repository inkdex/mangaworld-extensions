import { type TestLogger } from "@paperback/types";

import { MangaWorld } from "../MangaWorld/main.js";
import sourceInfo from "../MangaWorld/pbconfig.js";
import { TestSuite, registerDefaultTests } from "./suite.js";

export async function runTests(logger: TestLogger) {
  const suite = new TestSuite("MangaWorld tests", logger);
  registerDefaultTests(suite, MangaWorld, sourceInfo);

  await suite.run();
}
