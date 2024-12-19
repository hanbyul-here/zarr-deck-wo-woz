import { slice, openArray, HTTPStore } from "zarr";

export class ZarrReader {
  constructor() {}

  // https://github.com/gzuidhof/zarr.js/issues/153
  async fetchData() {
    const store = new HTTPStore(`http://localhost:5173/climate.zarr`);

    const lats_promise = openArray({ store, path: "latitude", mode: "r" }); // This is an HTTP HEAD call
    const lons_promise = openArray({ store, path: "longitude", mode: "r" });
    const time_promise = openArray({ store, path: "time", mode: "r" });
    const data_promise = openArray({ store, path: "tmp2m", mode: "r" });

    const [latsArrayItem, lonsArrayItem, timeArrayItem, dataArrayItem] =
      await Promise.all([
        lats_promise,
        lons_promise,
        time_promise,
        data_promise,
      ]); // Waiting for these to resolve initiates and waits for the HTTP GET requests to resolve

    const [latsRawArray, lonsRawArray, timeRawArray, dataRawArray] =
      await Promise.all([
        latsArrayItem.getRaw(),
        lonsArrayItem.getRaw(),
        timeArrayItem.getRaw(),
        dataArrayItem.get(0),
      ]);

    this.lats = latsRawArray.data;
    this.lons = lonsRawArray.data.map((e) => e - 180); // Original data range was 0 - 360
    this.data = dataRawArray.data;
  }

  findCloseValueAndIndex(val, array) {
    let closestValue = null;
    let closestIndex = null;

    for (let i = 0; i < array.length; i++) {
      if (array[i] <= val) {
        // Update if it's the first valid match or if array[i] is greater than the current closestValue
        if (closestValue === null || array[i] > closestValue) {
          closestValue = array[i];
          closestIndex = i;
        } else break;
      }
    }

    return { value: closestValue, index: closestIndex };
  }

  getCloseData({ lat, lon }) {
    const { index: latIndex } = this.findCloseValueAndIndex(lat, this.lats);
    const { index: lonIndex } = this.findCloseValueAndIndex(lon, this.lons);
    return {
      latIndex,
      lonIndex,
    };
  }

  resample2DArray({ inputArray, targetRows = 128, targetCols = 128 }) {
    const inputRows = inputArray.length;
    const inputCols = inputArray[0].length;
    const outputArray = [];

    if (inputRows === 0 || inputCols === 0) {
      throw new Error("Input array must have at least one row and one column.");
    }

    for (let i = 0; i < targetRows; i++) {
      const rowPosition = (i / (targetRows - 1)) * (inputRows - 1);
      const rowLowerIndex = Math.floor(rowPosition);
      const rowUpperIndex = Math.ceil(rowPosition);
      const rowWeight = rowPosition - rowLowerIndex;

      const newRow = [];

      for (let j = 0; j < targetCols; j++) {
        const colPosition = (j / (targetCols - 1)) * (inputCols - 1);
        const colLowerIndex = Math.floor(colPosition);
        const colUpperIndex = Math.ceil(colPosition);
        const colWeight = colPosition - colLowerIndex;

        // Get the four surrounding points for bilinear interpolation
        const topLeft = inputArray[rowLowerIndex][colLowerIndex];
        const topRight = inputArray[rowLowerIndex][colUpperIndex];
        const bottomLeft = inputArray[rowUpperIndex][colLowerIndex];
        const bottomRight = inputArray[rowUpperIndex][colUpperIndex];

        // Bilinear interpolation formula
        const interpolatedValue =
          topLeft * (1 - rowWeight) * (1 - colWeight) +
          topRight * (1 - rowWeight) * colWeight +
          bottomLeft * rowWeight * (1 - colWeight) +
          bottomRight * rowWeight * colWeight;

        newRow.push(interpolatedValue);
      }
      outputArray.push(newRow);
    }

    return outputArray;
  }

  slice2DArray({ array, rowStart, rowEnd, colStart, colEnd }) {
    // Adjust indices if rowStart is greater than rowEnd
    const startRow = Math.min(rowStart, rowEnd);
    const endRow = Math.max(rowStart, rowEnd);
    const startCol = Math.min(colStart, colEnd);
    const endCol = Math.max(colStart, colEnd);

    // Slice the rows between startRow and endRow (exclusive of endRow)
    const slicedRows = array.slice(startRow, endRow);

    // For each row, slice the columns between startCol and endCol (exclusive of endCol)
    let slicedArray = slicedRows.map((row) => row.slice(startCol, endCol));

    // Reverse rows if rowStart is greater than rowEnd
    if (rowStart > rowEnd) {
      slicedArray.reverse();
    }

    // Reverse columns if colStart is greater than colEnd
    if (colStart > colEnd) {
      slicedArray = slicedArray.map((row) => row.reverse());
    }

    return slicedArray;
  }

  getDataBetweenIndices({ northWest, southEast }) {
    const dataIndexForNW = this.getCloseData({
      lat: northWest.lat,
      lon: northWest.lon,
    });
    const dataIndexForSE = this.getCloseData({
      lat: southEast.lat,
      lon: southEast.lon,
    });

    const { lonIndex: lonIndexNW, latIndex: latIndexNW } = dataIndexForNW;
    const { lonIndex: lonIndexSE, latIndex: latIndexSE } = dataIndexForSE;

    const dataBetween = this.slice2DArray({
      array: this.data,
      rowStart: latIndexNW,
      rowEnd: latIndexSE,
      colStart: lonIndexNW,
      colEnd: lonIndexSE,
    });

    const resampledData = this.resample2DArray({ inputArray: dataBetween });

    return resampledData;
  }
}
