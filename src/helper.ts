// only for sorted array
export function findBoundingIndices(val: number, array: number[]) {
  if (!array.length) return { lower: null, upper: null };
  if (val <= array[0]) return { lower: 0, upper: 0 };
  if (val >= array[array.length - 1])
    return { lower: array.length - 1, upper: array.length - 1 };

  // Binary search to find insertion point
  let left = 0;
  let right = array.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (array[mid] === val) {
      return { lower: mid, upper: mid };
    }

    if (array[mid] < val) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  // At this point, 'right' is the index of the largest value smaller than val
  // and 'left' is the index of the smallest value larger than val
  return {
    lower: right,
    upper: left,
  };
}

export function resampleArray({
  inputArray,
  inputWidth,
  inputHeight,
  targetWidth = 128,
  targetHeight = 128,
}) {
  const outputArray = new Float32Array(targetWidth * targetHeight);

  if (
    inputArray.length === 0 ||
    inputArray.length !== inputWidth * inputHeight
  ) {
    throw new Error("Invalid input array dimensions");
  }

  // Helper function to get value from 2D position in flat array
  const getValue = (row: number, col: number) => {
    return inputArray[row * inputWidth + col];
  };

  for (let i = 0; i < targetHeight; i++) {
    // const rowPosition = (i / (targetHeight - 1)) * (inputHeight - 1);
    const rowPosition =
      ((targetHeight - 1 - i) / (targetHeight - 1)) * (inputHeight - 1); // ??

    const rowLowerIndex = Math.floor(rowPosition);
    const rowUpperIndex = Math.min(Math.ceil(rowPosition), inputHeight - 1);
    const rowWeight = rowPosition - rowLowerIndex;

    for (let j = 0; j < targetWidth; j++) {
      const colPosition = (j / (targetWidth - 1)) * (inputWidth - 1);
      const colLowerIndex = Math.floor(colPosition);
      const colUpperIndex = Math.min(Math.ceil(colPosition), inputWidth - 1);
      const colWeight = colPosition - colLowerIndex;

      // Get the four surrounding points for bilinear interpolation
      const topLeft = getValue(rowLowerIndex, colLowerIndex);
      const topRight = getValue(rowLowerIndex, colUpperIndex);
      const bottomLeft = getValue(rowUpperIndex, colLowerIndex);
      const bottomRight = getValue(rowUpperIndex, colUpperIndex);

      // Bilinear interpolation formula
      const interpolatedValue =
        topLeft * (1 - rowWeight) * (1 - colWeight) +
        topRight * (1 - rowWeight) * colWeight +
        bottomLeft * rowWeight * (1 - colWeight) +
        bottomRight * rowWeight * colWeight;

      outputArray[i * targetWidth + j] = interpolatedValue;
    }
  }

  return outputArray;
}

function calculateWebMercatorDimensions(
  minZoom = 0,
  maxZoom = 20,
  tileSize = 128
) {
  const dimensions = {};

  for (let z = minZoom; z <= maxZoom; z++) {
    // Number of tiles at this zoom level in each direction
    const numTiles = Math.pow(2, z);

    // Total pixels needed
    const width = numTiles * tileSize;
    const height = numTiles * tileSize;

    dimensions[z] = {
      zoom: z,
      tilesWide: numTiles,
      tilesHigh: numTiles,
      pixelWidth: width,
      pixelHeight: height,
      totalTiles: numTiles * numTiles,
      totalPixels: width * height,
    };
  }

  return dimensions;
}

// from zoom 0 to 3
export const dims = calculateWebMercatorDimensions(0, 10);

function calculateTileIndices(
  tileX: number,
  tileY: number,
  zoom: number,
  tileSize: number
) {
  // Calculate start and end indices for this tile
  const startX = tileX * tileSize;
  const startY = tileY * tileSize;
  const endX = startX + tileSize;
  const endY = startY + tileSize;

  return { startX, startY, endX, endY };
}

export function getTileData({ downsampledArray, x, y, z, tileSize }) {
  const fullWidth = dims[z].pixelWidth; // This will be 256 * 2^zoom

  // Get indices for this tile
  const { startX, startY, endX, endY } = calculateTileIndices(
    x,
    y,
    z,
    tileSize
  );

  // Create array for tile data
  const tileData = new Float32Array(tileSize * tileSize);

  // Extract tile data from downsampled array
  for (let y = 0; y < tileSize; y++) {
    for (let x = 0; x < tileSize; x++) {
      const sourceIndex = (startY + y) * fullWidth + (startX + x);
      const targetIndex = y * tileSize + x;
      tileData[targetIndex] = downsampledArray[sourceIndex];
    }
  }

  return tileData;
}
