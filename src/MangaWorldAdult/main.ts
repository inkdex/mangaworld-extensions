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
