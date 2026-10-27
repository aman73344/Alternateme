/**
 * AlternateContextTool
 *
 * Returns the Alternate's own public profile and persona. Only non-sensitive
 * fields are exposed: no owner email, no provider configuration, no secrets.
 */

import { prisma } from '@/database';
import { AGENT_TOOL_NAMES } from '../agent.constants';
import { ToolRiskLevel, type AgentTool, type ToolExecutionContext } from '../agent.types';
import { AlternateContextInputSchema } from './tool.schemas';

export interface AlternateContextOutput {
  displayName: string;
  username: string;
  title: string | null;
  bio: string | null;
  persona: {
    tone: string | null;
    writingStyle: string | null;
    personality: string | null;
    boundaries: string | null;
  } | null;
}

export const alternateContextTool: AgentTool<{ includePersona: boolean }, AlternateContextOutput> =
  {
    name: AGENT_TOOL_NAMES.ALTERNATE_CONTEXT,
    description:
      "Read this Alternate's public profile (name, title, bio) and, when the " +
      'caller is the owner, its persona settings. Read-only.',
    inputSchema: AlternateContextInputSchema,
    riskLevel: ToolRiskLevel.READ_ONLY,
    sideEffecting: false,
    allowPublicVisitor: true,

    async execute(context: ToolExecutionContext, input) {
      const alternate = await prisma.alternate.findFirst({
        where: { id: context.alternateId, deletedAt: null },
        select: {
          displayName: true,
          username: true,
          title: true,
          bio: true,
          // Persona is owner configuration: never disclosed to a visitor.
          persona: context.isOwner
            ? { select: { tone: true, writingStyle: true, personality: true, boundaries: true } }
            : false,
        },
      });

      return {
        displayName: alternate?.displayName ?? 'Unknown',
        username: alternate?.username ?? '',
        title: alternate?.title ?? null,
        bio: alternate?.bio ?? null,
        persona: input.includePersona && alternate?.persona ? alternate.persona : null,
      };
    },
  };
