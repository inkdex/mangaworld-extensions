/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

export type MangaMetadata = {
  page: number;
};
export type OptionItem = {
  value: string;
  id: string;
};
export type CacheItem = {
  expires: number;
  data: ArrayBuffer;
};

export type RawEntry = [key: string, index: number, data: unknown, meta?: { f?: number }];

export interface Genre {
  name: string;
  slug: string;
}

export interface Fansub {
  name: string;
}

export interface JSONConfig {
  CSRFToken: string;
  ADULT: boolean;
  URL: string;
  PUBLIC_URL: string;
  SITE_NAME: string;
  localURL: string;
  seo: object;
}

export interface Manga {
  id: string;
  title: string;
  slug: string;
  author: string[];
  artist: string[];
  genres: Genre[];
  fansub: Fansub | null;
  trama: string;
  extraTitles: string[];
  status: string;
  type: string;
  image: string;
  imageT: string;
  slugFolder: string;
  linkId: number;
  typeT: string;
  statusT: string;
  tramaT: string;
  createdAt: string;
  updatedAt: string;
}

export interface MangaChapterList {
  id: string;
  manga: string;
  name: string;
  title?: string | null;
  pages: string[];
  slugFolder: string;
  createdAt: string;
  updatedAt: string;
}

export interface JSONChapter {
  id: string;
  pages: string[];
  manga?: Manga;
  volume?: string;
  name: string;
  title: string;
  slugFolder: string;
  createdAt: string;
}

export interface Volume {
  id: string;
  manga: string;
  name: string;
  slugFolder: string;
  image: string;
  imageT: string;
}

export interface Volumes {
  volume: Volume;
  chapters: MangaChapterList[];
}

export interface Pages {
  volumes: Volumes[];
  singleChapters: MangaChapterList[];
}

export interface ChapterList {
  URL: string;
  CDN_URL: string;
  pages: Pages;
}

export interface TrendingManga {
  id: string;
  manga: Manga;
  name: string;
  pages: string[];
  slugFolder: string;
  createdAt: string;
}

export interface TrendingChaptersData {
  URL: string;
  mostViewedChapters: TrendingManga[];
}

export interface GlobalData {
  genres: Genre[];
  topMangas: Manga[];
  latestMangas: Manga[];
}

export interface SearchResults {
  URL: string;
  results: number;
  selected: object;
  authors: string[];
  artists: string[];
  years: (number | string)[];
  mangas: Manga[];
  chapters: JSONChapter[];
}

export interface SearchInfo {
  totalPages: number;
}

export interface MangaPageData {
  type: string;
  manga: Manga;
  chapters: JSONChapter[];
}

export type WindowEntry =
  | {
      kind: "config";
      key: string;
      index: number;
      data: object;
      meta?: { f?: number };
    }
  | {
      kind: "global";
      key: string;
      index: number;
      data: { globalData: GlobalData };
      meta?: { f?: number };
    }
  | {
      kind: "manga";
      key: string;
      index: number;
      data: MangaPageData;
      meta?: { f?: number };
    }
  | {
      kind: "trending";
      key: string;
      index: number;
      data: TrendingChaptersData;
      meta?: { f?: number };
    }
  | {
      kind: "chapter";
      key: string;
      index: number;
      data: ChapterList;
      meta?: { f?: number };
    }
  | {
      kind: "search";
      key: string;
      index: number;
      data: SearchResults;
      meta?: { f?: number };
    }
  | {
      kind: "searchInfo";
      key: string;
      index: number;
      data: SearchInfo;
      meta?: { f?: number };
    };

export interface JsonData {
  o: {
    l: number;
    g: { maintenance: boolean };
    w: WindowEntry[];
  };
}
