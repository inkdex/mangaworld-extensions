/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import { ContentRating, type Tag } from "@paperback/types";
import * as cheerio from "cheerio";
import { jsonParser, MangaWorldGeneric } from "./main";
import type {
  ChapterList,
  Genre,
  GlobalData,
  JSONConfig,
  JsonData,
  MangaPageData,
  OptionItem,
  Pages,
  RawEntry,
  SearchInfo,
  SearchResults,
  TrendingChaptersData,
  WindowEntry,
} from "./models";

export class Tags {
  /**
   * Check Excluded tags
   * @param tags
   * @param exc
   * @return true: hide
   */
  public excludedTags = (tags: string[], exc: string[]): boolean => {
    return tags.some((tag) => {
      return exc.includes(tag);
    });
  };
  /**
   * Check Blacklisted tags
   * @param tags : string[] - tags
   * @return true: hide
   */
  public blacklistedTags = (tags: string[]): boolean => {
    const blacklistedSettings = (Application.getState("hide_tags") as string[] | undefined) ?? [];
    return tags.some((tag) => {
      return blacklistedSettings.includes(tag);
    });
  };
  /**
   * Get manga Rating
   * @param {string[]} tags - tags
   * @return {ContentRating} - ContentRating
   */
  tagRatingMap: Record<string, ContentRating> = {
    ADULTI: ContentRating.ADULT,
    MATURO: ContentRating.MATURE,
  };

  getRating(tags: string[]): ContentRating {
    for (const tag of tags) {
      const matchedRating = this.tagRatingMap[tag.toUpperCase()] ?? undefined;
      if (matchedRating) return matchedRating;
    }
    return ContentRating.EVERYONE;
  }
}

export class Type {
  /**
   * Check Excluded tags
   * @return true: hide
   * @param type
   * @param excluded
   */
  public excludedTypes = (type: string, excluded: string[]): boolean => {
    return excluded.includes(type.toLowerCase());
  };

  /**
   * Check Blacklisted types
   * @param {string}  type - type
   * @return true: hide
   */
  public blacklistedType = (type: string): boolean => {
    const blacklistedSettings = (Application.getState("hide_type") as string[] | undefined) ?? [];
    return blacklistedSettings.includes(type.toLowerCase());
  };
}

export class FilterPreferences {
  YearFilter: OptionItem[] = [];
  GenreFilter: OptionItem[] = [];
  MangaTypeFilter: OptionItem[] = [];
  OrderFilter: OptionItem[] = [];
  StatusFilter: OptionItem[] = [];
  /**
   * Set Manga Type Filter
   */
  private setMangaTypeFilter(newValue: OptionItem[]) {
    this.MangaTypeFilter = newValue;
    Application.setState(JSON.stringify(newValue), ".type");
  }

  /**
   * Get Manga Type
   * @return [{ value: string, id: string }]
   */
  public getMangaTypeFilter() {
    return this.MangaTypeFilter;
  }

  /**
   * Set Ordering Filter
   */
  private setOrderFilter(newValue: OptionItem[]) {
    this.OrderFilter = newValue;
    Application.setState(JSON.stringify(newValue), ".sort");
  }

  /**
   * Get Ordering Type
   * @return [{value: string, id: string}]
   */
  public getOrderFilter() {
    return this.OrderFilter;
  }

  /**
   * Set Status Filter
   */
  private setStatusFilter(newValue: OptionItem[]) {
    this.StatusFilter = newValue;
    Application.setState(JSON.stringify(newValue), ".status");
  }

  /**
   * Get Status
   * @return [{value: string, id: string}]
   */
  public getStatusFilter() {
    return this.StatusFilter;
  }

  /**
   * Set Genres
   */
  private setGenreFilter(newValue: OptionItem[]) {
    this.GenreFilter = newValue;
    Application.setState(JSON.stringify(newValue), ".genres");
  }

  /**
   * Get Genres
   * @return [{ value: string, id: string }]
   */
  public getGenreFilter() {
    return this.GenreFilter;
  }

  /**
   * Set Years
   */
  private setYearFilter(newValue: OptionItem[]) {
    this.YearFilter = newValue;
    Application.setState(JSON.stringify(newValue), ".year");
  }

  /**
   * Get Years
   * @return [{ value: string, id: string }]
   */
  public getYearFilter() {
    return this.YearFilter;
  }
  /**
   * Populate Search Filter
   */
  async populateFilter(source: MangaWorldGeneric, force = false) {
    const lastFilterFetch = Number(Application.getState("last-filter-fetch") ?? 0);
    const cached = lastFilterFetch + 604800 > new Date().valueOf() / 1000;
    if (cached && !force) {
      const keys = ["genres", "type", "status", "sort", "year"] as const;
      const values = keys.map((k) => Application.getState(`.${k}`) as string | undefined);
      const [genres, type, status, sort, year] = values;
      if (
        genres === undefined ||
        type === undefined ||
        status === undefined ||
        sort === undefined ||
        year === undefined
      ) {
        await this.populateFilter(source, true);
        return;
      }
      this.setGenreFilter(JSON.parse(genres) as OptionItem[]);
      this.setMangaTypeFilter(JSON.parse(type) as OptionItem[]);
      this.setStatusFilter(JSON.parse(status) as OptionItem[]);
      this.setOrderFilter(JSON.parse(sort) as OptionItem[]);
      this.setYearFilter(JSON.parse(year) as OptionItem[]);
    } else {
      const html = await source.requestManager.parseFilters(source);
      const windowEntry = jsonParser.getWindowEntry(html);
      const JSONFilter = this.extractOptionJSON(windowEntry);
      const $ = cheerio.load(html);
      this.setMangaTypeFilter(this.extractOptions($, ".type"));
      this.setStatusFilter(this.extractOptions($, ".status"));
      this.setOrderFilter(this.extractOptions($, ".sort"));
      this.setGenreFilter(JSONFilter.genres);
      this.setYearFilter(JSONFilter.year);
      Application.setState(String(new Date().valueOf() / 1000), "last-filter-fetch");
    }
  }
  mapGenresToOptionItem(genres?: Genre[] | null): OptionItem[] {
    if (!genres) return [];
    return genres.map((genre) => ({
      id: genre.slug,
      value: genre.name,
    }));
  }

  mapStringToOptionItem(tags: (string | number)[]): OptionItem[] {
    if (!tags) return [];
    const stringTags = tags.map((v) => String(v));
    return stringTags.map((tag) => ({
      id: tag,
      value: tag,
    }));
  }
  /**
   * Extract filter option {value, id}.
   * @param $ - Requests.
   * @param filterSelector - CSS selector.
   * @returns{[{value, id}]}.
   */
  extractOptions($: cheerio.CheerioAPI, filterSelector: string): OptionItem[] {
    const options = $(`${filterSelector} select.filter-select option`);
    const result: OptionItem[] = [];

    options.each((_, el) => {
      const id = $(el).attr("data-name");
      const label = $(el).text().trim();

      if (id) {
        result.push({ value: label, id });
      }
    });
    Application.setState(JSON.stringify(result), filterSelector);
    return result;
  }

  extractOptionJSON(json: WindowEntry[]): {
    genres: OptionItem[];
    author: OptionItem[];
    artist: OptionItem[];
    year: OptionItem[];
  } {
    const filters: {
      genres: OptionItem[];
      author: OptionItem[];
      artist: OptionItem[];
      year: OptionItem[];
    } = {
      genres: [],
      author: [],
      artist: [],
      year: [],
    };
    json.forEach((item) => {
      if (item.kind == "global") {
        filters.genres = this.mapGenresToOptionItem(item.data.globalData.genres);
      }
      if (item.kind == "search") {
        filters.artist = this.mapStringToOptionItem(item.data.artists);
        filters.year = this.mapStringToOptionItem(item.data.years);
        filters.author = this.mapStringToOptionItem(item.data.authors);
      }
    });
    this.setGenreFilter(filters.genres);
    this.setYearFilter(filters.year);
    return filters;
  }
}

export class JsonParser {
  isMangaData(data: object): data is MangaPageData {
    return "manga" in data;
  }

  isGlobalData(data: object): data is { globalData: GlobalData } {
    return "globalData" in data;
  }

  isMangaChapterData(data: object): data is ChapterList {
    return "CDN_URL" in data;
  }

  isTrendingData(data: object): data is TrendingChaptersData {
    return "mostViewedChapters" in data;
  }

  isSearchData(data: object): data is SearchResults {
    return "selected" in data;
  }

  isSearchInfoData(data: object): data is SearchInfo {
    return "totalPages" in data;
  }

  convertEntries(w: (RawEntry | WindowEntry)[]): WindowEntry[] {
    return w.map((entry): WindowEntry => {
      if (!Array.isArray(entry)) return entry;

      const [key, index, data, meta] = entry;
      if (typeof data === "object" && data !== null) {
        if (this.isMangaData(data)) return { kind: "manga", key, index, data, meta };
        if (this.isGlobalData(data)) return { kind: "global", key, index, data, meta };
        if (this.isTrendingData(data)) return { kind: "trending", key, index, data, meta };
        if (this.isMangaChapterData(data)) return { kind: "chapter", key, index, data, meta };
        if (this.isSearchData(data)) return { kind: "search", key, index, data, meta };
        if (this.isSearchInfoData(data)) return { kind: "searchInfo", key, index, data, meta };
      }
      return {
        kind: "config",
        key,
        index,
        data: data as JSONConfig,
        meta,
      };
    });
  }

  getWindowEntry(html: string): WindowEntry[] {
    const regex =
      /<script[^>]*>\s*[^<]*?\$MC\s*=\s*\(window\.\$MC\|\|\[\]\)\.concat\(([\s\S]*?)\)\s*<\/script>/i;

    const match = html.match(regex);

    if (!match?.[1]) {
      throw new Error("No JSON Found");
    }
    const jsonText = match[1].trim();
    const json = JSON.parse(jsonText) as JsonData;
    return this.convertEntries(json.o.w);
  }

  mapGenresToTags(genres: Genre[]): Tag[] {
    return genres.map((genre) => ({
      id: genre.slug,
      title: genre.name,
    }));
  }

  findChapterData(page: Pages, chapterId: string) {
    if (page.volumes.length > 0) {
      for (const volume of page.volumes) {
        const chapter = volume.chapters.find((c) => c.id === chapterId);
        if (chapter) {
          return {
            chapterURL: `${volume.volume.slugFolder}-${volume.volume.id}/${chapter.slugFolder}-${chapter.id}`,
            mangaId: volume.volume.manga,
            pages: chapter.pages,
          };
        }
      }
    } else {
      const chapter = page.singleChapters.find((c) => c.id === chapterId);
      if (chapter) {
        return {
          chapterURL: `${chapter.slugFolder}-${chapter.id}`,
          mangaId: chapter.manga,
          pages: chapter.pages,
        };
      }
    }
    return null;
  }
}
