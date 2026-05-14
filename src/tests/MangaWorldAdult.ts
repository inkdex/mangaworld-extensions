import { type TestLogger } from "@paperback/types";

import { MangaWorldAdult } from "../MangaWorldAdult/main.js";
import sourceInfo from "../MangaWorldAdult/pbconfig.js";
import { TestSuite, registerDefaultTests } from "./suite.js";

export async function runTests(logger: TestLogger) {
  const suite = new TestSuite("MangaWorldAdult tests", logger);
  registerDefaultTests(suite, MangaWorldAdult, sourceInfo);

  await suite.run();
}
