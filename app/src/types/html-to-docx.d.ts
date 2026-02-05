declare module "html-to-docx" {
  interface DocxOptions {
    table?: {
      row?: {
        cantSplit?: boolean;
      };
    };
    footer?: boolean;
    pageNumber?: boolean;
    title?: string;
    margin?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  }

  function htmlToDocx(
    htmlString: string,
    headerHTMLString: string | null,
    options?: DocxOptions
  ): Promise<Buffer>;

  export default htmlToDocx;
}
