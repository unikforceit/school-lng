import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "School-InG · GNG GROUP",
    short_name: "School-InG",
    description: "Secure school operations, learning, communication, and analytics.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f3",
    theme_color: "#102039",
    icons: [
      { src: "/design/school-ing-logo.png", sizes: "any", type: "image/png" },
    ],
  };
}
