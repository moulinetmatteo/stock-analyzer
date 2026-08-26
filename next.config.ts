import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le dossier parent contient d'autres projets : on ancre Turbopack ici pour
  // qu'il n'aille pas chercher un lockfile en dehors du dépôt.
  turbopack: { root: __dirname },
};

export default nextConfig;
