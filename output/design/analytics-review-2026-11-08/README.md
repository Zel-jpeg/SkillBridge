# Analytics redesign review assets

Saved 8 November 2026 for the administrator and instructor/OJT coordinator
Reports & Analytics improvement plan. Application implementation is planned in
[Analytics charts and placement map design plan](../../../knowledge/ANALYTICS_CHARTS_AND_PLACEMENT_MAP_PLAN.md).

The [9 November full-screen gallery](../analytics-preview-2026-11-09/README.md)
adds eight role-specific report/map/workspace previews. Preserve this original
set for design provenance and inspiration; use the gallery together with the
written plan for the current screen review.

## Design priority

- Use [assessment-analytics.png](assessment-analytics.png) for chart hierarchy,
  summaries, report controls and the detailed-record layout.
- Use [map-style-switch.png](map-style-switch.png) for the latest placement-map
  controls: one Heatmap / Area boundaries switch and a conditional area-level
  selector in the same panel.
- Use [placement-geography.png](placement-geography.png) for the heatmap state,
  adjacent exact-count list, missing-pin notice and shared-capacity treatment.
- Use [province-city-choropleth.png](province-city-choropleth.png) for the regional
  overview and province-to-city/municipality navigation states.

These four files preserve the full-resolution generated concepts. Counts are
synthetic and geography is illustrative. Use validated production data and
licensed/versioned real boundary geometry during implementation. Earlier images
may show Density or Count markers controls; the latest style-switch design and
the written plan settle the primary control labels and behavior.

## Inventory

| File | Origin and intended use |
| --- | --- |
| [assessment-analytics.png](assessment-analytics.png) | Full-resolution Imagegen chart/report redesign |
| [placement-geography.png](placement-geography.png) | Full-resolution Imagegen weighted density-map redesign |
| [province-city-choropleth.png](province-city-choropleth.png) | Full-resolution Imagegen province/city state comparison |
| [map-style-switch.png](map-style-switch.png) | Full-resolution Imagegen latest shared map-style control |
| [user-reference-heatmap.png](user-reference-heatmap.png) | Exact copy of the latest user-attached heatmap review screenshot |
| [user-reference-area-boundaries.png](user-reference-area-boundaries.png) | Exact copy of the latest user-attached boundary-mode review screenshot |
| [inspiration-analytics-overview.png](inspiration-analytics-overview.png) | User's first chart/dashboard inspiration screenshot |
| [inspiration-chart-styling.png](inspiration-chart-styling.png) | User's second chart styling inspiration screenshot |
| [inspiration-chart-grid.png](inspiration-chart-grid.png) | User's third chart grid/map inspiration screenshot |
| [inspiration-country-map.png](inspiration-country-map.png) | User's country-shading reference for the city/province adaptation |
| [IMAGEGEN_PROMPTS.md](IMAGEGEN_PROMPTS.md) | Original chart and placement concept prompts |
| [CHOROPLETH_PROMPT.md](CHOROPLETH_PROMPT.md) | Province/city state-comparison prompt |
| [MAP_STYLE_SWITCH_PROMPT.md](MAP_STYLE_SWITCH_PROMPT.md) | Latest shared-map control prompt |
| [ASSETS.sha256](ASSETS.sha256) | SHA-256 checksums of the saved PNG files |

The original inspiration creators are not identified in the supplied screenshots.
They are retained as user-provided review references; they are not product
assets or a claim of authorship. Use their clarity and chart hierarchy with
SkillBridge's theme, metrics and permissions.

## Review scope

Implement the chart improvements across Assessments, Skills and Placements, not
only the maps. The full distribution map belongs in Reports & Analytics →
Placements for both staff roles. A scoped link may enter it from the instructor
placement workspace. Existing OJT Partners maps continue to describe partner
locations, with their measure clearly identified.

The implementation plan contains current stack findings, backend aggregate and
address-ID proposals, the boundary-data gate, access rules, delivery phases and
verification requirements. Images guide presentation; that plan defines the
functional contract when an illustrative screenshot omits a state or limitation.
