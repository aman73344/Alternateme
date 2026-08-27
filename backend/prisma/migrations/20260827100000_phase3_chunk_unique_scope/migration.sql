-- Fix the identity scope of a DocumentChunk. The previous constraint
-- ("userId","version","chunkIndex") collided whenever one user owned multiple
-- sources ingested at the same version - e.g. two TXT uploads each producing
-- chunk index 0. Chunks are uniquely identified inside a SOURCE generation.
ALTER TABLE "document_chunks" DROP CONSTRAINT IF EXISTS "document_chunks_userId_version_chunkIndex_key";
DROP INDEX IF EXISTS "document_chunks_userId_version_chunkIndex_key";
CREATE UNIQUE INDEX "document_chunks_sourceId_version_chunkIndex_key"
  ON "document_chunks"("sourceId","version","chunkIndex");
