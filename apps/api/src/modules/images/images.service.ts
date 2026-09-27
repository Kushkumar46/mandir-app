import { HttpStatus, Injectable } from '@nestjs/common';
import { type DeityImageView, ErrorCode, type ImageVariantUrls } from '@mandir/shared-types';

import { AppException } from '../../core/errors/app.exception.js';
import { PrismaService } from '../../core/prisma/prisma.module.js';
import { StorageService } from '../../core/storage/storage.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { canUseImage, pickDeityImage } from './image-visibility.js';

/** Signed GET lifetime for the owner's non-public images shown in the mandir. */
const PRIVATE_URL_TTL_SECONDS = 60 * 60;
const VARIANTS = ['thumb', 'card', 'full', 'hd'] as const;

const IMAGE_VIEW_INCLUDE = {
  temple: { select: { name: true, city: true } },
  uploadedBy: { select: { name: true } },
} satisfies Prisma.DeityImageInclude;

type ImageRow = Prisma.DeityImageGetPayload<{ include: typeof IMAGE_VIEW_INCLUDE }>;

export interface DeityImageRequest {
  deityId: string;
  selectedImageId: string | null;
  defaultImageId: string | null;
}

/**
 * Deity images: visibility and resolution (§6.2) for the mandir; uploads, `image.process`
 * pipeline and the moderation state machine arrive with T16.
 */
@Injectable()
export class ImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** The image `userId` sees for each deity (§6.2). Deities resolving to the bundled fallback map to null. */
  async resolveForDeities(userId: string, requests: DeityImageRequest[]): Promise<Map<string, DeityImageView | null>> {
    const deityIds = requests.map((r) => r.deityId);
    const directIds = requests.flatMap((r) => [r.selectedImageId, r.defaultImageId]).filter((id): id is string => !!id);

    const [direct, featured] = await Promise.all([
      directIds.length
        ? this.prisma.deityImage.findMany({ where: { id: { in: directIds } }, include: IMAGE_VIEW_INCLUDE })
        : [],
      deityIds.length
        ? this.prisma.deityImage.findMany({
            where: { deityId: { in: deityIds }, status: 'PUBLIC', isFeatured: true },
            include: IMAGE_VIEW_INCLUDE,
            orderBy: { updatedAt: 'desc' },
          })
        : [],
    ]);

    const byId = new Map(direct.map((i) => [i.id, i]));
    const featuredByDeity = new Map<string, ImageRow>();
    for (const image of featured) if (!featuredByDeity.has(image.deityId)) featuredByDeity.set(image.deityId, image);

    const entries = await Promise.all(
      requests.map(async (r) => {
        const picked = pickDeityImage(r.deityId, userId, {
          selected: (r.selectedImageId && byId.get(r.selectedImageId)) || null,
          featured: featuredByDeity.get(r.deityId) ?? null,
          deityDefault: (r.defaultImageId && byId.get(r.defaultImageId)) || null,
        });
        return [r.deityId, picked ? await this.toView(picked) : null] as const;
      }),
    );
    return new Map(entries);
  }

  /** Throws IMAGE_NOT_AVAILABLE unless `userId` may set this image for `deityId` (§6.2). */
  async assertUsable(userId: string, deityId: string, imageId: string): Promise<void> {
    const image = await this.prisma.deityImage.findUnique({
      where: { id: imageId },
      select: { deityId: true, status: true, uploadedById: true },
    });
    if (!image || image.deityId !== deityId || !canUseImage(image, userId)) {
      throw new AppException(ErrorCode.IMAGE_NOT_AVAILABLE, 'Image not available', HttpStatus.NOT_FOUND, { imageId });
    }
  }

  private async toView(image: ImageRow): Promise<DeityImageView> {
    return {
      id: image.id,
      source: image.source,
      status: image.status,
      urls: await this.urls(image),
      anchor: image.anchorX !== null && image.anchorY !== null ? { x: image.anchorX, y: image.anchorY } : null,
      credit: this.credit(image),
    };
  }

  /** Variant URLs; until variants exist (PROCESSING) every size points at the original. */
  private async urls(image: ImageRow): Promise<ImageVariantUrls> {
    const variants = (image.variants ?? {}) as Partial<Record<(typeof VARIANTS)[number], string>>;
    const entries = await Promise.all(
      VARIANTS.map(async (v) => {
        const key = variants[v] ?? image.objectKey;
        const url = this.storage.isPublic(key) ? this.storage.publicUrl(key) : await this.storage.presignGet(key, PRIVATE_URL_TTL_SECONDS);
        return [v, url] as const;
      }),
    );
    return Object.fromEntries(entries) as ImageVariantUrls;
  }

  private credit(image: ImageRow): DeityImageView['credit'] {
    const name = image.showCredit ? (image.creditName ?? image.uploadedBy?.name ?? null) : null;
    const temple = image.temple ? `${image.temple.name}, ${image.temple.city}` : null;
    return name || temple ? { name, temple } : null;
  }
}
