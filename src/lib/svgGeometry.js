export function compactPoints(points = []) {
  return points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return point.x !== previous.x || point.y !== previous.y;
  });
}

export function pointsToPath(points = []) {
  return compactPoints(points).map((point, index) => (
    (index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y
  )).join(' ');
}

export function getLongestSegment(points = []) {
  let longest = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const first = points[index];
    const second = points[index + 1];
    const length = Math.hypot(second.x - first.x, second.y - first.y);
    if (!longest || length > longest.length) longest = { index, first, second, length };
  }
  return longest;
}

export function moveAlong(first, second, distance) {
  const length = Math.hypot(second.x - first.x, second.y - first.y);
  if (length < 1) return { ...first };
  return {
    x: first.x + ((second.x - first.x) / length) * distance,
    y: first.y + ((second.y - first.y) / length) * distance,
  };
}

export function makeEdgeGeometry(routePoints, options = {}) {
  const symbolLengthLimit = options.symbolLength || 38;
  const route = compactPoints(routePoints || []);
  const segment = getLongestSegment(route);
  if (!segment || segment.length < 1) return null;

  const symbolLength = Math.min(symbolLengthLimit, segment.length * 0.58);
  const center = moveAlong(segment.first, segment.second, segment.length / 2);
  const symbolStart = moveAlong(segment.first, segment.second, segment.length / 2 - symbolLength / 2);
  const symbolEnd = moveAlong(segment.first, segment.second, segment.length / 2 + symbolLength / 2);
  const firstPathPoints = compactPoints(route.slice(0, segment.index + 1).concat(symbolStart));
  const secondPathPoints = compactPoints([symbolEnd].concat(route.slice(segment.index + 1)));
  const segmentDx = (segment.second.x - segment.first.x) / segment.length;
  const segmentDy = (segment.second.y - segment.first.y) / segment.length;
  let perpX = -segmentDy;
  let perpY = segmentDx;
  if (perpY > 0) {
    perpX *= -1;
    perpY *= -1;
  }

  const labelGap = Math.max(20, Math.min(28, segment.length * 0.14));
  const labelCenterX = center.x + perpX * (labelGap + 5);
  const labelCenterY = center.y + perpY * (labelGap + 5);
  return {
    angle: Math.atan2(segmentDy, segmentDx) * (180 / Math.PI),
    centerX: center.x,
    centerY: center.y,
    symbolScale: symbolLength / (options.symbolBaseLength || symbolLengthLimit),
    visibleFirstPath: pointsToPath(firstPathPoints),
    visibleSecondPath: pointsToPath(secondPathPoints),
    labelX: labelCenterX,
    labelY: labelCenterY - 6,
    valueX: labelCenterX,
    valueY: labelCenterY + 7,
    labelPlateX: labelCenterX - 31,
    labelPlateY: labelCenterY - 15,
    hitWidth: Math.max(72, symbolLength + 30),
    hitHeight: Math.max(44, Math.min(58, symbolLength + 18)),
  };
}
