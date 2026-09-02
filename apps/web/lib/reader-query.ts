import type { ReaderLanguage } from '@/lib/api-types';

export type RouteSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export async function routeLanguage(
  searchParams: RouteSearchParams,
): Promise<ReaderLanguage> {
  const value = (await searchParams).lang;
  return value === 'hi' ? 'hi' : 'en';
}

export async function routeQuery(
  searchParams: RouteSearchParams,
  key: string,
): Promise<string> {
  const value = (await searchParams)[key];
  return typeof value === 'string' ? value.trim() : '';
}
