/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import {
  ContentRating,
  type Chapter,
  type ChapterDetails,
  type ChapterUpdatesCarouselItem,
  type DiscoverSectionItem,
  type PagedResults,
  type SearchResultItem,
  type SourceManga,
  type Tag,
  type TagSection,
} from "@paperback/types";

import { filter, MangaWorldGeneric, tags, types } from "./main";
import type { ChapterRow, Genre, MangaMetadata, MangaPage, PagedCards } from "./models";
import {
  parseArchive,
  parseChapterList,
  parseLatestUpdates,
  parseTopList,
  parseTrendingChapters,
} from "./scraper";

type SectionResult = { items: DiscoverSectionItem[]; metadata: MangaMetadata | undefined };

export class Parsers {
  mapGenresToTags(genres: Genre[]): Tag[] {
    return genres.map((genre) => ({ id: genre.slug, title: genre.name }));
  }

  contentRating(source: MangaWorldGeneric, genreSlugs: string[]): ContentRating {
    return source.defaultContentRating === ContentRating.ADULT
      ? ContentRating.ADULT
      : tags.getRating(genreSlugs);
  }

  parseMangaDetails(
    page: MangaPage,
    mangaId: string,
    shareURL: string,
    source: MangaWorldGeneric,
  ): SourceManga {
    const tagSections: TagSection[] = [
      { id: "genres", title: "genres", tags: this.mapGenresToTags(page.genres) },
    ];
    return {
      mangaId,
      mangaInfo: {
        artist: page.artists,
        thumbnailUrl: page.image,
        synopsis: page.synopsis,
        primaryTitle: page.title,
        contentRating: this.contentRating(
          source,
          page.genres.map((g) => g.slug),
        ),
        status: page.status,
        author: page.authors,
        tagGroups: tagSections,
        secondaryTitles: page.altTitles,
        additionalInfo: { subs: page.fansub ?? "Ufficiale" },
        shareUrl: shareURL,
      },
    };
  }

  parseChapters(rows: ChapterRow[], sourceManga: SourceManga): Chapter[] {
    return rows.map((row) => ({
      chapterId: row.id,
      sourceManga: sourceManga,
      langCode: "🇮🇹",
      chapNum: row.chapNum,
      title: row.name,
      version: sourceManga.mangaInfo.additionalInfo?.subs ?? "",
      publishDate: row.date,
      ...(row.volume !== undefined ? { volume: row.volume } : {}),
      ...(row.volumeName ? { additionalInfo: { name: row.volumeName } } : {}),
    }));
  }

  parseChapterDetails(pages: string[], chapter: Chapter): ChapterDetails {
    if (pages.length === 0) {
      throw new Error("Nessuna pagina trovata nel capitolo");
    }
    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages: pages,
    };
  }

  parseSearchResults(
    excluded: { generi: string[]; tipi: string[] },
    source: MangaWorldGeneric,
    metadata: MangaMetadata | undefined,
    cards: PagedCards,
  ): PagedResults<SearchResultItem> {
    const page = metadata?.page ?? 1;
    const results: SearchResultItem[] = cards.items
      .filter(
        (item) =>
          !types.excludedTypes(item.type, excluded.tipi) &&
          !tags.excludedTags(
            item.genres.map((g) => g.slug),
            excluded.generi,
          ),
      )
      .map((item) => ({
        imageUrl: item.image,
        title: item.title,
        subtitle: item.authors,
        mangaId: item.id,
        contentRating: this.contentRating(
          source,
          item.genres.map((g) => g.slug),
        ),
      }));
    return {
      items: results,
      metadata: cards.hasNext ? { page: page + 1 } : undefined,
    };
  }

  async parseTypeSection(
    source: MangaWorldGeneric,
    metadata: MangaMetadata | undefined,
  ): Promise<SectionResult> {
    await filter.populateFilter(source);
    const mangaType: DiscoverSectionItem[] = [];
    filter
      .getMangaTypeFilter()
      .filter((option) => !types.blacklistedType(option.value))
      .forEach((filterItem) => {
        const getExcludedTypeObject = {
          ...Object.fromEntries(
            filter
              .getMangaTypeFilter()
              .filter((option) => types.blacklistedType(option.value))
              .map((item) => [item.id, "excluded" as const]),
          ),
          [filterItem.id]: "included" as const,
        } as Record<string, "included" | "excluded">;
        mangaType.push({
          type: "genresCarouselItem",
          searchQuery: {
            title: "",
            metadata: {
              type: getExcludedTypeObject,
            },
          },
          name: filterItem.value,
          metadata: metadata,
          contentRating: ContentRating.EVERYONE,
        });
      });
    return {
      items: mangaType,
      metadata: undefined,
    };
  }
  async parseGenreSection(
    source: MangaWorldGeneric,
    metadata: MangaMetadata | undefined,
  ): Promise<SectionResult> {
    await filter.populateFilter(source);
    const allGenres: DiscoverSectionItem[] = [];
    filter
      .getGenreFilter()
      .filter((option) => !tags.blacklistedTags([option.id]))
      .forEach((filterItem) => {
        const getExcludedValueObject = {
          ...Object.fromEntries(
            filter
              .getGenreFilter()
              .filter((option) => tags.blacklistedTags([option.id]))
              .map((item) => [item.id, "excluded" as const]),
          ),
          [filterItem.id]: "included" as const,
        } as Record<string, "included" | "excluded">;
        allGenres.push({
          type: "genresCarouselItem",
          searchQuery: {
            title: "",
            metadata: {
              genres: getExcludedValueObject,
            },
          },
          name: filterItem.value,
          metadata: metadata,
          contentRating:
            source.defaultContentRating === ContentRating.ADULT
              ? ContentRating.ADULT
              : tags.getRating([filterItem.value]),
        });
      });
    return {
      items: allGenres,
      metadata: undefined,
    };
  }

  async parseArchiveSection(
    source: MangaWorldGeneric,
    metadata: MangaMetadata | undefined,
    sort: string,
    genres: string[] = [],
  ): Promise<SectionResult> {
    const page = metadata?.page ?? 1;
    const hidden = (Application.getState("hide_tags") as string[] | undefined) ?? [];
    const url = source.requestManager.buildArchiveURL(source, {
      page,
      sort,
      genres,
      excludeGenres: hidden,
    });
    const $ = await source.requestManager.fetchHTML(url);
    const cards = parseArchive($, source.base_url);
    return {
      items: this.parseSection(page + 1, source, cards),
      metadata: cards.hasNext ? { page: page + 1 } : undefined,
    };
  }

  async parseMostReadSection(
    metadata: MangaMetadata | undefined,
    source: MangaWorldGeneric,
  ): Promise<SectionResult> {
    return this.parseArchiveSection(source, metadata, "most_read");
  }

  async parseLastAddedSection(
    metadata: MangaMetadata | undefined,
    source: MangaWorldGeneric,
    favTags: boolean,
  ): Promise<SectionResult> {
    const genres = favTags
      ? ((Application.getState("fav_tags_new") as string[] | undefined) ?? [])
      : [];
    return this.parseArchiveSection(source, metadata, "newest", genres);
  }

  parseSection(page: number, source: MangaWorldGeneric, cards: PagedCards): DiscoverSectionItem[] {
    const latest: DiscoverSectionItem[] = [];
    for (const item of cards.items) {
      const slugs = item.genres.map((g) => g.slug);
      if (!tags.blacklistedTags(slugs) && !types.blacklistedType(item.type)) {
        latest.push({
          metadata: { page: page },
          subtitle: item.authors,
          type: "simpleCarouselItem",
          contentRating: this.contentRating(source, slugs),
          imageUrl: item.image,
          mangaId: item.id,
          title: item.title,
        });
      }
    }
    return latest;
  }

  async parseMonthTrending(source: MangaWorldGeneric): Promise<SectionResult> {
    const $ = await source.requestManager.fetchHTML(source.base_url);
    const items: DiscoverSectionItem[] = parseTopList($, "month", source.base_url).map((manga) => ({
      type: "featuredCarouselItem",
      mangaId: manga.id,
      imageUrl: manga.image,
      title: manga.title,
      supertitle: manga.type.length > 0 ? manga.type.toUpperCase() : undefined,
      summary: `${manga.views} letture questo mese`,
      infoItems: [{ symbol: "star.fill", text: manga.rating || "-" }],
      contentRating: source.defaultContentRating,
    }));
    return { items, metadata: undefined };
  }

  async parseTrendingChaptersSection(source: MangaWorldGeneric): Promise<SectionResult> {
    const $ = await source.requestManager.fetchHTML(source.base_url);
    const trending = parseTrendingChapters($, source.base_url);

    const mangaIds = [...new Set(trending.map((t) => t.mangaId))];
    const chaptersByManga = new Map<string, ChapterRow[]>();
    await Promise.all(
      mangaIds.map(async (id) => {
        try {
          const page = await source.requestManager.fetchHTML(`${source.base_url}/manga/${id}`);
          chaptersByManga.set(id, parseChapterList(page));
        } catch {
          chaptersByManga.set(id, []);
        }
      }),
    );

    const items: ChapterUpdatesCarouselItem[] = [];
    for (const item of trending) {
      const rows = chaptersByManga.get(item.mangaId) ?? [];
      const chapter =
        rows.find((r) => r.name === item.chapterName) ??
        rows.find((r) => r.chapNum === item.chapNum);
      if (!chapter) continue; // senza id non si può aprire il capitolo
      items.push({
        type: "chapterUpdatesCarouselItem",
        chapterId: chapter.id,
        mangaId: item.mangaId,
        title: item.title,
        subtitle: item.chapterName,
        imageUrl: item.image,
        publishDate: chapter.date,
        contentRating: source.defaultContentRating,
      });
    }
    return { items, metadata: undefined };
  }

  async parseChapterUpdateSection(
    metadata: MangaMetadata | undefined,
    source: MangaWorldGeneric,
  ): Promise<SectionResult> {
    const page = metadata?.page ?? 1;
    const url = page > 1 ? `${source.base_url}/?page=${page}` : source.base_url;
    const $ = await source.requestManager.fetchHTML(url);
    const latest = parseLatestUpdates($, source.base_url);
    const items: ChapterUpdatesCarouselItem[] = [];
    for (const manga of latest.items) {
      const chapter = manga.chapters[0];
      if (!chapter) continue;
      items.push({
        type: "chapterUpdatesCarouselItem",
        chapterId: chapter.id,
        mangaId: manga.mangaId,
        title: manga.title,
        subtitle: chapter.title,
        imageUrl: manga.image,
        publishDate: chapter.date ?? new Date(),
        contentRating: source.defaultContentRating,
      });
    }
    return { items, metadata: latest.hasNext ? { page: page + 1 } : undefined };
  }
}
