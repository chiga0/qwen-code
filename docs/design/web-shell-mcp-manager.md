# Web Shell MCP Manager

## Goal

Replace the nested accordion presentation opened by `/mcp` with an in-place,
settings-page-style manager while retaining the existing `McpDialog` source as
a fallback. The manager replaces the chat surface instead of opening a modal.
It must expose all daemon MCP status, server actions,
tools, resources, schemas, errors, and budget information.

## Information architecture

The manager has three views:

1. A searchable, filterable server card grid.
2. A server details page with overview, tools, and resources sections.
3. A focused tool or resource details page.

Navigation replaces content instead of expanding nested rows. Breadcrumbs and
back controls preserve hierarchy. Server actions remain available from cards
and the server details header.

## Components

Use shadcn Card, Item, Breadcrumb, Command, ScrollArea, ToggleGroup, Badge,
DropdownMenu, Alert, Empty, Skeleton, and Button components. Use Lucide icons.
Tailwind classes are limited to layout and responsive behavior, with semantic
shadcn tokens for color.

## Responsive behavior

Desktop uses a two-column server grid in the main content pane. At narrow widths
the grid becomes one column. Detail views remain a single reading column. The
existing in-place panel owns scrolling and preserves the chat draft underneath.

## Behavior

Server actions reuse the existing daemon requests and refresh the affected
server's status, tools, and resources. Search and source filters are local.
Async action results use alerts. Errors and client-budget status are visible at
the top level. Tool and resource details retain the full protocol metadata.
