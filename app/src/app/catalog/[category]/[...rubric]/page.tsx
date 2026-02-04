"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CompanyCard from "@/components/CompanyCard";
import Pagination from "@/components/Pagination";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRegion } from "@/contexts/RegionContext";
import { regions } from "@/data/regions";
import type { BiznesinfoRubricResponse } from "@/lib/biznesinfo/types";
import { BIZNESINFO_CATEGORY_ICONS } from "@/lib/biznesinfo/icons";
import { formatCompanyCount } from "@/lib/utils/plural";

const PAGE_SIZE = 60;

interface PageProps {
  params: Promise<{ category: string; rubric: string[] }>;
}

export default function SubcategoryPage({ params }: PageProps) {
  const { category, rubric } = use(params);
  const { t } = useLanguage();
  const { selectedRegion, setSelectedRegion, regionName } = useRegion();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const query = (searchParams.get("q") || "").trim();
  const [queryDraft, setQueryDraft] = useState(query);
  const debounceRef = useRef<number | null>(null);

  const [currentPage, setCurrentPage] = useState(1);

  const [data, setData] = useState<BiznesinfoRubricResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const rubricPath = Array.isArray(rubric) ? rubric.join("/") : String(rubric || "");

  useEffect(() => {
    setQueryDraft(query);
  }, [query]);

  const replaceQueryParam = (nextQuery: string) => {
    const next = nextQuery.trim();
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("q", next);
    else params.delete("q");

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  useEffect(() => {
    const next = queryDraft.trim();
    if (next === query) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      replaceQueryParam(next);
    }, 400);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [queryDraft, query, searchParams, router, pathname]);

  useEffect(() => {
    setCurrentPage(1);
  }, [category, rubricPath, selectedRegion, query]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const rubricSlug = `${category}/${rubricPath}`;
    const region = selectedRegion || null;
    const offset = (currentPage - 1) * PAGE_SIZE;
    const params = new URLSearchParams();
    params.set("slug", rubricSlug);
    if (region) params.set("region", region);
    if (query) params.set("q", query);
    params.set("offset", String(offset));
    params.set("limit", String(PAGE_SIZE));

    fetch(`/api/biznesinfo/rubric?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((resp: BiznesinfoRubricResponse | null) => {
        if (!isMounted) return;
        setData(resp);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setData(null);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [category, rubricPath, selectedRegion, query, currentPage]);

  const icon = BIZNESINFO_CATEGORY_ICONS[category] || "🏢";
  const totalPages = data ? Math.ceil((data.page?.total ?? 0) / PAGE_SIZE) : 0;

  const inputClassName =
    "w-full rounded-2xl bg-white text-[#820251] font-medium text-[15px] placeholder:text-gray-500/60 placeholder:font-normal px-4 pr-24 py-3.5 shadow-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-300/70 focus:border-[#820251]/30 focus:placeholder:text-gray-500/60";
  const inputButtonClassName =
    "absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-[#820251]/10 text-[#820251] hover:bg-[#820251]/15 active:bg-[#820251]/20 transition-colors flex items-center justify-center";

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-100">
      <Header />

      <main className="flex-grow">
        {/* Breadcrumbs */}
        <div className="bg-white border-b border-gray-200">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Link href="/" className="hover:text-[#820251]">{t("common.home")}</Link>
              <span>/</span>
              <Link href="/#catalog" className="hover:text-[#820251]">{t("nav.catalog")}</Link>
              <span>/</span>
              <Link href={`/catalog/${category}`} className="hover:text-[#820251]">
                {data?.rubric?.category_name || category}
              </Link>
              <span>/</span>
              <span className="text-[#820251] font-medium">{data?.rubric?.name || rubricPath}</span>
            </div>
          </div>
        </div>

        {/* Rubric Header */}
        <div className="bg-gradient-to-r from-[#b10a78] to-[#7a0150] text-white py-10">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{icon}</span>
              <div>
                <h1 className="text-3xl font-bold">{data?.rubric?.name || rubricPath}</h1>
                <p className="text-pink-200 mt-1">
                  {data?.rubric?.category_name || category}
                  {" • "}
                  {isLoading ? "…" : formatCompanyCount(data?.page?.total ?? 0)}
                  {selectedRegion && ` • ${regionName}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Region Filter */}
        <div className="bg-white border-b border-gray-200 py-4">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-600 font-medium">{t("filter.region")}:</span>
              <button
                onClick={() => setSelectedRegion(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  !selectedRegion ? "bg-[#820251] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {t("search.allRegions")}
              </button>
              {regions.map((r) => (
                <button
                  key={r.slug}
                  onClick={() => setSelectedRegion(r.slug)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedRegion === r.slug
                      ? "bg-[#820251] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {t(`region.${r.slug}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Companies List */}
        <div className="container mx-auto py-10 px-4">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-[#820251] rounded"></span>
            {formatCompanyCount(data?.page?.total ?? 0)}
            {selectedRegion && (
              <span className="text-sm font-normal text-gray-500">
                — {regionName}
              </span>
            )}
          </h2>

          <form
            className="mb-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (debounceRef.current) window.clearTimeout(debounceRef.current);
              replaceQueryParam(queryDraft);
            }}
          >
            <div className="relative max-w-xl">
              <label className="sr-only" htmlFor="rubric-company-search">
                {t("search.companyPlaceholder")}
              </label>
              <input
                id="rubric-company-search"
                value={queryDraft}
                onChange={(e) => setQueryDraft(e.target.value)}
                inputMode="search"
                placeholder={t("search.companyPlaceholder")}
                className={inputClassName}
              />

              {!!queryDraft.trim() && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    if (debounceRef.current) window.clearTimeout(debounceRef.current);
                    setQueryDraft("");
                    replaceQueryParam("");
                  }}
                  className={`${inputButtonClassName} right-12`}
                >
                  ✕
                </button>
              )}

              <button type="submit" aria-label={t("search.find")} className={`${inputButtonClassName} right-2`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>

          {isLoading ? (
            <div className="bg-white rounded-lg p-10 text-center text-gray-500">{t("common.loading")}</div>
          ) : !data || !data.companies || data.companies.length === 0 ? (
            <div className="bg-white rounded-lg p-10 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">{t("company.notFound")}</h3>
              <p className="text-gray-500">{t("company.notFoundDesc")}</p>
              <button
                onClick={() => setSelectedRegion(null)}
                className="inline-block mt-4 text-[#820251] hover:underline"
              >
                {t("company.showAllRegions")}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.companies.map((company) => (
                  <CompanyCard key={company.id} company={company} />
                ))}
              </div>
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </>
          )}
        </div>

        {/* Back link */}
        <div className="container mx-auto pb-10 px-4">
          <Link
            href={`/catalog/${category}`}
            className="inline-flex items-center gap-2 text-[#820251] hover:underline"
          >
            ← {t("catalog.backToCategory")} {data?.rubric?.category_name || category}
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
