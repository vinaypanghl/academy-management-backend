import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * CORS headers (used across all API responses)
 */
export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Get Supabase service client
 */
export function getSupabaseClient() {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !key) {
        throw new Error("Missing Supabase environment variables");
    }

    return createClient(url, key);
}

/**
 * Authenticate request via Authorization Bearer token
 */
export async function getAuthenticatedUser(req: Request) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) throw new Error("Invalid token format");

    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) throw new Error("Unauthorized: " + (error?.message || "invalid user"));

    return user;
}

/**
 * Generate unique sequential external ID (e.g. ACAD-2025-001)
 */
export async function generateSequentialExternalId(
    supabase: any,
    prefix: string,
    year: string,
    table: string,
    column: string
) {
    let index = 1;
    let external_id = "";
    let exists = true;

    while (exists) {
        external_id = `${prefix}-${year}-${String(index).padStart(3, "0")}`;
        const { data } = await supabase.from(table).select(column).eq(column, external_id).single();
        exists = !!data;
        if (exists) index++;
    }

    return external_id;
}

/**
 * Generate random + timestamped external ID (e.g. ACAD-2025-123-20251025143015987)
 */
export function generateExternalId(prefix: string, year: string): string {
    const randomPart = String(Math.floor(Math.random() * 900 + 100)); // 3-digit random number
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, ""); // compact ISO timestamp
    return `${prefix}-${year}-${randomPart}-${timestamp}`;
}

/**
 * Consistent success response
 */
export function success(data: any, status = 200) {
    return new Response(JSON.stringify({ success: true, ...data }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

/**
 * Consistent error response
 */
export function error(message: string, status = 400) {
    return new Response(JSON.stringify({ success: false, error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

/**
 * Unified API response handler — use across all endpoints for consistency
 */
export function onResponse(data: any, message?: string, code?: number, connection?: any) {
    if (connection) connection.release?.();

    const responseBody = {
        success: code && code >= 200 && code < 300,
        code: code || 200,
        message: message || "",
        data,
    };

    return new Response(JSON.stringify(responseBody), {
        status: responseBody.code,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

/**
 * Utility to convert base64 to Uint8Array (used for file uploads)
 */
export function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Validate phone number format
 */
export function isValidPhone(phone: string): boolean {
    const phoneRegex = /^[+]?[\d\s\-()]{10,15}$/;
    return phoneRegex.test(phone);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
