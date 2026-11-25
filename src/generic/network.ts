/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import {
  PaperbackInterceptor,
  URL,
  type Request,
  type Response,
  type SearchQuery,
  type SortingOption,
} from "@paperback/types";
import * as cheerio from "cheerio";

import type { MangaWorldGeneric } from "./main";
import type { SearchMetadata } from "./models";

export interface ArchiveParams {
  page: number;
  keyword?: string;
  sort?: string;
  genres?: string[];
  excludeGenres?: string[];
  types?: string[];
  status?: string[];
  year?: number;
}

export class Requests {
  buildArchiveURL(source: MangaWorldGeneric, params: ArchiveParams): string {
    const url = new URL(source.base_url).addPathComponent("archive");
    if (params.keyword && params.keyword.length > 0) url.setQueryItem("keyword", params.keyword);
    url.setQueryItem("page", params.page.toString());
    if (params.sort) url.setQueryItem("sort", params.sort);
    if (params.genres && params.genres.length > 0) url.setQueryItem("genre", params.genres);
    if (params.excludeGenres && params.excludeGenres.length > 0)
      url.setQueryItem("exclude", params.excludeGenres);
    if (params.types && params.types.length > 0) url.setQueryItem("type", params.types);
    if (params.status && params.status.length > 0) url.setQueryItem("status", params.status);
    if (params.year) url.setQueryItem("year", params.year.toString());
    return url.toString();
  }

  constructSearchRequestURL(
    page: number,
    query: SearchQuery<SearchMetadata> = { title: "", metadata: {} },
    sorting: SortingOption | undefined,
    source: MangaWorldGeneric,
  ): {
    url: string;
    excluded: { generi: string[]; tipi: string[] };
  } {
    const genres: Record<string, "included" | "excluded"> = query.metadata?.genres ?? {};
    const types: Record<string, "included" | "excluded"> = query.metadata?.type ?? {};

    const included = (list: Record<string, "included" | "excluded">) =>
      Object.entries(list)
        .filter(([, state]) => state === "included")
        .map(([id]) => id);
    const excluded = (list: Record<string, "included" | "excluded">) =>
      Object.entries(list)
        .filter(([, state]) => state === "excluded")
        .map(([id]) => id);

    const generiEsclusi = excluded(genres);
    const tipiEsclusi = excluded(types);

    const url = this.buildArchiveURL(source, {
      page,
      keyword: query.title.toString(),
      sort: sorting?.id,
      genres: included(genres),
      excludeGenres: generiEsclusi,
      types: included(types),
      status: query.metadata?.status ?? [],
      year: query.metadata?.year ?? 0,
    });
    return { url, excluded: { generi: generiEsclusi, tipi: tipiEsclusi } };
  }

  async fetchPage(url: string): Promise<ArrayBuffer> {
    return (
      await Application.scheduleRequest({
        url,
        method: "GET",
      })
    )[1];
  }

  async fetchHTML(url: string): Promise<cheerio.CheerioAPI> {
    return cheerio.load(Application.arrayBufferToUTF8String(await this.fetchPage(url)));
  }

  async parseFilters(source: MangaWorldGeneric): Promise<cheerio.CheerioAPI> {
    return this.fetchHTML(`${source.base_url}/archive`);
  }
}

export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    return request;
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    void request;
    void response;

    return data;
  }
}
