import { ContentRating } from "@paperback/types";
import { basePbConfig } from "../generic/basePbConfig";

const pbConfig = basePbConfig;

pbConfig.name = "MangaWorld";
pbConfig.description = "Extension that pulls content from www.mangaworld.mx.";
pbConfig.language = "it";
pbConfig.icon = "icon.png";
pbConfig.contentRating = ContentRating.EVERYONE;

export default pbConfig;
