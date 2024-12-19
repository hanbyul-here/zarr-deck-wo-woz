import { ZarrReader } from "./zarr";

import DeckGL from "@deck.gl/react";
import { MapViewState } from "@deck.gl/core";

import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer } from "@deck.gl/layers";
import "./App.css";

const zarrReader = new ZarrReader();
await zarrReader.fetchData();
const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -122.41669,
  latitude: 37.7853,
  zoom: 3,
};

function tileToLatLng({ x, y, z }) {
  const lon_deg = ((x * 360) / Math.pow(2, z) - 180).toFixed(5);
  const lat_deg = (
    (360 / Math.PI) *
      Math.atan(
        Math.pow(Math.E, Math.PI - (2 * Math.PI * y) / Math.pow(2, z))
      ) -
    90
  ).toFixed(5);

  return {
    lat: parseFloat(lat_deg),
    lon: parseFloat(lon_deg),
  };
}

function float2DArrayToUint8ClampedArray(
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
  const { x, y, z } = index;
  const { lon: west, lat: north } = tileToLatLng({ x, y, z });
  const { lon: east, lat: south } = tileToLatLng({ x: x + 1, y: y + 1, z });

  if (signal.aborted) {
    console.error("Signal aborted: ", signal);
    return null;
  }
  const northWestBound = { lat: north, lon: west };
  const southEastBound = { lat: south, lon: east };

  const data = zarrReader.getDataBetweenIndices({
    northWest: northWestBound,
    southEast: southEastBound,
  });
  // https://deck.gl/docs/developer-guide/loading-data#load-resource-without-an-url
  const imageData = float2DArrayToUint8ClampedArray(data);

  return {
    imageData,
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
