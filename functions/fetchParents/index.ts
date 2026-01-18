// Edge function: /fetchParents
import { getSupabaseClient, success, error, getAuthenticatedUser } from "../_shared/utils.ts";
import { ROLES, TABLES } from "../_shared/constants.ts";

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }

    try {
        const supabase = getSupabaseClient();
        const authUser = await getAuthenticatedUser(req);

        const role = authUser.user_metadata?.role;
        const academyExternalId = authUser.user_metadata?.academy_id;

        if (![ROLES.ACADEMY, ROLES.ADMIN, ROLES.TEACHER].includes(role)) {
            return error("Unauthorized access");
        }

        // 🔹 Resolve academy UUID
        const { data: academy, error: academyError } = await supabase
            .from("academies")
            .select("id")
            .eq("academy_id", academyExternalId)
            .single();

        if (academyError || !academy) {
            return error("Academy not found");
        }

        /**
         * 🔹 Fetch parents via mapping table
         * parents → auth.users → parent_student_map
         */
        const { data, error: parentsError } = await supabase
            .from("parent_academy_map")
            .select(`
        parents (
          id,
          address,
          auth_user_id,
          parent_student_map (
            student_id,
            relationship
          )
        )
      `)
            .eq("academy_id", academy.id);

        if (parentsError) {
            return error(parentsError.message);
        }

        // 🔹 Enrich with auth.users data
        const parentAuthIds = data
            ?.map((row) => row.parents?.auth_user_id)
            .filter(Boolean);

        const { data: authUsers } = await supabase.auth.admin.listUsers();

        const authUserMap = new Map(
            authUsers.users.map((u) => [u.id, u])
        );

        const parents = data.map((row) => {
            const parent = row.parents;
            const auth = authUserMap.get(parent.auth_user_id);

            return {
                id: parent.id,
                display_name: auth?.user_metadata?.display_name || "",
                phone: auth?.phone || "",
                email: auth?.email || "",
                address: parent.address,
                parent_student_map: parent.parent_student_map || [],
            };
        });

        return success({ parents });
    } catch (err: any) {
        console.error("fetchParents error:", err);
        return error(err.message || "Internal server error", 500);
    }
});
