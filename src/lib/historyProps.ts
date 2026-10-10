/**
 * Single source of truth for every custom property that must round-trip
 * through history (save → restore). Both `getFilteredCanvasJSON` and
 * `updateObjectProperties` in historyManager consume this list.
 *
 * When you add a new tool that hangs props on a Fabric object (group,
 * path, etc.), add its prop names to the matching constant below.
 * The aggregated `HISTORY_CUSTOM_PROPS` is what historyManager imports.
 */

export const BEZIER_PROPS = [
  'bezierPoints', 'worldBezierPoints', 'isBezierPath',
  'bezierPointsAreLocal', 'isEditMode', 'selectedAnchorId', 'isClosed',
] as const;

export const STRAIGHT_LINE_PROPS = [
  'isStraightLine', 'straightLineStart', 'straightLineEnd',
  'straightLineControlPoint', 'straightLineVersion',
] as const;

export const CURVED_LINE_PROPS = [
  'isCurvedLine', 'curvedLineStart', 'curvedLineEnd', 'curvedLineControlPoint',
  'curvedLocalStart', 'curvedLocalEnd', 'curvedLocalControl', 'curvedLineVersion',
] as const;

export const ORTHOGONAL_LINE_PROPS = [
  'isOrthogonalLine', 'orthogonalLineWaypoints',
  'orthogonalLineLocalWaypoints', 'orthogonalLineLocalPoints', 'cornerStyle',
] as const;

export const ENDPOINT_MARKER_PROPS = [
  'startMarkerType', 'endMarkerType', 'markerOptions',
  'mainPath',
  'isEndpointMarker', 'lineId',
] as const;

export const IMAGE_MASK_PROPS = [
  'isMaskedImage', 'maskShape', 'isEditingImage', 'cornerRadius',
] as const;

export const CONNECTOR_PROPS = [
  'isConnector', 'connectorData', 'startConnection', 'endConnection',
] as const;

export const MEMBRANE_PROPS = [
  'isMembraneShape', 'membraneOptions', 'isMembrane', 'isRasterizedMembrane',
  'originalScaleX', 'originalScaleY', 'vectorObjects',
  'isMembraneIcon',
] as const;

export const TRIPLE_MEMBRANE_PROPS = [
  'isTripleMembrane', 'tripleMembraneOptions',
] as const;

export const DNA_HELIX_PROPS = [
  'isDNAHelix', 'dnaHelixOptions', 'isRasterizedHelix',
] as const;

export const LEADER_LINE_PROPS = [
  'leaderLocalStart', 'leaderLocalEnd',
  'labelOffsetX', 'labelOffsetY',
  'leaderLineStart', 'leaderLineEnd',
] as const;

export const NUMBERED_CALLOUT_PROPS = [
  'calloutNumber', 'calloutId', 'calloutLabel',
  'isLegend', 'legendHidden', 'isLegendLabel',
] as const;

export const TABLE_PROPS = [
  'tableConfig', 'isTableCell', 'cellRow', 'cellCol',
] as const;

export const ASSET_PROPS = [
  'assetId', 'isUserAsset',
] as const;

export const ICON_PROPS = [
  'iconId', 'isLibraryIcon', 'originalType', 'isIconReference', 'isUserGroup',
] as const;

export const CHART_PROPS = [
  'chartConfig',
] as const;

export const CROP_PROPS = [
  'cropConfig',
] as const;

export const GRID_RULER_PROPS = [
  'isGridLine', 'isRuler',
] as const;

export const PATHFINDING_PROPS = [
  'autoPathfindingEnabled', 'manualPathOverride',
] as const;

export const GRADIENT_PROPS = [
  'gradientConfig', 'gradientOriginalStroke',
] as const;

export const GENERAL_PROPS = [
  'id', 'name', 'data', 'excludeFromExport', 'customProp', 'customType',
] as const;

/**
 * Properties that affect composite/nested structure and must trigger a
 * recreate from JSON when they differ from the live object — `updateObjectProperties`
 * cannot rebuild Fabric bounds for these via plain assignment.
 */
export const STRUCTURE_PROPS = ['objects', 'path', 'points'] as const;

export const HISTORY_CUSTOM_PROPS: readonly string[] = [
  ...BEZIER_PROPS,
  ...STRAIGHT_LINE_PROPS,
  ...CURVED_LINE_PROPS,
  ...ORTHOGONAL_LINE_PROPS,
  ...ENDPOINT_MARKER_PROPS,
  ...IMAGE_MASK_PROPS,
  ...CONNECTOR_PROPS,
  ...MEMBRANE_PROPS,
  ...TRIPLE_MEMBRANE_PROPS,
  ...DNA_HELIX_PROPS,
  ...LEADER_LINE_PROPS,
  ...NUMBERED_CALLOUT_PROPS,
  ...TABLE_PROPS,
  ...ASSET_PROPS,
  ...ICON_PROPS,
  ...CHART_PROPS,
  ...CROP_PROPS,
  ...GRID_RULER_PROPS,
  ...PATHFINDING_PROPS,
  ...GRADIENT_PROPS,
  ...GENERAL_PROPS,
];
