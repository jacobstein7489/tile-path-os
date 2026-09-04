import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/AppSidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  /**
   * Runs on EVERY navigation inside the app, so it must not hit the network.
   * getSession() reads the local session, and the role check is cached in the
   * query client instead of re-querying user_roles on each route switch.
   */
  beforeLoad: async ({ context }) => {
    const { data, error } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (error || !user) throw redirect({ to: "/auth" });

    const roles = await context.queryClient.ensureQueryData({
      queryKey: ["my-roles", user.id],
      staleTime: 5 * 60 * 1000,
      queryFn: async () => {
        const { data: rows, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        if (roleError) throw roleError;
        return (rows ?? []).map((r) => r.role);
      },
    });

    if (!roles.length) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }

    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen bg-canvas">
      <AppSidebar />
      <div className="min-w-0 pb-20 md:ml-[216px] md:pb-0">
        <Outlet />
      </div>
    </div>
  );
}

