import { MangaWorldGeneric } from "../generic/main";
import pbconfig from "./pbconfig";

const DOMAIN: string = "https://www.mangaworld.mx";

class MangaWorldExtension extends MangaWorldGeneric {
    constructor() {
        super({
            domain: DOMAIN,
            name: pbconfig.name,
            contentRating: pbconfig.contentRating,
        });
    }
}

export const MangaWorld = new MangaWorldExtension();
