import { getSupabaseClient, error, success } from '../_shared/utils.ts';
import { TABLES } from '../_shared/constants.ts';

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
        const { credential, password } = await req.json();
        if (!credential || !password) return error('Missing credential or password');

        const supabase = getSupabaseClient();

        // Query user by credential
        const search = credential.includes('@') ? { email: credential } : { phone: credential };

        let { data: user, error: userErr } = await supabase
            .from(TABLES.USERS)
            .select('*')
            .or(`email.eq.${credential},phone.eq.${credential}`)
            .single();

        if ((!user || user.role !== 'academy') && !credential.includes('@')) {
            const { data: otherUser } = await supabase
                .from(TABLES.USERS)
                .select('*')
                .eq('phone', credential)
                .neq('role', 'academy')
                .single();

            if (otherUser) user = otherUser;
        }

        if (!user) return error('User not found');

        let authRes;
        if (user.role === 'academy') {
            if (credential.includes('@')) {
                authRes = await supabase.auth.signInWithPassword({ email: user.email, password });
            } else {
                authRes = await supabase.auth.signInWithPassword({ phone: user.phone, password });
            }
        } else {
            authRes = await supabase.auth.signInWithPassword({ phone: user.phone, password });
        }

        if (authRes.error || !authRes.data?.user || !authRes.data?.session) {
            return error(authRes.error?.message || 'Invalid credentials');
        }

        return success({
            user: {
                id: user.id,
                role: user.role,
                display_name: user.display_name,
                email: user.email,
                phone: user.phone,
                academy_id: user.academy_id,
            },
            token: authRes.data.session.access_token,
            role: user.role,
        });
    } catch (e) {
        return error(e.message || 'Login failed', 400);
    }
});
