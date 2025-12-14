import {
  ContentRating,
  type Chapter,
  type ChapterDetails,
  type ChapterUpdatesCarouselItem,
  type DiscoverSectionItem,
  type PagedResults,
  type SearchResultItem,
  type SourceManga,
  type TagSection,
} from "@paperback/types";
import { filter, jsonParser, MangaWorldGeneric, tags, types } from "./main";
import type { Manga, MangaChapterList, MangaMetadata, TrendingManga, WindowEntry } from "./models";

export class Parsers {
  /**
   * Get Manga Detail
   * @param mangaInfo
   * @param {string} mangaId - MangaID
   * @param {string} shareURL - shareURL
   * @param source
   * @return {SourceManga} - SourceManga
   */
  parseMangaDetails(
    mangaInfo: WindowEntry[],
    mangaId: string,
    shareURL: string,
    source: MangaWorldGeneric,
  ): SourceManga {
    const entry = mangaInfo.find((e) => e.kind === "manga");
    if (!entry) {
      throw new Error("Nessun dato 'manga' trovato nel JSON");
    }
    const parsed = entry.data.manga;
    const tagsArray = jsonParser.mapGenresToTags(parsed.genres);
    const rating =
      source.defaultContentRating === ContentRating.ADULT
        ? ContentRating.ADULT
        : tags.getRating(parsed.genres?.map((g) => g.name) ?? []);

    const tagSections: TagSection[] = [{ id: "genres", title: "genres", tags: tagsArray }];
    return {
      mangaId,
      mangaInfo: {
        artist: parsed.artist.join(", "),
        thumbnailUrl: parsed.imageT,
        synopsis: parsed.trama,
        primaryTitle: parsed.title ?? "",
        contentRating: rating,
        status: parsed.statusT,
        author: parsed.author.join(", "),
        tagGroups: tagSections,
        secondaryTitles: parsed.extraTitles ?? [],
        additionalInfo: { subs: parsed.fansub?.name ?? "Ufficiale" },
        shareUrl: shareURL,
      },
    };
  }

  baseChapterData(chapter: MangaChapterList, sourceManga: SourceManga) {
    return {
      chapterId: chapter.id,
      sourceManga: sourceManga,
      langCode: "🇮🇹",
      chapNum: Number(chapter.name.split(" ")[1] ?? 1),
      title: chapter.title ?? chapter.name ?? "",
      version: sourceManga.mangaInfo.additionalInfo?.subs ?? "",
      publishDate: new Date(chapter.createdAt),
    };
  }
  /**
   * Get Chapter List
   * @param items
   * @param {SourceManga} sourceManga - Manga
   * @return {Chapter[]} - Chapters
   */
  parseChapters(items: WindowEntry[], sourceManga: SourceManga): Chapter[] {
    return items
      .filter((item) => item.kind === "chapter") // prendi solo i chapter
      .flatMap((item) => {
        const elements = item.data.pages;
        const volumeChapters = (elements.volumes ?? []).flatMap((volume) =>
          volume.chapters.map((chapter) => ({
            ...this.baseChapterData(chapter, sourceManga),
            volume: Number(volume.volume.name.split(" ")[1] ?? 1),
            additionalInfo: {
              icon: volume.volume.imageT ?? "",
              name: volume.volume.name ?? "",
            },
          })),
        );
        const singleChapters = (elements.singleChapters ?? []).map((chapter) =>
          this.baseChapterData(chapter, sourceManga),
        );
        return [...volumeChapters, ...singleChapters];
      });
  }

  parseChapterDetails(json: WindowEntry[], chapterId: string): ChapterDetails {
    const mangaEntry = json.find((entry) => entry.kind === "manga");
    const chapterEntry = json.find((entry) => entry.kind === "chapter");
    if (!mangaEntry || !chapterEntry) {
      throw new Error("Manga o capitolo non trovati nel JSON");
    }
    const { slugFolder: slug, id: mangaID } = mangaEntry.data.manga;
    const { CDN_URL: cdnUrl, pages: pageData } = chapterEntry.data;
    const info = jsonParser.findChapterData(pageData, chapterId);
    const pages =
      info?.pages.map(
        (page) => `${cdnUrl}/chapters/${slug}-${info.mangaId}/${info.chapterURL}/${page}`,
      ) ?? [];
    return {
      id: chapterId,
      mangaId: mangaID,
      pages: pages,
    };
  }

  /**
   * Page Parsing
   * @param json
   * @return {[{id:string,title:string,image:string,tags:string[], authors: string, type: string}]}
   */
  parsePage(json: WindowEntry[]): {
    id: string;
    title: string;
    image: string;
    tags: string[];
    authors: string;
    type: string;
  }[] {
    return json
      .filter((entry) => entry.kind === "search")
      .flatMap((entry) =>
        entry.data.mangas.map((manga) => ({
          id: `${manga.linkId}/${manga.slug}`,
          title: manga.title ?? "",
          image: manga.imageT ?? "",
          tags: manga.genres?.map((g) => g.slug) ?? [],
          authors: manga.author.join(", ") ?? "",
          type: manga.typeT ?? "",
        })),
      );
  }

  /**
   * Search Parsing
   * @param excluded
   * @param source
   * @param metadata
   * @param json
   * @return {SearchResultItem[]} items
   */
  async parseSearchResults(
    excluded: { generi: string[]; tipi: string[] },
    source: MangaWorldGeneric,
    metadata: MangaMetadata | undefined,
    json: WindowEntry[],
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    const totalPages = json.find((item) => item.kind === "searchInfo")?.data.totalPages ?? 1;
    const results: SearchResultItem[] = this.parsePage(json)
      .filter(
        (item) =>
          !types.excludedTypes(item.type, excluded.tipi) &&
          !tags.excludedTags(item.tags, excluded.generi),
      )
      .map((item) => ({
        imageUrl: item.image,
        title: item.title,
        subtitle: item.authors,
        mangaId: item.id,
        contentRating:
          source.defaultContentRating === ContentRating.ADULT
            ? ContentRating.ADULT
            : tags.getRating(item.tags),
      }));
    return {
      items: results,
      metadata: page + 1 > totalPages ? undefined : { page: page + 1 },
    };
  }

  async parseTypeSection(
    source: MangaWorldGeneric,
    metadata: MangaMetadata,
  ): Promise<{ items: DiscoverSectionItem[]; metadata: MangaMetadata }> {
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
            filters: [
              {
                id: "types",
                value: getExcludedTypeObject,
              },
            ],
          },
          name: filterItem.value,
          metadata: metadata,
          contentRating: ContentRating.EVERYONE,
        });
      });
    return {
      items: mangaType,
      metadata: metadata,
    };
  }
  async parseGenreSection(
    source: MangaWorldGeneric,
    metadata: MangaMetadata,
  ): Promise<{ items: DiscoverSectionItem[]; metadata: MangaMetadata }> {
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
            filters: [
              {
                id: "genres",
                value: getExcludedValueObject,
              },
            ],
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
      metadata: metadata,
    };
  }
  /**
   * Parsing trending chapters
   * @param {MangaMetadata} metadata - metadata
   * @param source
   * @param chapters
   * @return { items: DiscoverSectionItem[] }
   */
  parseTrendingChapters(
    metadata: MangaMetadata,
    source: MangaWorldGeneric,
    chapters: TrendingManga[],
  ): { items: DiscoverSectionItem[]; metadata: MangaMetadata } {
    const items: DiscoverSectionItem[] = chapters.map((chapter) => ({
      metadata: metadata,
      type: "featuredCarouselItem",
      contentRating:
        source.defaultContentRating === ContentRating.ADULT
          ? ContentRating.ADULT
          : source.defaultContentRating,
      supertitle: chapter.name,
      mangaId: `${chapter.manga.linkId}/${chapter.manga.slug}`,
      title: chapter.manga.title ?? "",
      imageUrl: chapter.manga.imageT ?? chapter.manga.image,
    }));

    return { items: items, metadata: metadata };
  }

  /**
   * Parsing month trending
   * @param {MangaMetadata} metadata - metadata
   * @param source
   * @param mangas
   * @return [ { items: DiscoverSectionItem[], metadata: Metadata }, { items: DiscoverSectionItem[], metadata: Metadata } ]
   */
  parseMonthTrending(
    metadata: MangaMetadata,
    source: MangaWorldGeneric,
    mangas: Manga[],
  ): { items: DiscoverSectionItem[]; metadata: MangaMetadata } {
    const items: DiscoverSectionItem[] = mangas.map((manga) => ({
      metadata: metadata,
      type: "prominentCarouselItem",
      contentRating:
        source.defaultContentRating === ContentRating.ADULT
          ? ContentRating.ADULT
          : tags.getRating(manga.genres?.map((g) => g.slug) ?? []),
      imageUrl: manga.imageT ?? manga.image,
      mangaId: `${manga.linkId}/${manga.slug}`,
      title: manga.title ?? "",
    }));

    return { items: items, metadata: metadata };
  }

  /**
   *
   * Parsing most read
   * @param {MangaMetadata} metadata - metadata
   * @param source
   * @return {{ items: DiscoverSectionItem[], metadata: MangaMetadata }}
   */
  async parseMostReadSection(
    metadata: MangaMetadata,
    source: MangaWorldGeneric,
  ): Promise<{ items: DiscoverSectionItem[]; metadata: MangaMetadata }> {
    let page = metadata?.page ?? 1;
    const $ = await source.requestManager.parsePopularSectionRequests(page, source);
    page++;
    const windowEntry = jsonParser.getWindowEntry($);
    const latest = await this.parseSection(page, source, windowEntry);
    return { items: latest, metadata: { page: page } };
  }

  async parseLastAddedSection(
    metadata: MangaMetadata,
    source: MangaWorldGeneric,
    favTags: boolean,
  ): Promise<{ items: DiscoverSectionItem[]; metadata: MangaMetadata }> {
    let page = metadata?.page ?? 1;
    const html = await source.requestManager.parseLastMangaAddedTagsSectionRequests(
      page,
      source,
      favTags,
    );
    page++;
    const windowEntry = jsonParser.getWindowEntry(html);
    const latest = await this.parseSection(page, source, windowEntry);
    return { items: latest, metadata: { page: page } };
  }

  async parseSection(page: number, source: MangaWorldGeneric, json: WindowEntry[]) {
    const latest: DiscoverSectionItem[] = [];
    const parse = this.parsePage(json);
    for (const item of parse) {
      if (!tags.blacklistedTags(item.tags) && !types.blacklistedType(item.type)) {
        latest.push({
          metadata: { page: page },
          subtitle: item.authors,
          type: "simpleCarouselItem",
          contentRating:
            source.defaultContentRating === ContentRating.ADULT
              ? ContentRating.ADULT
              : tags.getRating(item.tags),
          imageUrl: item.image,
          mangaId: item.id,
          title: item.title,
        });
      }
    }
    return latest;
  }

  /**
   * Parse new chapters
   * @param {MangaMetadata} metadata - manga metadata
   * @param source
   * @return {Promise<{ items: DiscoverSectionItem[]; metadata: MangaMetadata }> }
   */

  async parseChapterUpdateSection(
    metadata: MangaMetadata,
    source: MangaWorldGeneric,
  ): Promise<{ items: DiscoverSectionItem[]; metadata: MangaMetadata }> {
    const page = metadata?.page ?? 1;
    let html = "";
    const updates: ChapterUpdatesCarouselItem[] = [];
    if (page == 1) {
      html = Application.arrayBufferToUTF8String(
        await source.requestManager.fetchPage(source.base_url),
      );
    } else {
      const data = (
        await Application.scheduleRequest({
          url: `${source.base_url}/?page=${page}`,
          method: "GET",
        })
      )[1];
      html = Application.arrayBufferToUTF8String(data);
    }
    const windowEntry = jsonParser.getWindowEntry(html);
    for (const { kind, data } of windowEntry) {
      if (kind !== "manga") continue;
      const { manga, chapters } = data;
      const firstChapter = chapters?.[0];
      if (firstChapter) {
        updates.push({
          chapterId: firstChapter.id ?? "",
          type: "chapterUpdatesCarouselItem",
          publishDate: new Date(firstChapter.createdAt),
          contentRating:
            source.defaultContentRating === ContentRating.ADULT
              ? ContentRating.ADULT
              : source.defaultContentRating,
          imageUrl: manga.imageT ?? manga.image,
          mangaId: `${manga.linkId}/${manga.slug}`,
          title: manga.title ?? "",
          subtitle: firstChapter.name ?? "",
        });
      }
    }
    return { items: updates, metadata: { page: page + 1 } };
  }
}
