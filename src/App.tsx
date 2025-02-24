import { ZarrReader } from "./zarr";
import ZarritaReader from "./zarr-with-zarrita";

import DeckGL from "@deck.gl/react";
import { MapViewState } from "@deck.gl/core";

import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer } from "@deck.gl/layers";
import "./App.css";

const baseUrl = window.location.href;

// test dataset
const zarrUrl = `${baseUrl}climate.zarr`;
const variable = "tmp2m";

const zarritaReader = await ZarritaReader.initialize({ zarrUrl });
await zarritaReader.fetchVariable({ variable });

const zarrReader = new ZarrReader();
await zarrReader.fetchData();

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -122.41669,
  latitude: 37.7853,
  zoom: 0,
};

function tileToLatLng({ x, y, z }) {
  // Number of tiles at this zoom level
  const n = Math.pow(2, z);

  // Convert tile x,y to longitude/latitude
  const lon = (x / n) * 360 - 180;

  // Convert y to latitude using inverse mercator projection
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = latRad * (180 / Math.PI);

  return { lon, lat };
}
// Helper function to map a single value from [minInput, maxInput] to [0, 255]
function float2DArrayToUint8ClampedArray(float2DArray) {
  const minVal = 230;
  const maxVal = 300;

  const flattenedMappedArray = [...float2DArray].map((dv) => {
    const normalized = ((dv - minVal) / (maxVal - minVal)) * 255;
    // Clamp the result to [0, 255] and round, and give it to r value
    return [Math.max(0, Math.min(255, Math.round(normalized))), 0, 0, 255];
  });

  // Create a Uint8ClampedArray from the mapped array
  return new Uint8ClampedArray(flattenedMappedArray.flat());
}

function flatFloat2DArrayToUint8ClampedArray(
  float2DArray,
  minInput = 230,
  maxInput = 300
) {
  // Helper function to map a single value from [minInput, maxInput] to [0, 255]
  const mapValue = (value) => {
    // Normalize the value within the range and map to [0, 255]
    const normalized = ((value - minInput) / (maxInput - minInput)) * 255;
    // Clamp the result to [0, 255] and round
    return [Math.max(0, Math.min(255, Math.round(normalized))), 0, 0, 255];
  };

  // Flatten the 2D array and map each value
  const flattenedMappedArray = float2DArray.flat().map(mapValue).flat();

  // Create a Uint8ClampedArray from the mapped array
  return new Uint8ClampedArray(flattenedMappedArray);
}

async function getTileData({ index, signal }) {
  if (signal.aborted) {
    console.error("Signal aborted: ", signal);
    return null;
  }

  const { x, y, z } = index;

  // const { lon: west, lat: north } = tileToLatLng({ x, y, z });
  // const { lon: east, lat: south } = tileToLatLng({ x: x + 1, y: y + 1, z });

  // const northWestBound = { lat: north, lon: west };
  // const southEastBound = { lat: south, lon: east };

  // const data = zarrReader.getDataBetweenIndices({
  //   northWest: northWestBound,
  //   southEast: southEastBound,
  // });
  // const imageData = flatFloat2DArrayToUint8ClampedArray(data);

  const dataFromZarrita = zarritaReader.getTileData({
    x,
    y,
    z,
  });

  const imageData1 = float2DArrayToUint8ClampedArray(dataFromZarrita);
  // https://deck.gl/docs/developer-guide/loading-data#load-resource-without-an-url
  return {
    imageData: imageData1,
  };
}

function App() {
  const layers = new TileLayer({
    id: "TileLayer",
    // data: 'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',

    /* props from TileLayer class */

    // TilesetClass: null,
    // debounceTime: 0,
    // extent: null,
    getTileData,
    // maxCacheByteSize: null,
    // maxCacheSize: null,
    // maxRequests: 6,
    // maxZoom: 19,
    // minZoom: 0,
    // onTileError: null,
    // onTileLoad: null,
    // onTileUnload: null,
    // onViewportLoad: null,
    // refinementStrategy: 'best-available',
    renderSubLayers: (props) => {
      const { imageData } = props.data;
      const { boundingBox } = props.tile;

      return new BitmapLayer(props, {
        data: null,
        image: { width: 128, height: 128, data: imageData },
        // images: images.length? {key: images[0] } : null,
        // colormapName: selectedColorMap,
        bounds: [
          boundingBox[0][0],
          boundingBox[0][1],
          boundingBox[1][0],
          boundingBox[1][1],
        ],
      });
    },
    tileSize: 128,
    // zRange: null,
    // zoomOffset: 0,

    /* props inherited from Layer class */

    // autoHighlight: false,
    // coordinateOrigin: [0, 0, 0],
    // coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
    // highlightColor: [0, 0, 128, 128],
    // modelMatrix: null,
    // opacity: 1,
    pickable: true,
    // visible: true,
    // wrapLongitude: false,
  });

  return (
    <>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        useDevicePixels={1.77}
        layers={layers}
      />
      {/* <div style={{position: 'absolute', top: '20px', left: '20px'}}>
        <select name="cars" id="cars" onChange={(e) => {setSelectedColorMap(e.target.value);}}>
          <option value="Blue">Blue</option>
          <option value="BrBG">BrBG</option>
      </select>
      </div> */}
    </>
  );
}

export default App;
