/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import {
  BasicRateLimiter,
  ContentRating,
  DiscoverSectionType,
  Form,
  type Chapter,
  type ChapterDetails,
  type ChapterProviding,
  type DiscoverSection,
  type DiscoverSectionItem,
  type DiscoverSectionProviding,
  type Extension,
  type MangaProviding,
  type PagedResults,
  type SearchQuery,
  type SearchResultItem,
  type SearchResultsProviding,
  type SettingsFormProviding,
  type SortingOption,
  type SourceManga,
  AdvancedSearchForm,
} from "@paperback/types";

import { MangaWorldAdvancedSearchForm } from "./forms/search";
import { Forms } from "./forms/settings";
import type { MangaMetadata, SearchMetadata } from "./models";
import { MainInterceptor, Requests } from "./network";
import { Parsers } from "./parsers";
import { parseArchive, parseChapterList, parseMangaPage, parseReaderPages } from "./scraper";
import { FilterPreferences, Tags, Type } from "./utils";

export const filter = new FilterPreferences();
export const tags = new Tags();
export const types = new Type();
export interface GenericParams {
  name: string;
  domain: string;
  contentRating: ContentRating;
  parser?: Parsers;
  requestManager?: Requests;
}

export abstract class MangaWorldGeneric
  implements
    SettingsFormProviding,
    Extension,
    SearchResultsProviding,
    MangaProviding,
    ChapterProviding,
    DiscoverSectionProviding
{
  readonly name: string;
  public base_url = "";
  public defaultContentRating = ContentRating.EVERYONE;
  parser: Parsers;
  requestManager: Requests;
  mainRateLimiter: BasicRateLimiter;
  mainInterceptor: MainInterceptor;

  protected constructor(params: GenericParams) {
    this.name = params.name;
    this.base_url = params.domain;
    this.defaultContentRating = params.contentRating ?? ContentRating.EVERYONE;
    this.parser = params.parser ?? new Parsers();
    this.requestManager = params.requestManager ?? new Requests();
    // Rate limit: Wait 1 sec after 5 requests
    this.mainRateLimiter = new BasicRateLimiter("main", {
      numberOfRequests: 5,
      bufferInterval: 1,
      ignoreImages: true,
    });
    this.mainInterceptor = new MainInterceptor("main");
  }

  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
    this.mainInterceptor.registerInterceptor();
  }

  async getSettingsForm(): Promise<Form> {
    await filter.populateFilter(this);
    return new Forms(this);
  }
  async getAdvancedSearchForm(
    searchQuery: SearchQuery<SearchMetadata>,
  ): Promise<AdvancedSearchForm> {
    await filter.populateFilter(this);
    return new MangaWorldAdvancedSearchForm(searchQuery);
  }

  async getSearchResults(
    query: SearchQuery<SearchMetadata>,
    metadata: MangaMetadata | undefined,
    sorting: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    if (query.metadata === undefined) {
      const def_type = (Application.getState("def_type") as string[] | undefined) ?? [];
      const hyde_type = (Application.getState("hide_type") as string[] | undefined) ?? [];
      const hide_tags = (Application.getState("hide_tags") as string[] | undefined) ?? [];
      query.metadata = {
        type: Object.fromEntries([
          ...def_type.map((k) => [k, "included"] as const),
          ...hyde_type.map((k) => [k, "excluded"] as const),
        ]),
        genres: Object.fromEntries(hide_tags.map((k) => [k, "excluded"])) ?? {},
      };
    }
    const page = metadata?.page ?? 1;
    const { url, excluded } = this.requestManager.constructSearchRequestURL(
      page,
      query,
      sorting,
      this,
    );
    const $ = await this.requestManager.fetchHTML(url);
    return this.parser.parseSearchResults(excluded, this, metadata, parseArchive($, this.base_url));
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const shareUrl = `${this.base_url}/manga/${mangaId}`;
    const $ = await this.requestManager.fetchHTML(shareUrl);
    return this.parser.parseMangaDetails(parseMangaPage($, this.base_url), mangaId, shareUrl, this);
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const $ = await this.requestManager.fetchHTML(`${this.base_url}/manga/${sourceManga.mangaId}`);
    return this.parser.parseChapters(parseChapterList($), sourceManga);
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const $ = await this.requestManager.fetchHTML(
      `${this.base_url}/manga/${chapter.sourceManga.mangaId}/read/${chapter.chapterId}?style=list`,
    );
    return this.parser.parseChapterDetails(parseReaderPages($, this.base_url), chapter);
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    const discover_section: DiscoverSection[] = [];
    if ((Application.getState("mese_section_enabled") as boolean) ?? true) {
      discover_section.push({
        id: "mese_section",
        title: "Tendenze del Mese",
        subtitle: "Più letti del mese",
        type: DiscoverSectionType.featured,
      });
    }
    if ((Application.getState("most_read_section_enabled") as boolean) ?? true) {
      discover_section.push({
        id: "most_read_section",
        title: "Più Letti",
        subtitle: "I più popolari di sempre",
        type: DiscoverSectionType.simpleCarousel,
      });
    }
    if ((Application.getState("new_section_enabled") as boolean) ?? true) {
      discover_section.push({
        id: "new_manga_section",
        title: "Nuove Aggiunte",
        subtitle: "Le nuove Aggiunte",
        type: DiscoverSectionType.simpleCarousel,
      });
    }
    if ((Application.getState("popular_section_enabled") as boolean) ?? true) {
      discover_section.push({
        id: "popular_section",
        title: "Capitoli In Tendenza",
        type: DiscoverSectionType.chapterUpdates,
      });
    }
    if ((Application.getState("update_section_enabled") as boolean) ?? true) {
      discover_section.push({
        id: "updated_section",
        title: "Aggiornati di Recente",
        subtitle: "Ultimi Capitoli Aggiunti",
        type: DiscoverSectionType.chapterUpdates,
      });
    }
    if (
      ((Application.getState("fav_tags_new") as string[])?.length ?? 0) > 0 &&
      ((Application.getState("fav_section_enabled") as boolean) ?? true)
    ) {
      discover_section.push({
        id: "new_fav_type_section",
        title: "Nuove Aggiunte dei tuoi Generi Preferiti",
        subtitle: "Le nuove Aggiunte dei tuoi Generi Preferiti",
        type: DiscoverSectionType.simpleCarousel,
      });
    }
    if ((Application.getState("type_section_enabled") as boolean) ?? true) {
      discover_section.push({
        id: "type_section",
        title: "Tipologia",
        subtitle: "Più letti di una tipologia",
        type: DiscoverSectionType.genres,
      });
    }
    if ((Application.getState("genre_section_enabled") as boolean) ?? true) {
      discover_section.push({
        id: "genre_section",
        title: "Genere",
        subtitle: "Più letti di un genere",
        type: DiscoverSectionType.genres,
      });
    }
    return discover_section;
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: MangaMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "mese_section":
        return this.parser.parseMonthTrending(this);
      case "popular_section":
        return this.parser.parseTrendingChaptersSection(this);
      case "updated_section":
        return this.parser.parseChapterUpdateSection(metadata, this);
      case "most_read_section":
        return this.parser.parseMostReadSection(metadata, this);
      case "new_manga_section":
        return this.parser.parseLastAddedSection(metadata, this, false);
      case "new_fav_type_section":
        return this.parser.parseLastAddedSection(metadata, this, true);
      case "genre_section":
        return this.parser.parseGenreSection(this, metadata);
      case "type_section":
        return this.parser.parseTypeSection(this, metadata);
      default:
        return { items: [], metadata: undefined };
    }
  }

  async getSortingOptions(): Promise<SortingOption[]> {
    await filter.populateFilter(this);
    return filter.getOrderFilter().map((item) => ({
      id: item.id,
      label: item.value,
    }));
  }
}
