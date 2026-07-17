declare module "word-extractor" {
  export default class WordExtractor {
    extract(input: Buffer | string): Promise<{
      getBody(): string;
      getHeaders(): Record<string, string>;
      getFooters(): Record<string, string>;
      getAnnotations(): string;
      getTextboxes(): string;
    }>;
  }
}
