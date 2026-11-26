"use client";
import { getLocalizedName } from "@/lib/localized-name";

import { useEffect, useState } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";

import {
  getCustomers,
  getProducts,
  type Customer,
  type Product,
} from "@/lib/masters";

import {
  getProductStock,
  saveSalesOrder,
  calculateOrderTotals,
  type ProductStock,
  type OrderDetails,
} from "@/lib/sales";

import { formatCurrency, formatNumber } from "@/lib/format";
import { useLanguage } from "@/contexts/language-context";

import { Button } from "@/components/ui/button";

import { MasterDialog } from "@/components/masters/master-dialog";

import {
  MasterField,
  MasterSelect,
} from "@/components/masters/master-form-fields";

type OrderRow = {
  key: number;
  productId: string;
  quantity: string;
  unit: "packet" | "carton";
};

export function OrderForm({
  record,
  onSuccess,
  onCancel,
}: {
  record: OrderDetails | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { t, language } = useLanguage();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<ProductStock[]>([]);

  const [customerId, setCustomerId] = useState(
    String(record?.customer_id ?? "")
  );

  const [rows, setRows] = useState<OrderRow[]>(
    record?.sales_order_items.length
      ? record.sales_order_items.map((item, index) => ({
          key: index + 1,
          productId: String(item.product_id),
          quantity: String(item.quantity),
          unit: "packet",
        }))
      : [
          {
            key: 1,
            productId: "",
            quantity: "",
            unit: "packet",
          },
        ]
  );

  const [nextKey, setNextKey] = useState(
    (record?.sales_order_items.length ?? 1) + 1
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [customerRows, productRows, stockRows] =
          await Promise.all([
            getCustomers(),
            getProducts(),
            getProductStock(),
          ]);

        setCustomers(customerRows);
        setProducts(productRows);
        setStock(stockRows);
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load order details."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  function addRow() {
    setRows((previous) => [
      ...previous,
      {
        key: nextKey,
        productId: "",
        quantity: "",
        unit: "packet",
      },
    ]);

    setNextKey((previous) => previous + 1);
  }

  function removeRow(key: number) {
    setRows((previous) =>
      previous.filter((row) => row.key !== key)
    );
  }

  function updateRow(
    key: number,
    changes: Partial<OrderRow>
  ) {
    setRows((previous) =>
      previous.map((row) =>
        row.key === key
          ? { ...row, ...changes }
          : row
      )
    );
  }

  function getProduct(productId: string) {
    return products.find(
      (product) => String(product.id) === productId
    );
  }

  function getPacketQuantity(row: OrderRow) {
    const quantity = Number(row.quantity);
    const product = getProduct(row.productId);

    if (
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    ) {
      return 0;
    }

    if (row.unit === "carton") {
      return quantity * (product?.packets_per_carton ?? 0);
    }

    return quantity;
  }

  const selectedCustomer = customers.find(
    (customer) => String(customer.id) === customerId
  );

  const totals = calculateOrderTotals(
    rows.map((row) => {
      const product = getProduct(row.productId);

      return {
        quantity: getPacketQuantity(row),
        unit_price: product?.selling_price ?? 0,
        gst_rate: product?.gst_rate ?? 0,
      };
    })
  );

  const totalPackets = rows.reduce(
    (sum, row) => sum + getPacketQuantity(row),
    0
  );

  async function handleSave() {
    if (loading || loadError) {
      throw new Error("Order details are not ready.");
    }

    if (!selectedCustomer?.is_active) {
      throw new Error("Select an active customer.");
    }

    if (rows.length === 0) {
      throw new Error("Add at least one product.");
    }

    const productIds = rows.map(
      (row) => row.productId
    );

    if (
      new Set(productIds).size !== productIds.length
    ) {
      throw new Error("Duplicate products are not allowed.");
    }

    const items = rows.map((row) => {
      const product = getProduct(row.productId);
      const quantity = getPacketQuantity(row);

      if (!product?.is_active) {
        throw new Error("Select an active product.");
      }

      if (
        !Number.isSafeInteger(quantity) ||
        quantity <= 0 ||
        quantity > 2147483647
      ) {
        throw new Error(
          `Enter a valid quantity for ${product.name}.`
        );
      }

      return {
        product_id: product.id,
        quantity,
      };
    });

    await saveSalesOrder({
      customerId: selectedCustomer.id,
      items,
      orderId: record?.id,
    });
  }

  return (
    <MasterDialog
      title={
        record
          ? "Edit sales order"
          : "Create sales order"
      }
      description="Select a customer and add products to the order."
      onSave={handleSave}
      onSuccess={onSuccess}
      onCancel={onCancel}
    >
      {loading ? (
        <p className="p-8 text-center text-sm text-slate-500">
          {t("Loading data...")}
        </p>
      ) : loadError ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </p>
      ) : (
        <div className="space-y-5">
          <MasterSelect
            label="Customer"
            value={customerId}
            onChange={setCustomerId}
            required
          >
            <option value="">
              {t("Select customer")}
            </option>

            {customers
              .filter(
                (customer) =>
                  customer.is_active ||
                  String(customer.id) === customerId
              )
              .map((customer) => (
                <option
                  key={customer.id}
                  value={customer.id}
                >
                  {customer.name} — {t(customer.state)}
                </option>
              ))}
          </MasterSelect>

          {selectedCustomer && (
            <div className="grid gap-3 rounded-lg border bg-slate-50 p-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">
                  {t("Customer type")}
                </p>

                <p className="font-medium capitalize">
                  {t(selectedCustomer.customer_type)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  {t("Phone")}
                </p>

                <p className="font-medium">
                  {selectedCustomer.phone || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  {t("GSTIN")}
                </p>

                <p className="font-medium">
                  {selectedCustomer.gstin || t("Unregistered")}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  {t("Tax type")}
                </p>

                <p className="font-medium">
                  {selectedCustomer.state_code === "33"
                    ? "CGST + SGST"
                    : "IGST"}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">
              {t("Order items")}
            </h3>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("Add product")}
            </Button>
          </div>

          {rows.map((row, index) => {
            const product = getProduct(row.productId);

            const productStock = stock.find(
              (item) => item.product_id === product?.id
            );

            const packets = getPacketQuantity(row);

            const available =
              productStock?.available_stock ?? 0;

            const shortage = Math.max(
              0,
              packets - available
            );

            const lineTotal = calculateOrderTotals([
              {
                quantity: packets,
                unit_price: product?.selling_price ?? 0,
                gst_rate: product?.gst_rate ?? 0,
              },
            ]);

            return (
              <div
                key={row.key}
                className="space-y-3 rounded-xl border bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {t("Item")} {index + 1}
                  </span>

                  {rows.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={t("Remove product")}
                      onClick={() => removeRow(row.key)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </div>

                <MasterSelect
                  label="Product"
                  value={row.productId}
                  onChange={(value) =>
                    updateRow(row.key, {
                      productId: value,
                      unit: "packet",
                    })
                  }
                  required
                >
                  <option value="">
                    {t("Select product")}
                  </option>

                  {products
                    .filter(
                      (item) =>
                        String(item.id) === row.productId ||
                        (item.is_active &&
                          !rows.some(
                            (other) =>
                              other.key !== row.key &&
                              other.productId === String(item.id)
                          ))
                    )
                    .map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item ? getLocalizedName(item, language) : "—"} — {item.sku}
                      </option>
                    ))}
                </MasterSelect>

                <div className="grid grid-cols-2 gap-3">
                  <MasterField
                    label="Quantity"
                    value={row.quantity}
                    onChange={(value) =>
                      updateRow(row.key, {
                        quantity: value,
                      })
                    }
                    type="number"
                    min={1}
                    step="1"
                    required
                  />

                  <MasterSelect
                    label="Unit"
                    value={row.unit}
                    onChange={(value) =>
                      updateRow(row.key, {
                        unit: value as "packet" | "carton",
                      })
                    }
                  >
                    <option value="packet">
                      {t("Packets")}
                    </option>

                    {!!product?.packets_per_carton && (
                      <option value="carton">
                        {t("Cartons")}
                      </option>
                    )}
                  </MasterSelect>
                </div>

                {product && (
                  <>
                    {row.unit === "carton" && (
                      <p className="rounded-md bg-indigo-50 p-2 text-xs text-indigo-700">
                        {row.quantity || 0} {t("cartons")}
                        {" × "}
                        {product.packets_per_carton}
                        {" = "}
                        {formatNumber(packets)} {t("packets")}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-slate-500">
                          {t("Unit price")}
                        </p>

                        <p className="font-medium">
                          {formatCurrency(product.selling_price)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          GST
                        </p>

                        <p className="font-medium">
                          {product.gst_rate}%
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          {t("Line total")}
                        </p>

                        <p className="font-semibold">
                          {formatCurrency(lineTotal.totalAmount)}
                        </p>
                      </div>
                    </div>

                    {productStock ? (
                      <div className="grid grid-cols-3 gap-2 rounded-lg border bg-white p-3">
                        <div>
                          <p className="text-xs text-slate-500">
                            {t("Physical")}
                          </p>

                          <p className="font-semibold">
                            {formatNumber(productStock.physical_stock)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            {t("Reserved")}
                          </p>

                          <p className="font-semibold text-amber-600">
                            {formatNumber(productStock.reserved_stock)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            {t("Available")}
                          </p>

                          <p className="font-semibold text-emerald-600">
                            {formatNumber(available)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700">
                        {t("Stock information unavailable.")}
                      </p>
                    )}

                    {productStock && shortage > 0 && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

                        <div>
                          <p className="font-medium">
                            {t("Insufficient stock")}
                          </p>

                          <p>
                            {t("Shortage")}:{" "}
                            {formatNumber(shortage)}{" "}
                            {t("packets")}
                          </p>

                          <p className="mt-1 text-xs">
                            {t("Order can be submitted but approval requires sufficient stock.")}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          <div className="space-y-3 rounded-xl border bg-white p-4">
            <h3 className="font-semibold">
              {t("Order summary")}
            </h3>

            <div className="flex justify-between text-sm">
              <span className="text-slate-500">
                {t("Total packets")}
              </span>

              <span className="font-medium">
                {formatNumber(totalPackets)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-500">
                {t("Taxable amount")}
              </span>

              <span>
                {formatCurrency(totals.taxableAmount)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-500">
                {t("Total GST")}
              </span>

              <span>
                {formatCurrency(totals.gstAmount)}
              </span>
            </div>

            <div className="flex justify-between border-t pt-3">
              <span className="font-semibold">
                {t("Grand total")}
              </span>

              <span className="text-xl font-bold text-indigo-700">
                {formatCurrency(totals.totalAmount)}
              </span>
            </div>

            <p className="text-xs text-slate-500">
              {t("Estimated total. Final tax amounts are calculated during invoicing.")}
            </p>
          </div>
        </div>
      )}
    </MasterDialog>
  );
}