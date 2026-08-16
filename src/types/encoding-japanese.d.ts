declare module 'encoding-japanese' {
  export type EncodingType =
    | 'UTF32'
    | 'UTF16'
    | 'UTF16BE'
    | 'UTF16LE'
    | 'BINARY'
    | 'ASCII'
    | 'JIS'
    | 'UTF8'
    | 'EUCJP'
    | 'SJIS'
    | 'UNICODE'
    | 'AUTO';

  export function detect(data: Uint8Array | number[] | string): EncodingType | false;

  export function convert(
    data: Uint8Array | number[] | string,
    options: {
      to: EncodingType;
      from?: EncodingType | false;
      type?: 'string' | 'arraybuffer' | 'array';
    }
  ): number[];

  export function codeToString(data: number[] | Uint8Array): string;
  export function stringToCode(str: string): number[];
}
