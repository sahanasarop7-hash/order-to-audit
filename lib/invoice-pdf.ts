import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { InvoiceDetails } from "@/lib/invoices";
import { formatDate } from "@/lib/format";

function money(value: number) {
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function numberToWords(value: number): string {
  const ones = [
    "Zero", "One", "Two", "Three", "Four",
    "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen",
    "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];

  const tens = [
    "", "", "Twenty", "Thirty", "Forty",
    "Fifty", "Sixty", "Seventy", "Eighty",
    "Ninety",
  ];

  if (value < 20) return ones[value];

  if (value < 100) {
    return (
      tens[Math.floor(value / 10)] +
      (value % 10
        ? " " + ones[value % 10]
        : "")
    );
  }

  const scales = [
    { value: 10000000, name: "Crore" },
    { value: 100000, name: "Lakh" },
    { value: 1000, name: "Thousand" },
    { value: 100, name: "Hundred" },
  ];

  for (const scale of scales) {
    if (value >= scale.value) {
      const quotient = Math.floor(
        value / scale.value
      );

      const remainder = value % scale.value;

      return (
        numberToWords(quotient) +
        " " +
        scale.name +
        (remainder
          ? " " + numberToWords(remainder)
          : "")
      );
    }
  }

  return "";
}

function amountInWords(amount: number) {
  const totalPaise = Math.round(amount * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  return (
    "Rupees " +
    numberToWords(rupees) +
    (paise
      ? " and " + numberToWords(paise) + " Paise"
      : "") +
    " Only"
  );
}

export function downloadInvoicePDF(
  invoice: InvoiceDetails
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const company =
    invoice.company_snapshot &&
    typeof invoice.company_snapshot === "object" &&
    !Array.isArray(invoice.company_snapshot)
      ? invoice.company_snapshot
      : {};

  function companyValue(key: string) {
    const value = company[key];

    return typeof value === "string" ||
      typeof value === "number"
      ? String(value)
      : "";
  }

  const companyName =
    companyValue("company_name") ||
    companyValue("name") ||
    "Company details unavailable";

  const companyAddress = [
    companyValue("address"),
    companyValue("city"),
    companyValue("state"),
    companyValue("pincode"),
  ].filter(Boolean).join(", ");

  const companyGSTIN = companyValue("gstin");

  // Header

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(67, 56, 202);

  const companyNameLines = doc.splitTextToSize(
    companyName,
    115
  );

  doc.text(companyNameLines, margin, 18);

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);

  doc.text("TAX INVOICE", pageWidth - margin, 18, {
    align: "right",
  });

  let y = 18 + companyNameLines.length * 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const addressLines = doc.splitTextToSize(
    companyAddress || "Address not configured",
    contentWidth
  );

  doc.text(addressLines, margin, y);
  y += addressLines.length * 4.5;

  doc.text(
    `GSTIN: ${companyGSTIN || "Not configured"}`,
    margin,
    y
  );

  y += 5;

  const contact = [
    companyValue("phone"),
    companyValue("email"),
  ].filter(Boolean).join(" | ");

  if (contact) {
    const contactLines = doc.splitTextToSize(
      contact,
      contentWidth
    );

    doc.text(contactLines, margin, y);
    y += contactLines.length * 4.5;
  }

  y += 3;

  doc.setDrawColor(67, 56, 202);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);

  y += 5;

  // Invoice metadata

  autoTable(doc, {
    startY: y,
    theme: "grid",
    margin: { left: margin, right: margin },
    body: [
      [
        "Invoice number",
        invoice.invoice_number,
        "Invoice date",
        formatDate(invoice.invoice_date),
      ],
      [
        "Order reference",
        invoice.sales_orders?.order_number ?? "-",
        "Due date",
        invoice.due_date
          ? formatDate(invoice.due_date)
          : "-",
      ],
      [
        "Place of supply",
        `${invoice.place_of_supply} (${invoice.state_code})`,
        "Status",
        invoice.status.toUpperCase(),
      ],
    ],
    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [248, 250, 252] },
      2: { fontStyle: "bold", fillColor: [248, 250, 252] },
    },
  });

  // Customer details

  autoTable(doc, {
    theme: "plain",
    margin: { left: margin, right: margin },
    head: [["BILL TO"]],
    body: [
      [invoice.customer_name],
      [invoice.customer_address || "-"],
      [
        `GSTIN: ${
          invoice.customer_gstin || "Unregistered"
        }`,
      ],
      [
        `Place of supply: ${
          invoice.place_of_supply
        } (${invoice.state_code})`,
      ],
    ],
    headStyles: {
      fillColor: [238, 242, 255],
      textColor: [67, 56, 202],
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 2,
    },
  });

  // Invoice items

  autoTable(doc, {
    theme: "grid",
    margin: { left: margin, right: margin },
    head: [[
      "#",
      "Product",
      "HSN",
      "Qty",
      "Rate",
      "Taxable",
      "GST %",
      "Total",
    ]],
    body: invoice.invoice_items.map(
      (item, index) => [
        index + 1,
        item.product_name,
        item.hsn_code || "-",
        item.quantity,
        money(item.unit_price),
        money(item.taxable_amount),
        `${item.gst_rate}%`,
        money(item.total_amount),
      ]
    ),
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { cellWidth: 8 },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
  });

  // GST breakdown for each product

  autoTable(doc, {
    theme: "grid",
    margin: { left: margin, right: margin },
    head: [[
      "Product",
      "Taxable value",
      "CGST",
      "SGST",
      "IGST",
    ]],
    body: invoice.invoice_items.map((item) => [
      item.product_name,
      money(item.taxable_amount),
      money(item.cgst_amount),
      money(item.sgst_amount),
      money(item.igst_amount),
    ]),
    headStyles: {
      fillColor: [238, 242, 255],
      textColor: [67, 56, 202],
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  // Invoice totals

  autoTable(doc, {
    theme: "plain",
    margin: { left: 110, right: margin },
    body: [
      ["Taxable amount", money(invoice.taxable_amount)],
      ["CGST", money(invoice.cgst_amount)],
      ["SGST", money(invoice.sgst_amount)],
      ["IGST", money(invoice.igst_amount)],
    ],
    foot: [[
      "Grand total (INR)",
      money(invoice.total_amount),
    ]],
    styles: {
      fontSize: 10,
      cellPadding: 2.5,
    },
    columnStyles: {
      1: { halign: "right" },
    },
    footStyles: {
      fillColor: [67, 56, 202],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    pageBreak: "avoid",
  });

  // Amount in words and bank details

  const notes = [
    ["Amount in words", amountInWords(invoice.total_amount)],
  ];

  const bankDetails = [
    companyValue("bank_name"),
    companyValue("bank_account_number")
      ? `A/C: ${companyValue("bank_account_number")}`
      : "",
    companyValue("bank_ifsc")
      ? `IFSC: ${companyValue("bank_ifsc")}`
      : "",
  ].filter(Boolean).join(" | ");

  if (bankDetails) {
    notes.push(["Bank details", bankDetails]);
  }

  autoTable(doc, {
    theme: "plain",
    margin: { left: margin, right: margin },
    body: notes,
    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 35 },
    },
    pageBreak: "avoid",
  });

  autoTable(doc, {
    theme: "plain",
    margin: { left: margin, right: margin },
    body: [
      [
        "Computer-generated invoice",
        "Authorised signatory",
      ],
    ],
    styles: {
      fontSize: 9,
      cellPadding: { top: 12, bottom: 4 },
    },
    columnStyles: {
      1: { halign: "right" },
    },
    pageBreak: "avoid",
  });

  // Footer on every page

  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);

    doc.text(
      "Generated by Order2Audit",
      margin,
      290
    );

    doc.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - margin,
      290,
      { align: "right" }
    );

    if (!companyGSTIN) {
      doc.setTextColor(185, 28, 28);

      doc.text(
        "DEMO INVOICE - GSTIN NOT CONFIGURED",
        pageWidth / 2,
        285,
        { align: "center" }
      );
    }

    if (invoice.status === "cancelled") {
      doc.setFontSize(28);
      doc.setTextColor(200, 40, 40);

      doc.text(
        "CANCELLED",
        pageWidth / 2,
        145,
        { align: "center", angle: 35 }
      );
    }
  }

  const filename = invoice.invoice_number.replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  );

  doc.save(`${filename}.pdf`);
}