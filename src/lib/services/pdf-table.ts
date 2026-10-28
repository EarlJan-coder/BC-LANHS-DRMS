import { rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import { BRAND_RED, DARK_TEXT, LIGHT_BORDER, MUTED_TEXT } from "@/lib/services/pdf-brand";

export type TableColumn = {
  header: string;
  width: number;
  align?: "left" | "center" | "right";
};

export type TableTheme = {
  headerBackground?: ReturnType<typeof rgb>;
  headerText?: ReturnType<typeof rgb>;
  rowBackground?: ReturnType<typeof rgb>;
  altRowBackground?: ReturnType<typeof rgb>;
  border?: ReturnType<typeof rgb>;
  text?: ReturnType<typeof rgb>;
  muted?: ReturnType<typeof rgb>;
};

const DEFAULT_THEME: Required<TableTheme> = {
  headerBackground: rgb(0.957, 0.906, 0.906),
  headerText: BRAND_RED,
  rowBackground: rgb(1, 1, 1),
  altRowBackground: rgb(0.98, 0.98, 0.988),
  border: LIGHT_BORDER,
  text: DARK_TEXT,
  muted: MUTED_TEXT,
};

export const TABLE_HEADER_HEIGHT = 24;
export const TABLE_ROW_HEIGHT = 20;
const CELL_PADDING_X = 8;

/** Truncate `text` with an ellipsis so it fits within `maxWidth`. */
export function fitCellText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const value = text ?? "";
  if (font.widthOfTextAtSize(value, size) <= maxWidth) {
    return value;
  }
  let trimmed = value;
  while (trimmed.length > 1 && font.widthOfTextAtSize(`${trimmed}\u2026`, size) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}\u2026`;
}

function cellX(align: TableColumn["align"], columnX: number, width: number, textWidth: number) {
  if (align === "right") {
    return columnX + width - CELL_PADDING_X - textWidth;
  }
  if (align === "center") {
    return columnX + (width - textWidth) / 2;
  }
  return columnX + CELL_PADDING_X;
}

function drawRow(
  page: PDFPage,
  columns: TableColumn[],
  cells: string[],
  y: number,
  height: number,
  font: PDFFont,
  size: number,
  background: ReturnType<typeof rgb>,
  textColor: ReturnType<typeof rgb>,
  x: number,
  border: ReturnType<typeof rgb>,
) {
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  page.drawRectangle({ x, y, width: totalWidth, height, color: background });

  let columnX = x;
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index];
    const raw = cells[index] ?? "";
    const maxWidth = column.width - CELL_PADDING_X * 2;
    const value = fitCellText(raw, font, size, maxWidth);
    const textWidth = font.widthOfTextAtSize(value, size);
    page.drawText(value, {
      x: cellX(column.align, columnX, column.width, textWidth),
      y: y + (height - size) / 2 + 1,
      size,
      font,
      color: textColor,
    });
    columnX += column.width;
  }

  // Horizontal rule under the row.
  page.drawLine({ start: { x, y }, end: { x: x + totalWidth, y }, thickness: 0.5, color: border });
}

export type TableDrawOptions = {
  /** The page the table currently lives on (drawn into). */
  currentPage: PDFPage;
  /** Left edge of the table. */
  x: number;
  /** Y coordinate for the top edge of the header row on the current page. */
  top: number;
  /** Lowest Y a row may reach before a new page is requested. */
  bottom: number;
  columns: TableColumn[];
  rows: string[][];
  regular: PDFFont;
  bold: PDFFont;
  /** Draw the continuation page and return it with the Y to resume the table at.
   * The returned `top` is where the next row's top edge should land. */
  onNewPage: () => { page: PDFPage; top: number };
  theme?: TableTheme;
  emptyLabel?: string;
};

export type TableDrawResult = { page: PDFPage; y: number };

/** Draws a bordered table with a header row, alternating data rows, and page
 * breaks that repeat the header. Returns the final page and the Y below the
 * last drawn row. */
export function drawTable(options: TableDrawOptions): TableDrawResult {
  const theme = { ...DEFAULT_THEME, ...options.theme };
  const totalWidth = options.columns.reduce((sum, column) => sum + column.width, 0);
  let current = options.currentPage;
  let y = options.top;

  const drawHeader = (targetPage: PDFPage, headerTopY: number) => {
    const headerBottomY = headerTopY - TABLE_HEADER_HEIGHT;
    drawRow(
      targetPage,
      options.columns,
      options.columns.map((column) => column.header),
      headerBottomY,
      TABLE_HEADER_HEIGHT,
      options.bold,
      9,
      theme.headerBackground,
      theme.headerText,
      options.x,
      theme.border,
    );
    // Stronger brand rule under the header.
    targetPage.drawLine({
      start: { x: options.x, y: headerBottomY },
      end: { x: options.x + totalWidth, y: headerBottomY },
      thickness: 1,
      color: BRAND_RED,
    });
  };

  drawHeader(current, y);
  y -= TABLE_HEADER_HEIGHT;

  if (options.rows.length === 0) {
    y -= TABLE_ROW_HEIGHT;
    const label = options.emptyLabel ?? "No records for the selected period.";
    current.drawText(label, {
      x: options.x + CELL_PADDING_X,
      y: y + (TABLE_ROW_HEIGHT - 9) / 2 + 1,
      size: 9,
      font: options.regular,
      color: theme.muted,
    });
    current.drawLine({
      start: { x: options.x, y },
      end: { x: options.x + totalWidth, y },
      thickness: 0.5,
      color: theme.border,
    });
    return { page: current, y };
  }

  for (let rowIndex = 0; rowIndex < options.rows.length; rowIndex += 1) {
    if (y - TABLE_ROW_HEIGHT < options.bottom) {
      const next = options.onNewPage();
      current = next.page;
      y = next.top;
      drawHeader(current, y);
      y -= TABLE_HEADER_HEIGHT;
    }
    y -= TABLE_ROW_HEIGHT;
    const isAlt = rowIndex % 2 === 1;
    drawRow(
      current,
      options.columns,
      options.rows[rowIndex],
      y,
      TABLE_ROW_HEIGHT,
      options.regular,
      9,
      isAlt ? theme.altRowBackground : theme.rowBackground,
      theme.text,
      options.x,
      theme.border,
    );
  }

  return { page: current, y };
}
