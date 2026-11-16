import zlib from "node:zlib";

// Reads the text of a Word (.docx) file. A .docx is a zip archive, so this reads the zip
// directory and unpacks word/document.xml using Node's built-in zlib. No extra libraries.
const INVALID = "This does not look like a valid Word (.docx) file.";

function findEndOfCentralDirectory(buf) {
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error(INVALID);
}

export function xmlToText(xml) {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function docxToText(buf) {
  const eocd = findEndOfCentralDirectory(buf);
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) throw new Error(INVALID);
    const method = buf.readUInt16LE(offset + 10);
    const compSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLen);
    if (name === "word/document.xml") {
      const localName = buf.readUInt16LE(localOffset + 26);
      const localExtra = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localName + localExtra;
      const raw = buf.subarray(start, start + compSize);
      if (method !== 0 && method !== 8) throw new Error("This Word file uses an unsupported compression method.");
      const xml = (method === 0 ? raw : zlib.inflateRawSync(raw)).toString("utf8");
      return xmlToText(xml);
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error("No document text was found in that Word file.");
}
