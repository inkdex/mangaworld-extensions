/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import type { JSONObject } from "@paperback/types";

export type MangaMetadata = {
  page: number;
};

export type OptionItem = {
  value: string;
  id: string;
};

export interface Genre {
  name: string;
  slug: string;
}

export interface MangaCard {
  id: string;
  title: string;
  image: string;
  authors: string;
  type: string;
  genres: Genre[];
}

export interface PagedCards {
  items: MangaCard[];
  hasNext: boolean;
}

export interface MangaPage {
  title: string;
  image: string;
  synopsis: string;
  authors: string;
  artists: string;
  status: string;
  fansub: string | null;
  altTitles: string[];
  genres: Genre[];
}

export interface ChapterRow {
  id: string;
  name: string;
  chapNum: number;
  date: Date;
  volume?: number;
  volumeName?: string;
}

export interface TopItem {
  id: string;
  title: string;
  image: string;
  type: string;
  views: string;
  rating: string;
}

export interface TrendingChapter {
  mangaId: string;
  title: string;
  image: string;
  chapterName: string;
  chapNum: number;
}

export interface LatestChapter {
  id: string;
  title: string;
  date?: Date;
}

export interface LatestUpdate {
  mangaId: string;
  title: string;
  image: string;
  chapters: LatestChapter[];
}

export interface PagedLatest {
  items: LatestUpdate[];
  hasNext: boolean;
}

export interface SearchMetadata extends JSONObject {
  genres?: Record<string, "included" | "excluded">;
  type?: Record<string, "included" | "excluded">;
  status?: string[];
  sort?: string[];
  year?: number;
}
