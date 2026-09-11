import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ORBIT | NEI-ISEP",
    short_name: "ORBIT",
    description: "Internal Operating System",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#7cce00",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}