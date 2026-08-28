import { z } from "zod";

/**
 * Zod schema pour Track — validation stricte du catalogue
 */

export const TrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().min(1),
  cover: z.string().url().startsWith("https://"),
  preview_url: z.string().url().startsWith("https://"),
  popularity: z.number().int().min(0).max(100),
  release_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "release_date must be YYYY-MM-DD"),
  era: z.enum(["classic", "2000s", "2010s", "2020s"]),
  source: z.enum(["spotify", "itunes", "deezer"]),
});

export const CatalogSchema = z.array(TrackSchema).min(80);

export type TrackInput = z.input<typeof TrackSchema>;
export type TrackValidated = z.output<typeof TrackSchema>;
