import { ContentRating } from "@paperback/types";
import { basePbConfig } from "../generic/basePbConfig";

const pbConfig = basePbConfig;

pbConfig.name = "MangaWorldAdult";
pbConfig.description =
    "Extension that pulls content from www.mangaworldadult.net.";
pbConfig.language = "it";
pbConfig.icon = "icon.png";
pbConfig.contentRating = ContentRating.ADULT;

export default pbConfig;
