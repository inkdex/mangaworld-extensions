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

import { filter, MangaWorldGeneric } from "./main";

export class Requests {
  constructSearchRequestURL(
    page: number,
    query: SearchQuery = { title: "", filters: [] },
    sorting: SortingOption | undefined,
    source: MangaWorldGeneric,
  ): {
    url: string;
    excluded: { generi: string[]; tipi: string[] };
  } {
    const generi: string[] = [];
    const generi_esclusi: string[] = [];
    const tipi_esclusi: string[] = [];
    const tipologia: string[] = [];
    const getFilterValue = (id: string) => query.filters.find((filter) => filter.id == id)?.value;
    const genres: string | Record<string, "included" | "excluded"> = getFilterValue("genres") ?? "";
    const types: string | Record<string, "included" | "excluded"> = getFilterValue("types") ?? "";
    const status: string | Record<string, "included" | "excluded"> = getFilterValue("status") ?? "";
    const year: string | Record<string, "included" | "excluded"> = getFilterValue("year") ?? "";
    if (genres && typeof genres === "object") {
      for (const tag of Object.entries(genres)) {
        if (tag[1] == "included") generi.push(tag[0]);
        if (tag[1] == "excluded")
          generi_esclusi.push(
            filter.getGenreFilter().find((item) => item.id === tag[0])?.value ?? "",
          );
      }
    }

    if (types && typeof types === "object") {
      for (const tag of Object.entries(types)) {
        if (tag[1] == "included") tipologia.push(tag[0]);
        if (tag[1] == "excluded") tipi_esclusi.push(tag[0]);
      }
    }
    const statusFilter = status as string;
    const yearFilter = year as string;
    const url = new URL(source.base_url).addPathComponent("archive");
    if (query.title.toString().length > 0)
      url.setQueryItem("keyword", query.title.toString() ?? "");
    url.setQueryItem("page", page.toString());
    if (sorting?.id) url.setQueryItem("sort", sorting?.id);
    if (generi.length > 0) url.setQueryItem("genre", generi);
    if (tipologia.length > 0) url.setQueryItem("type", tipologia);
    if (statusFilter.length > 0) url.setQueryItem("status", statusFilter ?? "");
    if (yearFilter.length > 0) url.setQueryItem("year", yearFilter ?? "");
    return {
      url: url.toString(),
      excluded: { generi: generi_esclusi, tipi: tipi_esclusi },
    };
  }

  async parseFilters(source: MangaWorldGeneric) {
    return Application.arrayBufferToUTF8String(
      await source.requestManager.fetchPage(`${source.base_url}/archive`),
    );
  }

  async parseLastMangaAddedTagsSectionRequests(
    page: number,
    source: MangaWorldGeneric,
    favTags: boolean,
  ) {
    let html = "";
    const tags = favTags ? (Application.getState("fav_tags_new") as string[]).join("&genre=") : "";
    if (page > 1) {
      const data = (
        await Application.scheduleRequest({
          url: `${source.base_url}/archive?sort=newest&page=${page}&genre=${tags}`,
          method: "GET",
        })
      )[1];
      html = Application.arrayBufferToUTF8String(data);
    } else {
      html = Application.arrayBufferToUTF8String(
        await source.requestManager.fetchPage(
          `${source.base_url}/archive?sort=newest&page=${page}&genre=${tags}`,
        ),
      );
    }
    return html;
  }

  async parsePopularSectionRequests(page: number, source: MangaWorldGeneric) {
    let html = "";
    if (page > 1) {
      const data = (
        await Application.scheduleRequest({
          url: `${source.base_url}/archive?sort=most_read&page=${page}`,
          method: "GET",
        })
      )[1];
      html = Application.arrayBufferToUTF8String(data);
    } else {
      html = Application.arrayBufferToUTF8String(
        await source.requestManager.fetchPage(
          `${source.base_url}/archive?sort=most_read&page=${page}`,
        ),
      );
    }
    return html;
  }

  async getSearchResultsRequests(url: string) {
    const data = (
      await Application.scheduleRequest({
        url: url,
        method: "GET",
      })
    )[1];
    return Application.arrayBufferToUTF8String(data);
  }

  async fetchPage(url: string): Promise<ArrayBuffer> {
    return (
      await Application.scheduleRequest({
        url,
        method: "GET",
      })
    )[1];
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
