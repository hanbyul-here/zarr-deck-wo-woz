import * as zarr from "zarrita";
import { findBoundingIndices, resampleArray } from "./helper";

interface ZarritaReaderProps {
  zarrUrl: string;
}

export class ZarritaReader {
  private zarrUrl: string;
  private store: unknown;
  private group: unknown;
  private lats: Float32Array<ArrayBufferLike>;
  private lons: Float32Array<ArrayBufferLike>;
  private dataArray: zarr.Array<zarr.DataType>;

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

    const latArray = await zarr.open(reader.group.resolve("latitude"), {
      kind: "array",
    });

    const lats = await zarr.get(
      latArray,
      latArray.shape.map((_e) => null)
    );
    reader.lats = lats.data;
    const lonArray = await zarr.open(reader.group.resolve("longitude"), {
      kind: "array",
    });
    const lons = await zarr.get(
      lonArray,
      lonArray.shape.map((_e) => null)
    );
    reader.lons = lons.data.map((e) => e - 180);
    return reader;
  }

  async fetchVariable({ variable }: { variable: string }) {
    try {
      this.dataArray = await zarr.open(this.group.resolve(variable), {
        kind: "array",
      });
    } catch (e) {
      console.error(e);
    }
  }

  // TODO: https://zarrita.dev/packages/core.html#access-a-chunk
  async getTileData({ northWest, southEast }) {
    const nwLat = findBoundingIndices(northWest.lat, this.lats);
    const nwLon = findBoundingIndices(northWest.lon, this.lons);

    const seLat = findBoundingIndices(southEast.lat, this.lats);
    const seLon = findBoundingIndices(southEast.lon, this.lons);

    try {
      const data = await zarr.get(this.dataArray, [
        0,
        zarr.slice(seLat.lower, nwLat.lower),
        zarr.slice(nwLon.lower, seLon.lower),
      ]);
      console.log(data.shape);
      const height = data.shape[data.shape.length - 2];
      const width = data.shape[data.shape.length - 1];
      const resampledData = resampleArray({
        inputArray: data.data,
        inputWidth: width,
        inputHeight: height,
        targetHeight: 128,
        targetWidth: 128,
      });
      return resampledData;
    } catch (e) {
      console.error(e);
    }

    // return data;
  }
}

export default ZarritaReader;
