const CHUNK_SIZE = 400; // ~tokens (rough: 1 token ≈ 4 chars)
const OVERLAP = 60;

export interface TextChunk {
  content: string;
  index: number;
  startChar: number;
  endChar: number;
}

export function chunkText(text: string): TextChunk[] {
  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  const chunks: TextChunk[] = [];
  // Split on paragraph boundaries first, then merge/split to target size
  const paragraphs = normalized.split(/\n\n+/);

  let buffer = "";
  let bufferStart = 0;
  let charPos = 0;

  for (const para of paragraphs) {
    const paraLen = para.length;

    if (buffer.length + paraLen > CHUNK_SIZE * 4 && buffer.length > 0) {
      // Flush buffer
      chunks.push({
        content: buffer.trim(),
        index: chunks.length,
        startChar: bufferStart,
        endChar: bufferStart + buffer.length,
      });
      // Overlap: keep last OVERLAP*4 chars
      const overlapText = buffer.slice(-(OVERLAP * 4));
      bufferStart = bufferStart + buffer.length - overlapText.length;
      buffer = overlapText + "\n\n" + para;
    } else {
      if (buffer.length > 0) buffer += "\n\n";
      buffer += para;
      if (buffer.length === para.length) bufferStart = charPos;
    }

    charPos += paraLen + 2; // +2 for the \n\n separator
  }

  if (buffer.trim().length > 0) {
    chunks.push({
      content: buffer.trim(),
      index: chunks.length,
      startChar: bufferStart,
      endChar: bufferStart + buffer.length,
    });
  }

  // If a single chunk is still too large, split by sentences
  const finalChunks: TextChunk[] = [];
  for (const chunk of chunks) {
    if (chunk.content.length <= CHUNK_SIZE * 5) {
      finalChunks.push({ ...chunk, index: finalChunks.length });
      continue;
    }
    const sentences = chunk.content.match(/[^.!?]+[.!?]+/g) ?? [chunk.content];
    let sentBuf = "";
    let sentStart = chunk.startChar;
    for (const s of sentences) {
      if (sentBuf.length + s.length > CHUNK_SIZE * 4 && sentBuf.length > 0) {
        finalChunks.push({
          content: sentBuf.trim(),
          index: finalChunks.length,
          startChar: sentStart,
          endChar: sentStart + sentBuf.length,
        });
        sentStart = sentStart + sentBuf.length - Math.min(200, sentBuf.length);
        sentBuf = s;
      } else {
        sentBuf += s;
      }
    }
    if (sentBuf.trim()) {
      finalChunks.push({
        content: sentBuf.trim(),
        index: finalChunks.length,
        startChar: sentStart,
        endChar: sentStart + sentBuf.length,
      });
    }
  }

  return finalChunks;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
