import { ContentRating } from "@paperback/types";
import { basePbConfig } from "../generic/config";

const pbConfig = basePbConfig;

pbConfig.name = "MangaWorldAdult";
pbConfig.description = "Extension that pulls content from www.mangaworldadult.net.";
pbConfig.contentRating = ContentRating.ADULT;

export default pbConfig;
