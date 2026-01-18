import { getSupabaseClient, success, error, generateExternalId, getAuthenticatedUser } from "../_shared/utils.ts";
import { ROLES, TABLES } from "../_shared/constants.ts";

Deno.serve(async (req: Request) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }

    if (req.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
    }
    const url = new URL(req.url);
    const phone = url.searchParams.get('phone');
    if (!phone) {
        return new Response(JSON.stringify({ error: 'Missing phone param' }), { status: 400 });
    }
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from('parents')
        .select('id, display_name, phone, email, relationship')
        .ilike('phone', `%${phone}%`);  // partial match

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ parents: data }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
});