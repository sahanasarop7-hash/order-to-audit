


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."approve_order"("p_order_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_status TEXT;
    v_item RECORD;
    v_available NUMERIC;
BEGIN
    -- Lock the order.
    SELECT status INTO v_status
    FROM sales_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_status <> 'pending' THEN
        RAISE EXCEPTION 'Only pending orders can be approved';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM sales_order_items
        WHERE order_id = p_order_id
    ) THEN
        RAISE EXCEPTION 'Order has no products';
    END IF;

    -- Check stock for each ordered product.
    FOR v_item IN
        SELECT product_id, quantity
        FROM sales_order_items
        WHERE order_id = p_order_id
        ORDER BY product_id
    LOOP
        -- Prevent simultaneous approval for the same product.
        PERFORM 1
        FROM products
        WHERE id = v_item.product_id
        FOR UPDATE;

        SELECT available_stock INTO v_available
        FROM product_stock
        WHERE product_id = v_item.product_id;

        IF v_available < v_item.quantity THEN
            RAISE EXCEPTION
                'Insufficient stock. Available: %, Required: %, Shortage: %',
                v_available,
                v_item.quantity,
                v_item.quantity - v_available;
        END IF;
    END LOOP;

    -- Approving the order reserves its stock.
    UPDATE sales_orders
    SET status = 'approved'
    WHERE id = p_order_id;
END;
$$;


ALTER FUNCTION "public"."approve_order"("p_order_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capture_invoice_company"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_company company_settings%ROWTYPE;
BEGIN
    SELECT *
    INTO v_company
    FROM company_settings
    WHERE id = 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Company settings are not configured';
    END IF;

    NEW.company_snapshot :=
        TO_JSONB(v_company)
        - 'id'
        - 'updated_at';

    NEW.due_date :=
        NEW.invoice_date
        + v_company.payment_terms_days;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."capture_invoice_company"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convert_quantity"("p_quantity" numeric, "p_from_unit" "text", "p_to_unit" "text", "p_packets_per_carton" integer DEFAULT NULL::integer) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    v_result NUMERIC;
BEGIN
    IF p_quantity IS NULL
       OR p_quantity::TEXT IN (
           'NaN', 'Infinity', '-Infinity'
       )
       OR p_quantity < 0 THEN
        RAISE EXCEPTION 'Invalid quantity';
    END IF;

    IF p_from_unit IS NULL
       OR p_to_unit IS NULL
       OR p_from_unit NOT IN (
           'kg', 'g', 'litre', 'ml',
           'piece', 'packet', 'carton'
       )
       OR p_to_unit NOT IN (
           'kg', 'g', 'litre', 'ml',
           'piece', 'packet', 'carton'
       ) THEN
        RAISE EXCEPTION 'Invalid unit';
    END IF;

    IF p_from_unit IN ('piece', 'packet', 'carton')
       AND p_quantity <> TRUNC(p_quantity) THEN
        RAISE EXCEPTION
            'Quantity must be a whole number';
    END IF;

    IF p_from_unit = p_to_unit THEN
        v_result := p_quantity;

    ELSIF p_from_unit = 'g'
          AND p_to_unit = 'kg' THEN
        v_result := p_quantity / 1000;

    ELSIF p_from_unit = 'kg'
          AND p_to_unit = 'g' THEN
        v_result := p_quantity * 1000;

    ELSIF p_from_unit = 'ml'
          AND p_to_unit = 'litre' THEN
        v_result := p_quantity / 1000;

    ELSIF p_from_unit = 'litre'
          AND p_to_unit = 'ml' THEN
        v_result := p_quantity * 1000;

    ELSIF p_from_unit = 'carton'
          AND p_to_unit = 'packet' THEN

        IF p_packets_per_carton IS NULL
           OR p_packets_per_carton <= 0 THEN
            RAISE EXCEPTION
                'Carton capacity is not configured';
        END IF;

        v_result :=
            p_quantity * p_packets_per_carton;

    ELSE
        RAISE EXCEPTION
            'Unsupported conversion: % to %',
            p_from_unit,
            p_to_unit;
    END IF;

    IF v_result <> ROUND(v_result, 3) THEN
        RAISE EXCEPTION
            'Quantity exceeds supported precision';
    END IF;

    RETURN ROUND(v_result, 3);
END;
$$;


ALTER FUNCTION "public"."convert_quantity"("p_quantity" numeric, "p_from_unit" "text", "p_to_unit" "text", "p_packets_per_carton" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT p.role
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = TRUE;
$$;


ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."customer_sales_report"("p_start_date" "date", "p_end_date" "date") RETURNS TABLE("customer_id" bigint, "customer_name" "text", "customer_type" "text", "total_invoices" bigint, "taxable_sales" numeric, "total_gst" numeric, "total_sales" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
    SELECT
        c.id,
        c.name,
        c.customer_type,

        COUNT(i.id) AS total_invoices,

        SUM(i.taxable_amount) AS taxable_sales,

        SUM(
            i.cgst_amount
            + i.sgst_amount
            + i.igst_amount
        ) AS total_gst,

        SUM(i.total_amount) AS total_sales

    FROM invoices i

    JOIN sales_orders so
        ON i.order_id = so.id

    JOIN customers c
        ON so.customer_id = c.id

    WHERE i.status = 'issued'
      AND i.invoice_date
          BETWEEN p_start_date AND p_end_date

    GROUP BY
        c.id,
        c.name,
        c.customer_type

    ORDER BY SUM(i.total_amount) DESC;
$$;


ALTER FUNCTION "public"."customer_sales_report"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_order"("p_order_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_status TEXT;
    v_invoice_id BIGINT;
    v_dispatch_id BIGINT;
    v_item RECORD;
    v_available NUMERIC;
BEGIN
    -- Lock the order.
    SELECT status INTO v_status
    FROM sales_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_status <> 'invoiced' THEN
        RAISE EXCEPTION
            'Only invoiced orders can be dispatched';
    END IF;

    -- Find the issued invoice.
    SELECT id INTO v_invoice_id
    FROM invoices
    WHERE order_id = p_order_id
      AND status = 'issued'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Valid invoice not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM invoice_items
        WHERE invoice_id = v_invoice_id
    ) THEN
        RAISE EXCEPTION 'Invoice has no items';
    END IF;

    -- Check physical stock for each product.
    FOR v_item IN
        SELECT product_id, SUM(quantity) AS quantity
        FROM invoice_items
        WHERE invoice_id = v_invoice_id
        GROUP BY product_id
        ORDER BY product_id
    LOOP
        PERFORM 1
        FROM products
        WHERE id = v_item.product_id
        FOR UPDATE;

        SELECT COALESCE(SUM(quantity), 0)
        INTO v_available
        FROM stock_movements
        WHERE product_id = v_item.product_id;

        IF v_available < v_item.quantity THEN
            RAISE EXCEPTION
                'Insufficient physical stock for dispatch';
        END IF;
    END LOOP;

    -- Create the dispatch document.
    INSERT INTO dispatches (
        order_id,
        invoice_id
    )
    VALUES (
        p_order_id,
        v_invoice_id
    )
    RETURNING id INTO v_dispatch_id;

    -- Deduct finished goods from the stock ledger.
    INSERT INTO stock_movements (
        product_id,
        movement_type,
        quantity,
        reference_type,
        reference_id
    )
    SELECT
        product_id,
        'dispatch',
        -SUM(quantity),
        'dispatch',
        v_dispatch_id
    FROM invoice_items
    WHERE invoice_id = v_invoice_id
    GROUP BY product_id;

    -- Complete the order.
    UPDATE sales_orders
    SET status = 'dispatched'
    WHERE id = p_order_id;
END;
$$;


ALTER FUNCTION "public"."dispatch_order"("p_order_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invoice"("p_order_id" bigint) RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_order RECORD;
    v_invoice_id BIGINT;
    v_year INTEGER;
    v_financial_year TEXT;
    v_number INTEGER;
    v_invoice_number TEXT;
    v_item RECORD;
    v_taxable NUMERIC(12,2);
    v_cgst NUMERIC(12,2);
    v_sgst NUMERIC(12,2);
    v_igst NUMERIC(12,2);
BEGIN
    -- Lock and retrieve the approved order.
    SELECT
        so.status,
        c.name,
        c.address,
        c.gstin,
        c.state,
        c.state_code
    INTO v_order
    FROM sales_orders so
    JOIN customers c ON so.customer_id = c.id
    WHERE so.id = p_order_id
    FOR UPDATE OF so;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order.status <> 'approved' THEN
        RAISE EXCEPTION 'Only approved orders can be invoiced';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM sales_order_items
        WHERE order_id = p_order_id
    ) THEN
        RAISE EXCEPTION 'Order has no products';
    END IF;

    -- Determine the financial year.
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

    IF EXTRACT(MONTH FROM CURRENT_DATE) < 4 THEN
        v_year := v_year - 1;
    END IF;

    v_financial_year :=
        RIGHT(v_year::TEXT, 2) || '-' ||
        RIGHT((v_year + 1)::TEXT, 2);

    -- Generate the next invoice number safely.
    INSERT INTO invoice_counters (
        financial_year,
        last_number
    )
    VALUES (v_financial_year, 1)
    ON CONFLICT (financial_year)
    DO UPDATE SET
        last_number = invoice_counters.last_number + 1
    RETURNING last_number INTO v_number;

    v_invoice_number :=
        'INV/' || v_financial_year || '/' ||
        LPAD(v_number::TEXT,
             GREATEST(5, LENGTH(v_number::TEXT)), '0');

    -- Create the invoice header.
    INSERT INTO invoices (
        invoice_number,
        order_id,
        customer_name,
        customer_address,
        customer_gstin,
        place_of_supply,
        state_code,
        taxable_amount,
        total_amount
    )
    VALUES (
        v_invoice_number,
        p_order_id,
        v_order.name,
        v_order.address,
        v_order.gstin,
        v_order.state,
        v_order.state_code,
        0,
        0
    )
    RETURNING id INTO v_invoice_id;

    -- Calculate GST for every ordered product.
    FOR v_item IN
        SELECT
            soi.*,
            p.name,
            p.packet_size_g,
            p.hsn_code
        FROM sales_order_items soi
        JOIN products p ON soi.product_id = p.id
        WHERE soi.order_id = p_order_id
    LOOP
        v_taxable := v_item.quantity * v_item.unit_price;

        v_cgst := 0;
        v_sgst := 0;
        v_igst := 0;

        IF v_order.state_code = '33' THEN
            v_cgst := ROUND(
                v_taxable * v_item.gst_rate / 200, 2
            );

            v_sgst := v_cgst;
        ELSE
            v_igst := ROUND(
                v_taxable * v_item.gst_rate / 100, 2
            );
        END IF;

        INSERT INTO invoice_items (
            invoice_id,
            product_id,
            product_name,
            hsn_code,
            quantity,
            unit_price,
            gst_rate,
            taxable_amount,
            cgst_amount,
            sgst_amount,
            igst_amount,
            total_amount
        )
        VALUES (
            v_invoice_id,
            v_item.product_id,
            v_item.name || ' ' ||
                v_item.packet_size_g || 'g',
            v_item.hsn_code,
            v_item.quantity,
            v_item.unit_price,
            v_item.gst_rate,
            v_taxable,
            v_cgst,
            v_sgst,
            v_igst,
            v_taxable + v_cgst + v_sgst + v_igst
        );
    END LOOP;

    -- Calculate invoice totals from its line items.
    UPDATE invoices
    SET (
        taxable_amount,
        cgst_amount,
        sgst_amount,
        igst_amount,
        total_amount
    ) = (
        SELECT
            SUM(taxable_amount),
            SUM(cgst_amount),
            SUM(sgst_amount),
            SUM(igst_amount),
            SUM(total_amount)
        FROM invoice_items
        WHERE invoice_id = v_invoice_id
    )
    WHERE id = v_invoice_id;

    -- Update the order status.
    UPDATE sales_orders
    SET status = 'invoiced'
    WHERE id = p_order_id;

    RETURN v_invoice_id;
END;
$$;


ALTER FUNCTION "public"."generate_invoice"("p_order_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gst_summary_report"("p_start_date" "date", "p_end_date" "date") RETURNS TABLE("supply_type" "text", "total_invoices" bigint, "taxable_amount" numeric, "cgst_amount" numeric, "sgst_amount" numeric, "igst_amount" numeric, "total_gst" numeric, "total_amount" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
    SELECT
        g.supply_type,

        COUNT(DISTINCT g.invoice_id),

        SUM(g.taxable_amount),
        SUM(g.cgst_amount),
        SUM(g.sgst_amount),
        SUM(g.igst_amount),
        SUM(g.total_gst),
        SUM(g.total_amount)

    FROM gst_outward_supplies g

    WHERE g.invoice_date
        BETWEEN p_start_date AND p_end_date

    GROUP BY g.supply_type

    ORDER BY g.supply_type;
$$;


ALTER FUNCTION "public"."gst_summary_report"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("allowed_roles" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    SELECT COALESCE(
        public.current_user_role() = ANY(allowed_roles),
        FALSE
    );
$$;


ALTER FUNCTION "public"."has_role"("allowed_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_record_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_record_id TEXT;
    v_user_id UUID;
    v_user_name TEXT;
    v_user_role TEXT;
    v_reason TEXT;
BEGIN

    -- Identify the changed record.

    IF TG_OP = 'INSERT' THEN

        v_new_data := TO_JSONB(NEW);
        v_record_id := v_new_data ->> 'id';

    ELSIF TG_OP = 'UPDATE' THEN

        v_old_data := TO_JSONB(OLD);
        v_new_data := TO_JSONB(NEW);

        -- Ignore updates that change nothing.

        IF v_old_data = v_new_data THEN
            RETURN NEW;
        END IF;

        v_record_id := v_new_data ->> 'id';

    ELSIF TG_OP = 'DELETE' THEN

        v_old_data := TO_JSONB(OLD);
        v_record_id := v_old_data ->> 'id';

    END IF;


    -- Identify the logged-in user.

    v_user_id := auth.uid();

    SELECT full_name, role
    INTO v_user_name, v_user_role
    FROM profiles
    WHERE id = v_user_id;


    -- Read correction reason, if provided.

    v_reason := NULLIF(
        current_setting(
            'app.correction_reason',
            TRUE
        ),
        ''
    );


    -- Save audit history.

    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_by,
        changed_by_name,
        changed_by_role,
        correction_reason
    )
    VALUES (
        TG_TABLE_NAME,
        v_record_id,
        TG_OP,
        v_old_data,
        v_new_data,
        v_user_id,
        COALESCE(v_user_name, 'Database / System'),
        COALESCE(v_user_role, 'system'),
        v_reason
    );


    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;

END;
$$;


ALTER FUNCTION "public"."log_record_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_production"("p_run_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_status TEXT;
    v_product_id BIGINT;
    v_actual_output INTEGER;
    v_item RECORD;
    v_available NUMERIC;
    v_unit_cost NUMERIC;
BEGIN
    -- Lock and retrieve the production run.
    SELECT
        pr.status,
        b.product_id,
        pr.actual_output
    INTO
        v_status,
        v_product_id,
        v_actual_output
    FROM production_runs pr
    JOIN boms b ON pr.bom_id = b.id
    WHERE pr.id = p_run_id
    FOR UPDATE OF pr;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Production run not found';
    END IF;

    IF v_status <> 'draft' THEN
        RAISE EXCEPTION
            'Only draft production runs can be posted';
    END IF;

    IF v_actual_output IS NULL THEN
        RAISE EXCEPTION 'Actual output is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM production_consumption
        WHERE production_run_id = p_run_id
    ) THEN
        RAISE EXCEPTION 'No material consumption recorded';
    END IF;

    -- Process each consumed material.
    FOR v_item IN
        SELECT inventory_item_id, actual_quantity
        FROM production_consumption
        WHERE production_run_id = p_run_id
        ORDER BY inventory_item_id
    LOOP
        -- Lock the material and retrieve its average cost.
        SELECT average_unit_cost INTO v_unit_cost
        FROM inventory_items
        WHERE id = v_item.inventory_item_id
        FOR UPDATE;

        -- Check available material stock.
        SELECT COALESCE(SUM(quantity), 0)
        INTO v_available
        FROM stock_movements
        WHERE inventory_item_id = v_item.inventory_item_id;

        IF v_available < v_item.actual_quantity THEN
            RAISE EXCEPTION
                'Insufficient stock for material ID %. Available: %, Required: %',
                v_item.inventory_item_id,
                v_available,
                v_item.actual_quantity;
        END IF;

        -- Save the historical material cost.
        UPDATE production_consumption
        SET unit_cost = v_unit_cost
        WHERE production_run_id = p_run_id
          AND inventory_item_id = v_item.inventory_item_id;

        -- Deduct consumed materials.
        IF v_item.actual_quantity > 0 THEN
            INSERT INTO stock_movements (
                inventory_item_id,
                movement_type,
                quantity,
                unit_cost,
                reference_type,
                reference_id
            )
            VALUES (
                v_item.inventory_item_id,
                'production_issue',
                -v_item.actual_quantity,
                v_unit_cost,
                'production',
                p_run_id
            );
        END IF;
    END LOOP;

    -- Lock the finished product.
    PERFORM 1
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;

    -- Add good finished packets to inventory.
    IF v_actual_output > 0 THEN
        INSERT INTO stock_movements (
            product_id,
            movement_type,
            quantity,
            reference_type,
            reference_id
        )
        VALUES (
            v_product_id,
            'production_receipt',
            v_actual_output,
            'production',
            p_run_id
        );
    END IF;

    -- Mark production as posted.
    UPDATE production_runs
    SET status = 'posted'
    WHERE id = p_run_id;
END;
$$;


ALTER FUNCTION "public"."post_production"("p_run_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_purchase"("p_purchase_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_purchase RECORD;
    v_item RECORD;
    v_current_stock NUMERIC;
    v_current_cost NUMERIC;
    v_new_cost NUMERIC;
    v_today DATE;
BEGIN

    -- 1. Find and lock the purchase.

    SELECT *
    INTO v_purchase
    FROM purchases
    WHERE id = p_purchase_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase not found';
    END IF;

    IF v_purchase.status <> 'draft' THEN
        RAISE EXCEPTION
            'Only draft purchases can be posted';
    END IF;


    -- 2. Ensure purchase contains items.

    IF NOT EXISTS (
        SELECT 1
        FROM purchase_items
        WHERE purchase_id = p_purchase_id
    ) THEN
        RAISE EXCEPTION
            'Purchase contains no items';
    END IF;


    -- 3. Set current business date.

    v_today :=
        (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

    IF v_purchase.purchase_date > v_today THEN
        RAISE EXCEPTION
            'Purchase date cannot be in the future';
    END IF;


    -- 4. Lock inventory items in consistent order.

    PERFORM i.id
    FROM inventory_items i
    WHERE i.id IN (
        SELECT inventory_item_id
        FROM purchase_items
        WHERE purchase_id = p_purchase_id
    )
    ORDER BY i.id
    FOR UPDATE;


    -- 5. Process each purchase item.

    FOR v_item IN

        SELECT *
        FROM purchase_items
        WHERE purchase_id = p_purchase_id
        ORDER BY inventory_item_id

    LOOP

        -- Read existing stock.

        SELECT COALESCE(SUM(quantity), 0)
        INTO v_current_stock
        FROM stock_movements
        WHERE inventory_item_id =
            v_item.inventory_item_id;


        -- Read existing weighted average cost.

        SELECT average_unit_cost
        INTO STRICT v_current_cost
        FROM inventory_items
        WHERE id = v_item.inventory_item_id;


        IF v_current_stock < 0 THEN
            RAISE EXCEPTION
                'Invalid negative material stock';
        END IF;


        -- Save original stock and cost snapshots.

        UPDATE purchase_items
        SET stock_before_purchase = v_current_stock,
            average_cost_before_purchase = v_current_cost
        WHERE id = v_item.id;


        -- Calculate new weighted average cost.

        v_new_cost := ROUND(
            (
                v_current_stock * v_current_cost
                + v_item.quantity * v_item.unit_price
            )
            /
            (
                v_current_stock + v_item.quantity
            ),
            6
        );


        -- Update material average cost.

        UPDATE inventory_items
        SET average_unit_cost = v_new_cost
        WHERE id = v_item.inventory_item_id;


        -- Record incoming stock.

        INSERT INTO stock_movements (
            inventory_item_id,
            movement_type,
            quantity,
            reference_type,
            reference_id,
            unit_cost,
            movement_date
        )
        VALUES (
            v_item.inventory_item_id,
            'purchase',
            v_item.quantity,
            'purchase',
            p_purchase_id,
            v_item.unit_price,
            v_today
        );

    END LOOP;


    -- 6. Mark purchase as posted.

    UPDATE purchases
    SET status = 'posted'
    WHERE id = p_purchase_id;

END;
$$;


ALTER FUNCTION "public"."post_purchase"("p_purchase_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_sales_report"("p_start_date" "date", "p_end_date" "date") RETURNS TABLE("product_id" bigint, "sku" "text", "product_name" "text", "total_invoices" bigint, "quantity_sold" bigint, "taxable_sales" numeric, "total_gst" numeric, "total_sales" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
    SELECT
        p.id,
        p.sku,
        p.name || ' ' || p.packet_size_g || 'g',

        COUNT(DISTINCT i.id),

        SUM(ii.quantity),

        SUM(ii.taxable_amount),

        SUM(
            ii.cgst_amount
            + ii.sgst_amount
            + ii.igst_amount
        ),

        SUM(ii.total_amount)

    FROM invoice_items ii

    JOIN invoices i
        ON ii.invoice_id = i.id

    JOIN products p
        ON ii.product_id = p.id

    WHERE i.status = 'issued'
      AND i.invoice_date
          BETWEEN p_start_date AND p_end_date

    GROUP BY
        p.id,
        p.sku,
        p.name,
        p.packet_size_g

    ORDER BY SUM(ii.taxable_amount) DESC;
$$;


ALTER FUNCTION "public"."product_sales_report"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_inventory_unit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN

    IF NEW.unit IS DISTINCT FROM OLD.unit
       OR NEW.category IS DISTINCT FROM OLD.category THEN

        IF EXISTS (
            SELECT 1
            FROM stock_movements
            WHERE inventory_item_id = OLD.id
        )
        OR EXISTS (
            SELECT 1
            FROM bom_items
            WHERE inventory_item_id = OLD.id
        )
        OR EXISTS (
            SELECT 1
            FROM purchase_items
            WHERE inventory_item_id = OLD.id
        )
        OR EXISTS (
            SELECT 1
            FROM production_consumption
            WHERE inventory_item_id = OLD.id
        ) THEN

            RAISE EXCEPTION
                'Unit or category cannot be changed after material usage. Create a new inventory item.';

        END IF;

    END IF;

    RETURN NEW;

END;
$$;


ALTER FUNCTION "public"."protect_inventory_unit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_used_bom"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM production_runs
        WHERE bom_id = OLD.id
    ) THEN

        IF TG_OP = 'UPDATE' THEN
            IF (TO_JSONB(NEW) - 'is_active')
               = (TO_JSONB(OLD) - 'is_active') THEN
                RETURN NEW;
            END IF;
        END IF;

        RAISE EXCEPTION
            'Used BOM cannot be modified. Create a new version';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."protect_used_bom"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_used_bom_items"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_bom_id BIGINT;
BEGIN

    IF TG_OP IN ('UPDATE', 'DELETE') THEN

        SELECT id INTO v_bom_id
        FROM boms
        WHERE id = OLD.bom_id
        FOR UPDATE;

        IF EXISTS (
            SELECT 1
            FROM production_runs
            WHERE bom_id = OLD.bom_id
        ) THEN
            RAISE EXCEPTION
                'Used BOM materials cannot be modified. Create a new BOM version.';
        END IF;

    END IF;


    IF TG_OP IN ('INSERT', 'UPDATE') THEN

        SELECT id INTO v_bom_id
        FROM boms
        WHERE id = NEW.bom_id
        FOR UPDATE;

        IF EXISTS (
            SELECT 1
            FROM production_runs
            WHERE bom_id = NEW.bom_id
        ) THEN
            RAISE EXCEPTION
                'Materials cannot be added to a used BOM.';
        END IF;

    END IF;


    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;

END;
$$;


ALTER FUNCTION "public"."protect_used_bom_items"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_payment"("p_invoice_id" bigint, "p_amount" numeric, "p_method" "text", "p_reference" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_invoice_total NUMERIC;
    v_invoice_status TEXT;
    v_paid NUMERIC;
    v_outstanding NUMERIC;
BEGIN

    IF p_amount IS NULL
       OR p_amount <= 0
       OR p_amount > 9999999999.99
       OR p_amount <> ROUND(p_amount, 2) THEN
        RAISE EXCEPTION 'Invalid payment amount';
    END IF;

    IF p_method IS NULL
       OR p_method NOT IN (
           'cash', 'upi', 'bank_transfer', 'cheque'
       ) THEN
        RAISE EXCEPTION 'Invalid payment method';
    END IF;

    SELECT total_amount, status
    INTO v_invoice_total, v_invoice_status
    FROM invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice not found';
    END IF;

    IF v_invoice_status <> 'issued' THEN
        RAISE EXCEPTION 'Invoice is not active';
    END IF;

    SELECT COALESCE(SUM(amount), 0)
    INTO v_paid
    FROM payments
    WHERE invoice_id = p_invoice_id
      AND status = 'recorded';

    v_outstanding := v_invoice_total - v_paid;

    IF p_amount > v_outstanding THEN
        RAISE EXCEPTION
            'Payment exceeds outstanding amount: %',
            v_outstanding;
    END IF;

    INSERT INTO payments (
        invoice_id,
        payment_date,
        amount,
        payment_method,
        reference_number,
        status
    )
    VALUES (
        p_invoice_id,
        (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE,
        p_amount,
        p_method,
        p_reference,
        'recorded'
    );

END;
$$;


ALTER FUNCTION "public"."record_payment"("p_invoice_id" bigint, "p_amount" numeric, "p_method" "text", "p_reference" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_adjust_stock"("p_quantity" numeric, "p_reason" "text", "p_inventory_item_id" bigint DEFAULT NULL::bigint, "p_product_id" bigint DEFAULT NULL::bigint) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_current_stock NUMERIC;
    v_reserved_stock NUMERIC;
    v_unit TEXT;
    v_unit_cost NUMERIC;
    v_movement_id BIGINT;
BEGIN

    -- 1. Only Admin can adjust stock.

    IF NOT public.has_role(ARRAY['admin']) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;


    -- 2. Validate correction reason.

    IF p_reason IS NULL
       OR BTRIM(p_reason) = '' THEN
        RAISE EXCEPTION
            'Stock adjustment reason is required';
    END IF;


    -- 3. Validate adjustment quantity.

    IF p_quantity IS NULL
       OR p_quantity = 0
       OR ABS(p_quantity) > 999999999.999
       OR p_quantity <> ROUND(p_quantity, 3) THEN
        RAISE EXCEPTION
            'Invalid adjustment quantity';
    END IF;


    -- 4. Exactly one stock item must be selected.

    IF (
        p_inventory_item_id IS NULL
        AND p_product_id IS NULL
    )
    OR (
        p_inventory_item_id IS NOT NULL
        AND p_product_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'Select either an inventory item or a finished product';
    END IF;


    -- 5. Raw material or packaging adjustment.

    IF p_inventory_item_id IS NOT NULL THEN

        SELECT unit, average_unit_cost
        INTO v_unit, v_unit_cost
        FROM inventory_items
        WHERE id = p_inventory_item_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Inventory item not found';
        END IF;

        IF v_unit = 'piece'
           AND p_quantity <> TRUNC(p_quantity) THEN
            RAISE EXCEPTION
                'Piece adjustment must be a whole number';
        END IF;

        SELECT COALESCE(SUM(quantity), 0)
        INTO v_current_stock
        FROM stock_movements
        WHERE inventory_item_id = p_inventory_item_id;

        IF v_current_stock + p_quantity < 0 THEN
            RAISE EXCEPTION
                'Adjustment would result in negative stock';
        END IF;


    -- 6. Finished product adjustment.

    ELSE

        PERFORM id
        FROM products
        WHERE id = p_product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product not found';
        END IF;

        IF p_quantity <> TRUNC(p_quantity) THEN
            RAISE EXCEPTION
                'Finished stock must be a whole number';
        END IF;

        SELECT
            physical_stock,
            reserved_stock
        INTO
            v_current_stock,
            v_reserved_stock
        FROM product_stock
        WHERE product_id = p_product_id;

        IF v_current_stock + p_quantity < 0 THEN
            RAISE EXCEPTION
                'Adjustment would result in negative stock';
        END IF;

        IF v_current_stock + p_quantity
           < v_reserved_stock THEN
            RAISE EXCEPTION
                'Adjustment would affect reserved stock. Resolve approved orders first.';
        END IF;

    END IF;


    -- 7. Store correction reason for audit logging.

    PERFORM set_config(
        'app.correction_reason',
        BTRIM(p_reason),
        TRUE
    );


    -- 8. Record adjustment in the stock ledger.

    INSERT INTO stock_movements (
        inventory_item_id,
        product_id,
        movement_type,
        quantity,
        unit_cost,
        reference_type,
        movement_date
    )
    VALUES (
        p_inventory_item_id,
        p_product_id,
        'adjustment',
        p_quantity,
        v_unit_cost,
        'manual_adjustment',
        (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
    )
    RETURNING id INTO v_movement_id;


    -- 9. Clear correction reason.

    PERFORM set_config(
        'app.correction_reason',
        '',
        TRUE
    );

    RETURN v_movement_id;

END;
$$;


ALTER FUNCTION "public"."secure_adjust_stock"("p_quantity" numeric, "p_reason" "text", "p_inventory_item_id" bigint, "p_product_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_approve_order"("p_order_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF NOT public.has_role(ARRAY['admin']) THEN
        RAISE EXCEPTION 'Permission denied: order approval';
    END IF;

    PERFORM public.approve_order(p_order_id);
END;
$$;


ALTER FUNCTION "public"."secure_approve_order"("p_order_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_cancel_production"("p_run_id" bigint, "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_status TEXT;
BEGIN

    IF NOT public.has_role(
        ARRAY['admin', 'production']
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    IF p_reason IS NULL
       OR BTRIM(p_reason) = '' THEN
        RAISE EXCEPTION
            'Cancellation reason is required';
    END IF;

    SELECT status
    INTO v_status
    FROM production_runs
    WHERE id = p_run_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Production run not found';
    END IF;

    IF v_status <> 'draft' THEN
        RAISE EXCEPTION
            'Only draft production runs can be cancelled directly';
    END IF;

    PERFORM set_config(
        'app.correction_reason',
        BTRIM(p_reason),
        TRUE
    );

    UPDATE production_runs
    SET status = 'cancelled',
        cancellation_reason = BTRIM(p_reason),
        cancelled_at = NOW(),
        cancelled_by = auth.uid()
    WHERE id = p_run_id;

    PERFORM set_config(
        'app.correction_reason', '', TRUE
    );

END;
$$;


ALTER FUNCTION "public"."secure_cancel_production"("p_run_id" bigint, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_cancel_purchase"("p_purchase_id" bigint, "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_status TEXT;
BEGIN

    IF NOT public.has_role(
        ARRAY['admin', 'accountant']
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    IF p_reason IS NULL
       OR BTRIM(p_reason) = '' THEN
        RAISE EXCEPTION
            'Cancellation reason is required';
    END IF;

    SELECT status
    INTO v_status
    FROM purchases
    WHERE id = p_purchase_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase not found';
    END IF;

    IF v_status <> 'draft' THEN
        RAISE EXCEPTION
            'Only draft purchases can be cancelled directly';
    END IF;

    PERFORM set_config(
        'app.correction_reason',
        BTRIM(p_reason),
        TRUE
    );

    UPDATE purchases
    SET status = 'cancelled',
        cancellation_reason = BTRIM(p_reason),
        cancelled_at = NOW(),
        cancelled_by = auth.uid()
    WHERE id = p_purchase_id;

    PERFORM set_config(
        'app.correction_reason', '', TRUE
    );

END;
$$;


ALTER FUNCTION "public"."secure_cancel_purchase"("p_purchase_id" bigint, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_close_order"("p_order_id" bigint, "p_action" "text", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_order RECORD;
BEGIN

    -- Validate user role.

    IF NOT public.has_role(
        ARRAY['admin', 'salesman']
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;


    -- Validate requested action.

    IF p_action IS NULL
       OR p_action NOT IN ('rejected', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid order action';
    END IF;


    -- Mandatory reason.

    IF p_reason IS NULL
       OR BTRIM(p_reason) = '' THEN
        RAISE EXCEPTION
            'Rejection or cancellation reason is required';
    END IF;


    -- Lock the order.

    SELECT *
    INTO v_order
    FROM sales_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;


    -- Salesman restrictions.

    IF NOT public.has_role(ARRAY['admin']) THEN

        IF v_order.salesman_id
           IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'Permission denied';
        END IF;

        IF v_order.status <> 'pending'
           OR p_action <> 'cancelled' THEN
            RAISE EXCEPTION
                'Salesmen can only cancel their own pending orders';
        END IF;

    END IF;


    -- Validate current order status.

    IF v_order.status NOT IN (
        'pending', 'approved'
    ) THEN
        RAISE EXCEPTION
            'Order cannot be closed in its current status: %',
            v_order.status;
    END IF;


    -- Only pending orders can be rejected.

    IF p_action = 'rejected'
       AND v_order.status <> 'pending' THEN
        RAISE EXCEPTION
            'Only pending orders can be rejected';
    END IF;


    -- Protect invoiced orders.

    IF EXISTS (
        SELECT 1
        FROM invoices
        WHERE order_id = p_order_id
    ) THEN
        RAISE EXCEPTION
            'Invoiced orders require a credit note workflow';
    END IF;


    -- Lock affected products to coordinate
    -- changes in reserved stock.

    PERFORM p.id
    FROM products p
    JOIN sales_order_items soi
        ON soi.product_id = p.id
    WHERE soi.order_id = p_order_id
    ORDER BY p.id
    FOR UPDATE OF p;


    -- Store correction reason for audit logging.

    PERFORM set_config(
        'app.correction_reason',
        BTRIM(p_reason),
        TRUE
    );


    -- Reject or cancel the order.

    UPDATE sales_orders
    SET status = p_action,
        closure_reason = BTRIM(p_reason),
        closed_at = NOW(),
        closed_by = auth.uid()
    WHERE id = p_order_id;


    -- Clear audit context.

    PERFORM set_config(
        'app.correction_reason',
        '',
        TRUE
    );

END;
$$;


ALTER FUNCTION "public"."secure_close_order"("p_order_id" bigint, "p_action" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_create_bom_version"("p_bom_id" bigint) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_product_id BIGINT;
    v_expected_output INTEGER;
    v_new_version INTEGER;
    v_new_bom_id BIGINT;
BEGIN

    -- 1. Validate user role.

    IF NOT public.has_role(
        ARRAY['admin', 'production']
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;


    -- 2. Retrieve the existing BOM.

    SELECT product_id, expected_output
    INTO v_product_id, v_expected_output
    FROM boms
    WHERE id = p_bom_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BOM not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM bom_items
        WHERE bom_id = p_bom_id
    ) THEN
        RAISE EXCEPTION 'Source BOM has no materials';
    END IF;


    -- 3. Lock the product to prevent concurrent
    -- version creation through this function.

    PERFORM id
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;


    -- 4. Calculate the next version number.

    SELECT COALESCE(MAX(version), 0) + 1
    INTO v_new_version
    FROM boms
    WHERE product_id = v_product_id;


    -- 5. Create the new BOM.

    INSERT INTO boms (
        product_id,
        expected_output,
        version
    )
    VALUES (
        v_product_id,
        v_expected_output,
        v_new_version
    )
    RETURNING id INTO v_new_bom_id;


    -- 6. Copy all materials from the original BOM.

    INSERT INTO bom_items (
        bom_id,
        inventory_item_id,
        planned_quantity
    )
    SELECT
        v_new_bom_id,
        inventory_item_id,
        planned_quantity
    FROM bom_items
    WHERE bom_id = p_bom_id;


    -- 7. Return the newly created BOM ID.

    RETURN v_new_bom_id;

END;
$$;


ALTER FUNCTION "public"."secure_create_bom_version"("p_bom_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_dashboard"("p_start_date" "date", "p_end_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF NOT has_role(
        ARRAY['admin', 'owner', 'accountant']
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    IF p_start_date IS NULL
       OR p_end_date IS NULL
       OR p_start_date > p_end_date THEN
        RAISE EXCEPTION 'Invalid date range';
    END IF;

    SELECT JSONB_BUILD_OBJECT(

        'net_sales',
        COALESCE((
            SELECT SUM(taxable_amount)
            FROM gst_transaction_register
            WHERE document_date
                BETWEEN p_start_date AND p_end_date
        ), 0),

        'total_gst',
        COALESCE((
            SELECT SUM(
                cgst_amount + sgst_amount + igst_amount
            )
            FROM gst_transaction_register
            WHERE document_date
                BETWEEN p_start_date AND p_end_date
        ), 0),

        'total_invoice_value',
        COALESCE((
            SELECT SUM(total_amount)
            FROM gst_transaction_register
            WHERE document_date
                BETWEEN p_start_date AND p_end_date
        ), 0),

        'payments_collected',
        COALESCE((
            SELECT SUM(amount)
            FROM payments
            WHERE status = 'recorded'
              AND payment_date
                BETWEEN p_start_date AND p_end_date
        ), 0),

        'outstanding_amount',
        COALESCE((
            SELECT SUM(outstanding_amount)
            FROM invoice_receivables
        ), 0),

        'overdue_amount',
        COALESCE((
            SELECT SUM(outstanding_amount)
            FROM invoice_receivables
            WHERE overdue_days > 0
        ), 0),

        'pending_orders',
        (
            SELECT COUNT(*)
            FROM sales_orders
            WHERE status = 'pending'
        ),

        'dispatched_orders',
        (
            SELECT COUNT(*)
            FROM dispatches
            WHERE dispatch_date
                BETWEEN p_start_date AND p_end_date
        ),

        'production_batches',
        (
            SELECT COUNT(*)
            FROM production_runs
            WHERE status = 'posted'
              AND production_date
                BETWEEN p_start_date AND p_end_date
        ),

        'planned_output',
        COALESCE((
            SELECT SUM(planned_output)
            FROM production_runs
            WHERE status = 'posted'
              AND production_date
                BETWEEN p_start_date AND p_end_date
        ), 0),

        'actual_output',
        COALESCE((
            SELECT SUM(actual_output)
            FROM production_runs
            WHERE status = 'posted'
              AND production_date
                BETWEEN p_start_date AND p_end_date
        ), 0),

        'production_yield',
        (
            SELECT ROUND(
                SUM(actual_output)::NUMERIC * 100
                / NULLIF(SUM(planned_output), 0),
                2
            )
            FROM production_runs
            WHERE status = 'posted'
              AND production_date
                BETWEEN p_start_date AND p_end_date
        ),

        'material_variance_alerts',
        (
            SELECT COUNT(*)
            FROM production_variance_report
            WHERE variance_status IN (
                'alert', 'unplanned_consumption'
            )
              AND production_date
                BETWEEN p_start_date AND p_end_date
        ),

        'yield_alerts',
        (
            SELECT COUNT(*)
            FROM production_summary_report
            WHERE yield_status = 'alert'
              AND production_date
                BETWEEN p_start_date AND p_end_date
        ),

        'material_stock_value',
        COALESCE((
            SELECT SUM(stock_value)
            FROM material_stock
        ), 0),

        'reorder_alert_count',
        (
            SELECT COUNT(*)
            FROM reorder_alerts
        )

    )
    INTO v_result;

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."secure_dashboard"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_dispatch_order"("p_order_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF NOT public.has_role(ARRAY['admin']) THEN
        RAISE EXCEPTION 'Permission denied: dispatch';
    END IF;

    PERFORM public.dispatch_order(p_order_id);
END;
$$;


ALTER FUNCTION "public"."secure_dispatch_order"("p_order_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_financial_report"("p_report" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_result JSONB;
BEGIN

    IF NOT public.has_role(ARRAY[
        'admin', 'accountant', 'owner'
    ]) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    CASE p_report

        WHEN 'gst_outward_supplies' THEN

            SELECT jsonb_agg(to_jsonb(r))
            INTO v_result
            FROM public.gst_outward_supplies r;

        WHEN 'invoice_receivables' THEN

            SELECT jsonb_agg(to_jsonb(r))
            INTO v_result
            FROM public.invoice_receivables r;

        WHEN 'receivables_ageing' THEN

            SELECT jsonb_agg(to_jsonb(r))
            INTO v_result
            FROM public.receivables_ageing r;

        WHEN 'payment_collection_report' THEN

            SELECT jsonb_agg(to_jsonb(r))
            INTO v_result
            FROM public.payment_collection_report r;

        WHEN 'customer_outstanding_report' THEN

            SELECT jsonb_agg(to_jsonb(r))
            INTO v_result
            FROM public.customer_outstanding_report r;

        ELSE
            RAISE EXCEPTION 'Invalid report name';

    END CASE;

    RETURN COALESCE(v_result, '[]'::JSONB);

END;
$$;


ALTER FUNCTION "public"."secure_financial_report"("p_report" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_generate_invoice"("p_order_id" bigint) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF NOT public.has_role(ARRAY['admin']) THEN
        RAISE EXCEPTION 'Permission denied: invoice generation';
    END IF;

    RETURN public.generate_invoice(p_order_id);
END;
$$;


ALTER FUNCTION "public"."secure_generate_invoice"("p_order_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_gst_register"("p_start_date" "date", "p_end_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_result JSONB;
BEGIN

    IF NOT public.has_role(
        ARRAY['admin', 'accountant', 'owner']
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    IF p_start_date IS NULL
       OR p_end_date IS NULL
       OR p_start_date > p_end_date THEN
        RAISE EXCEPTION 'Invalid report date range';
    END IF;

    SELECT jsonb_agg(
        to_jsonb(r)
        ORDER BY
            r.document_date,
            r.document_number,
            r.gst_rate
    )
    INTO v_result
    FROM gst_transaction_register r
    WHERE r.document_date
        BETWEEN p_start_date AND p_end_date;

    RETURN COALESCE(v_result, '[]'::JSONB);

END;
$$;


ALTER FUNCTION "public"."secure_gst_register"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_gst_summary_report"("p_start_date" "date", "p_end_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_result JSONB;
BEGIN

    IF NOT public.has_role(
        ARRAY['admin', 'accountant', 'owner']
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    IF p_start_date IS NULL
       OR p_end_date IS NULL
       OR p_start_date > p_end_date THEN
        RAISE EXCEPTION 'Invalid report date range';
    END IF;

    SELECT jsonb_agg(to_jsonb(r))
    INTO v_result
    FROM (
        SELECT
            supply_type,

            COUNT(DISTINCT document_number)
            FILTER (
                WHERE document_type = 'invoice'
            ) AS total_invoices,

            COUNT(DISTINCT document_number)
            FILTER (
                WHERE document_type = 'credit_note'
            ) AS total_credit_notes,

            SUM(taxable_amount) AS taxable_amount,
            SUM(cgst_amount) AS cgst_amount,
            SUM(sgst_amount) AS sgst_amount,
            SUM(igst_amount) AS igst_amount,

            SUM(
                cgst_amount
                + sgst_amount
                + igst_amount
            ) AS total_gst,

            SUM(total_amount) AS total_amount

        FROM gst_transaction_register

        WHERE document_date
            BETWEEN p_start_date AND p_end_date

        GROUP BY supply_type
        ORDER BY supply_type
    ) r;

    RETURN COALESCE(v_result, '[]'::JSONB);

END;
$$;


ALTER FUNCTION "public"."secure_gst_summary_report"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_issue_credit_note"("p_invoice_id" bigint, "p_reason" "text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_invoice RECORD;
    v_order RECORD;
    v_order_id BIGINT;
    v_credit_note_id BIGINT;
    v_credit_note_number TEXT;
    v_financial_year TEXT;
    v_year INTEGER;
    v_number INTEGER;
    v_today DATE;
BEGIN

    -- 1. Validate user role.

    IF NOT public.has_role(ARRAY['admin']) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;


    -- 2. Validate cancellation reason.

    IF p_reason IS NULL
       OR BTRIM(p_reason) = '' THEN
        RAISE EXCEPTION
            'Credit note reason is required';
    END IF;


    -- 3. Identify and lock the associated order.

    SELECT order_id
    INTO v_order_id
    FROM invoices
    WHERE id = p_invoice_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice not found';
    END IF;

    SELECT *
    INTO STRICT v_order
    FROM sales_orders
    WHERE id = v_order_id
    FOR UPDATE;


    -- 4. Lock the original invoice.

    SELECT *
    INTO STRICT v_invoice
    FROM invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF v_invoice.status <> 'issued' THEN
        RAISE EXCEPTION 'Invoice is not active';
    END IF;


    -- 5. Prevent duplicate credit notes.

    IF EXISTS (
        SELECT 1
        FROM credit_notes
        WHERE invoice_id = p_invoice_id
    ) THEN
        RAISE EXCEPTION
            'Credit note already exists for this invoice';
    END IF;


    -- 6. Protect dispatched invoices.

    IF v_order.status <> 'invoiced'
       OR EXISTS (
           SELECT 1
           FROM dispatches
           WHERE invoice_id = p_invoice_id
       ) THEN
        RAISE EXCEPTION
            'Dispatched invoices require a separate return workflow';
    END IF;


    -- 7. Protect invoices with active payments.

    IF EXISTS (
        SELECT 1
        FROM payments
        WHERE invoice_id = p_invoice_id
          AND status = 'recorded'
    ) THEN
        RAISE EXCEPTION
            'Resolve active payments before issuing a full credit note';
    END IF;


    -- 8. Ensure invoice contains line items.

    IF NOT EXISTS (
        SELECT 1
        FROM invoice_items
        WHERE invoice_id = p_invoice_id
    ) THEN
        RAISE EXCEPTION 'Invoice has no items';
    END IF;


    -- 9. Lock affected products.

    PERFORM p.id
    FROM products p
    WHERE p.id IN (
        SELECT product_id
        FROM invoice_items
        WHERE invoice_id = p_invoice_id
    )
    ORDER BY p.id
    FOR UPDATE;


    -- 10. Calculate financial year.

    v_today :=
        (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

    v_year := EXTRACT(YEAR FROM v_today)::INTEGER;

    IF EXTRACT(MONTH FROM v_today) < 4 THEN
        v_year := v_year - 1;
    END IF;

    v_financial_year :=
        RIGHT(v_year::TEXT, 2)
        || '-'
        || RIGHT((v_year + 1)::TEXT, 2);


    -- 11. Generate unique credit note number.

    INSERT INTO credit_note_counters (
        financial_year,
        last_number
    )
    VALUES (
        v_financial_year,
        1
    )
    ON CONFLICT (financial_year)
    DO UPDATE
    SET last_number =
        credit_note_counters.last_number + 1
    RETURNING last_number INTO v_number;

    v_credit_note_number :=
        'CN/'
        || v_financial_year
        || '/'
        || LPAD(
            v_number::TEXT,
            GREATEST(5, LENGTH(v_number::TEXT)),
            '0'
        );


    -- 12. Store reason for audit logging.

    PERFORM set_config(
        'app.correction_reason',
        BTRIM(p_reason),
        TRUE
    );


    -- 13. Create credit note using original
    -- invoice amounts.

    INSERT INTO credit_notes (
        credit_note_number,
        invoice_id,
        credit_note_date,
        reason,
        taxable_amount,
        cgst_amount,
        sgst_amount,
        igst_amount,
        total_amount,
        created_by
    )
    VALUES (
        v_credit_note_number,
        p_invoice_id,
        v_today,
        BTRIM(p_reason),
        v_invoice.taxable_amount,
        v_invoice.cgst_amount,
        v_invoice.sgst_amount,
        v_invoice.igst_amount,
        v_invoice.total_amount,
        auth.uid()
    )
    RETURNING id INTO v_credit_note_id;


    -- 14. Copy original invoice line items.

    INSERT INTO credit_note_items (
        credit_note_id,
        invoice_item_id,
        product_id,
        product_name,
        hsn_code,
        quantity,
        unit_price,
        gst_rate,
        taxable_amount,
        cgst_amount,
        sgst_amount,
        igst_amount,
        total_amount
    )
    SELECT
        v_credit_note_id,
        id,
        product_id,
        product_name,
        hsn_code,
        quantity,
        unit_price,
        gst_rate,
        taxable_amount,
        cgst_amount,
        sgst_amount,
        igst_amount,
        total_amount
    FROM invoice_items
    WHERE invoice_id = p_invoice_id;


    -- 15. Mark original invoice as cancelled.

    UPDATE invoices
    SET status = 'cancelled'
    WHERE id = p_invoice_id;


    -- 16. Cancel order and release reservations.

    UPDATE sales_orders
    SET status = 'cancelled',
        closure_reason = BTRIM(p_reason),
        closed_at = NOW(),
        closed_by = auth.uid()
    WHERE id = v_order_id;


    -- 17. Clear audit context.

    PERFORM set_config(
        'app.correction_reason',
        '',
        TRUE
    );

    RETURN v_credit_note_id;

END;
$$;


ALTER FUNCTION "public"."secure_issue_credit_note"("p_invoice_id" bigint, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_post_production"("p_run_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF NOT public.has_role(
        ARRAY['admin', 'production']
    ) THEN
        RAISE EXCEPTION 'Permission denied: production posting';
    END IF;

    PERFORM public.post_production(p_run_id);
END;
$$;


ALTER FUNCTION "public"."secure_post_production"("p_run_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_post_purchase"("p_purchase_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_purchase RECORD;
    v_supplier_active BOOLEAN;
BEGIN

    -- 1. Validate user permissions.

    IF NOT public.has_role(
        ARRAY['admin', 'accountant']
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;


    -- 2. Identify the supplier.

    SELECT *
    INTO v_purchase
    FROM purchases
    WHERE id = p_purchase_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase not found';
    END IF;


    -- 3. Lock and validate supplier.

    SELECT is_active
    INTO STRICT v_supplier_active
    FROM suppliers
    WHERE id = v_purchase.supplier_id
    FOR SHARE;

    IF NOT v_supplier_active THEN
        RAISE EXCEPTION
            'Cannot post purchase for an inactive supplier';
    END IF;


    -- 4. Lock purchase and verify supplier
    -- has not changed during validation.

    PERFORM id
    FROM purchases
    WHERE id = p_purchase_id
      AND supplier_id = v_purchase.supplier_id
      AND status = 'draft'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Purchase is no longer an eligible draft. Refresh and retry';
    END IF;


    -- 5. Execute existing purchase posting logic.

    PERFORM public.post_purchase(p_purchase_id);

END;
$$;


ALTER FUNCTION "public"."secure_post_purchase"("p_purchase_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_product_stock"() RETURNS TABLE("product_id" bigint, "name" "text", "sku" "text", "packet_size_g" integer, "physical_stock" numeric, "reserved_stock" numeric, "available_stock" numeric)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN

    IF NOT public.has_role(ARRAY[
        'admin', 'salesman', 'production',
        'accountant', 'owner'
    ]) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    RETURN QUERY
    SELECT
        ps.product_id,
        ps.name,
        ps.sku,
        ps.packet_size_g,
        ps.physical_stock::NUMERIC,
        ps.reserved_stock::NUMERIC,
        ps.available_stock::NUMERIC
    FROM public.product_stock ps
    ORDER BY ps.name;

END;
$$;


ALTER FUNCTION "public"."secure_product_stock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_record_payment"("p_invoice_id" bigint, "p_amount" numeric, "p_method" "text", "p_reference" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF NOT public.has_role(
        ARRAY['admin', 'accountant']
    ) THEN
        RAISE EXCEPTION 'Permission denied: payment recording';
    END IF;

    PERFORM public.record_payment(
        p_invoice_id,
        p_amount,
        p_method,
        p_reference
    );
END;
$$;


ALTER FUNCTION "public"."secure_record_payment"("p_invoice_id" bigint, "p_amount" numeric, "p_method" "text", "p_reference" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_reopen_order"("p_order_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_status TEXT;
BEGIN

    IF NOT public.has_role(ARRAY['admin']) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    SELECT status
    INTO v_status
    FROM sales_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_status <> 'approved' THEN
        RAISE EXCEPTION
            'Only approved orders can be reopened';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM invoices
        WHERE order_id = p_order_id
    ) THEN
        RAISE EXCEPTION
            'Invoiced orders cannot be reopened';
    END IF;

    UPDATE sales_orders
    SET status = 'pending'
    WHERE id = p_order_id;

END;
$$;


ALTER FUNCTION "public"."secure_reopen_order"("p_order_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_reorder_alerts"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF NOT has_role(
        ARRAY[
            'admin',
            'production',
            'accountant',
            'owner'
        ]
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN COALESCE(
        (
            SELECT JSONB_AGG(
                TO_JSONB(r)
                ORDER BY r.shortage_quantity DESC
            )
            FROM reorder_alerts r
        ),
        '[]'::JSONB
    );
END;
$$;


ALTER FUNCTION "public"."secure_reorder_alerts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_reverse_payment"("p_payment_id" bigint, "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_invoice_id BIGINT;
    v_status TEXT;
BEGIN

    IF NOT public.has_role(ARRAY['admin']) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    IF p_reason IS NULL
       OR BTRIM(p_reason) = '' THEN
        RAISE EXCEPTION
            'Payment reversal reason is required';
    END IF;


    -- Identify the associated invoice.

    SELECT invoice_id
    INTO v_invoice_id
    FROM payments
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found';
    END IF;


    -- Lock invoice to prevent concurrent
    -- payment and reversal conflicts.

    PERFORM id
    FROM invoices
    WHERE id = v_invoice_id
    FOR UPDATE;


    SELECT status
    INTO v_status
    FROM payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF v_status <> 'recorded' THEN
        RAISE EXCEPTION
            'Payment has already been reversed';
    END IF;


    -- Store correction reason for audit logging.

    PERFORM set_config(
        'app.correction_reason',
        BTRIM(p_reason),
        TRUE
    );


    -- Reverse payment without deleting history.

    UPDATE payments
    SET status = 'reversed',
        reversed_at = NOW(),
        reversed_by = auth.uid(),
        reversal_reason = BTRIM(p_reason)
    WHERE id = p_payment_id;


    PERFORM set_config(
        'app.correction_reason',
        '',
        TRUE
    );

END;
$$;


ALTER FUNCTION "public"."secure_reverse_payment"("p_payment_id" bigint, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_reverse_production"("p_run_id" bigint, "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_run RECORD;
    v_product_id BIGINT;
    v_available_stock NUMERIC;
    v_today DATE;
BEGIN

    -- 1. Only Admin can reverse posted production.

    IF NOT public.has_role(ARRAY['admin']) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;


    -- 2. A correction reason is mandatory.

    IF p_reason IS NULL
       OR BTRIM(p_reason) = '' THEN
        RAISE EXCEPTION
            'Reversal reason is required';
    END IF;


    -- 3. Find and lock the production run.

    SELECT *
    INTO v_run
    FROM production_runs
    WHERE id = p_run_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Production run not found';
    END IF;

    IF v_run.status <> 'posted' THEN
        RAISE EXCEPTION
            'Only posted production can be reversed';
    END IF;


    -- 4. Identify the finished product.

    SELECT product_id
    INTO STRICT v_product_id
    FROM boms
    WHERE id = v_run.bom_id;


    -- 5. Lock consumed inventory items.

    PERFORM i.id
    FROM inventory_items i
    WHERE i.id IN (
        SELECT inventory_item_id
        FROM production_consumption
        WHERE production_run_id = p_run_id
    )
    ORDER BY i.id
    FOR UPDATE;


    -- 6. Lock the finished product.

    PERFORM id
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;


    -- 7. Check available finished stock.

    SELECT available_stock
    INTO STRICT v_available_stock
    FROM product_stock
    WHERE product_id = v_product_id;

    IF v_available_stock < v_run.actual_output THEN
        RAISE EXCEPTION
            'Cannot reverse production. Available: %, Required: %',
            v_available_stock,
            v_run.actual_output;
    END IF;


    -- 8. Restrict reversal to the posting day.

    v_today :=
        (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

    IF NOT EXISTS (
        SELECT 1
        FROM stock_movements
        WHERE reference_type = 'production'
          AND reference_id = p_run_id
          AND movement_type IN (
              'production_issue',
              'production_receipt'
          )
    ) THEN
        RAISE EXCEPTION
            'Original production movements not found';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM stock_movements
        WHERE reference_type = 'production'
          AND reference_id = p_run_id
          AND movement_type IN (
              'production_issue',
              'production_receipt'
          )
          AND movement_date <> v_today
    ) THEN
        RAISE EXCEPTION
            'Only same-day production reversals are supported';
    END IF;


    -- 9. Prevent reversal if later stock
    -- movements exist for affected items.

    IF EXISTS (
        SELECT 1
        FROM stock_movements original
        JOIN stock_movements later
          ON later.id > original.id
         AND (
             (
                 original.inventory_item_id IS NOT NULL
                 AND later.inventory_item_id =
                     original.inventory_item_id
             )
             OR
             (
                 original.product_id IS NOT NULL
                 AND later.product_id =
                     original.product_id
             )
         )
        WHERE original.reference_type = 'production'
          AND original.reference_id = p_run_id
          AND original.movement_type IN (
              'production_issue',
              'production_receipt'
          )
          AND NOT (
              later.reference_type
                  IS NOT DISTINCT FROM 'production'
              AND later.reference_id
                  IS NOT DISTINCT FROM p_run_id
          )
    ) THEN
        RAISE EXCEPTION
            'Later stock movements exist. Reversal blocked';
    END IF;


    -- 10. Store reason for audit logging.

    PERFORM set_config(
        'app.correction_reason',
        BTRIM(p_reason),
        TRUE
    );


    -- 11. Reverse original stock movements.

    INSERT INTO stock_movements (
        inventory_item_id,
        product_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        unit_cost,
        movement_date
    )
    SELECT
        inventory_item_id,
        product_id,
        'adjustment',
        -quantity,
        'production_reversal',
        p_run_id,
        unit_cost,
        v_today
    FROM stock_movements
    WHERE reference_type = 'production'
      AND reference_id = p_run_id
      AND movement_type IN (
          'production_issue',
          'production_receipt'
      );


    -- 12. Mark production as cancelled.

    UPDATE production_runs
    SET status = 'cancelled',
        cancellation_reason = BTRIM(p_reason),
        cancelled_at = NOW(),
        cancelled_by = auth.uid()
    WHERE id = p_run_id;


    -- 13. Clear audit context.

    PERFORM set_config(
        'app.correction_reason',
        '',
        TRUE
    );

END;
$$;


ALTER FUNCTION "public"."secure_reverse_production"("p_run_id" bigint, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_reverse_purchase"("p_purchase_id" bigint, "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_purchase RECORD;
    v_item RECORD;
    v_movement RECORD;
    v_current_stock NUMERIC;
    v_today DATE;
BEGIN

    -- 1. Only Admin can reverse posted purchases.

    IF NOT public.has_role(ARRAY['admin']) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;


    -- 2. Require a valid correction reason.

    IF p_reason IS NULL
       OR BTRIM(p_reason) = '' THEN
        RAISE EXCEPTION
            'Reversal reason is required';
    END IF;


    -- 3. Find and lock the purchase.

    SELECT *
    INTO v_purchase
    FROM purchases
    WHERE id = p_purchase_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase not found';
    END IF;

    IF v_purchase.status <> 'posted' THEN
        RAISE EXCEPTION
            'Only posted purchases can be reversed';
    END IF;


    -- 4. Ensure purchase contains items.

    IF NOT EXISTS (
        SELECT 1
        FROM purchase_items
        WHERE purchase_id = p_purchase_id
    ) THEN
        RAISE EXCEPTION
            'Purchase contains no items';
    END IF;


    -- 5. Check original costing snapshots.

    IF EXISTS (
        SELECT 1
        FROM purchase_items
        WHERE purchase_id = p_purchase_id
          AND (
              stock_before_purchase IS NULL
              OR average_cost_before_purchase IS NULL
          )
    ) THEN
        RAISE EXCEPTION
            'Original purchase costing snapshots unavailable';
    END IF;


    -- 6. Get current business date.

    v_today :=
        (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;


    -- 7. Lock affected inventory items.

    PERFORM i.id
    FROM inventory_items i
    WHERE i.id IN (
        SELECT inventory_item_id
        FROM purchase_items
        WHERE purchase_id = p_purchase_id
    )
    ORDER BY i.id
    FOR UPDATE;


    -- 8. Set correction reason for audit logging.

    PERFORM set_config(
        'app.correction_reason',
        BTRIM(p_reason),
        TRUE
    );


    -- 9. Process each purchased material.

    FOR v_item IN

        SELECT *
        FROM purchase_items
        WHERE purchase_id = p_purchase_id
        ORDER BY inventory_item_id

    LOOP

        -- Find the original purchase movement.
        -- STRICT requires exactly one matching row.

        SELECT *
        INTO STRICT v_movement
        FROM stock_movements
        WHERE reference_type = 'purchase'
          AND reference_id = p_purchase_id
          AND movement_type = 'purchase'
          AND inventory_item_id =
              v_item.inventory_item_id;


        -- Verify original quantity and cost.

        IF v_movement.quantity
               IS DISTINCT FROM v_item.quantity
           OR v_movement.unit_cost
               IS DISTINCT FROM v_item.unit_price
        THEN
            RAISE EXCEPTION
                'Original purchase movement mismatch';
        END IF;


        -- Allow only same-day corrections.

        IF v_movement.movement_date <> v_today THEN
            RAISE EXCEPTION
                'Only same-day purchase reversals are supported';
        END IF;


        -- Prevent reversal after subsequent movements.

        IF EXISTS (
            SELECT 1
            FROM stock_movements
            WHERE inventory_item_id =
                v_item.inventory_item_id
              AND id > v_movement.id
        ) THEN
            RAISE EXCEPTION
                'Later stock movements exist for material %. Reversal blocked',
                v_item.inventory_item_id;
        END IF;


        -- Calculate current material stock.

        SELECT COALESCE(SUM(quantity), 0)
        INTO v_current_stock
        FROM stock_movements
        WHERE inventory_item_id =
            v_item.inventory_item_id;


        -- Prevent negative inventory.

        IF v_current_stock < v_item.quantity THEN
            RAISE EXCEPTION
                'Insufficient material stock for reversal';
        END IF;


        -- Ensure stock matches the saved snapshot.

        IF v_current_stock IS DISTINCT FROM (
            v_item.stock_before_purchase
            + v_item.quantity
        ) THEN
            RAISE EXCEPTION
                'Material stock snapshot mismatch';
        END IF;


        -- Restore exact original weighted average cost.

        UPDATE inventory_items
        SET average_unit_cost =
            v_item.average_cost_before_purchase
        WHERE id = v_item.inventory_item_id;


        -- Insert compensating stock movement.

        INSERT INTO stock_movements (
            inventory_item_id,
            movement_type,
            quantity,
            reference_type,
            reference_id,
            unit_cost,
            movement_date
        )
        VALUES (
            v_item.inventory_item_id,
            'adjustment',
            -v_item.quantity,
            'purchase_reversal',
            p_purchase_id,
            v_item.unit_price,
            v_today
        );

    END LOOP;


    -- 10. Mark original purchase as cancelled.

    UPDATE purchases
    SET status = 'cancelled',
        cancellation_reason = BTRIM(p_reason),
        cancelled_at = NOW(),
        cancelled_by = auth.uid()
    WHERE id = p_purchase_id;


    -- 11. Clear audit context.

    PERFORM set_config(
        'app.correction_reason',
        '',
        TRUE
    );

END;
$$;


ALTER FUNCTION "public"."secure_reverse_purchase"("p_purchase_id" bigint, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_save_bom"("p_product_id" bigint, "p_expected_output" integer, "p_items" "jsonb", "p_is_active" boolean DEFAULT true, "p_bom_id" bigint DEFAULT NULL::bigint) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_bom_id BIGINT;
    v_version INTEGER;
    v_existing_product_id BIGINT;
    v_item JSONB;
    v_material_id BIGINT;
    v_quantity NUMERIC;
    v_unit TEXT;
BEGIN

    -- 1. Check user permissions.

    IF NOT public.has_role(
        ARRAY['admin', 'production']
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;


    -- 2. Validate basic inputs.

    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'Product is required';
    END IF;

    IF p_expected_output IS NULL
       OR p_expected_output <= 0 THEN
        RAISE EXCEPTION
            'Expected output must be greater than zero';
    END IF;

    IF p_is_active IS NULL THEN
        RAISE EXCEPTION 'Active status is required';
    END IF;

    IF p_items IS NULL
       OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'Invalid BOM materials';
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION
            'At least one material is required';
    END IF;


    -- 3. Lock an existing BOM before editing.

    IF p_bom_id IS NOT NULL THEN

        SELECT product_id
        INTO v_existing_product_id
        FROM boms
        WHERE id = p_bom_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'BOM not found';
        END IF;

        IF v_existing_product_id <> p_product_id THEN
            RAISE EXCEPTION
                'Product cannot be changed for an existing BOM';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM production_runs
            WHERE bom_id = p_bom_id
        ) THEN
            RAISE EXCEPTION
                'Used BOM cannot be modified. Create a new version.';
        END IF;

    END IF;


    -- 4. Validate and lock the product.

    PERFORM id
    FROM products
    WHERE id = p_product_id
      AND is_active = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Product not found or inactive';
    END IF;


    -- 5. Validate every material.

    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_items)
        ORDER BY (value->>'inventory_item_id')::BIGINT
    LOOP

        v_material_id :=
            (v_item->>'inventory_item_id')::BIGINT;

        v_quantity :=
            (v_item->>'planned_quantity')::NUMERIC;

        IF v_material_id IS NULL THEN
            RAISE EXCEPTION 'Material is required';
        END IF;

        IF v_quantity IS NULL
           OR v_quantity::TEXT IN (
               'NaN', 'Infinity', '-Infinity'
           )
           OR v_quantity <= 0 THEN

            RAISE EXCEPTION
                'Planned quantity must be greater than zero';

        END IF;

        IF v_quantity <> ROUND(v_quantity, 3) THEN
            RAISE EXCEPTION
                'Quantity supports up to three decimal places';
        END IF;

        SELECT unit
        INTO v_unit
        FROM inventory_items
        WHERE id = v_material_id
          AND is_active = TRUE
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Material % not found or inactive',
                v_material_id;
        END IF;

        IF v_unit = 'piece'
           AND v_quantity <> TRUNC(v_quantity) THEN

            RAISE EXCEPTION
                'Piece quantities must be whole numbers';

        END IF;

    END LOOP;


    -- 6. Prevent duplicate materials.

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_items) AS item
        GROUP BY (item->>'inventory_item_id')::BIGINT
        HAVING COUNT(*) > 1
    ) THEN

        RAISE EXCEPTION
            'Duplicate materials are not allowed';

    END IF;


    -- 7. Create or update the BOM header.

    IF p_bom_id IS NULL THEN

        SELECT COALESCE(MAX(version), 0) + 1
        INTO v_version
        FROM boms
        WHERE product_id = p_product_id;

        INSERT INTO boms (
            product_id,
            expected_output,
            version,
            is_active
        )
        VALUES (
            p_product_id,
            p_expected_output,
            v_version,
            p_is_active
        )
        RETURNING id INTO v_bom_id;

    ELSE

        v_bom_id := p_bom_id;

        UPDATE boms
        SET expected_output = p_expected_output,
            is_active = p_is_active
        WHERE id = v_bom_id;

        DELETE FROM bom_items
        WHERE bom_id = v_bom_id;

    END IF;


    -- 8. Save all recipe materials.

    INSERT INTO bom_items (
        bom_id,
        inventory_item_id,
        planned_quantity
    )
    SELECT
        v_bom_id,
        (item->>'inventory_item_id')::BIGINT,
        (item->>'planned_quantity')::NUMERIC
    FROM jsonb_array_elements(p_items) AS item;


    -- 9. Return the saved BOM ID.

    RETURN v_bom_id;

END;
$$;


ALTER FUNCTION "public"."secure_save_bom"("p_product_id" bigint, "p_expected_output" integer, "p_items" "jsonb", "p_is_active" boolean, "p_bom_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_save_order"("p_customer_id" bigint, "p_items" "jsonb", "p_order_id" bigint DEFAULT NULL::bigint, "p_salesman_id" "uuid" DEFAULT NULL::"uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_order_id BIGINT;
    v_salesman_id UUID;
    v_salesman_name TEXT;
    v_order_number TEXT;
    v_order RECORD;
    v_item RECORD;
    v_product RECORD;
BEGIN

    -- Validate user role.

    IF NOT public.has_role(
        ARRAY['admin', 'salesman']
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;


    -- Validate customer.

    IF NOT EXISTS (
        SELECT 1
        FROM customers
        WHERE id = p_customer_id
    ) THEN
        RAISE EXCEPTION 'Invalid customer';
    END IF;


    -- Validate order items.

    IF p_items IS NULL
       OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'Invalid order items';
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION
            'Order must contain at least one product';
    END IF;


    -- Create new order.

    IF p_order_id IS NULL THEN

        IF public.has_role(ARRAY['admin']) THEN
            v_salesman_id :=
                COALESCE(p_salesman_id, auth.uid());
        ELSE
            v_salesman_id := auth.uid();
        END IF;

        SELECT full_name
        INTO v_salesman_name
        FROM profiles
        WHERE id = v_salesman_id
          AND is_active = TRUE
          AND role IN ('admin', 'salesman');

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid salesman';
        END IF;


        -- Generate unique order number.

        LOOP
            v_order_number :=
                'SO-' ||
                nextval('public.sales_order_number_seq');

            EXIT WHEN NOT EXISTS (
                SELECT 1
                FROM sales_orders
                WHERE order_number = v_order_number
            );
        END LOOP;


        INSERT INTO sales_orders (
            order_number,
            customer_id,
            salesman_id,
            salesman_name,
            order_date,
            status
        )
        VALUES (
            v_order_number,
            p_customer_id,
            v_salesman_id,
            v_salesman_name,
            (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE,
            'pending'
        )
        RETURNING id INTO v_order_id;


    -- Edit existing order.

    ELSE

        SELECT *
        INTO v_order
        FROM sales_orders
        WHERE id = p_order_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Order not found';
        END IF;

        IF NOT public.has_role(ARRAY['admin'])
           AND v_order.salesman_id
               IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'Permission denied';
        END IF;

        IF v_order.status <> 'pending' THEN
            RAISE EXCEPTION
                'Only pending orders can be edited';
        END IF;

        v_order_id := p_order_id;

        UPDATE sales_orders
        SET customer_id = p_customer_id
        WHERE id = v_order_id;

        DELETE FROM sales_order_items
        WHERE order_id = v_order_id;

    END IF;


    -- Insert validated order items.

    FOR v_item IN
        SELECT *
        FROM jsonb_to_recordset(p_items)
        AS x(product_id BIGINT, quantity NUMERIC)
    LOOP

        IF v_item.quantity IS NULL
           OR v_item.quantity <= 0
           OR v_item.quantity <> TRUNC(v_item.quantity)
           OR v_item.quantity > 2147483647 THEN
            RAISE EXCEPTION
                'Quantity must be a positive whole number';
        END IF;

        SELECT id, selling_price, gst_rate
        INTO v_product
        FROM products
        WHERE id = v_item.product_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Invalid product: %',
                v_item.product_id;
        END IF;

        IF EXISTS (
            SELECT 1
            FROM sales_order_items
            WHERE order_id = v_order_id
              AND product_id = v_item.product_id
        ) THEN
            RAISE EXCEPTION
                'Duplicate product in order';
        END IF;

        INSERT INTO sales_order_items (
            order_id,
            product_id,
            quantity,
            unit_price,
            gst_rate
        )
        VALUES (
            v_order_id,
            v_product.id,
            v_item.quantity::INTEGER,
            v_product.selling_price,
            v_product.gst_rate
        );

    END LOOP;

    RETURN v_order_id;

END;
$$;


ALTER FUNCTION "public"."secure_save_order"("p_customer_id" bigint, "p_items" "jsonb", "p_order_id" bigint, "p_salesman_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_save_production"("p_batch_number" "text", "p_bom_id" bigint, "p_production_date" "date", "p_planned_output" integer, "p_actual_output" integer, "p_damaged_pouches" integer, "p_labour_cost" numeric, "p_utility_cost" numeric, "p_items" "jsonb", "p_run_id" bigint DEFAULT NULL::bigint) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_run_id BIGINT;
    v_status TEXT;
    v_expected_output INTEGER;
    v_item RECORD;
    v_bom_item RECORD;
    v_planned_quantity NUMERIC;
BEGIN

    -- 1. Validate user role.

    IF NOT public.has_role(
        ARRAY['admin', 'production']
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;


    -- 2. Validate production details.

    IF p_batch_number IS NULL
       OR BTRIM(p_batch_number) = '' THEN
        RAISE EXCEPTION 'Batch number is required';
    END IF;

    IF p_production_date IS NULL
       OR p_production_date >
          (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE THEN
        RAISE EXCEPTION 'Invalid production date';
    END IF;

    IF p_planned_output IS NULL
       OR p_planned_output <= 0 THEN
        RAISE EXCEPTION
            'Planned output must be greater than zero';
    END IF;

    IF p_actual_output IS NULL
       OR p_actual_output < 0 THEN
        RAISE EXCEPTION 'Invalid actual output';
    END IF;

    IF p_damaged_pouches IS NULL
       OR p_damaged_pouches < 0 THEN
        RAISE EXCEPTION 'Invalid damaged pouch quantity';
    END IF;

    IF p_labour_cost IS NULL
       OR p_labour_cost < 0
       OR p_labour_cost > 9999999999.99
       OR p_labour_cost <> ROUND(p_labour_cost, 2) THEN
        RAISE EXCEPTION 'Invalid labour cost';
    END IF;

    IF p_utility_cost IS NULL
       OR p_utility_cost < 0
       OR p_utility_cost > 9999999999.99
       OR p_utility_cost <> ROUND(p_utility_cost, 2) THEN
        RAISE EXCEPTION 'Invalid utility cost';
    END IF;


    -- 3. Validate selected BOM.

    SELECT expected_output
    INTO v_expected_output
    FROM boms
    WHERE id = p_bom_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid BOM';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM bom_items
        WHERE bom_id = p_bom_id
    ) THEN
        RAISE EXCEPTION 'Selected BOM has no materials';
    END IF;


    -- 4. Validate actual consumption data.

    IF p_items IS NULL
       OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'Invalid consumption data';
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION
            'Material consumption is required';
    END IF;


    -- 5. Create new production draft.

    IF p_run_id IS NULL THEN

        INSERT INTO production_runs (
            batch_number,
            bom_id,
            production_date,
            planned_output,
            actual_output,
            damaged_pouches,
            labour_cost,
            utility_cost,
            status
        )
        VALUES (
            BTRIM(p_batch_number),
            p_bom_id,
            p_production_date,
            p_planned_output,
            p_actual_output,
            p_damaged_pouches,
            p_labour_cost,
            p_utility_cost,
            'draft'
        )
        RETURNING id INTO v_run_id;


    -- 6. Edit existing production draft.

    ELSE

        SELECT status
        INTO v_status
        FROM production_runs
        WHERE id = p_run_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Production run not found';
        END IF;

        IF v_status <> 'draft' THEN
            RAISE EXCEPTION
                'Only draft production runs can be edited';
        END IF;

        v_run_id := p_run_id;

        UPDATE production_runs
        SET batch_number = BTRIM(p_batch_number),
            bom_id = p_bom_id,
            production_date = p_production_date,
            planned_output = p_planned_output,
            actual_output = p_actual_output,
            damaged_pouches = p_damaged_pouches,
            labour_cost = p_labour_cost,
            utility_cost = p_utility_cost
        WHERE id = v_run_id;

        DELETE FROM production_consumption
        WHERE production_run_id = v_run_id;

    END IF;


    -- 7. Calculate planned material quantities
    -- and save actual consumption.

    FOR v_item IN
        SELECT *
        FROM jsonb_to_recordset(p_items)
        AS x(
            inventory_item_id BIGINT,
            actual_quantity NUMERIC
        )
    LOOP

        IF v_item.actual_quantity IS NULL
           OR v_item.actual_quantity < 0
           OR v_item.actual_quantity > 999999999.999
           OR v_item.actual_quantity <>
              ROUND(v_item.actual_quantity, 3) THEN
            RAISE EXCEPTION
                'Invalid actual consumption quantity';
        END IF;


        SELECT
            bi.planned_quantity,
            ii.unit
        INTO v_bom_item
        FROM bom_items bi
        JOIN inventory_items ii
            ON ii.id = bi.inventory_item_id
        WHERE bi.bom_id = p_bom_id
          AND bi.inventory_item_id =
              v_item.inventory_item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Material % is not in the selected BOM',
                v_item.inventory_item_id;
        END IF;


        -- Scale BOM according to planned output.

        v_planned_quantity :=
            v_bom_item.planned_quantity
            * p_planned_output
            / v_expected_output;


        -- Packaging requires whole pieces.

        IF v_bom_item.unit = 'piece' THEN

            v_planned_quantity :=
                CEIL(v_planned_quantity);

            IF v_item.actual_quantity <>
               TRUNC(v_item.actual_quantity) THEN
                RAISE EXCEPTION
                    'Piece quantity must be a whole number';
            END IF;

        ELSE

            v_planned_quantity :=
                ROUND(v_planned_quantity, 3);

        END IF;


        IF EXISTS (
            SELECT 1
            FROM production_consumption
            WHERE production_run_id = v_run_id
              AND inventory_item_id =
                  v_item.inventory_item_id
        ) THEN
            RAISE EXCEPTION
                'Duplicate material in production run';
        END IF;


        INSERT INTO production_consumption (
            production_run_id,
            inventory_item_id,
            planned_quantity,
            actual_quantity
        )
        VALUES (
            v_run_id,
            v_item.inventory_item_id,
            v_planned_quantity,
            v_item.actual_quantity
        );

    END LOOP;


    -- 8. Ensure all BOM materials are included.

    IF EXISTS (
        SELECT 1
        FROM bom_items bi
        WHERE bi.bom_id = p_bom_id
          AND NOT EXISTS (
              SELECT 1
              FROM production_consumption pc
              WHERE pc.production_run_id = v_run_id
                AND pc.inventory_item_id =
                    bi.inventory_item_id
          )
    ) THEN
        RAISE EXCEPTION
            'Consumption must be entered for every BOM material';
    END IF;

    RETURN v_run_id;

END;
$$;


ALTER FUNCTION "public"."secure_save_production"("p_batch_number" "text", "p_bom_id" bigint, "p_production_date" "date", "p_planned_output" integer, "p_actual_output" integer, "p_damaged_pouches" integer, "p_labour_cost" numeric, "p_utility_cost" numeric, "p_items" "jsonb", "p_run_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_save_purchase"("p_supplier_id" bigint, "p_invoice_number" "text", "p_purchase_date" "date", "p_items" "jsonb", "p_purchase_id" bigint DEFAULT NULL::bigint) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_supplier RECORD;
    v_purchase RECORD;
    v_purchase_id BIGINT;
    v_item JSONB;
    v_inventory_item_id BIGINT;
    v_quantity NUMERIC;
    v_unit_price NUMERIC;
    v_unit TEXT;
BEGIN

    -- 3. Validate user permissions.

    IF NOT public.has_role(
        ARRAY['admin', 'accountant']
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;


    -- 4. Validate supplier.

    SELECT *
    INTO v_supplier
    FROM suppliers
    WHERE id = p_supplier_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Supplier not found';
    END IF;

    IF NOT v_supplier.is_active THEN
        RAISE EXCEPTION 'Supplier is inactive';
    END IF;


    -- 5. Validate invoice details.

    IF p_invoice_number IS NULL
       OR BTRIM(p_invoice_number) = '' THEN
        RAISE EXCEPTION
            'Invoice number is required';
    END IF;

    IF p_purchase_date IS NULL
       OR p_purchase_date >
          (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
    THEN
        RAISE EXCEPTION 'Invalid purchase date';
    END IF;


    -- 6. Validate purchase items.

    IF p_items IS NULL
       OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION
            'Purchase items must be an array';
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION
            'At least one purchase item is required';
    END IF;


    -- 7. Create a new purchase or edit a draft.

    IF p_purchase_id IS NULL THEN

        INSERT INTO purchases (
            supplier_id,
            supplier_name,
            invoice_number,
            purchase_date,
            status
        )
        VALUES (
            p_supplier_id,
            v_supplier.name,
            BTRIM(p_invoice_number),
            p_purchase_date,
            'draft'
        )
        RETURNING id INTO v_purchase_id;

    ELSE

        SELECT *
        INTO v_purchase
        FROM purchases
        WHERE id = p_purchase_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Purchase not found';
        END IF;

        IF v_purchase.status <> 'draft' THEN
            RAISE EXCEPTION
                'Only draft purchases can be edited';
        END IF;

        UPDATE purchases
        SET supplier_id = p_supplier_id,
            supplier_name = v_supplier.name,
            invoice_number = BTRIM(p_invoice_number),
            purchase_date = p_purchase_date
        WHERE id = p_purchase_id;

        v_purchase_id := p_purchase_id;

        DELETE FROM purchase_items
        WHERE purchase_id = v_purchase_id;

    END IF;


    -- 8. Validate and insert every purchase item.

    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_items)
    LOOP

        v_inventory_item_id :=
            (v_item ->> 'inventory_item_id')::BIGINT;

        v_quantity :=
            (v_item ->> 'quantity')::NUMERIC;

        v_unit_price :=
            (v_item ->> 'unit_price')::NUMERIC;


        -- Validate material.

        SELECT unit
        INTO v_unit
        FROM inventory_items
        WHERE id = v_inventory_item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Invalid inventory item';
        END IF;


        -- Validate quantity.

        IF v_quantity IS NULL
           OR v_quantity::TEXT IN (
               'NaN', 'Infinity', '-Infinity'
           )
           OR v_quantity <= 0
           OR v_quantity <> ROUND(v_quantity, 3)
        THEN
            RAISE EXCEPTION
                'Invalid purchase quantity';
        END IF;


        -- Pieces must be whole numbers.

        IF v_unit = 'piece'
           AND v_quantity <> TRUNC(v_quantity)
        THEN
            RAISE EXCEPTION
                'Piece quantity must be a whole number';
        END IF;


        -- Validate purchase price.

        IF v_unit_price IS NULL
           OR v_unit_price::TEXT IN (
               'NaN', 'Infinity', '-Infinity'
           )
           OR v_unit_price < 0
           OR v_unit_price <> ROUND(v_unit_price, 2)
        THEN
            RAISE EXCEPTION
                'Invalid purchase unit price';
        END IF;


        -- Prevent duplicate material entries.

        IF EXISTS (
            SELECT 1
            FROM purchase_items
            WHERE purchase_id = v_purchase_id
              AND inventory_item_id =
                  v_inventory_item_id
        ) THEN
            RAISE EXCEPTION
                'Duplicate material in purchase';
        END IF;


        -- Insert purchase item.

        INSERT INTO purchase_items (
            purchase_id,
            inventory_item_id,
            quantity,
            unit_price
        )
        VALUES (
            v_purchase_id,
            v_inventory_item_id,
            v_quantity,
            v_unit_price
        );

    END LOOP;


    -- 9. Return purchase ID.

    RETURN v_purchase_id;

END;
$$;


ALTER FUNCTION "public"."secure_save_purchase"("p_supplier_id" bigint, "p_invoice_number" "text", "p_purchase_date" "date", "p_items" "jsonb", "p_purchase_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_set_bom_active"("p_bom_id" bigint, "p_is_active" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_product_id BIGINT;
BEGIN
    IF NOT public.has_role(
        ARRAY['admin', 'production']
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    IF p_is_active IS NULL THEN
        RAISE EXCEPTION 'Active status is required';
    END IF;

    SELECT product_id
    INTO v_product_id
    FROM boms
    WHERE id = p_bom_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BOM not found';
    END IF;

    IF p_is_active THEN

        PERFORM id
        FROM products
        WHERE id = v_product_id
          AND is_active = TRUE
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product is inactive';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM bom_items
            WHERE bom_id = p_bom_id
        ) THEN
            RAISE EXCEPTION 'BOM has no materials';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM bom_items bi
            JOIN inventory_items i
                ON i.id = bi.inventory_item_id
            WHERE bi.bom_id = p_bom_id
              AND i.is_active = FALSE
        ) THEN
            RAISE EXCEPTION
                'BOM contains inactive materials';
        END IF;

    END IF;

    UPDATE boms
    SET is_active = p_is_active
    WHERE id = p_bom_id;

END;
$$;


ALTER FUNCTION "public"."secure_set_bom_active"("p_bom_id" bigint, "p_is_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_stock_period_report"("p_start_date" "date", "p_end_date" "date") RETURNS TABLE("sku" "text", "item_name" "text", "category" "text", "unit" "text", "opening_stock" numeric, "receipts" numeric, "issues" numeric, "adjustments" numeric, "closing_stock" numeric)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN

    IF NOT public.has_role(ARRAY[
        'admin', 'production', 'accountant', 'owner'
    ]) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    IF p_start_date IS NULL
       OR p_end_date IS NULL
       OR p_start_date > p_end_date THEN
        RAISE EXCEPTION 'Invalid report date range';
    END IF;

    RETURN QUERY
    SELECT
        r.sku::TEXT,
        r.item_name::TEXT,
        r.category::TEXT,
        r.unit::TEXT,
        r.opening_stock::NUMERIC,
        r.receipts::NUMERIC,
        r.issues::NUMERIC,
        r.adjustments::NUMERIC,
        r.closing_stock::NUMERIC
    FROM public.stock_period_report(
        p_start_date,
        p_end_date
    ) r;

END;
$$;


ALTER FUNCTION "public"."secure_stock_period_report"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stock_period_report"("p_start_date" "date", "p_end_date" "date") RETURNS TABLE("sku" "text", "item_name" "text", "category" "text", "unit" "text", "opening_stock" numeric, "receipts" numeric, "issues" numeric, "adjustments" numeric, "closing_stock" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
    WITH all_items AS (
        SELECT
            ii.id AS item_id,
            ii.sku,
            ii.name,
            ii.category,
            ii.unit
        FROM inventory_items ii

        UNION ALL

        SELECT
            p.id,
            p.sku,
            p.name,
            'finished_goods',
            'packet'
        FROM products p
    ),

    movements AS (
        SELECT
            COALESCE(
                sm.inventory_item_id,
                sm.product_id
            ) AS item_id,

            sm.product_id IS NOT NULL AS is_finished,

            sm.movement_type,
            sm.quantity,
            sm.movement_date

        FROM stock_movements sm
    )

    SELECT
        ai.sku,
        ai.name,
        ai.category,
        ai.unit,

        COALESCE(SUM(m.quantity) FILTER (
            WHERE m.movement_date < p_start_date
            OR (
                m.movement_type = 'opening'
                AND m.movement_date = p_start_date
            )
        ), 0) AS opening_stock,

        COALESCE(SUM(m.quantity) FILTER (
            WHERE m.movement_date
                BETWEEN p_start_date AND p_end_date
            AND (
                m.movement_type IN (
                    'purchase',
                    'production_receipt'
                )
                OR (
                    m.movement_type = 'opening'
                    AND m.movement_date > p_start_date
                )
            )
        ), 0) AS receipts,

        COALESCE(-SUM(m.quantity) FILTER (
            WHERE m.movement_date
                BETWEEN p_start_date AND p_end_date
            AND m.movement_type IN (
                'production_issue',
                'dispatch'
            )
        ), 0) AS issues,

        COALESCE(SUM(m.quantity) FILTER (
            WHERE m.movement_date
                BETWEEN p_start_date AND p_end_date
            AND m.movement_type = 'adjustment'
        ), 0) AS adjustments,

        COALESCE(SUM(m.quantity) FILTER (
            WHERE m.movement_date <= p_end_date
        ), 0) AS closing_stock

    FROM all_items ai

    LEFT JOIN movements m
        ON ai.item_id = m.item_id
        AND m.is_finished =
            (ai.category = 'finished_goods')

    WHERE p_start_date <= p_end_date

    GROUP BY
        ai.sku,
        ai.name,
        ai.category,
        ai.unit

    ORDER BY ai.category, ai.name;
$$;


ALTER FUNCTION "public"."stock_period_report"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supplier_purchase_report"("p_start_date" "date", "p_end_date" "date") RETURNS TABLE("supplier_id" bigint, "supplier_code" "text", "supplier_name" "text", "is_active" boolean, "total_purchases" bigint, "total_purchase_value" numeric, "last_purchase_date" "date")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN

    -- 1. Validate report permissions.

    IF NOT public.has_role(
        ARRAY['admin', 'accountant', 'owner']
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;


    -- 2. Validate report date range.

    IF p_start_date IS NULL
       OR p_end_date IS NULL
       OR p_start_date > p_end_date THEN

        RAISE EXCEPTION 'Invalid report date range';

    END IF;


    -- 3. Generate supplier-wise summary.

    RETURN QUERY

    SELECT
        s.id,
        s.supplier_code,
        s.name,
        s.is_active,

        COUNT(DISTINCT p.id),

        COALESCE(
            SUM(pi.quantity * pi.unit_price),
            0
        ),

        MAX(p.purchase_date)

    FROM suppliers s

    LEFT JOIN purchases p
        ON p.supplier_id = s.id
       AND p.status = 'posted'
       AND p.purchase_date
           BETWEEN p_start_date AND p_end_date

    LEFT JOIN purchase_items pi
        ON pi.purchase_id = p.id

    GROUP BY
        s.id,
        s.supplier_code,
        s.name,
        s.is_active

    ORDER BY
        COALESCE(
            SUM(pi.quantity * pi.unit_price),
            0
        ) DESC,
        s.name;

END;
$$;


ALTER FUNCTION "public"."supplier_purchase_report"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_company_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_company_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_order_customer"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM customers
        WHERE id = NEW.customer_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION
            'Selected customer is inactive or invalid';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_order_customer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_order_product"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM products
        WHERE id = NEW.product_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION
            'Selected product is inactive or invalid';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_order_product"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_production_bom"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM boms b
        JOIN products p ON p.id = b.product_id
        WHERE b.id = NEW.bom_id
          AND b.is_active = TRUE
          AND p.is_active = TRUE
    ) THEN
        RAISE EXCEPTION
            'Selected BOM or product is inactive';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM bom_items bi
        JOIN inventory_items i
            ON i.id = bi.inventory_item_id
        WHERE bi.bom_id = NEW.bom_id
          AND i.is_active = FALSE
    ) THEN
        RAISE EXCEPTION
            'BOM contains inactive materials';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_production_bom"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_purchase_material"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM inventory_items
        WHERE id = NEW.inventory_item_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION
            'Selected material is inactive or invalid';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_purchase_material"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" bigint NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "changed_by" "uuid",
    "changed_by_name" "text" NOT NULL,
    "changed_by_role" "text" NOT NULL,
    "correction_reason" "text",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "audit_logs_action_check" CHECK (("action" = ANY (ARRAY['INSERT'::"text", 'UPDATE'::"text", 'DELETE'::"text"])))
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


ALTER TABLE "public"."audit_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."bom_items" (
    "id" bigint NOT NULL,
    "bom_id" bigint NOT NULL,
    "inventory_item_id" bigint NOT NULL,
    "planned_quantity" numeric(12,3) NOT NULL,
    CONSTRAINT "bom_items_planned_quantity_check" CHECK (("planned_quantity" > (0)::numeric))
);


ALTER TABLE "public"."bom_items" OWNER TO "postgres";


ALTER TABLE "public"."bom_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."bom_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."boms" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "expected_output" integer NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "boms_expected_output_check" CHECK (("expected_output" > 0))
);


ALTER TABLE "public"."boms" OWNER TO "postgres";


ALTER TABLE "public"."boms" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."boms_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."company_settings" (
    "id" integer DEFAULT 1 NOT NULL,
    "company_name" "text" NOT NULL,
    "gstin" "text",
    "address" "text",
    "city" "text",
    "pincode" "text",
    "state" "text" DEFAULT 'Tamil Nadu'::"text" NOT NULL,
    "state_code" "text" DEFAULT '33'::"text" NOT NULL,
    "phone" "text",
    "email" "text",
    "bank_name" "text",
    "bank_account_number" "text",
    "bank_ifsc" "text",
    "payment_terms_days" integer DEFAULT 30 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_settings_check" CHECK ((("gstin" IS NULL) OR (("gstin" ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'::"text") AND ("left"("gstin", 2) = "state_code")))),
    CONSTRAINT "company_settings_company_name_check" CHECK (("btrim"("company_name") <> ''::"text")),
    CONSTRAINT "company_settings_id_check" CHECK (("id" = 1)),
    CONSTRAINT "company_settings_payment_terms_days_check" CHECK ((("payment_terms_days" >= 0) AND ("payment_terms_days" <= 365))),
    CONSTRAINT "company_settings_state_code_check" CHECK (("state_code" = '33'::"text"))
);


ALTER TABLE "public"."company_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_note_counters" (
    "financial_year" "text" NOT NULL,
    "last_number" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."credit_note_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_note_items" (
    "id" bigint NOT NULL,
    "credit_note_id" bigint NOT NULL,
    "invoice_item_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "product_name" "text" NOT NULL,
    "hsn_code" "text",
    "quantity" integer NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "gst_rate" numeric(5,2) NOT NULL,
    "taxable_amount" numeric(12,2) NOT NULL,
    "cgst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "igst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    CONSTRAINT "credit_note_items_cgst_amount_check" CHECK (("cgst_amount" >= (0)::numeric)),
    CONSTRAINT "credit_note_items_check" CHECK (("total_amount" = ((("taxable_amount" + "cgst_amount") + "sgst_amount") + "igst_amount"))),
    CONSTRAINT "credit_note_items_gst_rate_check" CHECK ((("gst_rate" >= (0)::numeric) AND ("gst_rate" <= (100)::numeric))),
    CONSTRAINT "credit_note_items_igst_amount_check" CHECK (("igst_amount" >= (0)::numeric)),
    CONSTRAINT "credit_note_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "credit_note_items_sgst_amount_check" CHECK (("sgst_amount" >= (0)::numeric)),
    CONSTRAINT "credit_note_items_taxable_amount_check" CHECK (("taxable_amount" >= (0)::numeric)),
    CONSTRAINT "credit_note_items_total_amount_check" CHECK (("total_amount" >= (0)::numeric)),
    CONSTRAINT "credit_note_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."credit_note_items" OWNER TO "postgres";


ALTER TABLE "public"."credit_note_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."credit_note_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."credit_notes" (
    "id" bigint NOT NULL,
    "credit_note_number" "text" NOT NULL,
    "invoice_id" bigint NOT NULL,
    "credit_note_date" "date" DEFAULT (("now"() AT TIME ZONE 'Asia/Kolkata'::"text"))::"date" NOT NULL,
    "reason" "text" NOT NULL,
    "taxable_amount" numeric(12,2) NOT NULL,
    "cgst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "igst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "credit_notes_cgst_amount_check" CHECK (("cgst_amount" >= (0)::numeric)),
    CONSTRAINT "credit_notes_check" CHECK (("total_amount" = ((("taxable_amount" + "cgst_amount") + "sgst_amount") + "igst_amount"))),
    CONSTRAINT "credit_notes_igst_amount_check" CHECK (("igst_amount" >= (0)::numeric)),
    CONSTRAINT "credit_notes_reason_check" CHECK (("btrim"("reason") <> ''::"text")),
    CONSTRAINT "credit_notes_sgst_amount_check" CHECK (("sgst_amount" >= (0)::numeric)),
    CONSTRAINT "credit_notes_taxable_amount_check" CHECK (("taxable_amount" >= (0)::numeric)),
    CONSTRAINT "credit_notes_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


ALTER TABLE "public"."credit_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" bigint NOT NULL,
    "invoice_number" "text" NOT NULL,
    "order_id" bigint NOT NULL,
    "invoice_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_address" "text",
    "customer_gstin" "text",
    "place_of_supply" "text" NOT NULL,
    "state_code" "text" NOT NULL,
    "taxable_amount" numeric(12,2) NOT NULL,
    "cgst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "igst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'issued'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "due_date" "date" DEFAULT (CURRENT_DATE + 30) NOT NULL,
    "company_snapshot" "jsonb",
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['issued'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."credit_note_register" WITH ("security_invoker"='true') AS
 SELECT "cn"."id" AS "credit_note_id",
    "cn"."credit_note_number",
    "cn"."credit_note_date",
    "i"."invoice_number",
    "i"."invoice_date",
    "i"."customer_name",
    "i"."customer_gstin",
    "i"."place_of_supply",
    "i"."state_code",
    "cn"."reason",
    "cn"."taxable_amount",
    "cn"."cgst_amount",
    "cn"."sgst_amount",
    "cn"."igst_amount",
    (("cn"."cgst_amount" + "cn"."sgst_amount") + "cn"."igst_amount") AS "total_gst",
    "cn"."total_amount"
   FROM ("public"."credit_notes" "cn"
     JOIN "public"."invoices" "i" ON (("i"."id" = "cn"."invoice_id")));


ALTER VIEW "public"."credit_note_register" OWNER TO "postgres";


ALTER TABLE "public"."credit_notes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."credit_notes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "customer_type" "text" NOT NULL,
    "phone" "text",
    "address" "text",
    "state" "text" NOT NULL,
    "state_code" "text" NOT NULL,
    "gstin" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "customer_name_not_empty" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "customer_state_code_format" CHECK (("state_code" ~ '^[0-9]{2}$'::"text")),
    CONSTRAINT "customer_state_not_empty" CHECK (("btrim"("state") <> ''::"text")),
    CONSTRAINT "customers_customer_type_check" CHECK (("customer_type" = ANY (ARRAY['retailer'::"text", 'distributor'::"text"])))
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" bigint NOT NULL,
    "invoice_id" bigint NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "payment_method" "text" NOT NULL,
    "reference_number" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'recorded'::"text" NOT NULL,
    "reversed_at" timestamp with time zone,
    "reversed_by" "uuid",
    "reversal_reason" "text",
    CONSTRAINT "payment_reversal_consistency" CHECK (((("status" = 'recorded'::"text") AND ("reversed_at" IS NULL) AND ("reversed_by" IS NULL) AND ("reversal_reason" IS NULL)) OR (("status" = 'reversed'::"text") AND ("reversed_at" IS NOT NULL) AND ("reversed_by" IS NOT NULL) AND ("reversal_reason" IS NOT NULL) AND ("btrim"("reversal_reason") <> ''::"text")))),
    CONSTRAINT "payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "payments_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'upi'::"text", 'bank_transfer'::"text", 'cheque'::"text"]))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['recorded'::"text", 'reversed'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."invoice_receivables" WITH ("security_invoker"='true') AS
 SELECT "i"."id" AS "invoice_id",
    "i"."invoice_number",
    "i"."customer_name",
    "i"."invoice_date",
    "i"."due_date",
    "i"."total_amount",
    COALESCE("p"."amount_paid", (0)::numeric) AS "amount_paid",
    ("i"."total_amount" - COALESCE("p"."amount_paid", (0)::numeric)) AS "outstanding_amount",
        CASE
            WHEN (COALESCE("p"."amount_paid", (0)::numeric) >= "i"."total_amount") THEN 'paid'::"text"
            WHEN (COALESCE("p"."amount_paid", (0)::numeric) > (0)::numeric) THEN 'partially_paid'::"text"
            ELSE 'unpaid'::"text"
        END AS "payment_status",
        CASE
            WHEN (COALESCE("p"."amount_paid", (0)::numeric) >= "i"."total_amount") THEN 0
            ELSE GREATEST((CURRENT_DATE - "i"."due_date"), 0)
        END AS "overdue_days"
   FROM ("public"."invoices" "i"
     LEFT JOIN ( SELECT "payments"."invoice_id",
            "sum"("payments"."amount") AS "amount_paid"
           FROM "public"."payments"
          WHERE ("payments"."status" = 'recorded'::"text")
          GROUP BY "payments"."invoice_id") "p" ON (("p"."invoice_id" = "i"."id")))
  WHERE ("i"."status" = 'issued'::"text");


ALTER VIEW "public"."invoice_receivables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_orders" (
    "id" bigint NOT NULL,
    "order_number" "text" NOT NULL,
    "customer_id" bigint NOT NULL,
    "salesman_name" "text" NOT NULL,
    "order_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "salesman_id" "uuid",
    "closure_reason" "text",
    "closed_at" timestamp with time zone,
    "closed_by" "uuid",
    CONSTRAINT "sales_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'invoiced'::"text", 'dispatched'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."sales_orders" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."customer_outstanding_report" WITH ("security_invoker"='true') AS
 SELECT "c"."id" AS "customer_id",
    "c"."name" AS "customer_name",
    "c"."customer_type",
    "count"("ir"."invoice_id") AS "total_invoices",
    COALESCE("sum"("ir"."total_amount"), (0)::numeric) AS "total_invoiced",
    COALESCE("sum"("ir"."amount_paid"), (0)::numeric) AS "total_collected",
    COALESCE("sum"("ir"."outstanding_amount"), (0)::numeric) AS "total_outstanding",
    COALESCE("sum"("ir"."outstanding_amount") FILTER (WHERE ("ir"."overdue_days" > 0)), (0)::numeric) AS "overdue_amount"
   FROM ((("public"."customers" "c"
     LEFT JOIN "public"."sales_orders" "so" ON (("c"."id" = "so"."customer_id")))
     LEFT JOIN "public"."invoices" "i" ON (("so"."id" = "i"."order_id")))
     LEFT JOIN "public"."invoice_receivables" "ir" ON (("i"."id" = "ir"."invoice_id")))
  GROUP BY "c"."id", "c"."name", "c"."customer_type";


ALTER VIEW "public"."customer_outstanding_report" OWNER TO "postgres";


ALTER TABLE "public"."customers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."customers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."dispatches" (
    "id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "invoice_id" bigint NOT NULL,
    "dispatch_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dispatches" OWNER TO "postgres";


ALTER TABLE "public"."dispatches" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."dispatches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" bigint NOT NULL,
    "invoice_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "product_name" "text" NOT NULL,
    "hsn_code" "text",
    "quantity" integer NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "gst_rate" numeric(5,2) NOT NULL,
    "taxable_amount" numeric(12,2) NOT NULL,
    "cgst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "igst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    CONSTRAINT "invoice_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."invoice_items" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."gst_outward_supplies" WITH ("security_invoker"='true') AS
 SELECT "i"."id" AS "invoice_id",
    "i"."invoice_number",
    "i"."invoice_date",
    "i"."customer_name",
    "i"."customer_gstin",
    "i"."place_of_supply",
    "i"."state_code",
        CASE
            WHEN (NULLIF(TRIM(BOTH FROM "i"."customer_gstin"), ''::"text") IS NULL) THEN 'B2C'::"text"
            ELSE 'B2B'::"text"
        END AS "supply_category",
        CASE
            WHEN ("i"."state_code" = '33'::"text") THEN 'intra_state'::"text"
            ELSE 'inter_state'::"text"
        END AS "supply_type",
    "ii"."gst_rate",
    "sum"("ii"."taxable_amount") AS "taxable_amount",
    "sum"("ii"."cgst_amount") AS "cgst_amount",
    "sum"("ii"."sgst_amount") AS "sgst_amount",
    "sum"("ii"."igst_amount") AS "igst_amount",
    "sum"((("ii"."cgst_amount" + "ii"."sgst_amount") + "ii"."igst_amount")) AS "total_gst",
    "sum"("ii"."total_amount") AS "total_amount"
   FROM ("public"."invoices" "i"
     JOIN "public"."invoice_items" "ii" ON (("i"."id" = "ii"."invoice_id")))
  WHERE ("i"."status" = 'issued'::"text")
  GROUP BY "i"."id", "i"."invoice_number", "i"."invoice_date", "i"."customer_name", "i"."customer_gstin", "i"."place_of_supply", "i"."state_code", "ii"."gst_rate";


ALTER VIEW "public"."gst_outward_supplies" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."gst_transaction_register" AS
SELECT
    NULL::"text" AS "document_type",
    NULL::"text" AS "document_number",
    NULL::"date" AS "document_date",
    NULL::"text" AS "original_invoice_number",
    NULL::"text" AS "customer_name",
    NULL::"text" AS "customer_gstin",
    NULL::"text" AS "state_code",
    NULL::"text" AS "supply_type",
    NULL::numeric(5,2) AS "gst_rate",
    NULL::numeric AS "taxable_amount",
    NULL::numeric AS "cgst_amount",
    NULL::numeric AS "sgst_amount",
    NULL::numeric AS "igst_amount",
    NULL::numeric AS "total_amount";


ALTER VIEW "public"."gst_transaction_register" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text" NOT NULL,
    "category" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "average_unit_cost" numeric(16,6) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "reorder_level" numeric(12,3) DEFAULT 0 NOT NULL,
    "name_ta" "text",
    "name_hi" "text",
    CONSTRAINT "inventory_items_average_unit_cost_check" CHECK (("average_unit_cost" >= (0)::numeric)),
    CONSTRAINT "inventory_items_category_check" CHECK (("category" = ANY (ARRAY['raw_material'::"text", 'packaging'::"text"]))),
    CONSTRAINT "inventory_items_reorder_level_check" CHECK (("reorder_level" >= (0)::numeric)),
    CONSTRAINT "inventory_items_unit_check" CHECK (("unit" = ANY (ARRAY['kg'::"text", 'litre'::"text", 'piece'::"text"]))),
    CONSTRAINT "inventory_name_not_empty" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "inventory_sku_not_empty" CHECK (("btrim"("sku") <> ''::"text"))
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


ALTER TABLE "public"."inventory_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."inventory_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."invoice_counters" (
    "financial_year" "text" NOT NULL,
    "last_number" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."invoice_counters" OWNER TO "postgres";


ALTER TABLE "public"."invoice_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."invoice_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."invoices" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."invoices_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" bigint NOT NULL,
    "inventory_item_id" bigint,
    "product_id" bigint,
    "movement_type" "text" NOT NULL,
    "quantity" numeric(12,3) NOT NULL,
    "reference_type" "text",
    "reference_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "unit_cost" numeric(16,6),
    "movement_date" "date" DEFAULT (("now"() AT TIME ZONE 'Asia/Kolkata'::"text"))::"date" NOT NULL,
    CONSTRAINT "finished_stock_whole_packets" CHECK ((("product_id" IS NULL) OR ("quantity" = "trunc"("quantity")))),
    CONSTRAINT "stock_movements_check" CHECK (((("inventory_item_id" IS NOT NULL) AND ("product_id" IS NULL)) OR (("inventory_item_id" IS NULL) AND ("product_id" IS NOT NULL)))),
    CONSTRAINT "stock_movements_movement_type_check" CHECK (("movement_type" = ANY (ARRAY['opening'::"text", 'purchase'::"text", 'production_issue'::"text", 'production_receipt'::"text", 'dispatch'::"text", 'adjustment'::"text"]))),
    CONSTRAINT "stock_movements_quantity_check" CHECK (("quantity" <> (0)::numeric)),
    CONSTRAINT "stock_movements_unit_cost_check" CHECK (("unit_cost" >= (0)::numeric))
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."material_stock" WITH ("security_invoker"='true') AS
 SELECT "ii"."id" AS "inventory_item_id",
    "ii"."name",
    "ii"."sku",
    "ii"."category",
    "ii"."unit",
    COALESCE("sum"("sm"."quantity"), (0)::numeric) AS "current_stock",
    "ii"."average_unit_cost",
    "round"((COALESCE("sum"("sm"."quantity"), (0)::numeric) * "ii"."average_unit_cost"), 2) AS "stock_value"
   FROM ("public"."inventory_items" "ii"
     LEFT JOIN "public"."stock_movements" "sm" ON (("ii"."id" = "sm"."inventory_item_id")))
  GROUP BY "ii"."id", "ii"."name", "ii"."sku", "ii"."category", "ii"."unit", "ii"."average_unit_cost";


ALTER VIEW "public"."material_stock" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."payment_collection_report" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "payment_id",
    "p"."payment_date",
    "i"."invoice_number",
    "i"."customer_name",
    "so"."salesman_name",
    "p"."amount",
    "p"."payment_method",
    "p"."reference_number",
    "p"."notes"
   FROM (("public"."payments" "p"
     JOIN "public"."invoices" "i" ON (("i"."id" = "p"."invoice_id")))
     JOIN "public"."sales_orders" "so" ON (("so"."id" = "i"."order_id")))
  WHERE ("p"."status" = 'recorded'::"text");


ALTER VIEW "public"."payment_collection_report" OWNER TO "postgres";


ALTER TABLE "public"."payments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."payments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text" NOT NULL,
    "packet_size_g" integer NOT NULL,
    "selling_price" numeric(12,2) NOT NULL,
    "gst_rate" numeric(5,2) DEFAULT 5.00 NOT NULL,
    "hsn_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "packets_per_carton" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "reorder_level" integer DEFAULT 0 NOT NULL,
    "name_ta" "text",
    "name_hi" "text",
    CONSTRAINT "product_gst_rate_valid" CHECK ((("gst_rate" >= (0)::numeric) AND ("gst_rate" <= (100)::numeric))),
    CONSTRAINT "product_name_not_empty" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "product_sku_not_empty" CHECK (("btrim"("sku") <> ''::"text")),
    CONSTRAINT "products_packet_size_g_check" CHECK (("packet_size_g" > 0)),
    CONSTRAINT "products_packets_per_carton_check" CHECK (("packets_per_carton" > 0)),
    CONSTRAINT "products_reorder_level_check" CHECK (("reorder_level" >= 0)),
    CONSTRAINT "products_selling_price_check" CHECK (("selling_price" >= (0)::numeric))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_order_items" (
    "id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "gst_rate" numeric(5,2) NOT NULL,
    CONSTRAINT "sales_order_items_gst_rate_check" CHECK ((("gst_rate" >= (0)::numeric) AND ("gst_rate" <= (100)::numeric))),
    CONSTRAINT "sales_order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "sales_order_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."sales_order_items" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."product_stock" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "product_id",
    "p"."name",
    "p"."sku",
    "p"."packet_size_g",
    COALESCE("s"."physical_stock", (0)::numeric) AS "physical_stock",
    COALESCE("r"."reserved_stock", (0)::bigint) AS "reserved_stock",
    (COALESCE("s"."physical_stock", (0)::numeric) - (COALESCE("r"."reserved_stock", (0)::bigint))::numeric) AS "available_stock"
   FROM (("public"."products" "p"
     LEFT JOIN ( SELECT "stock_movements"."product_id",
            "sum"("stock_movements"."quantity") AS "physical_stock"
           FROM "public"."stock_movements"
          WHERE ("stock_movements"."product_id" IS NOT NULL)
          GROUP BY "stock_movements"."product_id") "s" ON (("s"."product_id" = "p"."id")))
     LEFT JOIN ( SELECT "soi"."product_id",
            "sum"("soi"."quantity") AS "reserved_stock"
           FROM ("public"."sales_order_items" "soi"
             JOIN "public"."sales_orders" "so" ON (("soi"."order_id" = "so"."id")))
          WHERE ("so"."status" = ANY (ARRAY['approved'::"text", 'invoiced'::"text"]))
          GROUP BY "soi"."product_id") "r" ON (("r"."product_id" = "p"."id")));


ALTER VIEW "public"."product_stock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."production_consumption" (
    "id" bigint NOT NULL,
    "production_run_id" bigint NOT NULL,
    "inventory_item_id" bigint NOT NULL,
    "planned_quantity" numeric(12,3) NOT NULL,
    "actual_quantity" numeric(12,3) NOT NULL,
    "unit_cost" numeric(16,6),
    CONSTRAINT "production_consumption_actual_quantity_check" CHECK (("actual_quantity" >= (0)::numeric)),
    CONSTRAINT "production_consumption_planned_quantity_check" CHECK (("planned_quantity" >= (0)::numeric)),
    CONSTRAINT "production_consumption_unit_cost_check" CHECK (("unit_cost" >= (0)::numeric))
);


ALTER TABLE "public"."production_consumption" OWNER TO "postgres";


ALTER TABLE "public"."production_consumption" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."production_consumption_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."production_runs" (
    "id" bigint NOT NULL,
    "batch_number" "text" NOT NULL,
    "bom_id" bigint NOT NULL,
    "production_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "planned_output" integer NOT NULL,
    "actual_output" integer,
    "damaged_pouches" integer DEFAULT 0 NOT NULL,
    "labour_cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "utility_cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cancellation_reason" "text",
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    CONSTRAINT "production_labour_cost_valid" CHECK (("labour_cost" >= (0)::numeric)),
    CONSTRAINT "production_runs_actual_output_check" CHECK (("actual_output" >= 0)),
    CONSTRAINT "production_runs_damaged_pouches_check" CHECK (("damaged_pouches" >= 0)),
    CONSTRAINT "production_runs_planned_output_check" CHECK (("planned_output" > 0)),
    CONSTRAINT "production_runs_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'posted'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "production_utility_cost_valid" CHECK (("utility_cost" >= (0)::numeric))
);


ALTER TABLE "public"."production_runs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."production_costing" WITH ("security_invoker"='true') AS
 SELECT "pr"."id" AS "production_run_id",
    "pr"."batch_number",
    "pr"."production_date",
    "p"."name" AS "product_name",
    "pr"."planned_output",
    "pr"."actual_output",
    "mc"."material_cost",
    "pr"."labour_cost",
    "pr"."utility_cost",
    (("mc"."material_cost" + "pr"."labour_cost") + "pr"."utility_cost") AS "total_production_cost",
    "round"(((("mc"."material_cost" + "pr"."labour_cost") + "pr"."utility_cost") / (NULLIF("pr"."actual_output", 0))::numeric), 2) AS "cost_per_packet"
   FROM ((("public"."production_runs" "pr"
     JOIN "public"."boms" "b" ON (("pr"."bom_id" = "b"."id")))
     JOIN "public"."products" "p" ON (("b"."product_id" = "p"."id")))
     JOIN ( SELECT "production_consumption"."production_run_id",
                CASE
                    WHEN ("count"("production_consumption"."unit_cost") = "count"(*)) THEN "round"("sum"(("production_consumption"."actual_quantity" * "production_consumption"."unit_cost")), 2)
                    ELSE NULL::numeric
                END AS "material_cost"
           FROM "public"."production_consumption"
          GROUP BY "production_consumption"."production_run_id") "mc" ON (("mc"."production_run_id" = "pr"."id")))
  WHERE ("pr"."status" = 'posted'::"text");


ALTER VIEW "public"."production_costing" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."production_margin" WITH ("security_invoker"='true') AS
 SELECT "pc"."production_run_id",
    "pc"."batch_number",
    "pc"."product_name",
    "pc"."actual_output",
    "pc"."total_production_cost",
    "pc"."cost_per_packet",
    "p"."selling_price",
    "round"(("p"."selling_price" - ("pc"."total_production_cost" / (NULLIF("pc"."actual_output", 0))::numeric)), 2) AS "margin_per_packet",
    "round"(((("p"."selling_price" - ("pc"."total_production_cost" / (NULLIF("pc"."actual_output", 0))::numeric)) / NULLIF("p"."selling_price", (0)::numeric)) * (100)::numeric), 2) AS "margin_percentage"
   FROM ((("public"."production_costing" "pc"
     JOIN "public"."production_runs" "pr" ON (("pc"."production_run_id" = "pr"."id")))
     JOIN "public"."boms" "b" ON (("pr"."bom_id" = "b"."id")))
     JOIN "public"."products" "p" ON (("b"."product_id" = "p"."id")));


ALTER VIEW "public"."production_margin" OWNER TO "postgres";


ALTER TABLE "public"."production_runs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."production_runs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."production_summary_report" WITH ("security_invoker"='true') AS
 SELECT "pr"."id" AS "production_run_id",
    "pr"."batch_number",
    "pr"."production_date",
    ((("p"."name" || ' '::"text") || "p"."packet_size_g") || 'g'::"text") AS "product_name",
    "pr"."planned_output",
    "pr"."actual_output",
    ("pr"."actual_output" - "pr"."planned_output") AS "output_variance",
    "round"(((("pr"."actual_output")::numeric * 100.0) / (NULLIF("pr"."planned_output", 0))::numeric), 2) AS "yield_percentage",
    "round"((((("pr"."actual_output" - "pr"."planned_output"))::numeric * 100.0) / (NULLIF("pr"."planned_output", 0))::numeric), 2) AS "yield_variance_percentage",
        CASE
            WHEN ("abs"((((("pr"."actual_output" - "pr"."planned_output"))::numeric * 100.0) / (NULLIF("pr"."planned_output", 0))::numeric)) > (3)::numeric) THEN 'alert'::"text"
            ELSE 'within_tolerance'::"text"
        END AS "yield_status",
    "pr"."damaged_pouches",
    "pc"."material_cost",
    "pc"."labour_cost",
    "pc"."utility_cost",
    "pc"."total_production_cost",
    "pc"."cost_per_packet",
    "pm"."selling_price",
    "pm"."margin_per_packet",
    "pm"."margin_percentage"
   FROM (((("public"."production_runs" "pr"
     JOIN "public"."boms" "b" ON (("pr"."bom_id" = "b"."id")))
     JOIN "public"."products" "p" ON (("b"."product_id" = "p"."id")))
     JOIN "public"."production_costing" "pc" ON (("pr"."id" = "pc"."production_run_id")))
     JOIN "public"."production_margin" "pm" ON (("pr"."id" = "pm"."production_run_id")))
  WHERE ("pr"."status" = 'posted'::"text");


ALTER VIEW "public"."production_summary_report" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."production_variance_report" WITH ("security_invoker"='true') AS
 SELECT "pr"."id" AS "production_run_id",
    "pr"."batch_number",
    "pr"."production_date",
    ((("p"."name" || ' '::"text") || "p"."packet_size_g") || 'g'::"text") AS "product_name",
    "ii"."sku",
    "ii"."name" AS "material_name",
    "ii"."category",
    "ii"."unit",
    "pc"."planned_quantity",
    "pc"."actual_quantity",
    ("pc"."actual_quantity" - "pc"."planned_quantity") AS "quantity_variance",
    "round"(((("pc"."actual_quantity" - "pc"."planned_quantity") * (100)::numeric) / NULLIF("pc"."planned_quantity", (0)::numeric)), 2) AS "variance_percentage",
        CASE
            WHEN (("pc"."planned_quantity" = (0)::numeric) AND ("pc"."actual_quantity" > (0)::numeric)) THEN 'unplanned_consumption'::"text"
            WHEN ("abs"(((("pc"."actual_quantity" - "pc"."planned_quantity") * (100)::numeric) / NULLIF("pc"."planned_quantity", (0)::numeric))) > (3)::numeric) THEN 'alert'::"text"
            ELSE 'within_tolerance'::"text"
        END AS "variance_status",
    "pc"."unit_cost",
    "round"((("pc"."actual_quantity" - "pc"."planned_quantity") * "pc"."unit_cost"), 2) AS "cost_variance"
   FROM (((("public"."production_consumption" "pc"
     JOIN "public"."production_runs" "pr" ON (("pc"."production_run_id" = "pr"."id")))
     JOIN "public"."inventory_items" "ii" ON (("pc"."inventory_item_id" = "ii"."id")))
     JOIN "public"."boms" "b" ON (("pr"."bom_id" = "b"."id")))
     JOIN "public"."products" "p" ON (("b"."product_id" = "p"."id")))
  WHERE ("pr"."status" = 'posted'::"text");


ALTER VIEW "public"."production_variance_report" OWNER TO "postgres";


ALTER TABLE "public"."products" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."products_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['salesman'::"text", 'admin'::"text", 'production'::"text", 'accountant'::"text", 'owner'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_items" (
    "id" bigint NOT NULL,
    "purchase_id" bigint NOT NULL,
    "inventory_item_id" bigint NOT NULL,
    "quantity" numeric(12,3) NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "stock_before_purchase" numeric(16,3),
    "average_cost_before_purchase" numeric(16,6),
    CONSTRAINT "purchase_items_average_cost_before_purchase_check" CHECK (("average_cost_before_purchase" >= (0)::numeric)),
    CONSTRAINT "purchase_items_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "purchase_items_stock_before_purchase_check" CHECK (("stock_before_purchase" >= (0)::numeric)),
    CONSTRAINT "purchase_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."purchase_items" OWNER TO "postgres";


ALTER TABLE "public"."purchase_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."purchase_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."purchases" (
    "id" bigint NOT NULL,
    "supplier_name" "text" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "purchase_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cancellation_reason" "text",
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "supplier_id" bigint NOT NULL,
    CONSTRAINT "purchases_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'posted'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."purchases" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."purchase_register" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "purchase_id",
    "p"."invoice_number",
    "p"."purchase_date",
    "p"."supplier_name",
    "ii"."id" AS "inventory_item_id",
    "ii"."sku",
    "ii"."name" AS "item_name",
    "ii"."category",
    "ii"."unit",
    "pi"."quantity",
    "pi"."unit_price",
    "round"(("pi"."quantity" * "pi"."unit_price"), 2) AS "total_amount",
    "p"."status" AS "purchase_status"
   FROM (("public"."purchases" "p"
     JOIN "public"."purchase_items" "pi" ON (("p"."id" = "pi"."purchase_id")))
     JOIN "public"."inventory_items" "ii" ON (("pi"."inventory_item_id" = "ii"."id")))
  WHERE ("p"."status" = 'posted'::"text");


ALTER VIEW "public"."purchase_register" OWNER TO "postgres";


ALTER TABLE "public"."purchases" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."purchases_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."receivables_ageing" WITH ("security_invoker"='true') AS
 SELECT "invoice_id",
    "invoice_number",
    "customer_name",
    "due_date",
    "outstanding_amount",
    "overdue_days",
        CASE
            WHEN ("overdue_days" = 0) THEN 'Not overdue'::"text"
            WHEN ("overdue_days" <= 30) THEN '1-30 days'::"text"
            WHEN ("overdue_days" <= 60) THEN '31-60 days'::"text"
            WHEN ("overdue_days" <= 90) THEN '61-90 days'::"text"
            ELSE '90+ days'::"text"
        END AS "ageing_bucket"
   FROM "public"."invoice_receivables"
  WHERE ("outstanding_amount" > (0)::numeric);


ALTER VIEW "public"."receivables_ageing" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."reorder_alerts" WITH ("security_invoker"='true') AS
 SELECT "i"."id" AS "item_id",
    "i"."sku",
    "i"."name" AS "item_name",
    "i"."category",
    "i"."unit",
    "m"."current_stock" AS "available_stock",
    "i"."reorder_level",
    GREATEST(("i"."reorder_level" - "m"."current_stock"), (0)::numeric) AS "shortage_quantity",
        CASE
            WHEN ("m"."current_stock" <= (0)::numeric) THEN 'out_of_stock'::"text"
            ELSE 'low_stock'::"text"
        END AS "alert_status"
   FROM ("public"."inventory_items" "i"
     JOIN "public"."material_stock" "m" ON (("m"."inventory_item_id" = "i"."id")))
  WHERE (("i"."is_active" = true) AND ("m"."current_stock" <= "i"."reorder_level"))
UNION ALL
 SELECT "p"."id" AS "item_id",
    "p"."sku",
    "p"."name" AS "item_name",
    'finished_goods'::"text" AS "category",
    'packet'::"text" AS "unit",
    "s"."available_stock",
    "p"."reorder_level",
    GREATEST((("p"."reorder_level")::numeric - "s"."available_stock"), (0)::numeric) AS "shortage_quantity",
        CASE
            WHEN ("s"."available_stock" <= (0)::numeric) THEN 'out_of_stock'::"text"
            ELSE 'low_stock'::"text"
        END AS "alert_status"
   FROM ("public"."products" "p"
     JOIN "public"."product_stock" "s" ON (("s"."product_id" = "p"."id")))
  WHERE (("p"."is_active" = true) AND ("s"."available_stock" <= ("p"."reorder_level")::numeric));


ALTER VIEW "public"."reorder_alerts" OWNER TO "postgres";


ALTER TABLE "public"."sales_order_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."sales_order_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."sales_order_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sales_order_number_seq" OWNER TO "postgres";


ALTER TABLE "public"."sales_orders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."sales_orders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."sales_register" WITH ("security_invoker"='true') AS
 SELECT "i"."id" AS "invoice_id",
    "i"."invoice_number",
    "i"."invoice_date",
    "so"."order_number",
    "so"."salesman_name",
    "i"."customer_name",
    "c"."customer_type",
    "i"."customer_gstin",
    "i"."place_of_supply",
    "i"."state_code",
    "i"."taxable_amount",
    "i"."cgst_amount",
    "i"."sgst_amount",
    "i"."igst_amount",
    (("i"."cgst_amount" + "i"."sgst_amount") + "i"."igst_amount") AS "total_gst",
    "i"."total_amount",
    "i"."status" AS "invoice_status",
    "so"."status" AS "order_status",
    "d"."dispatch_date"
   FROM ((("public"."invoices" "i"
     JOIN "public"."sales_orders" "so" ON (("i"."order_id" = "so"."id")))
     JOIN "public"."customers" "c" ON (("so"."customer_id" = "c"."id")))
     LEFT JOIN "public"."dispatches" "d" ON (("i"."id" = "d"."invoice_id")));


ALTER VIEW "public"."sales_register" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."stock_ledger_report" WITH ("security_invoker"='true') AS
 SELECT "sm"."id" AS "movement_id",
    "sm"."movement_date",
    COALESCE("ii"."sku", "p"."sku") AS "sku",
    COALESCE("ii"."name", "p"."name") AS "item_name",
    COALESCE("ii"."category", 'finished_goods'::"text") AS "category",
    COALESCE("ii"."unit", 'packet'::"text") AS "unit",
    "sm"."movement_type",
        CASE
            WHEN ("sm"."quantity" > (0)::numeric) THEN "sm"."quantity"
            ELSE (0)::numeric
        END AS "stock_in",
        CASE
            WHEN ("sm"."quantity" < (0)::numeric) THEN (- "sm"."quantity")
            ELSE (0)::numeric
        END AS "stock_out",
    "sum"("sm"."quantity") OVER (PARTITION BY "sm"."inventory_item_id", "sm"."product_id" ORDER BY "sm"."movement_date", "sm"."created_at", "sm"."id" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "running_balance",
    "sm"."unit_cost",
    "sm"."reference_type",
    "sm"."reference_id",
    "sm"."created_at"
   FROM (("public"."stock_movements" "sm"
     LEFT JOIN "public"."inventory_items" "ii" ON (("sm"."inventory_item_id" = "ii"."id")))
     LEFT JOIN "public"."products" "p" ON (("sm"."product_id" = "p"."id")));


ALTER VIEW "public"."stock_ledger_report" OWNER TO "postgres";


ALTER TABLE "public"."stock_movements" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."stock_movements_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" bigint NOT NULL,
    "supplier_code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "contact_person" "text",
    "phone" "text",
    "email" "text",
    "gstin" "text",
    "address" "text",
    "state" "text",
    "state_code" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "suppliers_check" CHECK ((("gstin" IS NULL) OR (("state_code" IS NOT NULL) AND ("left"("gstin", 2) = "state_code")))),
    CONSTRAINT "suppliers_gstin_check" CHECK ((("gstin" IS NULL) OR ("gstin" ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'::"text"))),
    CONSTRAINT "suppliers_name_check" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "suppliers_state_code_check" CHECK ((("state_code" IS NULL) OR ("state_code" ~ '^[0-9]{2}$'::"text"))),
    CONSTRAINT "suppliers_supplier_code_check" CHECK (("btrim"("supplier_code") <> ''::"text"))
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


ALTER TABLE "public"."suppliers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."suppliers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bom_items"
    ADD CONSTRAINT "bom_items_bom_id_inventory_item_id_key" UNIQUE ("bom_id", "inventory_item_id");



ALTER TABLE ONLY "public"."bom_items"
    ADD CONSTRAINT "bom_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boms"
    ADD CONSTRAINT "boms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boms"
    ADD CONSTRAINT "boms_product_id_version_key" UNIQUE ("product_id", "version");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_gstin_key" UNIQUE ("gstin");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_note_counters"
    ADD CONSTRAINT "credit_note_counters_pkey" PRIMARY KEY ("financial_year");



ALTER TABLE ONLY "public"."credit_note_items"
    ADD CONSTRAINT "credit_note_items_credit_note_id_invoice_item_id_key" UNIQUE ("credit_note_id", "invoice_item_id");



ALTER TABLE ONLY "public"."credit_note_items"
    ADD CONSTRAINT "credit_note_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_credit_note_number_key" UNIQUE ("credit_note_number");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_invoice_id_key" UNIQUE ("invoice_id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_gstin_key" UNIQUE ("gstin");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dispatches"
    ADD CONSTRAINT "dispatches_invoice_id_key" UNIQUE ("invoice_id");



ALTER TABLE ONLY "public"."dispatches"
    ADD CONSTRAINT "dispatches_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."dispatches"
    ADD CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."invoice_counters"
    ADD CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("financial_year");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."production_consumption"
    ADD CONSTRAINT "production_consumption_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."production_consumption"
    ADD CONSTRAINT "production_consumption_production_run_id_inventory_item_id_key" UNIQUE ("production_run_id", "inventory_item_id");



ALTER TABLE ONLY "public"."production_runs"
    ADD CONSTRAINT "production_runs_batch_number_key" UNIQUE ("batch_number");



ALTER TABLE ONLY "public"."production_runs"
    ADD CONSTRAINT "production_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_purchase_id_inventory_item_id_key" UNIQUE ("purchase_id", "inventory_item_id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_supplier_invoice_unique" UNIQUE ("supplier_id", "invoice_number");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_order_id_product_id_key" UNIQUE ("order_id", "product_id");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_gstin_key" UNIQUE ("gstin");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_supplier_code_key" UNIQUE ("supplier_code");



CREATE INDEX "idx_audit_changed_at" ON "public"."audit_logs" USING "btree" ("changed_at");



CREATE INDEX "idx_audit_changed_by" ON "public"."audit_logs" USING "btree" ("changed_by");



CREATE INDEX "idx_audit_record" ON "public"."audit_logs" USING "btree" ("table_name", "record_id");



CREATE INDEX "idx_audit_table_date" ON "public"."audit_logs" USING "btree" ("table_name", "changed_at");



CREATE INDEX "idx_audit_user_date" ON "public"."audit_logs" USING "btree" ("changed_by", "changed_at");



CREATE INDEX "idx_credit_notes_date" ON "public"."credit_notes" USING "btree" ("credit_note_date");



CREATE INDEX "idx_invoice_items_product" ON "public"."invoice_items" USING "btree" ("product_id");



CREATE INDEX "idx_invoices_date" ON "public"."invoices" USING "btree" ("invoice_date");



CREATE INDEX "idx_invoices_status_date" ON "public"."invoices" USING "btree" ("status", "invoice_date");



CREATE INDEX "idx_order_items_product" ON "public"."sales_order_items" USING "btree" ("product_id");



CREATE INDEX "idx_orders_customer" ON "public"."sales_orders" USING "btree" ("customer_id");



CREATE INDEX "idx_orders_salesman_date" ON "public"."sales_orders" USING "btree" ("salesman_id", "order_date");



CREATE INDEX "idx_orders_status_date" ON "public"."sales_orders" USING "btree" ("status", "order_date");



CREATE INDEX "idx_payments_date" ON "public"."payments" USING "btree" ("payment_date");



CREATE INDEX "idx_payments_invoice" ON "public"."payments" USING "btree" ("invoice_id");



CREATE INDEX "idx_production_status_date" ON "public"."production_runs" USING "btree" ("status", "production_date");



CREATE INDEX "idx_purchases_status_date" ON "public"."purchases" USING "btree" ("status", "purchase_date");



CREATE INDEX "idx_purchases_supplier" ON "public"."purchases" USING "btree" ("supplier_id");



CREATE INDEX "idx_sales_orders_salesman_id" ON "public"."sales_orders" USING "btree" ("salesman_id");



CREATE INDEX "idx_stock_material_date" ON "public"."stock_movements" USING "btree" ("inventory_item_id", "movement_date");



CREATE INDEX "idx_stock_product_date" ON "public"."stock_movements" USING "btree" ("product_id", "movement_date");



CREATE INDEX "idx_stock_reference" ON "public"."stock_movements" USING "btree" ("reference_type", "reference_id");



CREATE INDEX "idx_suppliers_name" ON "public"."suppliers" USING "btree" ("name");



CREATE UNIQUE INDEX "inventory_sku_normalized_unique" ON "public"."inventory_items" USING "btree" ("upper"("btrim"("sku")));



CREATE UNIQUE INDEX "products_sku_normalized_unique" ON "public"."products" USING "btree" ("upper"("btrim"("sku")));



CREATE OR REPLACE VIEW "public"."gst_transaction_register" WITH ("security_invoker"='true') AS
 SELECT 'invoice'::"text" AS "document_type",
    "i"."invoice_number" AS "document_number",
    "i"."invoice_date" AS "document_date",
    "i"."invoice_number" AS "original_invoice_number",
    "i"."customer_name",
    "i"."customer_gstin",
    "i"."state_code",
        CASE
            WHEN ("i"."state_code" = '33'::"text") THEN 'intra_state'::"text"
            ELSE 'inter_state'::"text"
        END AS "supply_type",
    "ii"."gst_rate",
    "sum"("ii"."taxable_amount") AS "taxable_amount",
    "sum"("ii"."cgst_amount") AS "cgst_amount",
    "sum"("ii"."sgst_amount") AS "sgst_amount",
    "sum"("ii"."igst_amount") AS "igst_amount",
    "sum"("ii"."total_amount") AS "total_amount"
   FROM ("public"."invoices" "i"
     JOIN "public"."invoice_items" "ii" ON (("ii"."invoice_id" = "i"."id")))
  WHERE ("i"."status" = ANY (ARRAY['issued'::"text", 'cancelled'::"text"]))
  GROUP BY "i"."id", "ii"."gst_rate"
UNION ALL
 SELECT 'credit_note'::"text" AS "document_type",
    "cn"."credit_note_number" AS "document_number",
    "cn"."credit_note_date" AS "document_date",
    "i"."invoice_number" AS "original_invoice_number",
    "i"."customer_name",
    "i"."customer_gstin",
    "i"."state_code",
        CASE
            WHEN ("i"."state_code" = '33'::"text") THEN 'intra_state'::"text"
            ELSE 'inter_state'::"text"
        END AS "supply_type",
    "cni"."gst_rate",
    (- "sum"("cni"."taxable_amount")) AS "taxable_amount",
    (- "sum"("cni"."cgst_amount")) AS "cgst_amount",
    (- "sum"("cni"."sgst_amount")) AS "sgst_amount",
    (- "sum"("cni"."igst_amount")) AS "igst_amount",
    (- "sum"("cni"."total_amount")) AS "total_amount"
   FROM (("public"."credit_notes" "cn"
     JOIN "public"."invoices" "i" ON (("i"."id" = "cn"."invoice_id")))
     JOIN "public"."credit_note_items" "cni" ON ((("cni"."id" IS NOT NULL) AND ("cni"."credit_note_id" = "cn"."id"))))
  GROUP BY "cn"."id", "i"."id", "cni"."gst_rate";



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."bom_items" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."boms" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."company_settings" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."credit_note_items" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."credit_notes" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."dispatches" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."inventory_items" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."invoice_items" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."production_consumption" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."production_runs" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."purchase_items" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."purchases" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."sales_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."sales_orders" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."stock_movements" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_record_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "check_order_customer" BEFORE INSERT OR UPDATE OF "customer_id" ON "public"."sales_orders" FOR EACH ROW EXECUTE FUNCTION "public"."validate_order_customer"();



CREATE OR REPLACE TRIGGER "check_order_product" BEFORE INSERT OR UPDATE OF "product_id" ON "public"."sales_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."validate_order_product"();



CREATE OR REPLACE TRIGGER "check_production_bom" BEFORE INSERT OR UPDATE OF "bom_id" ON "public"."production_runs" FOR EACH ROW EXECUTE FUNCTION "public"."validate_production_bom"();



CREATE OR REPLACE TRIGGER "check_purchase_material" BEFORE INSERT OR UPDATE OF "inventory_item_id" ON "public"."purchase_items" FOR EACH ROW EXECUTE FUNCTION "public"."validate_purchase_material"();



CREATE OR REPLACE TRIGGER "company_settings_timestamp" BEFORE UPDATE ON "public"."company_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_company_timestamp"();



CREATE OR REPLACE TRIGGER "invoice_company_snapshot" BEFORE INSERT ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."capture_invoice_company"();



CREATE OR REPLACE TRIGGER "protect_bom_history" BEFORE DELETE OR UPDATE ON "public"."boms" FOR EACH ROW EXECUTE FUNCTION "public"."protect_used_bom"();



CREATE OR REPLACE TRIGGER "protect_bom_item_history" BEFORE INSERT OR DELETE OR UPDATE ON "public"."bom_items" FOR EACH ROW EXECUTE FUNCTION "public"."protect_used_bom_items"();



CREATE OR REPLACE TRIGGER "protect_inventory_unit_history" BEFORE UPDATE ON "public"."inventory_items" FOR EACH ROW EXECUTE FUNCTION "public"."protect_inventory_unit"();



ALTER TABLE ONLY "public"."bom_items"
    ADD CONSTRAINT "bom_items_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "public"."boms"("id");



ALTER TABLE ONLY "public"."bom_items"
    ADD CONSTRAINT "bom_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."boms"
    ADD CONSTRAINT "boms_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."credit_note_items"
    ADD CONSTRAINT "credit_note_items_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id");



ALTER TABLE ONLY "public"."credit_note_items"
    ADD CONSTRAINT "credit_note_items_invoice_item_id_fkey" FOREIGN KEY ("invoice_item_id") REFERENCES "public"."invoice_items"("id");



ALTER TABLE ONLY "public"."credit_note_items"
    ADD CONSTRAINT "credit_note_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."dispatches"
    ADD CONSTRAINT "dispatches_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."dispatches"
    ADD CONSTRAINT "dispatches_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_reversed_by_fkey" FOREIGN KEY ("reversed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."production_consumption"
    ADD CONSTRAINT "production_consumption_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."production_consumption"
    ADD CONSTRAINT "production_consumption_production_run_id_fkey" FOREIGN KEY ("production_run_id") REFERENCES "public"."production_runs"("id");



ALTER TABLE ONLY "public"."production_runs"
    ADD CONSTRAINT "production_runs_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "public"."boms"("id");



ALTER TABLE ONLY "public"."production_runs"
    ADD CONSTRAINT "production_runs_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_salesman_id_fkey" FOREIGN KEY ("salesman_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_read" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text", 'owner'::"text"]));



ALTER TABLE "public"."bom_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bom_items_insert" ON "public"."bom_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'production'::"text"]));



CREATE POLICY "bom_items_read" ON "public"."bom_items" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'production'::"text", 'accountant'::"text", 'owner'::"text"]));



CREATE POLICY "bom_items_update" ON "public"."bom_items" FOR UPDATE TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'production'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'production'::"text"]));



ALTER TABLE "public"."boms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "boms_insert" ON "public"."boms" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'production'::"text"]));



CREATE POLICY "boms_read" ON "public"."boms" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'production'::"text", 'accountant'::"text", 'owner'::"text"]));



CREATE POLICY "boms_update" ON "public"."boms" FOR UPDATE TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'production'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'production'::"text"]));



ALTER TABLE "public"."company_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_settings_read" ON "public"."company_settings" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'salesman'::"text", 'accountant'::"text", 'owner'::"text"]));



CREATE POLICY "company_settings_update" ON "public"."company_settings" FOR UPDATE TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text"]));



ALTER TABLE "public"."credit_note_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_note_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_note_items_read" ON "public"."credit_note_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."credit_notes" "cn"
  WHERE ("cn"."id" = "credit_note_items"."credit_note_id"))));



ALTER TABLE "public"."credit_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_notes_read" ON "public"."credit_notes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE ("i"."id" = "credit_notes"."invoice_id"))));



ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customers_insert" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"(ARRAY['admin'::"text"]));



CREATE POLICY "customers_read" ON "public"."customers" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'salesman'::"text", 'accountant'::"text", 'owner'::"text"]));



CREATE POLICY "customers_update" ON "public"."customers" FOR UPDATE TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text"]));



ALTER TABLE "public"."dispatches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dispatches_read" ON "public"."dispatches" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sales_orders" "so"
  WHERE ("so"."id" = "dispatches"."order_id"))));



ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_items_insert" ON "public"."inventory_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"(ARRAY['admin'::"text"]));



CREATE POLICY "inventory_items_read" ON "public"."inventory_items" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'production'::"text", 'accountant'::"text", 'owner'::"text"]));



CREATE POLICY "inventory_items_update" ON "public"."inventory_items" FOR UPDATE TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text"]));



ALTER TABLE "public"."invoice_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_items_read" ON "public"."invoice_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE ("i"."id" = "invoice_items"."invoice_id"))));



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_read" ON "public"."invoices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sales_orders" "so"
  WHERE ("so"."id" = "invoices"."order_id"))));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_read" ON "public"."payments" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text", 'owner'::"text"]));



ALTER TABLE "public"."production_consumption" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "production_consumption_read" ON "public"."production_consumption" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."production_runs" "pr"
  WHERE ("pr"."id" = "production_consumption"."production_run_id"))));



ALTER TABLE "public"."production_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "production_runs_read" ON "public"."production_runs" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'production'::"text", 'accountant'::"text", 'owner'::"text"]));



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_insert" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"(ARRAY['admin'::"text"]));



CREATE POLICY "products_read" ON "public"."products" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'salesman'::"text", 'production'::"text", 'accountant'::"text", 'owner'::"text"]));



CREATE POLICY "products_update" ON "public"."products" FOR UPDATE TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text"]));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchase_items_read" ON "public"."purchase_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."purchases" "p"
  WHERE ("p"."id" = "purchase_items"."purchase_id"))));



ALTER TABLE "public"."purchases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchases_read" ON "public"."purchases" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'production'::"text", 'accountant'::"text", 'owner'::"text"]));



ALTER TABLE "public"."sales_order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_order_items_read" ON "public"."sales_order_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sales_orders" "so"
  WHERE ("so"."id" = "sales_order_items"."order_id"))));



ALTER TABLE "public"."sales_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_orders_read" ON "public"."sales_orders" FOR SELECT TO "authenticated" USING (("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text", 'owner'::"text"]) OR ("public"."has_role"(ARRAY['salesman'::"text"]) AND ("salesman_id" = "auth"."uid"()))));



ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_movements_read" ON "public"."stock_movements" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'production'::"text", 'accountant'::"text", 'owner'::"text"]));



ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suppliers_insert" ON "public"."suppliers" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



CREATE POLICY "suppliers_read" ON "public"."suppliers" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text", 'production'::"text", 'owner'::"text"]));



CREATE POLICY "suppliers_update" ON "public"."suppliers" FOR UPDATE TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_order"("p_order_id" bigint) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."capture_invoice_company"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."convert_quantity"("p_quantity" numeric, "p_from_unit" "text", "p_to_unit" "text", "p_packets_per_carton" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."convert_quantity"("p_quantity" numeric, "p_from_unit" "text", "p_to_unit" "text", "p_packets_per_carton" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."current_user_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."customer_sales_report"("p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."customer_sales_report"("p_start_date" "date", "p_end_date" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."dispatch_order"("p_order_id" bigint) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."generate_invoice"("p_order_id" bigint) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."gst_summary_report"("p_start_date" "date", "p_end_date" "date") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."has_role"("allowed_roles" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("allowed_roles" "text"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."log_record_change"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."post_production"("p_run_id" bigint) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."post_purchase"("p_purchase_id" bigint) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."product_sales_report"("p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_sales_report"("p_start_date" "date", "p_end_date" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."protect_inventory_unit"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."protect_used_bom"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."protect_used_bom_items"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."record_payment"("p_invoice_id" bigint, "p_amount" numeric, "p_method" "text", "p_reference" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."secure_adjust_stock"("p_quantity" numeric, "p_reason" "text", "p_inventory_item_id" bigint, "p_product_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_adjust_stock"("p_quantity" numeric, "p_reason" "text", "p_inventory_item_id" bigint, "p_product_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_approve_order"("p_order_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_approve_order"("p_order_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_cancel_production"("p_run_id" bigint, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_cancel_production"("p_run_id" bigint, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_cancel_purchase"("p_purchase_id" bigint, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_cancel_purchase"("p_purchase_id" bigint, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_close_order"("p_order_id" bigint, "p_action" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_close_order"("p_order_id" bigint, "p_action" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_create_bom_version"("p_bom_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_create_bom_version"("p_bom_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_dashboard"("p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_dashboard"("p_start_date" "date", "p_end_date" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_dispatch_order"("p_order_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_dispatch_order"("p_order_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_financial_report"("p_report" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_financial_report"("p_report" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_generate_invoice"("p_order_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_generate_invoice"("p_order_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_gst_register"("p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_gst_register"("p_start_date" "date", "p_end_date" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_gst_summary_report"("p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_gst_summary_report"("p_start_date" "date", "p_end_date" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_issue_credit_note"("p_invoice_id" bigint, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_issue_credit_note"("p_invoice_id" bigint, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_post_production"("p_run_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_post_production"("p_run_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_post_purchase"("p_purchase_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_post_purchase"("p_purchase_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_product_stock"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_product_stock"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_record_payment"("p_invoice_id" bigint, "p_amount" numeric, "p_method" "text", "p_reference" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_record_payment"("p_invoice_id" bigint, "p_amount" numeric, "p_method" "text", "p_reference" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_reopen_order"("p_order_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_reopen_order"("p_order_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_reorder_alerts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_reorder_alerts"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_reverse_payment"("p_payment_id" bigint, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_reverse_payment"("p_payment_id" bigint, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_reverse_production"("p_run_id" bigint, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_reverse_production"("p_run_id" bigint, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_reverse_purchase"("p_purchase_id" bigint, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_reverse_purchase"("p_purchase_id" bigint, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_save_bom"("p_product_id" bigint, "p_expected_output" integer, "p_items" "jsonb", "p_is_active" boolean, "p_bom_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_save_bom"("p_product_id" bigint, "p_expected_output" integer, "p_items" "jsonb", "p_is_active" boolean, "p_bom_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_save_order"("p_customer_id" bigint, "p_items" "jsonb", "p_order_id" bigint, "p_salesman_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_save_order"("p_customer_id" bigint, "p_items" "jsonb", "p_order_id" bigint, "p_salesman_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_save_production"("p_batch_number" "text", "p_bom_id" bigint, "p_production_date" "date", "p_planned_output" integer, "p_actual_output" integer, "p_damaged_pouches" integer, "p_labour_cost" numeric, "p_utility_cost" numeric, "p_items" "jsonb", "p_run_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_save_production"("p_batch_number" "text", "p_bom_id" bigint, "p_production_date" "date", "p_planned_output" integer, "p_actual_output" integer, "p_damaged_pouches" integer, "p_labour_cost" numeric, "p_utility_cost" numeric, "p_items" "jsonb", "p_run_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_save_purchase"("p_supplier_id" bigint, "p_invoice_number" "text", "p_purchase_date" "date", "p_items" "jsonb", "p_purchase_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_save_purchase"("p_supplier_id" bigint, "p_invoice_number" "text", "p_purchase_date" "date", "p_items" "jsonb", "p_purchase_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_set_bom_active"("p_bom_id" bigint, "p_is_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_set_bom_active"("p_bom_id" bigint, "p_is_active" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."secure_stock_period_report"("p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_stock_period_report"("p_start_date" "date", "p_end_date" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."stock_period_report"("p_start_date" "date", "p_end_date" "date") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."supplier_purchase_report"("p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."supplier_purchase_report"("p_start_date" "date", "p_end_date" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."validate_order_customer"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."validate_order_product"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."validate_production_bom"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."validate_purchase_material"() FROM PUBLIC;



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."audit_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."audit_logs" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bom_items" TO "service_role";
GRANT SELECT ON TABLE "public"."bom_items" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."boms" TO "service_role";
GRANT SELECT ON TABLE "public"."boms" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."company_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."company_settings" TO "authenticated";



GRANT UPDATE("company_name") ON TABLE "public"."company_settings" TO "authenticated";



GRANT UPDATE("gstin") ON TABLE "public"."company_settings" TO "authenticated";



GRANT UPDATE("address") ON TABLE "public"."company_settings" TO "authenticated";



GRANT UPDATE("city") ON TABLE "public"."company_settings" TO "authenticated";



GRANT UPDATE("pincode") ON TABLE "public"."company_settings" TO "authenticated";



GRANT UPDATE("phone") ON TABLE "public"."company_settings" TO "authenticated";



GRANT UPDATE("email") ON TABLE "public"."company_settings" TO "authenticated";



GRANT UPDATE("bank_name") ON TABLE "public"."company_settings" TO "authenticated";



GRANT UPDATE("bank_account_number") ON TABLE "public"."company_settings" TO "authenticated";



GRANT UPDATE("bank_ifsc") ON TABLE "public"."company_settings" TO "authenticated";



GRANT UPDATE("payment_terms_days") ON TABLE "public"."company_settings" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."credit_note_counters" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."credit_note_items" TO "service_role";
GRANT SELECT ON TABLE "public"."credit_note_items" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."credit_notes" TO "service_role";
GRANT SELECT ON TABLE "public"."credit_notes" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invoices" TO "service_role";
GRANT SELECT ON TABLE "public"."invoices" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."credit_note_register" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."customers" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."customers" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "service_role";
GRANT SELECT ON TABLE "public"."payments" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invoice_receivables" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."sales_orders" TO "service_role";
GRANT SELECT ON TABLE "public"."sales_orders" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."customer_outstanding_report" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dispatches" TO "service_role";
GRANT SELECT ON TABLE "public"."dispatches" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invoice_items" TO "service_role";
GRANT SELECT ON TABLE "public"."invoice_items" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."gst_outward_supplies" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."gst_transaction_register" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."inventory_items" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_items" TO "authenticated";



GRANT INSERT("name"),UPDATE("name") ON TABLE "public"."inventory_items" TO "authenticated";



GRANT INSERT("sku"),UPDATE("sku") ON TABLE "public"."inventory_items" TO "authenticated";



GRANT INSERT("category"),UPDATE("category") ON TABLE "public"."inventory_items" TO "authenticated";



GRANT INSERT("unit"),UPDATE("unit") ON TABLE "public"."inventory_items" TO "authenticated";



GRANT UPDATE("is_active") ON TABLE "public"."inventory_items" TO "authenticated";



GRANT UPDATE("reorder_level") ON TABLE "public"."inventory_items" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invoice_counters" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stock_movements" TO "service_role";
GRANT SELECT ON TABLE "public"."stock_movements" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."material_stock" TO "service_role";
GRANT SELECT ON TABLE "public"."material_stock" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payment_collection_report" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."products" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."products" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."sales_order_items" TO "service_role";
GRANT SELECT ON TABLE "public"."sales_order_items" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."product_stock" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."production_consumption" TO "service_role";
GRANT SELECT ON TABLE "public"."production_consumption" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."production_runs" TO "service_role";
GRANT SELECT ON TABLE "public"."production_runs" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."production_costing" TO "service_role";
GRANT SELECT ON TABLE "public"."production_costing" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."production_margin" TO "service_role";
GRANT SELECT ON TABLE "public"."production_margin" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."production_summary_report" TO "service_role";
GRANT SELECT ON TABLE "public"."production_summary_report" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."production_variance_report" TO "service_role";
GRANT SELECT ON TABLE "public"."production_variance_report" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."purchase_items" TO "service_role";
GRANT SELECT ON TABLE "public"."purchase_items" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."purchases" TO "service_role";
GRANT SELECT ON TABLE "public"."purchases" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."purchase_register" TO "service_role";
GRANT SELECT ON TABLE "public"."purchase_register" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."receivables_ageing" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reorder_alerts" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."sales_register" TO "service_role";
GRANT SELECT ON TABLE "public"."sales_register" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stock_ledger_report" TO "service_role";
GRANT SELECT ON TABLE "public"."stock_ledger_report" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."suppliers" TO "service_role";
GRANT SELECT ON TABLE "public"."suppliers" TO "authenticated";



GRANT INSERT("supplier_code"),UPDATE("supplier_code") ON TABLE "public"."suppliers" TO "authenticated";



GRANT INSERT("name"),UPDATE("name") ON TABLE "public"."suppliers" TO "authenticated";



GRANT INSERT("contact_person"),UPDATE("contact_person") ON TABLE "public"."suppliers" TO "authenticated";



GRANT INSERT("phone"),UPDATE("phone") ON TABLE "public"."suppliers" TO "authenticated";



GRANT INSERT("email"),UPDATE("email") ON TABLE "public"."suppliers" TO "authenticated";



GRANT INSERT("gstin"),UPDATE("gstin") ON TABLE "public"."suppliers" TO "authenticated";



GRANT INSERT("address"),UPDATE("address") ON TABLE "public"."suppliers" TO "authenticated";



GRANT INSERT("state"),UPDATE("state") ON TABLE "public"."suppliers" TO "authenticated";



GRANT INSERT("state_code"),UPDATE("state_code") ON TABLE "public"."suppliers" TO "authenticated";



GRANT INSERT("is_active"),UPDATE("is_active") ON TABLE "public"."suppliers" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";








-- Prevent client roles from truncating tables or creating triggers.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;
RESET ALL;
