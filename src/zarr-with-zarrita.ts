import * as zarr from "zarrita";
import { getTileData, resampleArray, dims } from "./helper";

interface ZarritaReaderProps {
  zarrUrl: string;
}

const quickCache = new Map();
export class ZarritaReader {
  private zarrUrl: string;
  private store: unknown;
  private group: unknown;
  private wholeData: zarr.Array<zarr.DataType>;

  private constructor({ zarrUrl }: ZarritaReaderProps) {
    this.zarrUrl = zarrUrl;
  }

  // Static factory method for initialization
  static async initialize({
    zarrUrl,
  }: ZarritaReaderProps): Promise<ZarritaReader> {
    const reader = new ZarritaReader({ zarrUrl });
    reader.store = await new zarr.FetchStore(zarrUrl);
    reader.group = await zarr.open.v2(reader.store, { kind: "group" });

    return reader;
  }

  async fetchVariable({ variable }: { variable: string }) {
    try {
      const dataArray = await zarr.open(this.group.resolve(variable), {
        kind: "array",
      });
      this.wholeData = await zarr.get(dataArray, [0, null, null]);
    } catch (e) {
      console.error(e);
    }
  }

  // https://zarrita.dev/packages/core.html#access-a-chunk
  // Different approach from zarr.ts - Donwsample the whole data first then get the tiles
  getTileData({ x, y, z }) {
    try {
      if (!quickCache.get(z)) {
        const targetW = dims[z].pixelWidth;
        const targetH = dims[z].pixelHeight;
        const height = this.wholeData.shape[this.wholeData.shape.length - 2];
        const width = this.wholeData.shape[this.wholeData.shape.length - 1];
        const resampledData = resampleArray({
          inputArray: this.wholeData.data,
          inputWidth: width,
          inputHeight: height,
          targetHeight: targetH,
          targetWidth: targetW,
        });
        quickCache.set(z, resampledData);
      }

      const tileData = getTileData({
        downsampledArray: quickCache.get(z), // Array already downsampled to correct zoom level size
        x,
        y,
        z,
        tileSize: 128,
      });
      return tileData;
    } catch (e) {
      console.error(e);
    }
  }
}

export default ZarritaReader;
