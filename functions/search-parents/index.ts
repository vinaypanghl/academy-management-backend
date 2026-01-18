import { getSupabaseClient } from "../_shared/utils.ts";

Deno.serve(async (req: Request) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }

    if (req.method !== "GET") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
            status: 405,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    }

    try {
        const url = new URL(req.url);
        const phoneParam = url.searchParams.get("phone")?.trim();

        // early return for empty or short phones
        if (!phoneParam || phoneParam.replace(/\D/g, '').length < 3) {
            return new Response(JSON.stringify({ success: true, parents: [], count: 0 }), {
                status: 200,
                headers: { "Access-Control-Allow-Origin": "*" },
            });
        }

        // normalize phone: remove all non-digits
        const normalizedPhone = phoneParam.replace(/\D/g, '');

        const supabase = getSupabaseClient();

        // search by normalized phone
        const { data, error } = await supabase
            .from("parents")
            .select("id, display_name, phone, email, address, relationship")
            .ilike("phone", `%${normalizedPhone}%`)
            .limit(10);

        if (error) {
            console.error("Search parents error:", error.message);
            return new Response(
                JSON.stringify({ success: false, error: "Failed to fetch parents" }),
                {
                    status: 500,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                parents: data || [],
                count: data?.length || 0,
            }),
            {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (err: any) {
        console.error("Unhandled error in search-parents:", err);
        return new Response(
            JSON.stringify({
                success: false,
                error: err?.message || "Internal Server Error",
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    }
});
