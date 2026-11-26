
import {
  reportColumnLabel,
  type ReportRow,
} from "@/lib/reports";

export type ReportExportInput = {
  title: string;
  period: string;
  filename: string;
  columns: string[];
  rows: ReportRow[];
};

function downloadBlob(
  blob: Blob,
  filename: string
) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// Protect text cells from spreadsheet formula injection.

function csvCell(value: unknown): string {
  if (value == null) return '""';

  let text = String(value);

  if (
    typeof value === "string" &&
    /^[\s]*[=+\-@]/.test(text)
  ) {
    text = "'" + text;
  }

  return '"' + text.replaceAll('"', '""') + '"';
}

export function exportReportCSV(
  input: ReportExportInput
) {
  const headers = input.columns
    .map(reportColumnLabel)
    .map(csvCell)
    .join(",");

  const records = input.rows.map((row) =>
    input.columns
      .map((column) => csvCell(row[column]))
      .join(",")
  );

  const csv = [
    headers,
    ...records,
  ].join("\r\n");

  // UTF-8 BOM improves compatibility with Excel.

  const blob = new Blob(
    ["\uFEFF", csv],
    {
      type: "text/csv;charset=utf-8;",
    }
  );

  downloadBlob(
    blob,
    `${input.filename}.csv`
  );
}

// Native Excel workbook with numeric cells.

export async function exportReportExcel(
  input: ReportExportInput
) {
  const ExcelJS = await import("exceljs");

  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Order2Audit";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(
    "Report",
    {
      views: [
        {
          state: "frozen",
          ySplit: 4,
        },
      ],
    }
  );

  const columnCount = input.columns.length;

  if (columnCount === 0) {
    throw new Error(
      "No report columns available."
    );
  }

  sheet.mergeCells(
    1,
    1,
    1,
    columnCount
  );

  const titleCell = sheet.getCell("A1");

  titleCell.value = input.title;

  titleCell.font = {
    bold: true,
    size: 18,
    color: {
      argb: "FFFFFFFF",
    },
  };

  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: "FF0F172A",
    },
  };

  sheet.getRow(1).height = 32;

  sheet.mergeCells(
    2,
    1,
    2,
    columnCount
  );

  sheet.getCell("A2").value = input.period;

  sheet.getCell("A2").font = {
    italic: true,
    color: {
      argb: "FF64748B",
    },
  };

  sheet.getCell("A3").value =
    `Records: ${input.rows.length}`;

  const headerRow = sheet.getRow(4);

  headerRow.values = input.columns.map(
    reportColumnLabel
  );

  headerRow.height = 28;

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: {
        argb: "FFFFFFFF",
      },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FF4F46E5",
      },
    };

    cell.alignment = {
      vertical: "middle",
      wrapText: true,
    };
  });

  input.rows.forEach((record, index) => {
    const row = sheet.addRow(
      input.columns.map(
        (column) => record[column] ?? ""
      )
    );

    row.eachCell((cell) => {
      cell.alignment = {
        vertical: "middle",
      };

      if (typeof cell.value === "number") {
        cell.numFmt = "#,##0.######";
      }

      if (index % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FFF8FAFC",
          },
        };
      }
    });
  });

  // Calculate practical column widths.

  input.columns.forEach((key, index) => {
    const heading = reportColumnLabel(key);

    const maxLength = input.rows.reduce(
      (length, row) =>
        Math.max(
          length,
          String(row[key] ?? "").length
        ),
      heading.length
    );

    sheet.getColumn(index + 1).width =
      Math.min(
        45,
        Math.max(14, maxLength + 3)
      );
  });

  sheet.autoFilter = {
    from: {
      row: 4,
      column: 1,
    },
    to: {
      row: Math.max(
        4,
        input.rows.length + 4
      ),
      column: columnCount,
    },
  };

  const buffer =
    await workbook.xlsx.writeBuffer();

  const bytes = new Uint8Array(buffer);

  const blob = new Blob(
    [bytes],
    {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
  );

  downloadBlob(
    blob,
    `${input.filename}.xlsx`
  );
}

// Landscape PDF with horizontal page splitting
// for reports containing many columns.

export async function exportReportPDF(
  input: ReportExportInput
) {
  const { jsPDF } = await import("jspdf");

  const { default: autoTable } =
    await import("jspdf-autotable");

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  autoTable(doc, {
    startY: 32,

    head: [
      input.columns.map(reportColumnLabel),
    ],

    body: input.rows.map((row) =>
      input.columns.map((column) => {
        const value = row[column];

        if (value == null) return "-";

        return String(value);
      })
    ),

    theme: "striped",

    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "middle",
    },

    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },

    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },

    margin: {
      top: 32,
      right: 10,
      bottom: 16,
      left: 10,
    },

    horizontalPageBreak: true,

    horizontalPageBreakRepeat: 0,

    showHead: "everyPage",

    didDrawPage: () => {
      doc.setFontSize(9);
      doc.setTextColor(100);

      doc.text(
        "Order2Audit | Manufacturing ERP",
        10,
        10
      );

      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);

      doc.text(input.title, 10, 18);

      doc.setFontSize(9);
      doc.setTextColor(80);

      doc.text(input.period, 10, 25);
    },
  });

  const pageCount =
    doc.getNumberOfPages();

  for (
    let page = 1;
    page <= pageCount;
    page++
  ) {
    doc.setPage(page);

    const width =
      doc.internal.pageSize.getWidth();

    const height =
      doc.internal.pageSize.getHeight();

    doc.setFontSize(8);
    doc.setTextColor(100);

    doc.text(
      `Records: ${input.rows.length}`,
      10,
      height - 7
    );

    doc.text(
      `Page ${page} of ${pageCount}`,
      width - 10,
      height - 7,
      {
        align: "right",
      }
    );
  }

  doc.save(`${input.filename}.pdf`);
}
