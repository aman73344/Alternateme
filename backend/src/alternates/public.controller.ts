import { Request, Response } from 'express';
import { prisma } from '@/database';
import { NotFoundError } from '@/utils/errors';

export const publicController = {
  async getPublicAlternate(req: Request, res: Response) {
    const { username } = req.params;

    const alternate = await prisma.alternate.findFirst({
      where: {
        username: username.toLowerCase(),
        deletedAt: null,
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
      },
      include: {
        persona: {
          select: {
            tone: true,
            writingStyle: true,
            personality: true,
          },
        },
        voiceProfile: {
          select: {
            provider: true,
            name: true,
          },
        },
        aiProvider: {
          select: {
            provider: true,
            defaultModel: true,
          },
        },
      },
    });

    if (!alternate) {
      throw new NotFoundError('Alternate not found');
    }

    const response: any = {
      displayName: alternate.displayName,
      title: alternate.title,
      bio: alternate.bio,
      avatarUrl: alternate.avatarUrl,
      username: alternate.username,
      visibility: alternate.visibility,
      status: alternate.status,
      publishedAt: alternate.publishedAt,
    };

    if (alternate.persona) {
      response.persona = alternate.persona;
    }

    if (alternate.voiceProfile) {
      response.voice = {
        provider: alternate.voiceProfile.provider,
        name: alternate.voiceProfile.name,
      };
    }

    if (alternate.aiProvider) {
      response.aiProvider = {
        provider: alternate.aiProvider.provider,
        model: alternate.aiProvider.defaultModel,
      };
    }

    res.json({ success: true, data: response });
  },
};