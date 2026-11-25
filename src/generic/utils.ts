/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import { ContentRating } from "@paperback/types";

import type { MangaWorldGeneric } from "./main";
import type { OptionItem } from "./models";
import { parseFilterOptions } from "./scraper";

export class Tags {
  public excludedTags = (tags: string[], exc: string[]): boolean => {
    return tags.some((tag) => {
      return exc.includes(tag);
    });
  };
  public blacklistedTags = (tags: string[]): boolean => {
    const blacklistedSettings = (Application.getState("hide_tags") as string[] | undefined) ?? [];
    return tags.some((tag) => {
      return blacklistedSettings.includes(tag);
    });
  };
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
  public excludedTypes = (type: string, excluded: string[]): boolean => {
    return excluded.includes(type.toLowerCase());
  };

  public blacklistedType = (type: string): boolean => {
    const blacklistedSettings = (Application.getState("hide_type") as string[] | undefined) ?? [];
    return blacklistedSettings.includes(type.toLowerCase());
  };
}

const FILTER_FETCH_KEY = "last-filter-fetch-v2";

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

  public getMangaTypeFilter() {
    return this.MangaTypeFilter;
  }

  private setOrderFilter(newValue: OptionItem[]) {
    this.OrderFilter = newValue;
    Application.setState(JSON.stringify(newValue), ".sort");
  }

  public getOrderFilter() {
    return this.OrderFilter;
  }

  private setStatusFilter(newValue: OptionItem[]) {
    this.StatusFilter = newValue;
    Application.setState(JSON.stringify(newValue), ".status");
  }

  public getStatusFilter() {
    return this.StatusFilter;
  }

  private setGenreFilter(newValue: OptionItem[]) {
    this.GenreFilter = newValue;
    Application.setState(JSON.stringify(newValue), ".genres");
  }

  public getGenreFilter() {
    return this.GenreFilter;
  }

  private setYearFilter(newValue: OptionItem[]) {
    this.YearFilter = newValue;
    Application.setState(JSON.stringify(newValue), ".year");
  }

  public getYearFilter() {
    return this.YearFilter;
  }

  async populateFilter(source: MangaWorldGeneric, force = false) {
    const lastFilterFetch = Number(Application.getState(FILTER_FETCH_KEY) ?? 0);
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
      const $ = await source.requestManager.parseFilters(source);
      const genres = parseFilterOptions($, "genre");
      const orders = parseFilterOptions($, "sort");
      if (genres.length === 0 || orders.length === 0) {
        throw new Error("Filtri non trovati nella pagina /archive");
      }
      this.setGenreFilter(genres);
      this.setMangaTypeFilter(parseFilterOptions($, "type"));
      this.setStatusFilter(parseFilterOptions($, "status"));
      this.setOrderFilter(orders);
      this.setYearFilter(parseFilterOptions($, "year"));
      Application.setState(String(new Date().valueOf() / 1000), FILTER_FETCH_KEY);
    }
  }
}
