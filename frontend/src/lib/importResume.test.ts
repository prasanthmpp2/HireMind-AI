import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { defaultResume } from "./resume";
import { importResumeFromFile } from "./importResume";

const makeFile = (data: string | Uint8Array, name: string, type: string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : Uint8Array.from(data);
  const file = new File([bytes.buffer], name, { type });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
  Object.defineProperty(file, "text", { value: async () => new TextDecoder().decode(bytes) });
  return file;
};

describe("resume file import", () => {
  it("imports contact and resume sections from UTF-8 text", async () => {
    const file = makeFile(
      "Zoë Li\nzoe@example.test\n+1 555 123 4567\n\nSUMMARY\nBuilds useful products.\n\nSKILLS\nReact, TypeScript",
      "resume.txt",
      "text/plain"
    );
    const resume = await importResumeFromFile(file, defaultResume);
    expect(resume.personal.name).toBe("Zoë Li");
    expect(resume.personal.email).toBe("zoe@example.test");
    expect(resume.personal.summary).toContain("Builds useful products");
    expect(resume.skills).toEqual(["React", "TypeScript"]);
  });

  it("extracts paragraphs from DOCX files", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Zoë Li</w:t></w:r></w:p><w:p><w:r><w:t>zoe@example.test</w:t></w:r></w:p><w:p><w:r><w:t>SUMMARY</w:t></w:r></w:p><w:p><w:r><w:t>Builds useful products.</w:t></w:r></w:p></w:body></w:document>`);
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const file = makeFile(bytes, "resume.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    const resume = await importResumeFromFile(file, defaultResume);
    expect(resume.personal.name).toBe("Zoë Li");
    expect(resume.personal.email).toBe("zoe@example.test");
    expect(resume.personal.summary).toContain("Builds useful products");
  });

  it("rejects unsupported and oversized files before parsing", async () => {
    await expect(importResumeFromFile(new File(["data"], "resume.exe"), defaultResume))
      .rejects.toThrow("Unsupported format");
    const oversized = new File([new Uint8Array(15 * 1024 * 1024 + 1)], "resume.txt", { type: "text/plain" });
    await expect(importResumeFromFile(oversized, defaultResume)).rejects.toThrow("smaller than 15 MB");
  });
});
