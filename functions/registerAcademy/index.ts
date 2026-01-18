import {
    getSupabaseClient,
    onResponse,
    generateExternalId,
    isValidPhone,
    isValidEmail,
} from "../_shared/utils.ts";
import { ROLES, TABLES } from "../_shared/constants.ts";

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return onResponse(null, "ok", 200);
    }

    try {
        const supabase = getSupabaseClient();
        const body = await req.json();

        const {
            academy_name,
            email,
            password,
            phone,
            address,
            city,
            state,
            country,
            pincode,
            website,
            logo_url,
        } = body;

        // Validate required fields
        if (!academy_name || !email || !password) {
            return onResponse(null, "Missing required fields: academy_name, email, password", 400);
        }
        if (!isValidPhone(phone)) {
            return onResponse(null, "Invalid email format", 400);
        }

        if (!isValidEmail(email)) {
            return onResponse(null, "Invalid email format", 400);
        }

        const year = new Date().getFullYear().toString();
        const academy_id = generateExternalId("ACAD", year);

        // 2️⃣ Create Supabase Auth user with metadata
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                role: ROLES.ACADEMY,
                display_name: academy_name,
                academy_id,
            },
        });

        if (authError || !authData.user) {
            console.error("Auth error:", authError);
            return onResponse(null, authError?.message || "Failed to create user", 400);
        }

        const user_id = authData.user.id;

        const { error: insertError } = await supabase.from(TABLES.ACADEMIES).insert([
            {
                academy_id,
                academy_name,
                address,
                city,
                state,
                country,
                pincode,
                website,
                logo_url,
                is_active: true,
                owner_user_id: user_id,
            },
        ]);

        if (insertError) {
            console.error("Insert error:", insertError);
            return onResponse(null, insertError.message, 400);
        }

        return onResponse(
            {
                academy_id,
                email,
                role: ROLES.ACADEMY,
            },
            "Academy registered successfully",
            201
        )
    } catch (err: any) {
        console.error("Unexpected error:", err);
        return onResponse(null, err.message || "Internal server error", 500);
    }
});
