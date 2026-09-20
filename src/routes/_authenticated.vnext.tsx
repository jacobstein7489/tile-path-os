import { createFileRoute } from "@tanstack/react-router";
import { VNextShell } from "@/components/vnext/VNextShell";

export const Route = createFileRoute("/_authenticated/vnext")({ component: VNextShell });
