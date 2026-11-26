
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type CompanySettings =
  Database["public"]["Tables"]["company_settings"]["Row"];

export type CompanySettingsInput = Pick<
  CompanySettings,
  | "company_name"
  | "gstin"
  | "address"
  | "city"
  | "pincode"
  | "phone"
  | "email"
  | "bank_name"
  | "bank_account_number"
  | "bank_ifsc"
  | "payment_terms_days"
>;

export async function getCompanySettings():
  Promise<CompanySettings> {
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function saveCompanySettings(
  values: CompanySettingsInput
) {
  const { error } = await supabase
    .from("company_settings")
    .update({
      company_name: values.company_name,
      gstin: values.gstin,
      address: values.address,
      city: values.city,
      pincode: values.pincode,
      phone: values.phone,
      email: values.email,
      bank_name: values.bank_name,
      bank_account_number:
        values.bank_account_number,
      bank_ifsc: values.bank_ifsc,
      payment_terms_days:
        values.payment_terms_days,
    })
    .eq("id", 1)
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }
}
