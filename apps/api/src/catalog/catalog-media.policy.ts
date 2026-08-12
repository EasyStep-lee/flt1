import { SafeApiError } from '../http/api-error.js';

export interface CatalogMediaResponse {
  readonly url: string;
  readonly alt: string;
}

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export const buildCatalogMediaResponse = (
  detailSnapshot: Readonly<Record<string, unknown>>,
): readonly CatalogMediaResponse[] => {
  const value = detailSnapshot.media;
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) {
    throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Product media snapshot is invalid');
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Product media snapshot is invalid');
    }
    const media = item as Record<string, unknown>;
    if (
      Object.keys(media).some((key) => key !== 'url' && key !== 'alt') ||
      typeof media.url !== 'string' ||
      media.url.length > 2_048 ||
      !isHttpsUrl(media.url) ||
      typeof media.alt !== 'string' ||
      media.alt.length > 200
    ) {
      throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Product media snapshot is invalid');
    }
    return { url: media.url, alt: media.alt };
  });
};
