
import zarr from "zarr-js";
import type { Loader, Metadata, ChunkTuple, Data } from "zarr-js";


const getPyramidMetadata = (multiscales: Multiscale[]) => {
  const datasets = multiscales[0]?.datasets;
  if (!datasets) {
    throw new Error("No `multiscales` or `datasets` in zarr metadata");
  }
  const levels = datasets.map((dataset) => Number(dataset.path));
  const maxZoom = Math.max(...levels);
  const tileSize = datasets[0]?.pixels_per_tile;
  const crs = datasets[0]?.crs ?? "EPSG:3857";
  if (!tileSize) {
    throw new Error("No `pixels_per_tile` value in `multiscales` metadata.");
  }
  return { levels, maxZoom, tileSize, crs };
};

// only v2
export async function loadZarr(source, variable) {
  const [loaders, metadata] = await new Promise<[Record<string, Loader>, Metadata]>((resolve, reject) => {
    zarr(window.fetch, "v2").openGroup(
      source,
      (err: Error, l: Record<string, Loader>, m: Metadata) => {
        if (err) {
          reject(err); 
        } else {
          resolve([l, m]); 
        }
      },
    );
  });

  const zattrs = metadata.metadata[".zattrs"];
  if (!zattrs) {
    throw new Error(`Failed to load .zattrs for ${source}`);
  }
  const multiscales = zattrs.multiscales;
  const datasets = multiscales[0]?.datasets;
  if (!datasets) {
    throw new Error(`Failed to load .zattrs for ${source}`);
  }
  const { levels, maxZoom, tileSize, crs } = getPyramidMetadata(multiscales);
  const zarrayPath = `${levels[0]}/${variable}/.zarray`;
  const zarray = metadata.metadata[zarrayPath];
  if (!zarray) {
    throw new Error(`Failed to load .zarray for ${source} and ${zarrayPath}`);
  }
  const shape = zarray.shape;
  const chunks = zarray.chunks;
  const fillValue = zarray.fill_value;

  return {
    loaders,
    levels,
    maxZoom,
    tileSize,
    crs,
    shape,
    chunks,
    fillValue,
  };
}



export class Tile {
  chunk: ChunkTuple;
  loader: Loader;
  data: Float32Array | null = null;

  loading: boolean = false;

  constructor({ chunk, loader }) {
    this.chunk = chunk;
    this.loader = loader;
  }

  async fetchData(): Promise<Float32Array> {
    if (this.data) {
      return this.data;
    } else if (this.loading) {
      // This is probably a bad idea... 
      return this.fetchData();
    }
    return await new Promise<Float32Array>((resolve) => {
      this.loading = true;
      this.loader(this.chunk, (_: Error, data: Data) => {
        this.loading = false;
        console.log('tile data')
        console.log(data);
        this.data = data.data;
        resolve(this.data);
      });
    });
  }
}
