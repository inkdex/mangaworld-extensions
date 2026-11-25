/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import type { CheerioAPI } from "cheerio";

import type {
  ChapterRow,
  Genre,
  LatestChapter,
  LatestUpdate,
  MangaCard,
  MangaPage,
  OptionItem,
  PagedCards,
  PagedLatest,
  TopItem,
  TrendingChapter,
} from "./models";

type Selection = ReturnType<CheerioAPI>;

const MONTHS: Record<string, number> = {
  gennaio: 0,
  febbraio: 1,
  marzo: 2,
  aprile: 3,
  maggio: 4,
  giugno: 5,
  luglio: 6,
  agosto: 7,
  settembre: 8,
  ottobre: 9,
  novembre: 10,
  dicembre: 11,
};

const clean = (text: string): string => text.replace(/\s+/g, " ").trim();

export function parseItalianDate(text: string): Date {
  const match = /(\d{1,2})\s+([a-zà-ù]+)\s+(\d{4})/i.exec(text);
  const month = match?.[2] ? MONTHS[match[2].toLowerCase()] : undefined;
  if (!match?.[1] || !match[3] || month === undefined) return new Date();
  return new Date(Number(match[3]), month, Number(match[1]));
}

export function absoluteUrl(src: string | undefined, baseUrl: string): string {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("/")) return `${baseUrl}${src}`;
  return `${baseUrl}/${src}`;
}

/** `https://host/manga/2906/slug[/...]` -> `2906/slug` */
export function mangaIdFromHref(href: string | undefined): string {
  const match = /\/manga\/(\d+\/[^/?#]+)/.exec(href ?? "");
  return match?.[1] ?? "";
}

/** `...archive?genre=slice-of-life` -> `slice-of-life` */
function queryValue(href: string | undefined, key: string): string {
  const match = new RegExp(`[?&]${key}=([^&#]+)`).exec(href ?? "");
  return match?.[1] ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
}

function genresFrom($: CheerioAPI, scope: Selection): Genre[] {
  const genres: Genre[] = [];
  scope.find('a[href*="genre="]').each((_, el) => {
    const slug = queryValue($(el).attr("href"), "genre");
    const name = clean($(el).text());
    if (slug && name) genres.push({ slug, name });
  });
  return genres;
}

function fact($: CheerioAPI, scope: Selection, labels: string[]): Selection {
  const row = scope.find("dl.fact-list > div").filter((_, el) => {
    const label = clean($(el).find("dt").first().text()).replace(/:$/, "").toLowerCase();
    return labels.includes(label);
  });
  return row.first().find("dd").first();
}

function factList($: CheerioAPI, scope: Selection, labels: string[]): string {
  const dd = fact($, scope, labels);
  const links = dd
    .find("a")
    .map((_, a) => clean($(a).text()))
    .get()
    .filter((t) => t.length > 0);
  return links.length > 0 ? links.join(", ") : clean(dd.text());
}

export function hasNextPage($: CheerioAPI): boolean {
  return $('nav#pager a[rel="next"], nav.pager a[rel="next"]').length > 0;
}

export function parseArchive($: CheerioAPI, baseUrl: string): PagedCards {
  const items: MangaCard[] = [];
  $("article.archive-card").each((_, el) => {
    const card = $(el);
    const href = card.find("a.card-cover").attr("href") ?? card.find(".card-title a").attr("href");
    const id = mangaIdFromHref(href);
    if (!id) return;
    const title =
      clean(card.find(".card-title a").first().text()) ||
      clean(card.find("a.card-cover").attr("title") ?? "");
    const img = card.find("a.card-cover img").first();
    items.push({
      id,
      title,
      image: absoluteUrl(img.attr("src") ?? img.attr("data-src"), baseUrl),
      authors: factList($, card, ["autore", "autori"]),
      type: clean(card.find(".card-tags a.tag").first().text()).toLowerCase(),
      genres: genresFrom($, card),
    });
  });
  return { items, hasNext: hasNextPage($) };
}

export function parseMangaPage($: CheerioAPI, baseUrl: string): MangaPage {
  const hero = $("section.manga-hero").first();
  const title = clean(hero.find("h1.manga-title").first().text());
  if (!title) throw new Error("Pagina manga non riconosciuta: titolo mancante");

  const altText = clean(hero.find("p.manga-alt").first().text()).replace(
    /^titoli alternativi:\s*/i,
    "",
  );

  const genres: Genre[] = [];
  hero.find("ul.hero-chips a").each((_, el) => {
    const name = clean($(el).text());
    const slug = queryValue($(el).attr("href"), "genre");
    if (name && slug) genres.push({ name, slug });
  });

  const fansubDd = fact($, hero, ["fansub", "fansubs"]);
  const fansub = clean(fansubDd.text());

  return {
    title,
    image: absoluteUrl(hero.find(".manga-cover img").first().attr("src"), baseUrl),
    synopsis: clean($("p.manga-plot").first().text()),
    authors: factList($, hero, ["autore", "autori"]),
    artists: factList($, hero, ["artista", "artisti"]),
    status: clean(fact($, hero, ["stato"]).text()),
    fansub: fansub.length > 0 ? fansub : null,
    altTitles: altText.length > 0 ? altText.split(/\s*,\s*/).filter((t) => t.length > 0) : [],
    genres,
  };
}

function chapterNumber(name: string): number | undefined {
  const match =
    /cap(?:itolo|\.)?\s*(\d+(?:[.,]\d+)?)/i.exec(name) ?? /(\d+(?:[.,]\d+)?)/.exec(name);
  return match?.[1] ? Number(match[1].replace(",", ".")) : undefined;
}

function volumeOf(list: Selection): { volume?: number; volumeName?: string } {
  if (list.hasClass("single-chapters")) return {};
  const candidates = [
    list.prevAll("h2, h3, h4, summary, header, [class*=volume]").first(),
    list.parent().prevAll("h2, h3, h4, summary, header, [class*=volume]").first(),
    list
      .closest("details, [data-volume], .volume, [class*=volume-]")
      .find("summary, h2, h3, h4")
      .first(),
  ];
  for (const candidate of candidates) {
    const name = clean(candidate.text());
    const match = /volume\s*(\d+(?:[.,]\d+)?)/i.exec(name);
    if (match?.[1]) return { volume: Number(match[1].replace(",", ".")), volumeName: name };
    if (name.length > 0 && name.length < 60 && candidate.length > 0) {
      return { volumeName: name };
    }
  }
  return {};
}

export function parseChapterList($: CheerioAPI): ChapterRow[] {
  const rows: ChapterRow[] = [];
  $("li.ch-row").each((_, el) => {
    const row = $(el);
    const link = row.find("a.ch").first();
    const id =
      row.attr("data-chapter") ?? /\/read\/([0-9a-f]+)/i.exec(link.attr("href") ?? "")?.[1];
    if (!id) return;
    const name =
      clean(link.find(".ch-name").first().text()) ||
      clean(link.find(".ch-label").first().text()) ||
      clean(link.attr("title") ?? "");
    const volume = volumeOf(row.closest("ul.ch-list"));
    const volumeFromName = /vol(?:ume|\.)?\s*(\d+(?:[.,]\d+)?)/i.exec(name)?.[1];
    if (volume.volume === undefined && volumeFromName) {
      volume.volume = Number(volumeFromName.replace(",", "."));
    }
    rows.push({
      id,
      name,
      chapNum: chapterNumber(name) ?? 1,
      date: parseItalianDate(link.find(".ch-date").first().text()),
      ...volume,
    });
  });
  return rows;
}

export function parseReaderPages($: CheerioAPI, baseUrl: string): string[] {
  return $("img.reader-page, img[data-reader-image]")
    .map((_, el) => absoluteUrl($(el).attr("data-src") ?? $(el).attr("src"), baseUrl))
    .get()
    .filter((src) => src.length > 0);
}

export function parseFilterOptions($: CheerioAPI, name: string): OptionItem[] {
  const result: OptionItem[] = [];
  $(`form[data-filters] input[name="${name}"]`).each((_, el) => {
    const id = ($(el).attr("value") ?? "").trim();
    const value = clean($(el).closest("label").find(".check-label").text());
    if (id && value) result.push({ id, value });
  });
  return result;
}

export function parseTopList(
  $: CheerioAPI,
  panel: "day" | "month" | "total",
  baseUrl: string,
): TopItem[] {
  const items: TopItem[] = [];
  $(`#top-panel-${panel} a.top-item`).each((_, el) => {
    const item = $(el);
    const id = mangaIdFromHref(item.attr("href"));
    if (!id) return;
    items.push({
      id,
      title: clean(item.find(".top-name").first().text()),
      image: absoluteUrl(item.find("img").first().attr("src"), baseUrl),
      type: clean(item.find(".top-meta").first().text()).toLowerCase(),
      views: clean(item.find(".top-views strong").first().text()),
      rating: clean(item.find(".rating-chip strong").first().text()),
    });
  });
  return items;
}

export function parseTrendingChapters($: CheerioAPI, baseUrl: string): TrendingChapter[] {
  const items: TrendingChapter[] = [];
  $("#hero article.slide").each((_, el) => {
    const slide = $(el);
    const link = slide.find(".slide-title a").first();
    const mangaId = mangaIdFromHref(link.attr("href"));
    const chapterName = clean(slide.find("p.slide-chapter").first().text());
    if (!mangaId) return;
    items.push({
      mangaId,
      title: clean(link.text()),
      image: absoluteUrl(
        slide.find("img.slide-cover, .slide-cover img").first().attr("src"),
        baseUrl,
      ),
      chapterName,
      chapNum: chapterNumber(chapterName) ?? 1,
    });
  });
  return items;
}

export function parseLatestUpdates($: CheerioAPI, baseUrl: string): PagedLatest {
  const items: LatestUpdate[] = [];
  $("section.latest article.card").each((_, el) => {
    const card = $(el);
    const mangaId = mangaIdFromHref(card.find("a.card-cover").attr("href"));
    if (!mangaId) return;
    const chapters: LatestChapter[] = [];
    card.find("ul.ch-list a.ch").each((__, a) => {
      const link = $(a);
      const id = /\/read\/([0-9a-f]+)/i.exec(link.attr("href") ?? "")?.[1];
      if (!id) return;
      const datetime = link.find("time[datetime]").attr("datetime");
      const date = datetime ? new Date(datetime) : undefined;
      chapters.push({
        id,
        title: clean(link.attr("title") ?? "") || clean(link.find(".ch-name").text()),
        ...(date && !isNaN(date.valueOf()) ? { date } : {}),
      });
    });
    items.push({
      mangaId,
      title: clean(card.find(".card-title a").first().text()),
      image: absoluteUrl(card.find("a.card-cover img").first().attr("src"), baseUrl),
      chapters,
    });
  });
  return { items, hasNext: hasNextPage($) };
}
