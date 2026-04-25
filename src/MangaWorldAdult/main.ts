/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import { MangaWorldGeneric } from "../generic/main";
import pbconfig from "./pbconfig";

const DOMAIN: string = "https://www.mangaworldadult.net";

class MangaWorldAdultExtension extends MangaWorldGeneric {
  constructor() {
    super({
      domain: DOMAIN,
      name: pbconfig.name,
      contentRating: pbconfig.contentRating,
    });
  }
}

export const MangaWorldAdult = new MangaWorldAdultExtension();
